import { jsonSchema, tool } from "ai";
import type { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import type { CloudinaryRef } from "@/lib/cloudinary-ref";
import { itemMdLink, pageMdLink } from "@/lib/sharry-tools";

function stringParam(description: string) {
	return { type: "string" as const, description };
}

function asItemId(id: string) {
	return id as Id<"items">;
}

const ITEM_ID_PARAM = stringParam(
	"Item ID (use when multiple items share the same name — from a previous disambiguation response)",
);

// Helper to resolve owned item — by direct ID or by name search
async function resolveOwned(
	convex: ConvexHttpClient,
	itemName: string,
	itemId?: string,
) {
	// Direct ID — fetch claims from Convex so approve/reject tools work.
	if (itemId) {
		const result = await convex.query(api.chat.resolveMyItemById, {
			itemId: asItemId(itemId),
		});
		if (!result)
			return {
				ok: false as const,
				error: "Could not find that item in your inventory.",
			};
		return {
			ok: true as const,
			itemId: asItemId(result.itemId),
			itemName: result.itemName,
			claims: result.claims,
		};
	}

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
		const descriptions = result.items
			.map(
				(i) =>
					`"${i.name}" (${i.category}${i.description ? `, ${i.description.slice(0, 60)}` : ""}) — ID: ${i.itemId}`,
			)
			.join("\n");
		return {
			ok: false as const,
			error: `Multiple items match "${itemName}":\n${descriptions}\nAsk the user which one they mean. You can use the item ID to target a specific one.`,
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

const IMAGE_INDICES_PARAM = {
	type: "array" as const,
	items: { type: "number" as const },
	description:
		"Which images to attach, by number (e.g. [1] or [2, 3]). Only include images relevant to this action.",
};

export function buildMutationTools(
	convex: ConvexHttpClient,
	locale: string,
	attachedImageRefs: CloudinaryRef[] = [],
) {
	// Resolve 1-based image indices to CloudinaryRefs
	function resolveImageRefs(indices?: number[]): CloudinaryRef[] | undefined {
		if (!indices || indices.length === 0) return undefined;
		const refs = indices
			.map((i) => attachedImageRefs[i - 1])
			.filter(Boolean)
			// Strip extra fields (e.g. context) — Convex expects only publicId + secureUrl
			.map(({ publicId, secureUrl }) => ({ publicId, secureUrl }));
		return refs.length > 0 ? refs : undefined;
	}
	return {
		createItem: tool({
			description:
				"Create a new item listing. Collect name, description, and category through conversation first. Note: location must be added via the app afterward. If the user shared relevant images, specify which ones with imageIndices.",
			inputSchema: jsonSchema<{
				name: string;
				description?: string;
				category?: string;
				imageIndices?: number[];
			}>({
				type: "object",
				properties: {
					name: stringParam("Item name"),
					description: stringParam("Item description"),
					category: stringParam(
						"Category: kitchen, furniture, electronics, clothing, books, sports, other",
					),
					imageIndices: IMAGE_INDICES_PARAM,
				},
				required: ["name"],
			}),
			needsApproval: true,
			execute: async ({ name, description, category, imageIndices }) => {
				try {
					const imageCloudinary = resolveImageRefs(imageIndices);
					await convex.mutation(api.items.create, {
						name,
						description,
						category: category as any,
						imageCloudinary,
					});
					// Resolve the new item to get its ID for a direct link
					const resolved = await convex.query(api.chat.resolveMyItem, {
						itemName: name,
					});
					const itemId = resolved?.found === true ? resolved.itemId : null;
					const photoNote = imageCloudinary
						? `${imageCloudinary.length} photo(s) attached.`
						: "No photos attached — add them in the app.";
					const link = itemId
						? itemMdLink("View your listing", itemId, locale)
						: pageMdLink("My Items", "my-items", locale);
					return {
						success: `Created "${name}". ${photoNote}`,
						nextStep: `Tell the user to add location if needed. Include this markdown link in your response: ${link}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not create item." };
				}
			},
		}),

		updateItem: tool({
			description:
				"Update an existing item's name, description, category, or photos. Resolves by item name or item ID. If the user shared relevant images, specify which ones with imageIndices to replace the item's photos.",
			inputSchema: jsonSchema<{
				itemName: string;
				itemId?: string;
				name?: string;
				description?: string;
				category?: string;
				imageIndices?: number[];
			}>({
				type: "object",
				properties: {
					itemName: stringParam("Current name of your item"),
					itemId: ITEM_ID_PARAM,
					name: stringParam("New name"),
					description: stringParam("New description"),
					category: stringParam("New category"),
					imageIndices: IMAGE_INDICES_PARAM,
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({
				itemName,
				itemId,
				name,
				description,
				category,
				imageIndices,
			}) => {
				try {
					const resolved = await resolveOwned(convex, itemName, itemId);
					if (!resolved.ok) return { error: resolved.error };
					const imageCloudinary = resolveImageRefs(imageIndices);
					await convex.mutation(api.items.update, {
						id: resolved.itemId,
						...(name && { name }),
						...(description && { description }),
						...(category && { category: category as any }),
						...(imageCloudinary && { imageCloudinary }),
					});
					const photoNote = imageCloudinary
						? ` Photos updated (${imageCloudinary.length}).`
						: "";
					return {
						success: `Updated "${resolved.itemName}".${photoNote}`,
						nextStep: `Include this markdown link in your response: ${itemMdLink("View item", resolved.itemId, locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not update item." };
				}
			},
		}),

		deleteItem: tool({
			description:
				"Permanently delete an item. HIGH RISK — cannot be undone. Use itemId when multiple items share the same name.",
			inputSchema: jsonSchema<{ itemName: string; itemId?: string }>({
				type: "object",
				properties: {
					itemName: stringParam("Name of your item to delete"),
					itemId: ITEM_ID_PARAM,
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName, itemId }) => {
				try {
					const resolved = await resolveOwned(convex, itemName, itemId);
					if (!resolved.ok) return { error: resolved.error };
					await convex.mutation(api.items.deleteItem, { id: resolved.itemId });
					return {
						success: `Deleted "${resolved.itemName}".`,
						nextStep: `Include this markdown link in your response: ${pageMdLink("My Items", "my-items", locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not delete item." };
				}
			},
		}),

		approveClaim: tool({
			description: "Approve a pending request on your item.",
			inputSchema: jsonSchema<{
				itemName: string;
				itemId?: string;
				claimerName?: string;
			}>({
				type: "object",
				properties: {
					itemName: stringParam("Name of your item"),
					itemId: ITEM_ID_PARAM,
					claimerName: stringParam("Name of the requester (to disambiguate)"),
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName, itemId, claimerName }) => {
				try {
					const resolved = await resolveOwned(convex, itemName, itemId);
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
						nextStep: `Include this markdown link in your response: ${itemMdLink("View item", resolved.itemId, locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not approve request." };
				}
			},
		}),

		rejectClaim: tool({
			description: "Reject a pending request on your item.",
			inputSchema: jsonSchema<{
				itemName: string;
				itemId?: string;
				claimerName?: string;
			}>({
				type: "object",
				properties: {
					itemName: stringParam("Name of your item"),
					itemId: ITEM_ID_PARAM,
					claimerName: stringParam("Name of the requester"),
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName, itemId, claimerName }) => {
				try {
					const resolved = await resolveOwned(convex, itemName, itemId);
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
						nextStep: `Include this markdown link in your response: ${itemMdLink("View item", resolved.itemId, locale)}`,
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
						nextStep: `Include this markdown link in your response: ${itemMdLink("View item", itemId, locale)}`,
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
						nextStep: `Include this markdown link in your response: ${itemMdLink("View item", resolved.itemId, locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not cancel request." };
				}
			},
		}),

		proposePickupWindow: tool({
			description: "Propose a 1-hour pickup time for an approved item.",
			inputSchema: jsonSchema<{
				itemName: string;
				itemId?: string;
				dateTime: string;
			}>({
				type: "object",
				properties: {
					itemName: stringParam("Item name"),
					itemId: ITEM_ID_PARAM,
					dateTime: stringParam(
						"Pickup time (ISO format, e.g., 2026-03-20T14:00)",
					),
				},
				required: ["itemName", "dateTime"],
			}),
			needsApproval: true,
			execute: async ({ itemName, itemId, dateTime }) => {
				try {
					const ts = parseDate(dateTime);
					if (!ts) return { error: "Could not parse date/time." };
					// Try as owner first, then as borrower
					const asOwner = await resolveOwned(convex, itemName, itemId);
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
						return {
							success: `Pickup proposed for ${dateTime}.`,
							nextStep: `Include this markdown link in your response: ${itemMdLink("View item", asOwner.itemId, locale)}`,
						};
					}
					const asBorrower = await resolveBorrowed(convex, itemName);
					if (asBorrower.ok) {
						await convex.mutation(api.items.proposePickupWindow, {
							itemId: asBorrower.itemId,
							claimId: asBorrower.claimId,
							windowStartAt: ts,
						});
						return {
							success: `Pickup proposed for ${dateTime}.`,
							nextStep: `Include this markdown link in your response: ${itemMdLink("View item", asBorrower.itemId, locale)}`,
						};
					}
					return { error: asOwner.error };
				} catch (e: any) {
					return { error: e.message ?? "Could not propose pickup." };
				}
			},
		}),

		approvePickupWindow: tool({
			description: "Approve a proposed pickup time.",
			inputSchema: jsonSchema<{ itemName: string; itemId?: string }>({
				type: "object",
				properties: {
					itemName: stringParam("Item name"),
					itemId: ITEM_ID_PARAM,
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName, itemId }) => {
				try {
					const asOwner = await resolveOwned(convex, itemName, itemId);
					if (asOwner.ok) {
						const approved = asOwner.claims.find(
							(c) => c.status === "approved",
						);
						if (!approved) return { error: "No approved claim found." };
						await convex.mutation(api.items.approvePickupWindow, {
							itemId: asOwner.itemId,
							claimId: approved.claimId,
						});
						return {
							success: "Pickup time approved.",
							nextStep: `Include this markdown link in your response: ${itemMdLink("View item", asOwner.itemId, locale)}`,
						};
					}
					const asBorrower = await resolveBorrowed(convex, itemName);
					if (asBorrower.ok) {
						await convex.mutation(api.items.approvePickupWindow, {
							itemId: asBorrower.itemId,
							claimId: asBorrower.claimId,
						});
						return {
							success: "Pickup time approved.",
							nextStep: `Include this markdown link in your response: ${itemMdLink("View item", asBorrower.itemId, locale)}`,
						};
					}
					return { error: asOwner.error };
				} catch (e: any) {
					return { error: e.message ?? "Could not approve pickup." };
				}
			},
		}),

		proposeReturnWindow: tool({
			description: "Propose a 1-hour return time.",
			inputSchema: jsonSchema<{
				itemName: string;
				itemId?: string;
				dateTime: string;
			}>({
				type: "object",
				properties: {
					itemName: stringParam("Item name"),
					itemId: ITEM_ID_PARAM,
					dateTime: stringParam("Return time (ISO format)"),
				},
				required: ["itemName", "dateTime"],
			}),
			needsApproval: true,
			execute: async ({ itemName, itemId, dateTime }) => {
				try {
					const ts = parseDate(dateTime);
					if (!ts) return { error: "Could not parse date/time." };
					const asOwner = await resolveOwned(convex, itemName, itemId);
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
						return {
							success: `Return proposed for ${dateTime}.`,
							nextStep: `Include this markdown link in your response: ${itemMdLink("View item", asOwner.itemId, locale)}`,
						};
					}
					const asBorrower = await resolveBorrowed(convex, itemName);
					if (asBorrower.ok) {
						await convex.mutation(api.items.proposeReturnWindow, {
							itemId: asBorrower.itemId,
							claimId: asBorrower.claimId,
							windowStartAt: ts,
						});
						return {
							success: `Return proposed for ${dateTime}.`,
							nextStep: `Include this markdown link in your response: ${itemMdLink("View item", asBorrower.itemId, locale)}`,
						};
					}
					return { error: asOwner.error };
				} catch (e: any) {
					return { error: e.message ?? "Could not propose return." };
				}
			},
		}),

		approveReturnWindow: tool({
			description: "Approve a proposed return time.",
			inputSchema: jsonSchema<{ itemName: string; itemId?: string }>({
				type: "object",
				properties: {
					itemName: stringParam("Item name"),
					itemId: ITEM_ID_PARAM,
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName, itemId }) => {
				try {
					const asOwner = await resolveOwned(convex, itemName, itemId);
					if (asOwner.ok) {
						const active = asOwner.claims.find(
							(c) => c.status === "approved" && c.pickedUpAt,
						);
						if (!active) return { error: "No active loan found." };
						await convex.mutation(api.items.approveReturnWindow, {
							itemId: asOwner.itemId,
							claimId: active.claimId,
						});
						return {
							success: "Return time approved.",
							nextStep: `Include this markdown link in your response: ${itemMdLink("View item", asOwner.itemId, locale)}`,
						};
					}
					const asBorrower = await resolveBorrowed(convex, itemName);
					if (asBorrower.ok) {
						await convex.mutation(api.items.approveReturnWindow, {
							itemId: asBorrower.itemId,
							claimId: asBorrower.claimId,
						});
						return {
							success: "Return time approved.",
							nextStep: `Include this markdown link in your response: ${itemMdLink("View item", asBorrower.itemId, locale)}`,
						};
					}
					return { error: asOwner.error };
				} catch (e: any) {
					return { error: e.message ?? "Could not approve return." };
				}
			},
		}),

		markPickedUp: tool({
			description: "Confirm an item has been picked up.",
			inputSchema: jsonSchema<{ itemName: string; itemId?: string }>({
				type: "object",
				properties: {
					itemName: stringParam("Item name"),
					itemId: ITEM_ID_PARAM,
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName, itemId }) => {
				try {
					const resolved = await resolveOwned(convex, itemName, itemId);
					if (!resolved.ok) return { error: resolved.error };
					const approved = resolved.claims.find(
						(c) => c.status === "approved" && !c.pickedUpAt,
					);
					if (!approved) return { error: "No approved claim awaiting pickup." };
					await convex.mutation(api.items.markPickedUp, {
						itemId: resolved.itemId,
						claimId: approved.claimId,
					});
					return {
						success: `Marked "${resolved.itemName}" as picked up.`,
						nextStep: `Include this markdown link in your response: ${itemMdLink("View item", resolved.itemId, locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not mark as picked up." };
				}
			},
		}),

		markReturned: tool({
			description: "Confirm an item has been returned.",
			inputSchema: jsonSchema<{ itemName: string; itemId?: string }>({
				type: "object",
				properties: {
					itemName: stringParam("Item name"),
					itemId: ITEM_ID_PARAM,
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName, itemId }) => {
				try {
					const resolved = await resolveOwned(convex, itemName, itemId);
					if (!resolved.ok) return { error: resolved.error };
					const active = resolved.claims.find(
						(c) => c.status === "approved" && c.pickedUpAt,
					);
					if (!active) return { error: "No active loan to return." };
					await convex.mutation(api.items.markReturned, {
						itemId: resolved.itemId,
						claimId: active.claimId,
					});
					return {
						success: `Marked "${resolved.itemName}" as returned.`,
						nextStep: `Include this markdown link in your response: ${itemMdLink("View item", resolved.itemId, locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not mark as returned." };
				}
			},
		}),

		markMissing: tool({
			description:
				"Report an item as lost/missing. HIGH RISK — cannot be undone.",
			inputSchema: jsonSchema<{
				itemName: string;
				itemId?: string;
				note?: string;
			}>({
				type: "object",
				properties: {
					itemName: stringParam("Item name"),
					itemId: ITEM_ID_PARAM,
					note: stringParam("Description of what happened"),
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName, itemId, note }) => {
				try {
					const resolved = await resolveOwned(convex, itemName, itemId);
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
					return {
						success: `Reported "${resolved.itemName}" as missing.`,
						nextStep: `Include this markdown link in your response: ${itemMdLink("View item", resolved.itemId, locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not report as missing." };
				}
			},
		}),

		createRating: tool({
			description:
				"Rate a completed transaction. Help the user compose their rating from vague input. If the user shared a relevant photo, specify which one with imageIndices.",
			inputSchema: jsonSchema<{
				claimId: string;
				stars: number;
				comment?: string;
				imageIndices?: number[];
			}>({
				type: "object",
				properties: {
					claimId: stringParam("Claim ID for the transaction"),
					stars: { type: "number" as any, description: "Rating 1-5 stars" },
					comment: stringParam("Review comment"),
					imageIndices: IMAGE_INDICES_PARAM,
				},
				required: ["claimId", "stars"],
			}),
			needsApproval: true,
			execute: async ({ claimId, stars, comment, imageIndices }) => {
				try {
					const photoCloudinary = resolveImageRefs(imageIndices);
					await convex.mutation(api.ratings.createRating, {
						claimId: claimId as Id<"claims">,
						stars,
						comment,
						photoCloudinary,
					});
					const photoNote = photoCloudinary ? " Photo attached." : "";
					return {
						success: `Submitted ${stars}-star rating.${photoNote}`,
						nextStep: `Include this markdown link in your response: ${pageMdLink("My Items", "my-items", locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not submit rating." };
				}
			},
		}),

		checkWishlist: tool({
			description:
				"Check existing wishlist items for duplicates before creating a new wish. ALWAYS call this AND browseItems before createWishlistItem. If a similar wish exists, tell the user to vote for it instead.",
			inputSchema: jsonSchema<{ query: string }>({
				type: "object",
				properties: {
					query: stringParam("What the user is looking for"),
				},
				required: ["query"],
			}),
			execute: async ({ query }) => {
				try {
					const existing = await convex.query(api.wishlist.list);
					return {
						existingWishes: existing.slice(0, 20).map((w: any) => ({
							wishId: w._id,
							text: w.text,
							votes: w.votes?.length ?? 0,
							isOwner: w.isOwner ?? false,
						})),
						instruction: `Review these existing wishes. If any are similar to "${query}" and the user does NOT own it (isOwner: false), tell them it already exists and offer to vote for it. If they OWN a similar wish (isOwner: true), tell them they already have that wish — don't suggest voting on your own wish. Only proceed with createWishlistItem if nothing similar exists.`,
					};
				} catch {
					return { error: "Could not check wishlist right now." };
				}
			},
		}),

		createWishlistItem: tool({
			description:
				"Add a wish for an item you'd like someone to share. IMPORTANT: ALWAYS call browseItems AND checkWishlist BEFORE this tool. Only create if no matching items or wishes exist. If the user shared a relevant image, specify which one with imageIndices.",
			inputSchema: jsonSchema<{
				text: string;
				imageIndices?: number[];
			}>({
				type: "object",
				properties: {
					text: stringParam("What you're looking for"),
					imageIndices: IMAGE_INDICES_PARAM,
				},
				required: ["text"],
			}),
			needsApproval: true,
			execute: async ({ text, imageIndices }) => {
				try {
					const imageCloudinary = resolveImageRefs(imageIndices);
					await convex.mutation(api.wishlist.create, {
						text,
						imageCloudinary,
					});
					const photoNote = imageCloudinary ? " Photo attached." : "";
					return {
						success: `Added to wishlist: "${text}".${photoNote} Neighbors can see it and might share!`,
						nextStep: `Include this markdown link in your response: ${pageMdLink("Wishlist", "wishlist", locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not add to wishlist." };
				}
			},
		}),

		voteWishlistItem: tool({
			description:
				"Vote (or unvote) on a wishlist item. Use when the user wants to upvote a wish. Call browseWishlist or checkWishlist first to get the wishId.",
			inputSchema: jsonSchema<{ wishId: string; wishText?: string }>({
				type: "object",
				properties: {
					wishId: stringParam("The wishlist item ID to vote on"),
					wishText: stringParam("The wish text (for confirmation)"),
				},
				required: ["wishId"],
			}),
			needsApproval: true,
			execute: async ({ wishId, wishText }) => {
				try {
					await convex.mutation(api.wishlist.toggleVote, {
						id: wishId as Id<"wishlist">,
					});
					return {
						success: `Vote toggled on "${wishText ?? "wish"}". Check the wishlist to see the updated count!`,
						nextStep: `Include this markdown link in your response: ${pageMdLink("Wishlist", "wishlist", locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not vote on this wish." };
				}
			},
		}),

		updateWishlistItem: tool({
			description:
				"Update a wish's text or image. Only the creator can update their own wish. Use browseWishlist or checkWishlist first to get the wishId. If the user shared a relevant image, specify which one with imageIndices.",
			inputSchema: jsonSchema<{
				wishId: string;
				text: string;
				imageIndices?: number[];
			}>({
				type: "object",
				properties: {
					wishId: stringParam("The wishlist item ID to update"),
					text: stringParam("Updated wish text"),
					imageIndices: IMAGE_INDICES_PARAM,
				},
				required: ["wishId", "text"],
			}),
			needsApproval: true,
			execute: async ({ wishId, text, imageIndices }) => {
				try {
					const imageCloudinary = resolveImageRefs(imageIndices);
					await convex.mutation(api.wishlist.update, {
						id: wishId as Id<"wishlist">,
						text,
						imageCloudinary,
					});
					const photoNote = imageCloudinary ? " Image updated." : "";
					return {
						success: `Updated wish: "${text}".${photoNote}`,
						nextStep: `Include this markdown link in your response: ${pageMdLink("Wishlist", "wishlist", locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not update this wish." };
				}
			},
		}),

		switchItemMode: tool({
			description:
				"Toggle an item between lending mode and giveaway mode. Giveaway items transfer permanently with no return. WARNING: may affect active claims.",
			inputSchema: jsonSchema<{
				itemName: string;
				itemId?: string;
				giveaway: boolean;
			}>({
				type: "object",
				properties: {
					itemName: stringParam("Name of your item"),
					itemId: ITEM_ID_PARAM,
					giveaway: {
						type: "boolean" as const,
						description: "true for giveaway, false for lending",
					},
				},
				required: ["itemName", "giveaway"],
			}),
			needsApproval: true,
			execute: async ({ itemName, itemId, giveaway }) => {
				try {
					const resolved = await resolveOwned(convex, itemName, itemId);
					if (!resolved.ok) return { error: resolved.error };
					await convex.mutation(api.items.switchItemMode, {
						id: resolved.itemId,
						giveaway,
					});
					const mode = giveaway ? "giveaway" : "lending";
					return {
						success: `Switched "${resolved.itemName}" to ${mode} mode.`,
						nextStep: `Include this markdown link in your response: ${itemMdLink("View item", resolved.itemId, locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not switch item mode." };
				}
			},
		}),

		blockDates: tool({
			description:
				"Block a date range on your calendar so no one can request your items during that period. Use when the owner is unavailable (e.g., traveling).",
			inputSchema: jsonSchema<{
				startDate: string;
				endDate: string;
				note?: string;
			}>({
				type: "object",
				properties: {
					startDate: stringParam("Start date (ISO format, e.g., 2026-04-01)"),
					endDate: stringParam("End date (ISO format, e.g., 2026-04-07)"),
					note: stringParam("Optional reason (e.g., traveling)"),
				},
				required: ["startDate", "endDate"],
			}),
			needsApproval: true,
			execute: async ({ startDate, endDate, note }) => {
				try {
					const start = parseDate(startDate);
					const end = parseDate(endDate);
					if (!start || !end)
						return {
							error: "Could not parse dates. Use format like '2026-04-01'.",
						};
					await convex.mutation(api.items.addOwnerUnavailabilityRange, {
						startDate: start,
						endDate: end,
						note,
					});
					return {
						success: `Blocked ${startDate} to ${endDate}.${note ? ` Reason: ${note}` : ""}`,
						nextStep: `Include this markdown link in your response: ${pageMdLink("My Items", "my-items", locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not block dates." };
				}
			},
		}),

		updateProfile: tool({
			description:
				"Update the user's profile. Can change name, bio, address, or contact methods (telegram, whatsapp, facebook, phone).",
			inputSchema: jsonSchema<{
				name?: string;
				bio?: string;
				address?: string;
				telegram?: string;
				whatsapp?: string;
				facebook?: string;
				phone?: string;
			}>({
				type: "object",
				properties: {
					name: stringParam("Display name"),
					bio: stringParam("Short bio (max 500 chars)"),
					address: stringParam("Area or address"),
					telegram: stringParam("Telegram username"),
					whatsapp: stringParam("WhatsApp number"),
					facebook: stringParam("Facebook profile"),
					phone: stringParam("Phone number"),
				},
			}),
			needsApproval: true,
			execute: async ({
				name,
				bio,
				address,
				telegram,
				whatsapp,
				facebook,
				phone,
			}) => {
				try {
					const hasContacts = telegram || whatsapp || facebook || phone;
					const contacts = hasContacts
						? {
								...(telegram && { telegram }),
								...(whatsapp && { whatsapp }),
								...(facebook && { facebook }),
								...(phone && { phone }),
							}
						: undefined;
					await convex.mutation(api.users.updateProfile, {
						...(name && { name }),
						...(bio && { bio }),
						...(address && { address }),
						...(contacts && { contacts }),
					});
					return {
						success: "Profile updated.",
						nextStep: `Include this markdown link in your response: ${pageMdLink("Profile", "profile", locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not update profile." };
				}
			},
		}),

		markAllNotificationsRead: tool({
			description:
				"Mark all notifications as read. Use when the user says they've seen their updates.",
			inputSchema: jsonSchema<Record<string, never>>({
				type: "object",
				properties: {},
			}),
			execute: async () => {
				try {
					await convex.mutation(api.notifications.markAllAsRead);
					return {
						success: "All notifications marked as read.",
						nextStep: `Include this markdown link in your response: ${pageMdLink("Notifications", "notifications", locale)}`,
					};
				} catch (e: any) {
					return {
						error: e.message ?? "Could not mark notifications as read.",
					};
				}
			},
		}),

		deleteWishlistItem: tool({
			description:
				"Delete a wish from the wishlist. Only the creator can delete their own wish. This cannot be undone.",
			inputSchema: jsonSchema<{ wishId: string; wishText?: string }>({
				type: "object",
				properties: {
					wishId: stringParam("The wishlist item ID to delete"),
					wishText: stringParam("The wish text (for confirmation)"),
				},
				required: ["wishId"],
			}),
			needsApproval: true,
			execute: async ({ wishId, wishText }) => {
				try {
					await convex.mutation(api.wishlist.deleteItem, {
						id: wishId as Id<"wishlist">,
					});
					return {
						success: `Deleted wish: "${wishText ?? "wish"}". It's been removed from the wishlist.`,
						nextStep: `Include this markdown link in your response: ${pageMdLink("Wishlist", "wishlist", locale)}`,
					};
				} catch (e: any) {
					return { error: e.message ?? "Could not delete this wish." };
				}
			},
		}),
	};
}
