# Sharry Tool Use — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Branch:** feat/sharry-ai-assistant

## Problem

Sharry currently receives a static snapshot of the user's account (item counts, names, stage) via the system prompt. This works for simple questions like "do I have any items?" but fails when users ask for details: "who requested my drill?", "find me a drill near me", "what are my notifications?". Sharry has to deflect with "check the app" instead of answering directly.

## Decision

Add read-only tool use to Sharry so it can query Convex on demand. Server-side execution via AI SDK `streamText` tools + `ConvexHttpClient` with auth token forwarding (Approach C from brainstorming).

### Why not client-side tools?

Client-side tool execution (Approach B) would mean extra round-trips between server and client, more complex frontend code, and tool logic exposed to the browser. Server-side keeps the client simple — it just renders streamed text.

### Why not pure prefetch?

Prefetching everything into the system prompt doesn't scale. Each new question type would require adding more data to the context, bloating token usage. Tools fetch only what's needed, when it's needed.

### Why keep prefetched context alongside tools?

For simple questions ("how many items do I have?"), a tool call is wasteful — the answer is already in the system prompt. The prefetched context (stage, counts, item names) handles the 80% case instantly. Tools handle the 20% that needs more detail.

## Architecture

```
Browser                    API Route                    Convex
  |                           |                            |
  |-- POST /api/chat -------->|                            |
  |  (messages + userContext   |                            |
  |   + locale               |                            |
  |   + Authorization header) |                            |
  |                           |-- streamText(tools) ----> LLM
  |                           |<--- tool_call: getMyItems  |
  |                           |                            |
  |                           |-- ConvexHttpClient ------->|
  |                           |  (with auth token)         |
  |                           |<---- items[] --------------|
  |                           |                            |
  |                           |-- tool result -> LLM       |
  |                           |<--- formatted response     |
  |<-- streamed response -----|                            |
```

- `ConvexHttpClient` instantiated per-request with the user's Clerk JWT
- `maxSteps: 4` — LLM can chain up to 4 tool calls per turn (accounts for name resolution + data fetch + follow-up)
- Prefetched context remains in system prompt for fast simple answers
- `maxOutputTokens` increased from 600 to 800
- The existing typing dots animation covers latency during tool execution

## Auth Flow (detailed)

### Client side (chat-widget.tsx)

Import `useAuth` from `@clerk/nextjs`. Call `getToken()` (async, returns `Promise<string | null>`) inside the existing custom `fetch` wrapper and set it as an `Authorization: Bearer <token>` header.

```typescript
// In chat-widget.tsx
const { getToken } = useAuth();
const getTokenRef = useRef(getToken);
getTokenRef.current = getToken;

const transport = useMemo(
  () =>
    new DefaultChatTransport({
      api: "/api/chat",
      fetch: async (url, init) => {
        const body = JSON.parse((init?.body as string) ?? "{}");
        body.userContext = userContextRef.current;
        body.locale = localeRef.current;
        const token = await getTokenRef.current();
        return fetch(url, {
          ...init,
          body: JSON.stringify(body),
          headers: {
            ...Object.fromEntries(new Headers(init?.headers).entries()),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      },
    }),
  [],
);
```

### Server side (app/api/chat/route.ts)

Extract the `Authorization` header, create a `ConvexHttpClient`, authenticate it, and pass it to tool definitions via closure.

```typescript
import { ConvexHttpClient } from "convex/browser";

export async function POST(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  const { messages, userContext, locale } = await request.json();

  // Create authenticated Convex client for tool use
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) convex.setAuth(token);

  const tools = buildTools(convex, locale);

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: buildSystemPrompt({ userContext, locale }),
    messages: await convertToModelMessages(messages),
    tools,
    maxSteps: 4,
    maxOutputTokens: 800,
    temperature: 0.5,
  });

  return result.toUIMessageStreamResponse();
}
```

## Tools (9 total, all read-only)

### About my stuff

| Tool | Args | Returns | Use case |
|------|------|---------|----------|
| `getMyItems` | none | items with descriptions, categories, pending claim counts | "what items do I have listed?" |
| `getMyBorrowedItems` | none | items being fostered with owner name and return dates | "what am I fostering?" |
| `getClaimsOnItem` | `itemName: string` | claims with claimer name, dates, status | "who requested my drill?" |

### Browsing & discovery

