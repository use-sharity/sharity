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
- Fetch all `chat_messages` where `userId` matches, ordered by `createdAt`
- Return the full list for UI rendering

### `saveMessage` (mutation)

- Args: `{ role: "user" | "assistant", content: string }`
- Auth check
- Insert into `chat_messages` with `userId` from identity and `createdAt: Date.now()`

## Widget Changes (`components/chat-widget.tsx`)

### Loading history

- Use `useQuery(api.chat.getMessages)` to load persisted messages
- Convert persisted messages to the format expected by `useChat`'s `initialMessages`
- Re-initialize `useChat` when persisted messages load

### Saving messages

- On user submit: call `saveMessage({ role: "user", content })` immediately
- On assistant response complete (status transitions from `"streaming"` to `"ready"`): extract text from assistant message parts, call `saveMessage({ role: "assistant", content })`

### Historical message rendering

- All persisted messages render as normal text bubbles
- Tool approval cards are NOT rendered for historical messages — only text content
- Welcome message and suggestions show only when there are zero messages (persisted or live)

## API Route Changes (`app/api/chat/route.ts`)

### LLM context window

- The client sends all messages (as `useChat` does by default)
- The server slices to the **last 50 messages** before passing to `streamText()`
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
