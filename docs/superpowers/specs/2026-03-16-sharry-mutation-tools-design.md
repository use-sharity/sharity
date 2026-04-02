# Sharry Mutation Tools — Design Spec

**Date:** 2026-03-16
**Status:** Approved
**Branch:** feat/sharry-ai-assistant
**Depends on:** `2026-03-15-sharry-tool-use-design.md` (read-only tools, already implemented)

## Problem

Sharry can look up data (items, claims, notifications) but can't take any actions. Users have to leave the chat and navigate to the right page to do things like approve a request, cancel a claim, or add an item. This breaks the conversational flow.

## Decision

Add 16 mutation tools to Sharry with AI SDK's native `needsApproval: true` for every mutation. The client renders Approve/Deny buttons — no action happens without an explicit click.

### Why `needsApproval` (Option C)?

- AI SDK v6 has built-in protocol support: `needsApproval` on the tool definition, `addToolApprovalResponse` on the client
- The SDK handles the pause/resume flow — we just render the buttons
- Safer than trusting the LLM to always ask for confirmation (Option A)
- Less custom work than building a bespoke approval UI from scratch (Option B)

## Architecture

Same as read-only tools — server-side execution via `streamText` + `ConvexHttpClient` with Clerk auth. The only difference: mutation tools set `needsApproval: true`.

**Important: the approval flow is multi-request, not a single stream.**

```
Request 1:
  User: "approve the request on my tent"
  → LLM calls getClaimsOnItem (read, no approval)
  → LLM sees pending claim from Dmitry, calls approveClaim (mutation, needsApproval)
  → SDK pauses, streams tool-approval-request part to client
  → Client renders: "Approve request from Dmitry (Mar 20-25)?" [Approve] [Deny]

Request 2 (triggered by user clicking Approve):
  → Client calls addToolApprovalResponse({ id: approval.id, approved: true })
  → DefaultChatTransport sends full message history + approval response to POST /api/chat
  → Route creates fresh ConvexHttpClient with auth token (from Authorization header)
  → streamText resumes: SDK executes approveClaim mutation
  → LLM formats confirmation: "Done — Dmitry's request is approved"
```

The `stopWhen: stepCountIs(4)` counter resets per request. The route handler needs NO changes for the approval round-trip — `convertToModelMessages` + `streamText` handles it.

Read-only tools remain unchanged (`needsApproval` absent/false).

## ID Resolution Strategy

Most Convex mutations require document IDs (`Id<"items">`, `Id<"claims">`), but users speak in names. The tool layer resolves names to IDs via dedicated Convex queries before calling mutations.

### New Convex queries in `convex/chat.ts`

**`chat.resolveMyItem(itemName: string)`**

Resolves an owned item by name. Used by: updateItem, deleteItem, approveClaim, rejectClaim, proposePickupWindow, approvePickupWindow, markPickedUp, markReturned, markMissing.

Returns:
```typescript
| null  // not authenticated
| { found: false; items: string[] }  // no match, list available names
| { found: "multiple"; items: string[] }  // ambiguous
| {
    found: true;
    itemId: Id<"items">;
    itemName: string;
    claims: Array<{
      claimId: Id<"claims">;
      claimerName: string;
      claimerId: string;
      status: string;
      startDate: number;
      endDate: number;
      pickedUpAt?: number;
    }>;
  }
```

**`chat.resolveMyBorrowedItem(itemName: string)`**

Resolves a borrowed item by name. Used by: cancelMyClaim, proposeReturnWindow, approveReturnWindow.

Returns:
```typescript
| null  // not authenticated
| { found: false; items: string[] }  // no match, list borrowed item names
| { found: "multiple"; items: string[] }  // ambiguous
| {
    found: true;
    itemId: Id<"items">;
    itemName: string;
    claimId: Id<"claims">;
    ownerName: string;
    status: string;
  }
```

These queries reuse the same pattern as `chat.getClaimsOnItem` — resolve name, fetch related data, return enriched result.

## Mutation Tools (16 total)

All tools use `inputSchema: jsonSchema<T>({...})` (matching existing read-only tools) and `needsApproval: true`.

### Item management

| Tool | LLM-facing args | Convex mutation | Notes |
|------|-----------------|-----------------|-------|
| `createItem` | name, description?, category? | `items.create({ name, description?, category? })` | No location or images via chat — user adds later via UI. Sharry warns about this. |
| `updateItem` | itemName, name?, description?, category? | `items.update({ id, ... })` | Resolves itemName → itemId via `chat.resolveMyItem` |
| `deleteItem` | itemName | `items.deleteItem({ id })` | **High risk.** Resolves via `chat.resolveMyItem` |

### Claim management (as owner)

| Tool | LLM-facing args | Convex mutation | Notes |
|------|-----------------|-----------------|-------|
| `approveClaim` | itemName, claimerName? | `items.approveClaim({ claimId, id })` | Resolves via `chat.resolveMyItem`, picks claim by claimer name match |
| `rejectClaim` | itemName, claimerName? | `items.rejectClaim({ claimId, id })` | Same resolution as approveClaim |

### Claim management (as borrower)

| Tool | LLM-facing args | Convex mutation | Notes |
|------|-----------------|-----------------|-------|
| `requestItem` | itemId, startDate, endDate | `items.requestItem({ id, startDate, endDate })` | itemId comes from browseItems/getItemDetails. Dates: LLM provides ISO strings, tool parses to epoch timestamps. |
| `cancelMyClaim` | itemName | `items.cancelClaim({ claimId })` | Resolves via `chat.resolveMyBorrowedItem` |

### Pickup/return flow

