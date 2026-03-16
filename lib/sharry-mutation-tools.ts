import { jsonSchema, tool } from "ai";
import type { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";

function stringParam(description: string) {
	return { type: "string" as const, description };
}

function asItemId(id: string) {
	return id as Id<"items">;
}

// Helper to resolve owned item name → { itemId, claims }
async function resolveOwned(convex: ConvexHttpClient, itemName: string) {
	const result = await convex.query(api.chat.resolveMyItem, { itemName });
	if (!result)
		return { ok: false as const, error: "Sign in to manage your items." };
	if (result.found === false) {
		return {
			ok: false as const,
			error: `No item matching "${itemName}". Your items: ${result.items.join(", ")}`,
		};
	}
	if (result.found === "multiple") {
		return {
			ok: false as const,
			error: `Multiple items match: ${result.items.join(", ")}. Which one?`,
		};
	}
	return {
		ok: true as const,
		itemId: result.itemId,
		itemName: result.itemName,
		claims: result.claims,
	};
}

// Helper to resolve borrowed item name → { itemId, claimId }
async function resolveBorrowed(convex: ConvexHttpClient, itemName: string) {
	const result = await convex.query(api.chat.resolveMyBorrowedItem, {
		itemName,
	});
	if (!result)
		return { ok: false as const, error: "Sign in to manage your items." };
	if (result.found === false) {
		return {
			ok: false as const,
			error: `No borrowed item matching "${itemName}". Your borrowed items: ${result.items.join(", ")}`,
		};
	}
	if (result.found === "multiple") {
		return {
			ok: false as const,
			error: `Multiple items match: ${result.items.join(", ")}. Which one?`,
		};
	}
	return {
		ok: true as const,
		itemId: result.itemId,
		claimId: result.claimId,
		itemName: result.itemName,
	};
}

// Parse date string to epoch timestamp
function parseDate(dateStr: string): number | null {
	const date = new Date(dateStr);
	return isNaN(date.getTime()) ? null : date.getTime();
}

export function buildMutationTools(convex: ConvexHttpClient, locale: string) {
	return {
		createItem: tool({
			description:
				"Create a new item listing. Collect name, description, and category through conversation first. Note: photos and location must be added via the app afterward.",
			inputSchema: jsonSchema<{
				name: string;
				description?: string;
				category?: string;
			}>({
				type: "object",
				properties: {
					name: stringParam("Item name"),
					description: stringParam("Item description"),
					category: stringParam(
						"Category: kitchen, furniture, electronics, clothing, books, sports, other",
					),
				},
				required: ["name"],
			}),
			needsApproval: true,
			execute: async ({ name, description, category }) => {
				try {
					await convex.mutation(api.items.create, {
						name,
						description,
						category: category as any,
					});
					return {
						success: `Created "${name}". Add photos and location through the app for better visibility.`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not create item." };
				}
			},
		}),

		updateItem: tool({
			description:
				"Update an existing item's name, description, or category. Resolves by item name.",
			inputSchema: jsonSchema<{
				itemName: string;
				name?: string;
				description?: string;
				category?: string;
			}>({
				type: "object",
				properties: {
					itemName: stringParam("Current name of your item"),
					name: stringParam("New name"),
					description: stringParam("New description"),
					category: stringParam("New category"),
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName, name, description, category }) => {
				try {
					const resolved = await resolveOwned(convex, itemName);
					if (!resolved.ok) return { error: resolved.error };
					await convex.mutation(api.items.update, {
						id: resolved.itemId,
						...(name && { name }),
						...(description && { description }),
						...(category && { category: category as any }),
					});
					return { success: `Updated "${resolved.itemName}".` };
				} catch (e: any) {
					return { error: e.message ?? "Could not update item." };
				}
			},
		}),

		deleteItem: tool({
			description: "Permanently delete an item. HIGH RISK — cannot be undone.",
			inputSchema: jsonSchema<{ itemName: string }>({
				type: "object",
				properties: { itemName: stringParam("Name of your item to delete") },
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName }) => {
				try {
					const resolved = await resolveOwned(convex, itemName);
					if (!resolved.ok) return { error: resolved.error };
					await convex.mutation(api.items.deleteItem, { id: resolved.itemId });
					return { success: `Deleted "${resolved.itemName}".` };
				} catch (e: any) {
					return { error: e.message ?? "Could not delete item." };
				}
			},
		}),
	};
}
