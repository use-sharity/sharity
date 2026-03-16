# Chat History Persistence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Sharry chat messages in Convex so they survive page navigation, refresh, and device switches.

**Architecture:** Add a `chat_messages` table to Convex, load history on widget mount via `setMessages`, save messages after each exchange, and truncate to last 50 before sending to the LLM.

**Tech Stack:** Convex (DB + functions), `@ai-sdk/react` v3 (`useChat` with `setMessages`), Next.js API route

**Spec:** `docs/superpowers/specs/2026-03-16-chat-history-persistence-design.md`

---

## Chunk 1: Backend (Schema + Convex functions)

### Task 1: Add `chat_messages` table to schema

**Files:**
- Modify: `convex/schema.ts:187` (before closing `});`)

- [ ] **Step 1: Add the table definition**

Add this before the closing `});` in `convex/schema.ts`, after the `ratings` table:

```typescript
	// Chat message history
	chat_messages: defineTable({
		userId: v.string(),
		role: v.union(v.literal("user"), v.literal("assistant")),
		content: v.string(),
		createdAt: v.number(),
	}).index("by_user", ["userId", "createdAt"]),
```

- [ ] **Step 2: Verify schema compiles**

Run: `pnpm convex dev` (if already running, it auto-reloads)
Expected: Schema pushes successfully, no errors.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(chat): add chat_messages table to schema"
```

---

### Task 2: Add `getMessages` query and `saveMessage` mutation

**Files:**
- Modify: `convex/chat.ts:1-2` (add `mutation` import, add new exports at end of file)

- [ ] **Step 1: Add `mutation` to imports**

In `convex/chat.ts`, change line 2 from:
```typescript
import { query } from "./_generated/server";
```
to:
```typescript
import { mutation, query } from "./_generated/server";
```

- [ ] **Step 2: Add `getMessages` query at end of file**

Append to `convex/chat.ts`:

```typescript
export const getMessages = query({
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		const userId = identity.subject;

		const messages = await ctx.db
			.query("chat_messages")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.order("desc")
			.take(200);

		// Return in chronological order (oldest first)
		return messages.reverse().map((m) => ({
			role: m.role,
			content: m.content,
			createdAt: m.createdAt,
		}));
	},
});
```

- [ ] **Step 3: Add `saveMessage` mutation at end of file**

Append to `convex/chat.ts`:

```typescript
export const saveMessage = mutation({
	args: {
		role: v.union(v.literal("user"), v.literal("assistant")),
		content: v.string(),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthenticated");
		const userId = identity.subject;

		await ctx.db.insert("chat_messages", {
			userId,
			role: args.role,
			content: args.content,
			createdAt: Date.now(),
		});
	},
});
```

- [ ] **Step 4: Verify functions compile**

Run: `pnpm convex dev` (auto-reloads)
Expected: Functions deploy successfully, `api.chat.getMessages` and `api.chat.saveMessage` are available.

- [ ] **Step 5: Commit**

```bash
git add convex/chat.ts
git commit -m "feat(chat): add getMessages query and saveMessage mutation"
```

---

## Chunk 2: Widget — Load & Save History

### Task 3: Load persisted history on mount

**Files:**
- Modify: `components/chat-widget.tsx`

The `useChat` hook returns `setMessages` which we use to seed persisted messages once after the query loads. We use a `hasSeeded` ref to ensure this only happens once per mount.

- [ ] **Step 1: Add `useMutation` import and `hasSeeded` ref**

In `components/chat-widget.tsx`, change line 6 from:
```typescript
import { useQuery } from "convex/react";
```
to:
```typescript
import { useMutation, useQuery } from "convex/react";
```

- [ ] **Step 2: Add `setMessages` to the `useChat` destructuring**

Change line 126-127 from:
```typescript
	const { messages, sendMessage, status, error, addToolApprovalResponse } =
		useChat({
```
to:
```typescript
	const { messages, sendMessage, status, error, addToolApprovalResponse, setMessages } =
		useChat({
```

- [ ] **Step 3: Add persisted messages query, save mutation, and seeding logic**

After the `const inputRef = useRef<HTMLInputElement>(null);` line (line 91), add:

```typescript
	const persistedMessages = useQuery(api.chat.getMessages);
	const saveMessage = useMutation(api.chat.saveMessage);
	const hasSeeded = useRef(false);
	const lastSavedIndexRef = useRef(0);
```

Then, after the `useChat` block (after line 145), add the seeding effect:

```typescript
	// Seed persisted messages once on first load
	useEffect(() => {
		if (hasSeeded.current) return;
		if (!persistedMessages || persistedMessages.length === 0) return;
		hasSeeded.current = true;
		const seeded = persistedMessages.map((m, i) => ({
			id: `persisted-${i}`,
			role: m.role as "user" | "assistant",
			parts: [{ type: "text" as const, text: m.content }],
		}));
		setMessages(seeded);
		lastSavedIndexRef.current = seeded.length;
	}, [persistedMessages, setMessages]);
```

- [ ] **Step 4: Verify it compiles**

Run: `pnpm dev`
Expected: No TypeScript errors. Chat widget renders. If there are persisted messages, they appear on open.

- [ ] **Step 5: Commit**

```bash
git add components/chat-widget.tsx
git commit -m "feat(chat): load persisted messages on widget mount"
```

---

### Task 4: Save messages after send and receive

**Files:**
- Modify: `components/chat-widget.tsx`

- [ ] **Step 1: Save user message on submit**

In the `handleSubmit` callback, after `sendMessage({ text: trimmed });` (around line 183), add the save call:

```typescript
			sendMessage({ text: trimmed });
			saveMessage({ role: "user", content: trimmed });
			setInput("");
```

- [ ] **Step 2: Save user message on suggestion click**

In the `handleSuggestionClick` callback, after `sendMessage({ text });` (around line 191), add:

```typescript
		(text: string) => {
			sendMessage({ text });
			saveMessage({ role: "user", content: text });
		},
```

Update the dependency array to include `saveMessage`:
```typescript
		[sendMessage, saveMessage],
```

Also update `handleSubmit`'s dependency array to include `saveMessage`:
```typescript
		[input, isLoading, sendMessage, saveMessage],
```

- [ ] **Step 3: Save assistant message when streaming completes**

Add a new `useEffect` after the seeding effect to watch for completed assistant messages. Note: `lastSavedIndexRef` was already declared in Task 3 alongside `hasSeeded`, and the seeding effect already sets it to `seeded.length` — so persisted messages are never re-saved.

```typescript
	// Save assistant messages when streaming completes
	useEffect(() => {
		if (status !== "ready") return;
		// Find new assistant messages since last save
		for (let i = lastSavedIndexRef.current; i < messages.length; i++) {
			const msg = messages[i];
			if (msg.role === "assistant") {
				const text = getMessageText(msg);
				if (text) {
					saveMessage({ role: "assistant", content: text });
				}
			}
		}
		lastSavedIndexRef.current = messages.length;
	}, [status, messages, saveMessage]);
```

- [ ] **Step 4: Verify it works end-to-end**

Run: `pnpm dev`
1. Open the chat widget
2. Send a message — check Convex dashboard for a new `chat_messages` row with role "user"
3. Wait for the response — check for a new row with role "assistant"
4. Refresh the page — messages should persist and appear in the chat

- [ ] **Step 5: Commit**

```bash
git add components/chat-widget.tsx
git commit -m "feat(chat): save user and assistant messages to Convex"
```

---

## Chunk 3: Truncate Messages for LLM

### Task 5: Truncate to last 50 messages in transport

**Files:**
- Modify: `components/chat-widget.tsx` (transport `fetch` override)

The transport already intercepts the fetch call to inject `userContext` and auth headers. We add message truncation here so only the last 50 messages are sent to the API.

- [ ] **Step 1: Add truncation in the transport fetch**

In the `transport` useMemo (around line 104-124), after parsing the body and before the fetch call, add truncation:

```typescript
			fetch: async (url, init) => {
				const body = JSON.parse((init?.body as string) ?? "{}");
				body.userContext = userContextRef.current;
				body.locale = localeRef.current;
				// Truncate to last 50 messages to keep LLM context bounded
				if (Array.isArray(body.messages) && body.messages.length > 50) {
					body.messages = body.messages.slice(-50);
				}
				const token = await getTokenRef.current({ template: "convex" });
				return fetch(url, {
					...init,
					body: JSON.stringify(body),
					headers: {
						...Object.fromEntries(new Headers(init?.headers).entries()),
						...(token ? { Authorization: `Bearer ${token}` } : {}),
					},
				});
			},
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm dev`
Expected: No errors. Chat works normally.

- [ ] **Step 3: Commit**

```bash
git add components/chat-widget.tsx
git commit -m "feat(chat): truncate messages to last 50 in transport"
```

---

### Task 6: Manual end-to-end verification

- [ ] **Step 1: Fresh start test**

1. Open the app in a browser, sign in
2. Open the chat widget — should show welcome message + suggestions (no persisted messages yet)
3. Click a suggestion — message sends, response streams back
4. Check Convex dashboard: two `chat_messages` rows (user + assistant)

- [ ] **Step 2: Persistence test**

1. After the conversation above, refresh the page
2. Open the chat widget — previous messages should appear
3. Send another message — it should continue naturally
4. Navigate to a different page, then back — messages persist

- [ ] **Step 3: Cross-tab test**

1. Open the app in a second browser tab
2. Open the chat widget — should show the same history
3. Send a message in tab 1 — tab 2 should NOT update live (we seed once, not reactively, which is correct)

- [ ] **Step 4: Welcome state test**

1. Sign in as a different user (or clear chat_messages for the test user in Convex dashboard)
2. Open chat widget — should show welcome message + suggestions (no history = fresh state)
