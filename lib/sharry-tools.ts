import { tool } from "ai";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";

// Helper: cast string to Convex Id (safe for ConvexHttpClient which accepts strings at runtime)
function asId<T extends string>(id: string) {
	return id as unknown as Id<T>;
}

export function buildTools(convex: ConvexHttpClient, locale: string) {
	return {
		getMyItems: tool({
			description:
				"List the user's own items with descriptions and categories. Use when the user asks about their listed items.",
			parameters: z.object({}),
			execute: async () => {
				try {
					const items = await convex.query(api.items.getMyItems);
					return items
						.filter((i) => i.isOwner)
						.map((i) => ({
							name: i.name,
							description: i.description ?? "",
							category: i.category ?? "other",
						}));
				} catch {
					return { error: "Could not fetch your items right now." };
				}
			},
		}),

		getMyBorrowedItems: tool({
			description:
				"List items the user is currently fostering, with owner name and return dates. Use when the user asks what they're borrowing.",
			parameters: z.object({}),
			execute: async () => {
				try {
					const items = await convex.query(api.items.getMyBorrowedItems);
					return items.map((i) => ({
						name: i.name,
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
			parameters: z.object({
				query: z
					.string()
					.optional()
					.describe("Search term to match against item names"),
				category: z
					.string()
					.optional()
					.describe(
						"Category filter: kitchen, furniture, electronics, clothing, books, sports, other",
					),
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
					}));
				} catch {
					return { error: "Could not search items right now." };
				}
			},
		}),

		getItemDetails: tool({
			description:
				"Get full details of a specific item by ID: description, category, owner name, location. Use after browseItems to learn more.",
			parameters: z.object({
				itemId: z.string().describe("The item ID from browseItems results"),
			}),
			execute: async ({ itemId }) => {
				try {
					const item = await convex.query(api.items.getById, {
						id: asId<"items">(itemId),
					});
					if (!item) return { error: "Item not found." };
					const ownerInfo = await convex.query(api.users.getBasicInfo, {
						userId: item.ownerId,
					});
					return {
						name: item.name,
						description: item.description ?? "",
						category: item.category ?? "other",
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
			parameters: z.object({
				itemId: z.string().describe("The item ID"),
			}),
			execute: async ({ itemId }) => {
				try {
					const ranges = await convex.query(api.items.getAvailability, {
						id: asId<"items">(itemId),
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
			parameters: z.object({
				itemName: z.string().describe("Name of the user's item"),
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
						return {
							clarify: `Multiple items match: ${result.items.join(", ")}. Which one?`,
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
				"Get public profile info and rating summary for a user. Use when the user asks about someone.",
			parameters: z.object({
				userId: z.string().describe("The user ID to look up"),
			}),
			execute: async ({ userId }) => {
				try {
					const [profile, ratings] = await Promise.all([
						convex.query(api.users.getProfile, { userId }),
						convex.query(api.ratings.getRatingSummary, { userId }),
					]);
					return {
						name: profile?.name ?? "Unknown",
						bio: profile?.bio ?? "",
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
			parameters: z.object({}),
			execute: async () => {
				try {
					const notifs = await convex.query(api.notifications.get);
					return notifs.slice(0, 10).map((n) => ({
						type: n.type.replace(/_/g, " "),
						isRead: n.isRead,
						itemName: n.item?.name ?? null,
						createdAt: new Date(n.createdAt).toLocaleDateString(locale),
					}));
				} catch {
					return { error: "Could not fetch notifications right now." };
				}
			},
		}),

		navigateTo: tool({
			description:
				"Generate a link to a page in the app. Use when the user wants to go somewhere.",
			parameters: z.object({
				page: z
					.enum([
						"home",
						"my-items",
						"profile",
						"wishlist",
						"notifications",
						"item-detail",
					])
					.describe("The page to navigate to"),
				itemId: z.string().optional().describe("Required for item-detail page"),
			}),
			execute: async ({ page, itemId }) => {
				const paths: Record<string, string> = {
					home: `/${locale}`,
					"my-items": `/${locale}/my-items`,
					profile: `/${locale}/profile`,
					wishlist: `/${locale}/wishlist`,
					notifications: `/${locale}/notifications`,
					"item-detail": `/${locale}/items/${itemId ?? ""}`,
				};
				return { url: paths[page] ?? `/${locale}` };
			},
		}),
	};
}
