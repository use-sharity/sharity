import { jsonSchema, tool } from "ai";
import type { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { buildMutationTools } from "@/lib/sharry-mutation-tools";
import type { CloudinaryRef } from "@/lib/cloudinary-ref";

// Helper: cast string to Convex Id (safe for ConvexHttpClient which accepts strings at runtime)
function asItemId(id: string) {
	return id as Id<"items">;
}

// Schema helpers using AI SDK's jsonSchema (avoids zod dependency)
const noParams = jsonSchema<Record<string, never>>({
	type: "object",
	properties: {},
});

function stringParam(description: string) {
	return { type: "string" as const, description };
}

export function buildTools(
	convex: ConvexHttpClient,
	locale: string,
	attachedImageRefs: CloudinaryRef[] = [],
) {
	return {
		getMyItems: tool({
			description:
				"List the user's own items with descriptions and categories. Use when the user asks about their listed items.",
			inputSchema: noParams,
			execute: async () => {
				try {
					const items = await convex.query(api.items.getMyItems);
					return items
						.filter((i) => i.isOwner)
						.map((i) => ({
							itemId: i._id,
							name: i.name,
							description: i.description ?? "",
							category: i.category ?? "other",
							mode: i.giveaway ? "giveaway" : "lending",
						}));
				} catch {
					return { error: "Could not fetch your items right now." };
				}
			},
		}),

		getMyBorrowedItems: tool({
			description:
				"List items the user is currently fostering, with owner name and return dates. Use when the user asks what they're borrowing.",
			inputSchema: noParams,
			execute: async () => {
				try {
					const items = await convex.query(api.items.getMyBorrowedItems);
					return items.map((i) => ({
						itemId: i._id,
						name: i.name,
						claimId: i.claim._id,
						ownerId: i.ownerId,
						ownerName: i.owner.name ?? "a neighbor",
						endDate: new Date(i.claim.endDate).toLocaleDateString(locale),
					}));
				} catch {
					return { error: "Could not fetch your borrowed items right now." };
				}
			},
		}),

		browseItems: tool({
			description:
				"Search available items from other neighbors. Filter by name/keyword and/or category. Use when the user wants to find something to borrow.",
			inputSchema: jsonSchema<{ query?: string; category?: string }>({
				type: "object",
				properties: {
					query: stringParam("Search term to match against item names"),
					category: stringParam(
						"Category: kitchen, furniture, electronics, clothing, books, sports, other",
					),
				},
			}),
			execute: async ({ query, category }) => {
				try {
					let items = await convex.query(api.items.get);
					if (query) {
						const q = query.toLowerCase();
						items = items.filter((i) => i.name.toLowerCase().includes(q));
					}
					if (category) {
						items = items.filter((i) => i.category === category);
					}
					return items.slice(0, 10).map((i) => ({
						id: i._id,
						name: i.name,
						description: i.description ?? "",
						category: i.category ?? "other",
						mode: i.giveaway ? "giveaway" : "lending",
						ward: i.location?.ward ?? null,
					}));
				} catch {
					return { error: "Could not search items right now." };
				}
			},
		}),

		getItemDetails: tool({
			description:
				"Get full details of a specific item by ID: description, category, owner name, location. Use after browseItems to learn more.",
			inputSchema: jsonSchema<{ itemId: string }>({
				type: "object",
				properties: {
					itemId: stringParam("The item ID from browseItems results"),
				},
				required: ["itemId"],
			}),
			execute: async ({ itemId }) => {
				try {
					const item = await convex.query(api.items.getById, {
						id: asItemId(itemId),
					});
					if (!item) return { error: "Item not found." };
					const ownerInfo = await convex.query(api.users.getBasicInfo, {
						userId: item.ownerId,
					});
					return {
						name: item.name,
						description: item.description ?? "",
						category: item.category ?? "other",
						mode: item.giveaway ? "giveaway" : "lending",
						ownerId: item.ownerId,
						ownerName: ownerInfo.name ?? "a neighbor",
						location: item.location?.address ?? null,
					};
				} catch {
					return { error: "Could not fetch item details right now." };
				}
			},
		}),

		getItemAvailability: tool({
			description:
				"Get the availability calendar for an item — which date ranges are booked vs free.",
			inputSchema: jsonSchema<{ itemId: string }>({
				type: "object",
				properties: { itemId: stringParam("The item ID") },
				required: ["itemId"],
			}),
			execute: async ({ itemId }) => {
				try {
					const ranges = await convex.query(api.items.getAvailability, {
						id: asItemId(itemId),
					});
					if (ranges.length === 0) return { available: "fully available" };
					return {
						bookedRanges: ranges.map((r) => ({
							from: new Date(r.startDate).toLocaleDateString(locale),
							to: new Date(r.endDate).toLocaleDateString(locale),
						})),
					};
				} catch {
					return { error: "Could not fetch availability right now." };
				}
			},
		}),

		getClaimsOnItem: tool({
			description:
				"Look up who has requested or is fostering a specific item owned by the user. Takes an item name (partial match OK).",
			inputSchema: jsonSchema<{ itemName: string }>({
				type: "object",
				properties: { itemName: stringParam("Name of the user's item") },
				required: ["itemName"],
			}),
			execute: async ({ itemName }) => {
				try {
					const result = await convex.query(api.chat.getClaimsOnItem, {
						itemName,
					});
					if (!result) return { error: "Sign in to see your items." };
					if (result.found === false) {
						return {
							error: `No item matching "${itemName}". Your items: ${result.items.join(", ")}`,
						};
					}
					if (result.found === "multiple") {
						const descriptions = result.items
							.map(
								(i: any) =>
									`"${i.name}" (${i.category}${i.description ? `, ${i.description.slice(0, 60)}` : ""}) — ID: ${i.itemId}`,
							)
							.join("\n");
						return {
							clarify: `Multiple items match:\n${descriptions}\nWhich one?`,
						};
					}
					return {
						itemName: result.itemName,
						claims: result.claims.map((c) => ({
							claimerName: c.claimerName,
							claimerId: c.claimerId,
							status: c.status,
							startDate: new Date(c.startDate).toLocaleDateString(locale),
							endDate: new Date(c.endDate).toLocaleDateString(locale),
						})),
					};
				} catch {
					return { error: "Could not look up claims right now." };
				}
			},
		}),

		getUserProfile: tool({
			description:
				"Get public profile info, bio, contact methods, and rating summary for a user by their userId. ALWAYS call this before making claims about a user's profile, ratings, or activity level. Use the ownerId from getItemDetails or getMyBorrowedItems.",
			inputSchema: jsonSchema<{ userId: string }>({
				type: "object",
				properties: { userId: stringParam("The user ID to look up") },
				required: ["userId"],
			}),
			execute: async ({ userId }) => {
				try {
					const [profile, ratings] = await Promise.all([
						convex.query(api.users.getProfile, { userId }),
						convex.query(api.ratings.getRatingSummary, { userId }),
					]);
					if (!profile) {
						return { error: "This neighbor hasn't set up their profile yet." };
					}
					const contacts = profile.availableContacts;
					const contactMethods = Object.entries(contacts)
						.filter(([, v]) => v)
						.map(([k]) => k);
					return {
						name: profile.name ?? "Unknown",
						bio: profile.bio ?? "No bio yet",
						area: profile.address ?? "Not specified",
						contactMethods:
							contactMethods.length > 0
								? contactMethods.join(", ")
								: "None listed",
						memberSince: new Date(profile.createdAt).toLocaleDateString(locale),
						averageStars: ratings.averageStars,
						totalRatings: ratings.totalRatings,
					};
				} catch {
					return { error: "Could not fetch profile right now." };
				}
			},
		}),

		getNotifications: tool({
			description:
				"Get the user's recent notifications. Use when the user asks for updates or what's new.",
			inputSchema: noParams,
			execute: async () => {
				try {
					const notifs = await convex.query(api.notifications.get);
					return notifs.slice(0, 10).map((n) => ({
						type: n.type.replace(/_/g, " "),
						isRead: n.isRead,
						itemId: n.itemId,
						itemName: n.item?.name ?? null,
						createdAt: new Date(n.createdAt).toLocaleDateString(locale),
					}));
				} catch {
					return { error: "Could not fetch notifications right now." };
				}
			},
		}),

		browseWishlist: tool({
			description:
				"List wishlist items with vote counts. Use when the user asks what people are wishing for, or before voting on a wish.",
			inputSchema: noParams,
			execute: async () => {
				try {
					const wishes = await convex.query(api.wishlist.list);
					return wishes.slice(0, 20).map((w) => ({
						wishId: w._id,
						text: w.text,
						votes: w.votes?.length ?? 0,
						matchCount: w.matchCount ?? 0,
						isOwner: w.isOwner ?? false,
						isLiked: w.isLiked ?? false,
					}));
				} catch {
					return { error: "Could not fetch wishlist right now." };
				}
			},
		}),

		navigateTo: tool({
			description:
				"Generate a link to a page in the app. Use when the user wants to go somewhere.",
			inputSchema: jsonSchema<{ page: string; itemId?: string }>({
				type: "object",
				properties: {
					page: {
						type: "string",
						enum: [
							"home",
							"my-items",
							"profile",
							"wishlist",
							"notifications",
							"item-detail",
						],
						description: "The page to navigate to",
					},
					itemId: stringParam("Required for item-detail page"),
				},
				required: ["page"],
			}),
			execute: async ({ page, itemId }) => {
				const paths: Record<string, string> = {
					home: `/${locale}`,
					"my-items": `/${locale}/my-items`,
					profile: `/${locale}/profile`,
					wishlist: `/${locale}/wishlist`,
					notifications: `/${locale}/notifications`,
					"item-detail": `/${locale}/item/${itemId ?? ""}`,
				};
				return { url: paths[page] ?? `/${locale}` };
			},
		}),

		// Mutation tools
		...buildMutationTools(convex, locale, attachedImageRefs),
	};
}
