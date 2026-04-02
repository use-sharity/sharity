# Sharry Mutation Tools Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 16 mutation tools to Sharry with AI SDK `needsApproval` and client-side Approve/Deny buttons.

**Architecture:** Mutation tools defined in `lib/sharry-mutation-tools.ts` (separate from read-only tools). Resolution queries in `convex/chat.ts` resolve item names to IDs server-side. Client renders approval cards for `state === "approval-requested"` message parts.

**Tech Stack:** AI SDK v6 (`tool` + `needsApproval` + `jsonSchema`), `ConvexHttpClient`, Clerk auth

**Spec:** `docs/superpowers/specs/2026-03-16-sharry-mutation-tools-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `convex/chat.ts` | Modify | Add `resolveMyItem` and `resolveMyBorrowedItem` queries |
| `lib/sharry-mutation-tools.ts` | Create | 16 mutation tool definitions with `needsApproval: true` |
| `lib/sharry-tools.ts` | Modify | Import and merge mutation tools into `buildTools` |
| `lib/sharry-prompt.ts` | Modify | Add mutation guidance to system prompt |
| `components/chat-widget.tsx` | Modify | Render approval cards for tool-approval-request parts |
| `components/tool-approval-card.tsx` | Create | Approval card component (summary + buttons) |
| `evals/promptfooconfig.yaml` | Modify | Add mutation awareness test cases |

---

## Chunk 1: Resolution Queries

### Task 1: Add `resolveMyItem` query

**Files:**
- Modify: `convex/chat.ts`

- [ ] **Step 1: Add `resolveMyItem` query**

After the existing `getClaimsOnItem` query, add:

```typescript
export const resolveMyItem = query({
	args: { itemName: v.string() },
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		const userId = identity.subject;

		const myItems = await ctx.db
			.query("items")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();

		const q = args.itemName.toLowerCase();
		const matches = myItems.filter((i) =>
			i.name.toLowerCase().includes(q),
		);

		if (matches.length === 0) {
			return { found: false as const, items: myItems.map((i) => i.name) };
		}
		if (matches.length > 1) {
			return { found: "multiple" as const, items: matches.map((i) => i.name) };
		}

		const item = matches[0];
		const claims = await ctx.db
			.query("claims")
			.withIndex("by_item", (q2) => q2.eq("itemId", item._id))
			.collect();

		const enrichedClaims = await Promise.all(
			claims.map(async (c) => {
				const user = await ctx.db
					.query("users")
					.filter((q2) => q2.eq(q2.field("clerkId"), c.claimerId))
					.first();
				return {
					claimId: c._id,
					claimerName: user?.name ?? "a neighbor",
					claimerId: c.claimerId,
					status: c.status,
					startDate: c.startDate,
					endDate: c.endDate,
					pickedUpAt: c.pickedUpAt,
				};
			}),
		);

		return {
			found: true as const,
			itemId: item._id,
			itemName: item.name,
			claims: enrichedClaims,
		};
	},
});
```

- [ ] **Step 2: Verify Convex compiles**

Check `pnpm convex:dev` output — should show "Convex functions ready!"

- [ ] **Step 3: Commit**

```bash
git add convex/chat.ts
git commit -m "feat(chat): add resolveMyItem query for mutation tools"
```

---

### Task 2: Add `resolveMyBorrowedItem` query

**Files:**
- Modify: `convex/chat.ts`

- [ ] **Step 1: Add `resolveMyBorrowedItem` query**

```typescript
export const resolveMyBorrowedItem = query({
	args: { itemName: v.string() },
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		const userId = identity.subject;

		const myClaims = await ctx.db
			.query("claims")
			.withIndex("by_claimer", (q) => q.eq("claimerId", userId))
			.filter((q) =>
				q.or(
					q.eq(q.field("status"), "pending"),
					q.eq(q.field("status"), "approved"),
				),
			)
			.collect();

		const itemsWithClaims = await Promise.all(
			myClaims.map(async (c) => {
				const item = await ctx.db.get(c.itemId);
				if (!item) return null;
				const owner = await ctx.db
					.query("users")
					.filter((q) => q.eq(q.field("clerkId"), item.ownerId))
					.first();
				return {
					itemId: item._id,
					itemName: item.name,
					claimId: c._id,
					ownerName: owner?.name ?? "a neighbor",
					status: c.status,
				};
			}),
		);

		const valid = itemsWithClaims.filter((x) => x !== null);
		const q = args.itemName.toLowerCase();
		const matches = valid.filter((x) =>
			x.itemName.toLowerCase().includes(q),
		);

		if (matches.length === 0) {
			return { found: false as const, items: valid.map((x) => x.itemName) };
		}
		if (matches.length > 1) {
			return { found: "multiple" as const, items: matches.map((x) => x.itemName) };
		}

		return { found: true as const, ...matches[0] };
	},
});
```

- [ ] **Step 2: Verify Convex compiles**

- [ ] **Step 3: Commit**

```bash
git add convex/chat.ts
git commit -m "feat(chat): add resolveMyBorrowedItem query for mutation tools"
```

---

## Chunk 2: Mutation Tool Definitions

### Task 3: Create mutation tools module with item management tools

**Files:**
- Create: `lib/sharry-mutation-tools.ts`

- [ ] **Step 1: Create file with `buildMutationTools` factory and item management tools (createItem, updateItem, deleteItem)**

```typescript
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
	if (!result) return { ok: false as const, error: "Sign in to manage your items." };
	if (result.found === false) {
		return { ok: false as const, error: `No item matching "${itemName}". Your items: ${result.items.join(", ")}` };
	}
	if (result.found === "multiple") {
		return { ok: false as const, error: `Multiple items match: ${result.items.join(", ")}. Which one?` };
	}
	return { ok: true as const, itemId: result.itemId, itemName: result.itemName, claims: result.claims };
}

