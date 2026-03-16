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
						success: `Created "${name}". Add photos and location at /${locale}/my-items for better visibility.`,
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

		approveClaim: tool({
			description: "Approve a pending request on your item.",
			inputSchema: jsonSchema<{ itemName: string; claimerName?: string }>({
				type: "object",
				properties: {
					itemName: stringParam("Name of your item"),
					claimerName: stringParam("Name of the requester (to disambiguate)"),
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName, claimerName }) => {
				try {
					const resolved = await resolveOwned(convex, itemName);
					if (!resolved.ok) return { error: resolved.error };
					const pending = resolved.claims.filter((c) => c.status === "pending");
					if (pending.length === 0)
						return { error: "No pending requests on this item." };
					let claim = pending[0];
					if (pending.length > 1 && claimerName) {
						const match = pending.find((c) =>
							c.claimerName.toLowerCase().includes(claimerName.toLowerCase()),
						);
						if (match) claim = match;
						else
							return {
								error: `No pending request from "${claimerName}". Pending: ${pending.map((c) => c.claimerName).join(", ")}`,
							};
					} else if (pending.length > 1) {
						return {
							error: `Multiple pending requests: ${pending.map((c) => `${c.claimerName} (${new Date(c.startDate).toLocaleDateString(locale)} - ${new Date(c.endDate).toLocaleDateString(locale)})`).join(", ")}. Which one?`,
						};
					}
					await convex.mutation(api.items.approveClaim, {
						claimId: claim.claimId,
						id: resolved.itemId,
					});
					return {
						success: `Approved ${claim.claimerName}'s request on "${resolved.itemName}".`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not approve request." };
				}
			},
		}),

		rejectClaim: tool({
			description: "Reject a pending request on your item.",
			inputSchema: jsonSchema<{ itemName: string; claimerName?: string }>({
				type: "object",
				properties: {
					itemName: stringParam("Name of your item"),
					claimerName: stringParam("Name of the requester"),
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName, claimerName }) => {
				try {
					const resolved = await resolveOwned(convex, itemName);
					if (!resolved.ok) return { error: resolved.error };
					const pending = resolved.claims.filter((c) => c.status === "pending");
					if (pending.length === 0)
						return { error: "No pending requests on this item." };
					let claim = pending[0];
					if (pending.length > 1 && claimerName) {
						const match = pending.find((c) =>
							c.claimerName.toLowerCase().includes(claimerName.toLowerCase()),
						);
						if (match) claim = match;
						else return { error: `No pending request from "${claimerName}".` };
					} else if (pending.length > 1) {
						return {
							error: `Multiple pending requests. Which one? ${pending.map((c) => c.claimerName).join(", ")}`,
						};
					}
					await convex.mutation(api.items.rejectClaim, {
						claimId: claim.claimId,
						id: resolved.itemId,
					});
					return {
						success: `Rejected ${claim.claimerName}'s request on "${resolved.itemName}".`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not reject request." };
				}
			},
		}),

		requestItem: tool({
			description:
				"Request to borrow an item. Needs item ID (from browseItems) and dates.",
			inputSchema: jsonSchema<{
				itemId: string;
				startDate: string;
				endDate: string;
			}>({
				type: "object",
				properties: {
					itemId: stringParam("Item ID from browseItems results"),
					startDate: stringParam("Start date (ISO format, e.g., 2026-03-20)"),
					endDate: stringParam("End date (ISO format, e.g., 2026-03-25)"),
				},
				required: ["itemId", "startDate", "endDate"],
			}),
			needsApproval: true,
			execute: async ({ itemId, startDate, endDate }) => {
				try {
					const start = parseDate(startDate);
					const end = parseDate(endDate);
					if (!start || !end)
						return {
							error: "Could not parse dates. Use format like '2026-03-20'.",
						};
					await convex.mutation(api.items.requestItem, {
						id: asItemId(itemId),
						startDate: start,
						endDate: end,
					});
					return {
						success: `Request sent for ${startDate} to ${endDate}. The owner will be notified.`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not send request." };
				}
			},
		}),

		cancelMyClaim: tool({
			description: "Cancel your own pending request on a borrowed item.",
			inputSchema: jsonSchema<{ itemName: string }>({
				type: "object",
				properties: { itemName: stringParam("Name of the item you requested") },
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName }) => {
				try {
					const resolved = await resolveBorrowed(convex, itemName);
					if (!resolved.ok) return { error: resolved.error };
					await convex.mutation(api.items.cancelClaim, {
						claimId: resolved.claimId,
					});
					return {
						success: `Cancelled your request on "${resolved.itemName}".`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not cancel request." };
				}
			},
		}),

		proposePickupWindow: tool({
			description: "Propose a 1-hour pickup time for an approved item.",
			inputSchema: jsonSchema<{ itemName: string; dateTime: string }>({
				type: "object",
				properties: {
					itemName: stringParam("Item name"),
					dateTime: stringParam(
						"Pickup time (ISO format, e.g., 2026-03-20T14:00)",
					),
				},
				required: ["itemName", "dateTime"],
			}),
			needsApproval: true,
			execute: async ({ itemName, dateTime }) => {
				try {
					const ts = parseDate(dateTime);
					if (!ts) return { error: "Could not parse date/time." };
					// Try as owner first, then as borrower
					const asOwner = await resolveOwned(convex, itemName);
					if (asOwner.ok) {
						const approved = asOwner.claims.find(
							(c) => c.status === "approved",
						);
						if (!approved)
							return { error: "No approved claim to schedule pickup for." };
						await convex.mutation(api.items.proposePickupWindow, {
							itemId: asOwner.itemId,
							claimId: approved.claimId,
							windowStartAt: ts,
						});
						return { success: `Pickup proposed for ${dateTime}.` };
					}
					const asBorrower = await resolveBorrowed(convex, itemName);
					if (asBorrower.ok) {
						await convex.mutation(api.items.proposePickupWindow, {
							itemId: asBorrower.itemId,
							claimId: asBorrower.claimId,
							windowStartAt: ts,
						});
						return { success: `Pickup proposed for ${dateTime}.` };
					}
					return { error: asOwner.error };
				} catch (e: any) {
					return { error: e.message ?? "Could not propose pickup." };
				}
			},
		}),

		approvePickupWindow: tool({
			description: "Approve a proposed pickup time.",
			inputSchema: jsonSchema<{ itemName: string }>({
				type: "object",
				properties: { itemName: stringParam("Item name") },
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName }) => {
				try {
					const asOwner = await resolveOwned(convex, itemName);
					if (asOwner.ok) {
						const approved = asOwner.claims.find(
							(c) => c.status === "approved",
						);
						if (!approved) return { error: "No approved claim found." };
						await convex.mutation(api.items.approvePickupWindow, {
							itemId: asOwner.itemId,
							claimId: approved.claimId,
						});
						return { success: "Pickup time approved." };
					}
					const asBorrower = await resolveBorrowed(convex, itemName);
					if (asBorrower.ok) {
						await convex.mutation(api.items.approvePickupWindow, {
							itemId: asBorrower.itemId,
							claimId: asBorrower.claimId,
						});
						return { success: "Pickup time approved." };
					}
					return { error: asOwner.error };
				} catch (e: any) {
					return { error: e.message ?? "Could not approve pickup." };
				}
			},
		}),

		proposeReturnWindow: tool({
			description: "Propose a 1-hour return time.",
			inputSchema: jsonSchema<{ itemName: string; dateTime: string }>({
				type: "object",
				properties: {
					itemName: stringParam("Item name"),
					dateTime: stringParam("Return time (ISO format)"),
				},
				required: ["itemName", "dateTime"],
			}),
			needsApproval: true,
			execute: async ({ itemName, dateTime }) => {
				try {
					const ts = parseDate(dateTime);
					if (!ts) return { error: "Could not parse date/time." };
					const asOwner = await resolveOwned(convex, itemName);
					if (asOwner.ok) {
						const active = asOwner.claims.find(
							(c) => c.status === "approved" && c.pickedUpAt,
						);
						if (!active)
							return { error: "No active loan to schedule return for." };
						await convex.mutation(api.items.proposeReturnWindow, {
							itemId: asOwner.itemId,
							claimId: active.claimId,
							windowStartAt: ts,
						});
						return { success: `Return proposed for ${dateTime}.` };
					}
					const asBorrower = await resolveBorrowed(convex, itemName);
					if (asBorrower.ok) {
						await convex.mutation(api.items.proposeReturnWindow, {
							itemId: asBorrower.itemId,
							claimId: asBorrower.claimId,
							windowStartAt: ts,
						});
						return { success: `Return proposed for ${dateTime}.` };
					}
					return { error: asOwner.error };
				} catch (e: any) {
					return { error: e.message ?? "Could not propose return." };
				}
			},
		}),

		approveReturnWindow: tool({
			description: "Approve a proposed return time.",
			inputSchema: jsonSchema<{ itemName: string }>({
				type: "object",
				properties: { itemName: stringParam("Item name") },
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName }) => {
				try {
					const asOwner = await resolveOwned(convex, itemName);
					if (asOwner.ok) {
						const active = asOwner.claims.find(
							(c) => c.status === "approved" && c.pickedUpAt,
						);
						if (!active) return { error: "No active loan found." };
						await convex.mutation(api.items.approveReturnWindow, {
							itemId: asOwner.itemId,
							claimId: active.claimId,
						});
						return { success: "Return time approved." };
					}
					const asBorrower = await resolveBorrowed(convex, itemName);
					if (asBorrower.ok) {
						await convex.mutation(api.items.approveReturnWindow, {
							itemId: asBorrower.itemId,
							claimId: asBorrower.claimId,
						});
						return { success: "Return time approved." };
					}
					return { error: asOwner.error };
				} catch (e: any) {
					return { error: e.message ?? "Could not approve return." };
				}
			},
		}),

		markPickedUp: tool({
			description: "Confirm an item has been picked up.",
			inputSchema: jsonSchema<{ itemName: string }>({
				type: "object",
				properties: { itemName: stringParam("Item name") },
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName }) => {
				try {
					const resolved = await resolveOwned(convex, itemName);
					if (!resolved.ok) return { error: resolved.error };
					const approved = resolved.claims.find(
						(c) => c.status === "approved" && !c.pickedUpAt,
					);
					if (!approved) return { error: "No approved claim awaiting pickup." };
					await convex.mutation(api.items.markPickedUp, {
						itemId: resolved.itemId,
						claimId: approved.claimId,
					});
					return { success: `Marked "${resolved.itemName}" as picked up.` };
				} catch (e: any) {
					return { error: e.message ?? "Could not mark as picked up." };
				}
			},
		}),

		markReturned: tool({
			description: "Confirm an item has been returned.",
			inputSchema: jsonSchema<{ itemName: string }>({
				type: "object",
				properties: { itemName: stringParam("Item name") },
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName }) => {
				try {
					const resolved = await resolveOwned(convex, itemName);
					if (!resolved.ok) return { error: resolved.error };
					const active = resolved.claims.find(
						(c) => c.status === "approved" && c.pickedUpAt,
					);
					if (!active) return { error: "No active loan to return." };
					await convex.mutation(api.items.markReturned, {
						itemId: resolved.itemId,
						claimId: active.claimId,
					});
					return { success: `Marked "${resolved.itemName}" as returned.` };
				} catch (e: any) {
					return { error: e.message ?? "Could not mark as returned." };
				}
			},
		}),

		markMissing: tool({
			description:
				"Report an item as lost/missing. HIGH RISK — cannot be undone.",
			inputSchema: jsonSchema<{ itemName: string; note?: string }>({
				type: "object",
				properties: {
					itemName: stringParam("Item name"),
					note: stringParam("Description of what happened"),
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName, note }) => {
				try {
					const resolved = await resolveOwned(convex, itemName);
					if (!resolved.ok) return { error: resolved.error };
					const active = resolved.claims.find(
						(c) => c.status === "approved" && c.pickedUpAt,
					);
					if (!active) return { error: "No active loan to mark as missing." };
					await convex.mutation(api.items.markMissing, {
						itemId: resolved.itemId,
						claimId: active.claimId,
						note,
					});
					return { success: `Reported "${resolved.itemName}" as missing.` };
				} catch (e: any) {
					return { error: e.message ?? "Could not report as missing." };
				}
			},
		}),

		createRating: tool({
			description:
				"Rate a completed transaction. Help the user compose their rating from vague input.",
			inputSchema: jsonSchema<{
				claimId: string;
				stars: number;
				comment?: string;
			}>({
				type: "object",
				properties: {
					claimId: stringParam("Claim ID for the transaction"),
					stars: { type: "number" as any, description: "Rating 1-5 stars" },
					comment: stringParam("Review comment"),
				},
				required: ["claimId", "stars"],
			}),
			needsApproval: true,
			execute: async ({ claimId, stars, comment }) => {
				try {
					await convex.mutation(api.ratings.createRating, {
						claimId: claimId as Id<"claims">,
						stars,
						comment,
					});
					return { success: `Submitted ${stars}-star rating.` };
				} catch (e: any) {
					return { error: e.message ?? "Could not submit rating." };
				}
			},
		}),

		createWishlistItem: tool({
			description: "Add a wish for an item you'd like someone to share.",
			inputSchema: jsonSchema<{ text: string }>({
				type: "object",
				properties: { text: stringParam("What you're looking for") },
				required: ["text"],
			}),
			needsApproval: true,
			execute: async ({ text }) => {
				try {
					await convex.mutation(api.wishlist.create, { text });
					return {
						success: `Added to wishlist: "${text}". Neighbors can see it and might share!`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not add to wishlist." };
				}
			},
		}),
	};
}