| Tool | Args | Returns | Use case |
|------|------|---------|----------|
| `browseItems` | `query?: string, category?: string` | matching available items (excludes user's own items) | "find me a drill" / "what electronics are available?" |
| `getItemDetails` | `itemId: string` | full item details (description, owner) | "tell me more about that drill" |
| `getItemAvailability` | `itemId: string` | booked vs free date ranges | "when is that drill available?" |

### About other people

| Tool | Args | Returns | Use case |
|------|------|---------|----------|
| `getUserProfile` | `userId: string` | name, bio, rating summary (via `ratings.getRatingSummary`) | "who is this person who requested my item?" |

### Updates

| Tool | Args | Returns | Use case |
|------|------|---------|----------|
| `getNotifications` | none | recent notifications (requests, approvals, pickups, returns, ratings) | "any updates?" |

### Navigation

| Tool | Args | Returns | Use case |
|------|------|---------|----------|
| `navigateTo` | `page: string, itemId?: string` | locale-prefixed URL path (e.g., `/en/my-items`) | "take me to my items" / "show me that drill" |

### Tool implementation notes

**`getClaimsOnItem` name resolution:** Two-step in-memory resolution within a single tool execute call. First, query `getMyItems` to get the user's items. Then case-insensitive substring match on the name. If exactly one match, query `getClaims` with the item ID. If multiple matches, return the list of matching names and ask the user to clarify. If no match, return "no item found with that name." This consumes one step in `maxSteps` regardless of the internal query count.

**`browseItems` filtering:** Calls existing `items.get` query (which excludes the user's own items and unavailable owners). Filters results in-memory by case-insensitive substring match on name and exact match on category. Returns top 10 results to keep the response concise.

**`getUserProfile` rating data:** Calls `users.getProfile` for bio/name (privacy-respecting — no contact details), plus `ratings.getRatingSummary` for star averages. Two Convex queries, one tool call.

**`navigateTo` locale handling:** The `locale` is available in the route handler (from the request body). The tool prepends it to the path: `/${locale}/${page}`. For `item-detail`, the path is `/${locale}/items/${itemId}`.

**`getItemDetails` images:** Returns item description, owner name, category, and location. Image URLs are excluded from the tool result since the chat widget cannot display them. The prompt instructs Sharry not to reference photos.

**Example tool definition (AI SDK shape):**

```typescript
const tools = {
  getMyItems: tool({
    description: "List the user's own items with descriptions and pending request counts",
    parameters: z.object({}),
    execute: async () => {
      try {
        const items = await convex.query(api.items.getMyItems);
        return items.map((i) => ({
          name: i.name,
          description: i.description,
          category: i.category,
        }));
      } catch {
        return { error: "Could not fetch your items right now." };
      }
    },
  }),
};
```

### Error handling

All tool `execute` functions wrap their Convex calls in try/catch. On failure, they return a structured `{ error: string }` object instead of throwing. This lets the LLM respond gracefully ("I couldn't fetch that right now — try again in a moment") rather than aborting the stream.

## Prompt Changes

- Keep prefetched context (stage, counts, item names) in system prompt
- Add a "Tools" section explaining what tools are available and when to use them
- Key instruction: "If you can answer from the context above, do so. Only call a tool when you need more detail than what's provided."
- Tool-use guidance: "When you get results from a tool, summarize them conversationally. Don't dump raw data."
- "Never mention photos or images — the chat cannot display them."

## Client Changes

- Forward Clerk token as `Authorization` header in the custom fetch wrapper (see Auth Flow above)
- Detect internal links (e.g., `/en/my-items`) in assistant messages and render as tappable styled links
- No changes to `useChat` hook — tool calls are handled server-side, client just sees streamed text

## What This Does NOT Include

- **Mutations** — Sharry cannot take actions (approve claims, cancel requests, etc.). Read-only for v1.
- **Image display** — Chat widget is text-only. Tool results exclude image URLs.
- **Conversation memory** — Each chat session is stateless. No persistent conversation history.
- **New Convex indexes** — `browseItems` filters in-memory. Full-text search is a future optimization.
- **Fuzzy search** — `browseItems` and `getClaimsOnItem` use substring matching, not fuzzy/semantic search.

## Testing

- Update promptfoo evals to test tool-informed responses (new test category: "Tool Use")
- Test cases: "who requested my drill?", "find me electronics", "any notifications?"
- Verify tools are NOT called for questions answerable from prefetched context
- Test error handling: invalid item names, expired auth tokens
