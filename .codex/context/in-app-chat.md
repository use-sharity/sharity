# In-App Chat Prototype Context

## Goal

Build a working Sharity prototype for 1:1 user-to-user chat so borrowers and owners can coordinate pickup/return without relying on external WhatsApp/email fallback.

## MVP Scope

- 1:1 only.
- Conversation must be scoped to an item; claim linkage is optional but preferred when available.
- Text messages.
- System messages for claim lifecycle events.
- Conversation list.
- Thread view.
- Unread counter.
- Entry points from item/claim surfaces.

## Explicit Non-Scope

- No attachments.
- No typing indicators.
- No presence.
- No push/email notifications for v1 unless explicitly added later.
- No edit/delete messages.
- No group chats.

## Acceptance Criteria

- A signed-in user can start a conversation with an item owner.
- The owner and borrower can exchange messages in realtime through Convex queries.
- Both users can see a conversation list with last message preview.
- Unread count updates after receiving and reading messages.
- Claim lifecycle mutations can create system messages without weakening existing business rules.
- UI works under localized routes.
- Browser verification covers two users or clearly documents why that was not possible.
- Existing Sharry AI assistant route/module remains intact.

## Known Pitfalls

- `convex/chat.ts` name collision with Sharry AI assistant.
- Locale route pushes like `/chat/:id` can skip locale prefix from localized pages.
- Convex generated API types must be regenerated, not permanently edited by hand.
- Querying all conversations and filtering client-side is acceptable only for prototype scale; call it out if kept.
- Manual integration of multiple agent outputs can leave stale API module names.

## Suggested Verification

```bash
pnpm convex codegen
pnpm exec tsc --noEmit
pnpm lint
pnpm dev
BASE_URL=http://localhost:3001 pnpm exec playwright test --reporter=line
```

If possible, run two browser sessions with two Clerk test users.
