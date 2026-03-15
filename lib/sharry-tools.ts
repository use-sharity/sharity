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
	};
}
