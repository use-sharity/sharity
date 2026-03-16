# Chat History Persistence — Design Spec

## Problem

The Sharry chat widget stores messages only in React state (`useChat` hook). Messages are lost when the user closes the widget, navigates between pages, refreshes, or switches devices. This makes the assistant feel unreliable and forces users to repeat context.

## Solution

Persist chat messages in a Convex `chat_messages` table. The widget loads history on mount and saves messages after each exchange. The LLM receives only the last 50 messages to keep costs low, but the user can scroll back through their full history.

## Data Model

New table in `convex/schema.ts`:

```typescript
chat_messages: defineTable({
  userId: v.string(),
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  createdAt: v.number(),
}).index("by_user", ["userId", "createdAt"])
```

- Single continuous thread per user — no conversation/session IDs
- Index on `(userId, createdAt)` for efficient ordered retrieval
- Only text content is stored — tool approval cards are transient UI state
- No storage of tool call parts — only final text responses

## Backend Functions

Add to `convex/chat.ts`:

### `getMessages` (query)

- Auth check — return `null` if unauthenticated
- Fetch the last **200** `chat_messages` where `userId` matches, ordered by `createdAt`
- 200 is enough for meaningful scroll-back without loading thousands of messages for heavy users
- If "load more" is needed later, add cursor-based pagination as a follow-up

### `saveMessage` (mutation)

- Args: `{ role: "user" | "assistant", content: string }`
- Auth check
- Insert into `chat_messages` with `userId` from identity and `createdAt: Date.now()`

## Widget Changes (`components/chat-widget.tsx`)

### Loading history (seed once, not reactively)

`useQuery(api.chat.getMessages)` is a reactive Convex subscription — it re-fires on every table change. If fed directly into `useChat` as `initialMessages`, it would reset chat state on every new message (breaking streaming, tool approvals, etc.).

**The pattern:**
1. Use `useQuery(api.chat.getMessages)` to fetch persisted messages.
2. Track a `hasSeeded` ref (initialized to `false`).
3. On the **first** render where persisted messages are available and `hasSeeded` is `false`, convert them to `useChat`-compatible format and pass as `initialMessages`. Set `hasSeeded` to `true`.
4. After seeding, the reactive query result is **ignored** by `useChat` — all new messages live in `useChat`'s internal state and are persisted to Convex as a side effect.
5. The reactive query is only relevant if the widget is unmounted and remounted (e.g., page navigation), at which point a fresh seed happens.

### Saving messages

- On user submit: call `saveMessage({ role: "user", content })` immediately
- On assistant response complete (status transitions from `"streaming"` to `"ready"`): extract text from assistant message parts, call `saveMessage({ role: "assistant", content })`
- **Failed exchanges:** If the LLM call fails (network error, 500), the user message is already persisted but no assistant response is saved. This is acceptable — on next load the user sees their unanswered message, and the LLM will naturally respond to it in the next exchange. No cleanup needed.

### Historical message rendering

- All persisted messages render as normal text bubbles
- Tool approval cards are NOT rendered for historical messages — only text content
- Welcome message and suggestions show only when there are zero messages (persisted or live)

### Tool call context after reload

After a reload, persisted history contains only text messages — tool-call/tool-result parts are not stored. This is acceptable because:
- The `userContext` query provides the real-time state of items, claims, and stage — the LLM doesn't need tool-call history to know what actions were taken
- Tool calls are reflected as actual DB mutations (created items, approved claims, etc.) which `userContext` captures
- The text responses ("Created your item!", "Approved the request") provide enough conversational context

## API Route Changes (`app/api/chat/route.ts`)

### LLM context window

- The client sends only the last **50 messages** from `useChat` state (truncate before sending, not on the server) to avoid unbounded request payloads as history grows
- The server passes these directly to `streamText()` — no additional slicing needed
- This keeps token costs bounded while preserving enough context for conversational coherence
- The `userContext` query already provides real-time awareness of items, claims, and stage — old chat messages are not needed for that

## What the User Experiences

1. Opens chat → sees full message history instantly (Convex reactive query)
2. Sends a message → persists immediately
3. Gets a response → persists when streaming finishes
4. Refreshes page, navigates, switches device → full history is there
5. Sharry contextually "remembers" the last 50 messages — invisible limit to the user

## Out of Scope

- Multiple conversations / "new chat" button
- Message search
- Summarization of old messages
- Memory system (extracting key facts from conversations)
- Message deletion / clearing history

These can be added later if needed.

## Files Changed

1. `convex/schema.ts` — add `chat_messages` table
2. `convex/chat.ts` — add `getMessages` query and `saveMessage` mutation
3. `components/chat-widget.tsx` — load history, save messages, handle initial state
4. `app/api/chat/route.ts` — slice messages to last 50 before LLM call