// Helper to resolve borrowed item name → { itemId, claimId }
async function resolveBorrowed(convex: ConvexHttpClient, itemName: string) {
	const result = await convex.query(api.chat.resolveMyBorrowedItem, { itemName });
	if (!result) return { ok: false as const, error: "Sign in to manage your items." };
	if (result.found === false) {
		return { ok: false as const, error: `No borrowed item matching "${itemName}". Your borrowed items: ${result.items.join(", ")}` };
	}
	if (result.found === "multiple") {
		return { ok: false as const, error: `Multiple items match: ${result.items.join(", ")}. Which one?` };
	}
	return { ok: true as const, itemId: result.itemId, claimId: result.claimId, itemName: result.itemName };
}

// Parse date string to epoch timestamp
function parseDate(dateStr: string): number | null {
	const date = new Date(dateStr);
	return isNaN(date.getTime()) ? null : date.getTime();
}

export function buildMutationTools(convex: ConvexHttpClient, locale: string) {
	return {
		createItem: tool({
			description: "Create a new item listing. Collect name, description, and category through conversation first. Note: photos and location must be added via the app afterward.",
			inputSchema: jsonSchema<{ name: string; description?: string; category?: string }>({
				type: "object",
				properties: {
					name: stringParam("Item name"),
					description: stringParam("Item description"),
					category: stringParam("Category: kitchen, furniture, electronics, clothing, books, sports, other"),
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
					return { success: `Created "${name}". Add photos and location through the app for better visibility.` };
				} catch (e: any) {
					return { error: e.message ?? "Could not create item." };
				}
			},
		}),

		updateItem: tool({
			description: "Update an existing item's name, description, or category. Resolves by item name.",
			inputSchema: jsonSchema<{ itemName: string; name?: string; description?: string; category?: string }>({
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
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add lib/sharry-mutation-tools.ts
git commit -m "feat(chat): add mutation tools module with item management tools"
```

---

### Task 4: Add claim management tools

**Files:**
- Modify: `lib/sharry-mutation-tools.ts`

- [ ] **Step 1: Add approveClaim, rejectClaim, requestItem, cancelMyClaim**

Add inside the `buildMutationTools` return object:

```typescript
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
			if (pending.length === 0) return { error: "No pending requests on this item." };
			let claim = pending[0];
			if (pending.length > 1 && claimerName) {
				const match = pending.find((c) =>
					c.claimerName.toLowerCase().includes(claimerName.toLowerCase()),
				);
				if (match) claim = match;
				else return { error: `No pending request from "${claimerName}". Pending: ${pending.map((c) => c.claimerName).join(", ")}` };
			} else if (pending.length > 1) {
				return { error: `Multiple pending requests: ${pending.map((c) => `${c.claimerName} (${new Date(c.startDate).toLocaleDateString(locale)} - ${new Date(c.endDate).toLocaleDateString(locale)})`).join(", ")}. Which one?` };
			}
			await convex.mutation(api.items.approveClaim, { claimId: claim.claimId, id: resolved.itemId });
			return { success: `Approved ${claim.claimerName}'s request on "${resolved.itemName}".` };
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
			if (pending.length === 0) return { error: "No pending requests on this item." };
			let claim = pending[0];
			if (pending.length > 1 && claimerName) {
				const match = pending.find((c) =>
					c.claimerName.toLowerCase().includes(claimerName.toLowerCase()),
				);
				if (match) claim = match;
				else return { error: `No pending request from "${claimerName}".` };
			} else if (pending.length > 1) {
				return { error: `Multiple pending requests. Which one? ${pending.map((c) => c.claimerName).join(", ")}` };
			}
			await convex.mutation(api.items.rejectClaim, { claimId: claim.claimId, id: resolved.itemId });
			return { success: `Rejected ${claim.claimerName}'s request on "${resolved.itemName}".` };
		} catch (e: any) {
			return { error: e.message ?? "Could not reject request." };
		}
	},
}),

requestItem: tool({
	description: "Request to borrow an item. Needs item ID (from browseItems) and dates.",
	inputSchema: jsonSchema<{ itemId: string; startDate: string; endDate: string }>({
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
			if (!start || !end) return { error: "Could not parse dates. Use format like '2026-03-20'." };
			await convex.mutation(api.items.requestItem, { id: asItemId(itemId), startDate: start, endDate: end });
			return { success: `Request sent for ${startDate} to ${endDate}. The owner will be notified.` };
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
			await convex.mutation(api.items.cancelClaim, { claimId: resolved.claimId });
			return { success: `Cancelled your request on "${resolved.itemName}".` };
		} catch (e: any) {
			return { error: e.message ?? "Could not cancel request." };
		}
	},
}),
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add lib/sharry-mutation-tools.ts
git commit -m "feat(chat): add claim management mutation tools"
```

---

### Task 5: Add pickup/return, rating, and wishlist tools

**Files:**
- Modify: `lib/sharry-mutation-tools.ts`

- [ ] **Step 1: Add remaining 8 tools**

Add inside the `buildMutationTools` return object:

```typescript
proposePickupWindow: tool({
	description: "Propose a 1-hour pickup time for an approved item.",
	inputSchema: jsonSchema<{ itemName: string; dateTime: string }>({
		type: "object",
		properties: {
			itemName: stringParam("Item name"),
			dateTime: stringParam("Pickup time (ISO format, e.g., 2026-03-20T14:00)"),
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
				const approved = asOwner.claims.find((c) => c.status === "approved");
				if (!approved) return { error: "No approved claim to schedule pickup for." };
				await convex.mutation(api.items.proposePickupWindow, { itemId: asOwner.itemId, claimId: approved.claimId, windowStartAt: ts });
				return { success: `Pickup proposed for ${dateTime}.` };
			}
			const asBorrower = await resolveBorrowed(convex, itemName);
			if (asBorrower.ok) {
				await convex.mutation(api.items.proposePickupWindow, { itemId: asBorrower.itemId, claimId: asBorrower.claimId, windowStartAt: ts });
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
				const approved = asOwner.claims.find((c) => c.status === "approved");
				if (!approved) return { error: "No approved claim found." };
				await convex.mutation(api.items.approvePickupWindow, { itemId: asOwner.itemId, claimId: approved.claimId });
				return { success: "Pickup time approved." };
			}
			const asBorrower = await resolveBorrowed(convex, itemName);
			if (asBorrower.ok) {
				await convex.mutation(api.items.approvePickupWindow, { itemId: asBorrower.itemId, claimId: asBorrower.claimId });
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
				const active = asOwner.claims.find((c) => c.status === "approved" && c.pickedUpAt);
				if (!active) return { error: "No active loan to schedule return for." };
				await convex.mutation(api.items.proposeReturnWindow, { itemId: asOwner.itemId, claimId: active.claimId, windowStartAt: ts });
				return { success: `Return proposed for ${dateTime}.` };
			}
			const asBorrower = await resolveBorrowed(convex, itemName);
			if (asBorrower.ok) {
				await convex.mutation(api.items.proposeReturnWindow, { itemId: asBorrower.itemId, claimId: asBorrower.claimId, windowStartAt: ts });
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
				const active = asOwner.claims.find((c) => c.status === "approved" && c.pickedUpAt);
				if (!active) return { error: "No active loan found." };
				await convex.mutation(api.items.approveReturnWindow, { itemId: asOwner.itemId, claimId: active.claimId });
				return { success: "Return time approved." };
			}
			const asBorrower = await resolveBorrowed(convex, itemName);
			if (asBorrower.ok) {
				await convex.mutation(api.items.approveReturnWindow, { itemId: asBorrower.itemId, claimId: asBorrower.claimId });
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
			const approved = resolved.claims.find((c) => c.status === "approved" && !c.pickedUpAt);
			if (!approved) return { error: "No approved claim awaiting pickup." };
			await convex.mutation(api.items.markPickedUp, { itemId: resolved.itemId, claimId: approved.claimId });
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
			const active = resolved.claims.find((c) => c.status === "approved" && c.pickedUpAt);
			if (!active) return { error: "No active loan to return." };
			await convex.mutation(api.items.markReturned, { itemId: resolved.itemId, claimId: active.claimId });
			return { success: `Marked "${resolved.itemName}" as returned.` };
		} catch (e: any) {
			return { error: e.message ?? "Could not mark as returned." };
		}
	},
}),

markMissing: tool({
	description: "Report an item as lost/missing. HIGH RISK — cannot be undone.",
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
			const active = resolved.claims.find((c) => c.status === "approved" && c.pickedUpAt);
			if (!active) return { error: "No active loan to mark as missing." };
			await convex.mutation(api.items.markMissing, { itemId: resolved.itemId, claimId: active.claimId, note });
			return { success: `Reported "${resolved.itemName}" as missing.` };
		} catch (e: any) {
			return { error: e.message ?? "Could not report as missing." };
		}
	},
}),

createRating: tool({
	description: "Rate a completed transaction. Help the user compose their rating from vague input.",
	inputSchema: jsonSchema<{ claimId: string; stars: number; comment?: string }>({
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
			return { success: `Added to wishlist: "${text}". Neighbors can see it and might share!` };
		} catch (e: any) {
			return { error: e.message ?? "Could not add to wishlist." };
		}
	},
}),
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add lib/sharry-mutation-tools.ts
git commit -m "feat(chat): add pickup/return, rating, and wishlist mutation tools"
```

---

### Task 6: Wire mutation tools into buildTools

**Files:**
- Modify: `lib/sharry-tools.ts`

- [ ] **Step 1: Import and merge mutation tools**

At the top of `lib/sharry-tools.ts`, add:

```typescript
import { buildMutationTools } from "@/lib/sharry-mutation-tools";
```

In `buildTools`, change the return to merge both:

```typescript
export function buildTools(convex: ConvexHttpClient, locale: string) {
	return {
		// ... existing read-only tools stay unchanged ...

		// Mutation tools
		...buildMutationTools(convex, locale),
	};
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add lib/sharry-tools.ts
git commit -m "feat(chat): wire mutation tools into buildTools"
```

---

## Chunk 3: Client-side Approval UI

### Task 7: Create tool approval card component

**Files:**
- Create: `components/tool-approval-card.tsx`

- [ ] **Step 1: Create the approval card component**

```typescript
"use client";

import { useState } from "react";

const HIGH_RISK_TOOLS = new Set(["deleteItem", "markMissing"]);

const TOOL_SUMMARIES: Record<string, (input: any) => string> = {
	createItem: (i) => `Create item "${i.name}"`,
	updateItem: (i) => `Update "${i.itemName}"`,
	deleteItem: (i) => `Delete "${i.itemName}" permanently`,
	approveClaim: (i) => `Approve request on "${i.itemName}"`,
	rejectClaim: (i) => `Reject request on "${i.itemName}"`,
	requestItem: (i) => `Request to borrow (${i.startDate} – ${i.endDate})`,
	cancelMyClaim: (i) => `Cancel your request on "${i.itemName}"`,
	proposePickupWindow: (i) => `Propose pickup: ${i.dateTime}`,
	approvePickupWindow: (i) => `Approve pickup for "${i.itemName}"`,
	proposeReturnWindow: (i) => `Propose return: ${i.dateTime}`,
	approveReturnWindow: (i) => `Approve return for "${i.itemName}"`,
	markPickedUp: (i) => `Confirm pickup of "${i.itemName}"`,
	markReturned: (i) => `Confirm return of "${i.itemName}"`,
	markMissing: (i) => `Report "${i.itemName}" as missing`,
	createRating: (i) => `Submit ${i.stars}-star rating`,
	createWishlistItem: (i) => `Add wish: "${i.text}"`,
};

interface ToolApprovalCardProps {
	toolName: string;
	input: unknown;
	approvalId: string;
	onApprove: (id: string) => void;
	onDeny: (id: string) => void;
}

export function ToolApprovalCard({
	toolName,
	input,
	approvalId,
	onApprove,
	onDeny,
}: ToolApprovalCardProps) {
	const [decided, setDecided] = useState<"approved" | "denied" | null>(null);

	const isHighRisk = HIGH_RISK_TOOLS.has(toolName);
	const summaryFn = TOOL_SUMMARIES[toolName];
	const summary = summaryFn ? summaryFn(input) : `Run ${toolName}`;

	if (decided) {
		return (
			<div
				className="rounded-lg px-3 py-2 text-xs"
				style={{ color: "#7A7570" }}
			>
				{decided === "approved" ? "✓ Approved" : "✗ Denied"}
			</div>
		);
	}

	return (
		<div
			className="my-2 rounded-lg border px-3 py-2"
			style={{ borderColor: "#E0D9CE", backgroundColor: "#FDFCFA" }}
		>
			<div className="mb-1 text-sm" style={{ color: "#1C1C1A" }}>
				{summary}
			</div>
			{isHighRisk && (
				<div className="mb-2 text-xs" style={{ color: "#B91C1C" }}>
					This cannot be undone
				</div>
			)}
			<div className="flex gap-2">
				<button
					type="button"
					onClick={() => {
						setDecided("approved");
						onApprove(approvalId);
					}}
					className="rounded-md px-3 py-1 text-xs font-medium"
					style={{
						backgroundColor: isHighRisk ? "#B91C1C" : "#2D4A35",
						color: "#F0EBE0",
					}}
				>
					{isHighRisk ? "Confirm" : "Approve"}
				</button>
				<button
					type="button"
					onClick={() => {
						setDecided("denied");
						onDeny(approvalId);
					}}
					className="rounded-md px-3 py-1 text-xs font-medium"
					style={{ backgroundColor: "#E0D9CE", color: "#1C1C1A" }}
				>
					{isHighRisk ? "Cancel" : "Deny"}
				</button>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add components/tool-approval-card.tsx
git commit -m "feat(chat): add tool approval card component"
```

---

### Task 8: Render approval cards in chat widget

**Files:**
- Modify: `components/chat-widget.tsx`

- [ ] **Step 1: Import approval card and `addToolApprovalResponse` from useChat**

Add imports:

```typescript
import { ToolApprovalCard } from "@/components/tool-approval-card";
```

Update the `useChat` destructuring to include `addToolApprovalResponse`:

```typescript
const { messages, sendMessage, status, error, addToolApprovalResponse } = useChat({ transport });
```

- [ ] **Step 2: Refactor message rendering to handle tool parts**

Replace the message content rendering inside the message map. Instead of just rendering text, iterate over `message.parts` and render both text and tool-approval parts:

```typescript
{message.parts?.map((part, idx) => {
	if (part.type === "text" && part.text) {
		return (
			<span key={idx}>
				{renderMessageContent(part.text)}
			</span>
		);
	}
	// Check for tool parts with approval-requested state
	if ("state" in part && part.state === "approval-requested" && "approval" in part) {
		const toolName = part.type.replace("tool-", "");
		return (
			<ToolApprovalCard
				key={idx}
				toolName={toolName}
				input={(part as any).input}
				approvalId={(part as any).approval.id}
				onApprove={(id) =>
					addToolApprovalResponse({ id, approved: true })
				}
				onDeny={(id) =>
					addToolApprovalResponse({ id, approved: false, reason: "User denied" })
				}
			/>
		);
	}
	return null;
})}
```

Keep the loading dots for when there are no renderable parts (empty text during streaming).

- [ ] **Step 3: Test in browser**

Ask Sharry "add my coffee grinder to Sharity". It should collect info through conversation, then show an approval card. Click Approve — item should be created.

- [ ] **Step 4: Commit**

```bash
git add components/chat-widget.tsx
git commit -m "feat(chat): render tool approval cards in chat messages"
```

---

## Chunk 4: Prompt + Evals + Testing

### Task 9: Update system prompt with mutation guidance

**Files:**
- Modify: `lib/sharry-prompt.ts`

- [ ] **Step 1: Add mutation guidance to `SHARRY_TOOL_GUIDANCE`**

Extend the existing constant with mutation-specific rules:

```typescript
export const SHARRY_TOOL_GUIDANCE = `## Using tools
You have tools to look up live data and take actions. Follow these rules:
- If you can answer from the user's current state above, do so. Only call a tool when you need more detail.
- When you get results from a tool, summarize them conversationally. Don't dump raw data.
- If a tool returns an error, tell the user you couldn't do that and suggest they check the app directly.
- If a tool returns a clarification (multiple matches), ask the user which one they meant.
- When you use navigateTo, include the URL naturally in your response so the user can tap it.
- Never mention photos or images — the chat cannot display them.
- Never mention tool names or that you're "calling a function." Just answer naturally.
- Remember: plain text only. No markdown, no bold (**), no bullet lists. Format like a text message.

## Taking actions
- You can take actions (approve requests, create items, etc.) on behalf of the user. Every action requires their approval via a button click.
- Before calling a mutation tool, summarize what you're about to do.
- For high-risk actions (delete item, mark missing), warn the user that this cannot be undone.
- For createRating, help compose the rating: ask what stars and how it went, then draft the text.
- For createItem, collect name, description, and category through conversation. Note: photos and location must be added via the app afterward.
- For requestItem, ask for dates if not specified. Check availability first.
- Never call multiple mutation tools in a single turn. One action at a time.
- Dates: use ISO format when calling tools (e.g., 2026-03-20).`;
```

- [ ] **Step 2: Update welcome message**

In `chat-widget.tsx`, update the welcome text to mention actions:

```
Hey 👋 I'm Sharry. I can help you find items, answer questions,
approve requests, or manage your listings. What's on your mind?
```

- [ ] **Step 3: Commit**

```bash
git add lib/sharry-prompt.ts components/chat-widget.tsx
git commit -m "feat(chat): update prompt and welcome message for mutation tools"
```

---

### Task 10: Add mutation eval test cases

**Files:**
- Modify: `evals/promptfooconfig.yaml`

- [ ] **Step 1: Add mutation awareness test cases**

```yaml
  # ── Mutation Awareness (4 cases) ──
  - vars:
      prompt: "can you approve the request on my tent?"
      userContext:
        stage: "has_pending_claims"
        itemCount: 2
        itemNames: ["The Yellow Tent", "Electric Drill"]
        activeBorrows: 0
        fosteringItemNames: []
        pendingClaimsOnMyItems: 1
        pendingMyRequests: 0
    assert:
      - type: llm-rubric
        value: "Response should offer to approve the pending request on the tent. Should indicate it can take this action."

  - vars:
      prompt: "I want to add my blender to Sharity"
      userContext:
        stage: "active_user"
        itemCount: 2
        itemNames: ["Tent", "Drill"]
        activeBorrows: 0
        fosteringItemNames: []
        pendingClaimsOnMyItems: 0
        pendingMyRequests: 0
    assert:
      - type: llm-rubric
        value: "Response should start collecting item details (ask about description, category) to create a new listing."

  - vars:
      prompt: "delete my drill"
      userContext:
        stage: "active_user"
        itemCount: 2
        itemNames: ["Tent", "Electric Drill"]
        activeBorrows: 0
        fosteringItemNames: []
        pendingClaimsOnMyItems: 0
        pendingMyRequests: 0
    assert:
      - type: llm-rubric
        value: "Response should warn that deletion is permanent and cannot be undone before proceeding."

  - vars:
      prompt: "how was fostering the blender? it was great honestly"
      userContext:
        stage: "active_user"
        itemCount: 1
        itemNames: ["Tent"]
        activeBorrows: 0
        fosteringItemNames: []
        pendingClaimsOnMyItems: 0
        pendingMyRequests: 0
    assert:
      - type: llm-rubric
        value: "Response should offer to help compose a rating based on the positive feedback."
```

- [ ] **Step 2: Run evals**

```bash
./scripts/run-evals.sh
```

- [ ] **Step 3: Commit**

```bash
git add evals/promptfooconfig.yaml
git commit -m "test(evals): add mutation awareness test cases"
```

---

### Task 11: Manual integration testing

- [ ] **Step 1: Test mutation tools end-to-end**

1. "Add my coffee grinder" → collects details → approval card → Approve → created
2. "Approve the request on my tent" → finds claim → approval card → Approve → approved
3. "Delete my drill" → warning about permanence → approval card (red) → Approve → deleted
4. "I want to borrow [item]" → asks dates → approval card → Approve → request sent
5. "Cancel my request on [item]" → approval card → Approve → cancelled
6. "Take me to my items" → tappable link (read-only tool, no approval needed)

- [ ] **Step 2: Test denial flow**

1. Ask to delete an item → click Deny → Sharry acknowledges
2. Ask to approve a claim → click Deny → Sharry acknowledges

- [ ] **Step 3: Test edge cases**

1. "Approve the request" with no pending claims → graceful error
2. "Delete my nonexistent item" → name resolution error
3. Multiple pending claims → asks which one
4. Logged out → "sign in first"

- [ ] **Step 4: Fix any issues and commit**

```bash
git add -A
git commit -m "fix(chat): address mutation integration test findings"
```