| Tool | LLM-facing args | Convex mutation | Notes |
|------|-----------------|-----------------|-------|
| `proposePickupWindow` | itemName, dateTime | `items.proposePickupWindow({ itemId, claimId, windowStartAt })` | Resolves via `chat.resolveMyItem` or `chat.resolveMyBorrowedItem` (either party can propose). LLM provides ISO datetime, tool parses to epoch. |
| `approvePickupWindow` | itemName | `items.approvePickupWindow({ itemId, claimId })` | Same resolution |
| `proposeReturnWindow` | itemName, dateTime | `items.proposeReturnWindow({ itemId, claimId, windowStartAt })` | Same |
| `approveReturnWindow` | itemName | `items.approveReturnWindow({ itemId, claimId })` | Same |
| `markPickedUp` | itemName | `items.markPickedUp({ itemId, claimId })` | Resolves via context, finds approved claim with pickup window |
| `markReturned` | itemName | `items.markReturned({ itemId, claimId })` | Same |
| `markMissing` | itemName, note? | `items.markMissing({ itemId, claimId, note? })` | **High risk.** |

### Social

| Tool | LLM-facing args | Convex mutation | Notes |
|------|-----------------|-----------------|-------|
| `createRating` | claimId, stars, comment? | `ratings.createRating({ claimId, stars, comment? })` | claimId comes from conversation context (Sharry already looked up claims). No photos via chat. |

### Wishlist

| Tool | LLM-facing args | Convex mutation | Notes |
|------|-----------------|-----------------|-------|
| `createWishlistItem` | text | `wishlist.create({ text })` | No images via chat. |

### Date handling

For `requestItem` and `proposePickupWindow`/`proposeReturnWindow`, the LLM produces human-readable dates ("March 20", "Saturday at 2pm"). The tool's `execute` function:
1. Parses the date string using `new Date(dateString)`
2. Validates the result is a valid date (`!isNaN(date.getTime())`)
3. If invalid, returns `{ error: "Could not parse that date. Try a format like 'March 20' or '2026-03-20'." }`
4. Converts to epoch: `date.getTime()`

### Error handling

All tool `execute` functions wrap Convex calls in try/catch. Convex mutation errors (e.g., "Cannot claim your own item", "Only approved claims can approve pickup time") are caught and returned as user-friendly `{ error: string }` messages, matching the read-only tool pattern.

## Client-side Approval UI

### Current state and required changes

The current `chat-widget.tsx` only renders `type === "text"` parts via `getMessageText`. Tool invocation parts (type `tool-${toolName}`) are silently dropped. This needs to change:

1. **Iterate all message parts**, not just text parts
2. **For text parts**, render as before (with `renderMessageContent` for links)
3. **For tool parts with `state === "approval-requested"`**, render the approval card
4. **For tool parts with `state === "output-available"`**, render nothing (the LLM's text response covers it)
5. **For tool parts with `state === "approval-denied"`**, show "Denied" badge

### Approval card component

```
┌─────────────────────────────────────┐
│ Approve request from Dmitry         │
│ on "The Yellow Tent" (Mar 20-25)?   │
│                                     │
│    [Approve]          [Deny]        │
└─────────────────────────────────────┘
```

For high-risk:
```
┌─────────────────────────────────────┐
│ Delete "The Yellow Tent"?           │
│ ⚠ This cannot be undone            │
│                                     │
│    [Delete]           [Cancel]      │
└─────────────────────────────────────┘
```

### Summary generation

A lookup table maps tool names to human-readable summaries. All 16 mutation tools must have an entry:

```typescript
const toolSummaries: Record<string, (input: any) => string> = {
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
```

### Approval ID

The `addToolApprovalResponse` function takes `{ id, approved, reason? }`. The `id` is `approval.id` from the `tool-approval-request` part (NOT the `toolCallId`).

### High-risk tools

`deleteItem` and `markMissing` show a warning line and use "Delete"/"Report" button text instead of "Approve".

## Prompt Changes

Add a mutation guidance section to the system prompt:
- "You can take actions on behalf of the user. Every action requires their approval via a button click."
- "When using a mutation tool, summarize what you're about to do. The user will see an Approve/Deny prompt."
- "For high-risk actions (delete item, mark missing), warn the user that this cannot be undone."
- "For createRating, help the user compose their rating. Ask what stars they'd give and how it went, then draft the text."
- "For createItem, collect name, description, and category through conversation. Note: photos and location must be added through the app afterward."
- "For requestItem, ask for dates if not specified. Check availability first using getItemAvailability."
- "Never call multiple mutation tools in a single turn. One action at a time."
- "Dates: use ISO format when calling tools (e.g., 2026-03-20). Ask the user to clarify ambiguous dates."

Update the welcome message to mention Sharry can also take actions.

## What This Does NOT Include

- **Image uploads via chat** — creating items or ratings with photos requires the existing UI forms. Deferred to a follow-up. Sharry suggests adding photos via the app.
- **Location via chat** — `createItem` omits location. Sharry warns users to add it via the app for better visibility.
- **Changing dates on submitted claims** — backend doesn't support this. Cancel and re-request instead. Pickup/return window proposals effectively cover rescheduling.
- **Bulk actions** — "delete all my items" requires multiple tool calls, each with its own Approve click.
- **Undo** — once approved and executed, no rollback. High-risk warnings cover this.

## Testing

- Add eval test cases for mutation awareness (Sharry offers to take actions when appropriate)
- Manual testing: approve/reject claims, create items, request items, rate transactions via chat
- Test denial flow: user clicks Deny, Sharry acknowledges and doesn't execute
- Test high-risk warnings: deleteItem and markMissing show warning text
- Test conversational collection: createItem with missing fields prompts for them
- Test date parsing: "March 20", "next Saturday", ISO dates
- Test approval round-trip: fresh ConvexHttpClient auth on the follow-up request
