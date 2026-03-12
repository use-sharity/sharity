# Sharry AI Assistant — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a context-aware AI chat assistant (Sharry) as a floating widget in Sharity, using Vercel AI SDK + Claude Haiku 4.5.

**Architecture:** A Next.js API route uses Vercel AI SDK's `streamText()` to call Claude Haiku 4.5 with a system prompt built from static app knowledge + dynamic user context fetched from Convex. The client uses `useChat()` hook for streaming. The widget is a floating bubble that opens a chat panel.

**Tech Stack:** Next.js 16 (App Router), Vercel AI SDK (`ai` + `@ai-sdk/anthropic`), Convex (getUserContext query), Tailwind CSS 4, next-intl, TypeScript 5.

**Spec:** `docs/superpowers/specs/2026-03-12-sharry-ai-assistant-design.md`

---

## Chunk 1: Backend (API route + Convex query + schema fix)

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Vercel AI SDK packages**

Run:
```bash
pnpm add ai @ai-sdk/anthropic
```

- [ ] **Step 2: Verify installation**

Run:
```bash
pnpm ls ai @ai-sdk/anthropic
```
Expected: Both packages listed with versions.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add Vercel AI SDK and Anthropic provider"
```

---

### Task 2: Add `by_owner` index to items table

The `items` table currently has no indexes. The `getUserContext` query needs to look up items by `ownerId` efficiently.

**Files:**
- Modify: `convex/schema.ts:6-34`

- [ ] **Step 1: Add index to items table**

In `convex/schema.ts`, add `.index("by_owner", ["ownerId"])` to the `items` table definition. The table currently ends at line 34 with just `})`. Change it to:

```typescript
	}).index("by_owner", ["ownerId"]),
```

Note: the closing of `items` table at line 34 currently reads `}),` — replace the `})` with `}).index("by_owner", ["ownerId"])`. The trailing comma stays.

- [ ] **Step 2: Verify Convex picks it up**

If Convex dev is running, it should auto-deploy the schema change. If not:
```bash
pnpm convex dev
```
Check that it deploys without errors.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): add by_owner index to items table"
```

---

### Task 3: Create Convex getUserContext query

**Files:**
- Create: `convex/chat.ts`

- [ ] **Step 1: Create `convex/chat.ts`**

```typescript
import { query } from "./_generated/server";

export const getUserContext = query({
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		const userId = identity.subject;

		const myItems = await ctx.db
			.query("items")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();

		const myClaims = await ctx.db
			.query("claims")
			.withIndex("by_claimer", (q) => q.eq("claimerId", userId))
			.collect();

		const claimsOnMyItems = [];
		for (const item of myItems) {
			const claims = await ctx.db
				.query("claims")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.collect();
			claimsOnMyItems.push(...claims);
		}

		const pendingOnMyItems = claimsOnMyItems.filter(
			(c) => c.status === "pending",
		);
		const activeBorrows = myClaims.filter(
			(c) =>
				c.status === "approved" &&
				c.pickedUpAt != null &&
				c.returnedAt == null &&
				c.transferredAt == null,
		);

		let stage: string = "active_user";
		if (myItems.length === 0 && myClaims.length === 0) {
			stage = "new_user";
		} else if (
			myItems.length > 0 &&
			claimsOnMyItems.length === 0 &&
			myClaims.length === 0
		) {
			stage = "has_items_no_activity";
		} else if (pendingOnMyItems.length > 0) {
			stage = "has_pending_claims";
		}

		return {
			stage,
			itemCount: myItems.length,
			activeBorrows: activeBorrows.length,
			pendingClaimsOnMyItems: pendingOnMyItems.length,
			pendingMyRequests: myClaims.filter((c) => c.status === "pending").length,
		};
	},
});
```

- [ ] **Step 2: Verify it compiles**

If Convex dev is running, check the terminal for errors. Otherwise:
```bash
pnpm convex dev
```
Expected: Deploys successfully, `api.chat.getUserContext` is available.

- [ ] **Step 3: Commit**

```bash
git add convex/chat.ts
git commit -m "feat(chat): add getUserContext Convex query"
```

---

### Task 4: Create the API route with system prompt

**Files:**
- Create: `app/api/chat/route.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p app/api/chat
```

- [ ] **Step 2: Create `app/api/chat/route.ts`**

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

// --- Sharry system prompt ---

const SHARRY_IDENTITY = `You are Sharry, Sharity's AI assistant.

## Your personality
- Friendly and plain-spoken. You sound like a real person, not a startup.
- Calm, direct, warm. Say what you mean in as few words as possible.
- Always practical, specific, grounded in everyday situations.
- Never word-buzzy, moralistic, corporate, or over-enthusiastic.

## Emoji rules
- One emoji per message max — sometimes none.
- Place at the end of a sentence or as a natural accent, never at the start.
- Use for warmth (👋 👀 📸 ✅), not for decoration (🎉🎊🥳🔥).
- No emoji chains. Skip emojis on serious topics.

## Language
- Use Sharity terminology: community members are "neighbors", lending is "sharing", borrowing is "fostering", a listed thing is an "item".
- If the user writes in a different language than your default, switch to their language.
- Keep brand terms consistent across languages.`;

const SHARRY_APP_KNOWLEDGE = `## How Sharity works

### For Sharers (lending items)
1. Tap the "+" button on the home page to add a new item.
2. Fill in: name, description, photos, category, location.
3. Your item appears on the main page for neighbors to find.
4. When someone requests your item, you get a notification.
5. Go to "My Items" → tap the item → review pending requests.
6. Approve or reject each request.
7. After approval, coordinate pickup with the borrower (a pickup time proposal flow).
8. When they return it, confirm the return.

### For Fosterers (borrowing items)
1. Browse items on the home page or filter by category.
2. Tap an item → select dates on the calendar.
3. Tap "Request" → the owner gets notified.
4. Wait for approval (check your notifications).
5. Once approved, coordinate pickup with the owner.
6. Return the item when your fostering period ends.

### Giveaway items
Some items are marked as giveaways — they transfer permanently, no return needed. Completion is tracked via a transfer confirmation instead of a return.

### Key pages
- **Home (Browse)**: See all available items from other neighbors.
- **My Items**: Your listed items + items you're fostering.
- **Wishlist**: Request items you wish someone would share. Others can vote.
- **Profile**: Edit your name, avatar, contacts, bio.
- **Notifications**: Updates on requests, approvals, pickups, returns, ratings.

### Item categories
kitchen, furniture, electronics, clothing, books, sports, other

### Claim lifecycle
For loans: pending → approved/rejected → picked_up → returned
For giveaways: pending → approved/rejected → transferred
Also possible: expired, missing

The full pickup/return flow involves a proposal + approval step for scheduling.

### Ratings
Both sides rate after a transaction is completed — 1 to 5 stars with an optional comment and photo.

### Calendar
Each item has an availability calendar. Approved fostering dates are blocked. Owners can also block dates when they're unavailable.

## Rules
- Maximum 5 pending requests per item.
- You can't request your own item.
- Approved request dates can't overlap.
- Only the owner can approve or reject requests.
- Only the fosterer can cancel their own request.

## About Sharity
- Based in Da Lat, Vietnam.
- Community of expats and locals sharing everyday items.
- Philosophy: no need to buy something you'll use once. Someone nearby probably has it.
- Not preachy — just practical and friendly.`;

interface UserContext {
	stage: string;
	itemCount: number;
	activeBorrows: number;
	pendingClaimsOnMyItems: number;
	pendingMyRequests: number;
}

function buildUserContext(ctx: UserContext): string {
	const lines = ["## The user's current state"];
	lines.push(`- Stage: ${ctx.stage}`);
	lines.push(`- Items listed: ${ctx.itemCount}`);
	lines.push(`- Items currently fostering: ${ctx.activeBorrows}`);
	lines.push(`- Pending requests on their items: ${ctx.pendingClaimsOnMyItems}`);
	lines.push(`- Their pending requests to others: ${ctx.pendingMyRequests}`);

	if (ctx.stage === "new_user") {
		lines.push(
			"\nThis neighbor just signed up. Encourage them to add their first item or browse what's available.",
		);
	} else if (ctx.stage === "has_items_no_activity") {
		lines.push(
			"\nThis neighbor has items listed but no one has requested them yet. Suggest patience or improving their listings (better photos, clearer descriptions).",
		);
	} else if (ctx.stage === "has_pending_claims") {
		lines.push(
			"\nThis neighbor has pending requests to review. Remind them to check My Items.",
		);
	}

	return lines.join("\n");
}

function buildSystemPrompt({
	userContext,
	locale,
}: {
	userContext?: UserContext | null;
	locale?: string;
}): string {
	const parts = [SHARRY_IDENTITY];

	if (locale) {
		const langMap: Record<string, string> = {
			en: "English",
			vi: "Vietnamese",
			ru: "Russian",
		};
		const lang = langMap[locale] ?? "English";
		parts.push(
			`## Default language\nRespond in ${lang} by default. If the user writes in a different language, switch to theirs.`,
		);
	}

	parts.push(SHARRY_APP_KNOWLEDGE);

	if (userContext) {
		parts.push(buildUserContext(userContext));
	}

	return parts.join("\n\n");
}

// --- Route handler ---

export async function POST(request: Request) {
	const { messages, userContext, locale } = await request.json();

	const systemPrompt = buildSystemPrompt({ userContext, locale });

	try {
		const result = streamText({
			model: anthropic("claude-haiku-4-5-20251001"),
			system: systemPrompt,
			messages,
			maxTokens: 600,
			temperature: 0.5,
		});

		return result.toDataStreamResponse();
	} catch {
		return Response.json(
			{ error: "Sharry is taking a break — try again in a moment." },
			{ status: 500 },
		);
	}
}
```

- [ ] **Step 3: Verify the route compiles**

```bash
pnpm build
```

If build fails, check for TypeScript errors. The `ANTHROPIC_API_KEY` env var is needed at runtime, not build time.

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat(chat): add Sharry API route with system prompt"
```

---

## Chunk 2: Frontend (chat widget + integration)

### Task 5: Create the chat widget component

**Files:**
- Create: `components/chat-widget.tsx`

- [ ] **Step 1: Create `components/chat-widget.tsx`**

```tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { useQuery } from "convex/react";
import { useLocale } from "next-intl";
import { useRef, useEffect, useState, useCallback } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { api } from "@/convex/_generated/api";

const SUGGESTIONS_BY_STAGE: Record<string, string[]> = {
	new_user: [
		"How do I share an item?",
		"How does fostering work?",
		"What is Sharity?",
	],
	has_items_no_activity: [
		"How can I improve my listings?",
		"How does fostering work?",
		"Where are my items?",
	],
	has_pending_claims: [
		"How do I approve a request?",
		"What happens after approval?",
		"How do I contact a neighbor?",
	],
	active_user: [
		"How do I return an item?",
		"How do ratings work?",
		"How does the calendar work?",
	],
	logged_out: [
		"What is Sharity?",
		"How does sharing work?",
		"How do I sign up?",
	],
};

export function ChatWidget() {
	const [isOpen, setIsOpen] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const locale = useLocale();
	const userContext = useQuery(api.chat.getUserContext);

	const {
		messages,
		input,
		handleInputChange,
		handleSubmit,
		isLoading,
		error,
		append,
	} = useChat({
		api: "/api/chat",
		body: { userContext, locale },
	});

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [messages, scrollToBottom]);

	useEffect(() => {
		if (isOpen) inputRef.current?.focus();
	}, [isOpen]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isOpen) setIsOpen(false);
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen]);

	const stage = userContext?.stage ?? (userContext === null ? "logged_out" : "active_user");
	const suggestions = SUGGESTIONS_BY_STAGE[stage] ?? SUGGESTIONS_BY_STAGE.active_user;

	return (
		<>
			{/* Floating bubble */}
			{!isOpen && (
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					className="fixed right-4 bottom-20 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 sm:right-6 sm:bottom-6"
					style={{ backgroundColor: "#2D4A35" }}
					aria-label="Open chat with Sharry"
				>
					<MessageCircle className="h-5 w-5" style={{ color: "#F0EBE0" }} />
				</button>
			)}

			{/* Chat panel */}
			{isOpen && (
				<div
					role="dialog"
					aria-label="Chat with Sharry"
					className="fixed inset-0 z-50 flex flex-col sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[520px] sm:w-[400px] sm:rounded-xl sm:border sm:shadow-lg"
					style={{
						backgroundColor: "rgba(255, 255, 255, 0.97)",
						backdropFilter: "blur(12px)",
						borderColor: "#E0D9CE",
					}}
				>
					{/* Header */}
					<div
						className="flex items-center justify-between px-4 py-3"
						style={{ borderBottom: "1px solid #E0D9CE" }}
					>
						<div className="flex items-center gap-2">
							<div
								className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
								style={{ backgroundColor: "#2D4A35", color: "#F0EBE0" }}
							>
								S
							</div>
							<span className="font-semibold" style={{ color: "#1C1C1A" }}>
								Sharry
							</span>
						</div>
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							aria-label="Close chat"
						>
							<X className="h-4 w-4" style={{ color: "#7A7570" }} />
						</button>
					</div>

					{/* Messages */}
					<div
						className="flex-1 overflow-y-auto px-4 py-4"
						aria-live="polite"
					>
						{messages.length === 0 && (
							<>
								{/* Welcome message */}
								<div className="mb-4 flex gap-2">
									<div
										className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
										style={{
											backgroundColor: "#2D4A35",
											color: "#F0EBE0",
										}}
									>
										S
									</div>
									<div
										className="rounded-lg rounded-tl-none px-3 py-2 text-sm"
										style={{
											backgroundColor: "#F0EBE0",
											color: "#1C1C1A",
											lineHeight: "1.5",
										}}
									>
										Hey 👋 I&apos;m Sharry. I can help you find your way
										around, answer questions about sharing or fostering items,
										or explain how things work. What&apos;s on your mind?
									</div>
								</div>

								{/* Suggestions */}
								<div className="ml-8 flex flex-wrap gap-1.5">
									{suggestions.map((s) => (
										<button
											key={s}
											type="button"
											onClick={() =>
												append({ role: "user", content: s })
											}
											className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-gray-50"
											style={{
												borderColor: "#E0D9CE",
												color: "#2D4A35",
											}}
										>
											{s}
										</button>
									))}
								</div>
							</>
						)}

						{messages.map((message) => (
							<div
								key={message.id}
								className={`mb-3 flex ${message.role === "user" ? "justify-end" : "gap-2"}`}
							>
								{message.role === "assistant" && (
									<div
										className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
										style={{
											backgroundColor: "#2D4A35",
											color: "#F0EBE0",
										}}
									>
										S
									</div>
								)}
								<div
									className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
										message.role === "user"
											? "rounded-tr-none"
											: "rounded-tl-none"
									}`}
									style={
										message.role === "user"
											? {
													backgroundColor: "#2D4A35",
													color: "#F0EBE0",
												}
											: {
													backgroundColor: "#F0EBE0",
													color: "#1C1C1A",
												}
									}
								>
									{message.content || (
										<span
											className="inline-flex items-center gap-1"
											style={{ color: "#7A7570" }}
										>
											<span className="animate-pulse">●</span>
											<span
												className="animate-pulse"
												style={{ animationDelay: "0.2s" }}
											>
												●
											</span>
											<span
												className="animate-pulse"
												style={{ animationDelay: "0.4s" }}
											>
												●
											</span>
										</span>
									)}
								</div>
							</div>
						))}

						{error && (
							<div className="mb-3 flex gap-2">
								<div
									className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
									style={{
										backgroundColor: "#2D4A35",
										color: "#F0EBE0",
									}}
								>
									S
								</div>
								<div
									className="rounded-lg rounded-tl-none px-3 py-2 text-sm"
									style={{
										backgroundColor: "#F0EBE0",
										color: "#1C1C1A",
									}}
								>
									Sharry is taking a break — try again in a moment.
								</div>
							</div>
						)}

						<div ref={messagesEndRef} />
					</div>

					{/* Input */}
					<form
						onSubmit={handleSubmit}
						className="px-4 py-3"
						style={{ borderTop: "1px solid #E0D9CE" }}
					>
						<div className="flex gap-2">
							<input
								ref={inputRef}
								type="text"
								value={input}
								onChange={handleInputChange}
								placeholder="Ask Sharry anything..."
								disabled={isLoading}
								className="flex-1 rounded-full px-4 py-2 text-sm outline-none"
								style={{
									backgroundColor: "#F0EBE0",
									color: "#1C1C1A",
								}}
							/>
							<button
								type="submit"
								disabled={!input.trim() || isLoading}
								className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
								style={{ backgroundColor: "#2D4A35" }}
							>
								<Send
									className="h-4 w-4"
									style={{ color: "#F0EBE0" }}
								/>
							</button>
						</div>
					</form>
				</div>
			)}
		</>
	);
}
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm build
```

Expected: No TypeScript errors. (Runtime test comes after integration.)

- [ ] **Step 3: Commit**

```bash
git add components/chat-widget.tsx
git commit -m "feat(chat): add Sharry chat widget component"
```

---

### Task 6: Integrate widget into layout

**Files:**
- Modify: `app/[locale]/layout.tsx:11,86`

- [ ] **Step 1: Add import**

At the top of `app/[locale]/layout.tsx`, after line 12 (`import { ProfileProvider }...`), add:

```typescript
import { ChatWidget } from "@/components/chat-widget";
```

- [ ] **Step 2: Add component to JSX**

After `<Toaster />` on line 86, add:

```tsx
								<ChatWidget />
```

The result should look like:

```tsx
							<AppHeader />
							{children}
							<Toaster />
							<ChatWidget />
```

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/layout.tsx
git commit -m "feat(chat): integrate Sharry widget into app layout"
```

---

## Chunk 3: Environment + Manual Testing

### Task 7: Set up environment and test

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add API key**

Add to `.env.local`:
```env
ANTHROPIC_API_KEY=<your-key>
```

Get a key from https://console.anthropic.com/settings/keys

- [ ] **Step 2: Start dev servers**

Terminal 1:
```bash
pnpm convex:dev
```

Terminal 2:
```bash
pnpm dev
```

- [ ] **Step 3: Test — bubble appears**

Open the app in browser. Verify:
- Green bubble visible bottom-right on desktop
- On mobile viewport: bubble is above the bottom tab bar
- Clicking bubble opens the chat panel

- [ ] **Step 4: Test — basic chat works**

In the chat panel:
- Click a suggested question
- Verify streaming response appears progressively
- Verify Sharry uses brand voice (calm, direct, uses "neighbors"/"sharing"/"fostering")
- Send a custom message and verify response

- [ ] **Step 5: Test — multilingual**

- Write a message in Russian → Sharry should respond in Russian
- Write a message in Vietnamese → Sharry should respond in Vietnamese
- Switch app locale → Sharry's default language should change

- [ ] **Step 6: Test — context awareness**

Test with different user states:
- **Logged out**: suggestions show "What is Sharity?", "How does sharing work?", "How do I sign up?"
- **New user** (no items, no claims): suggestions show "How do I share an item?"
- **User with pending claims**: suggestions show "How do I approve a request?"

- [ ] **Step 7: Test — error and edge cases**

- Close panel with Escape key
- Close panel with X button
- Send empty message (should be prevented)
- Remove `ANTHROPIC_API_KEY` temporarily → verify error message appears
- Rapid messages → verify no crashes

- [ ] **Step 8: Test — mobile layout**

- Resize browser to mobile width (<640px)
- Chat panel should be full-screen
- Bubble should not overlap bottom tabs

---

### Task 8: Final cleanup and commit

- [ ] **Step 1: Run linter and formatter**

```bash
pnpm lint
pnpm format
```

Fix any issues.

- [ ] **Step 2: Verify clean build**

```bash
pnpm build
```

Expected: Build succeeds with no errors or warnings.

- [ ] **Step 3: Final commit (if formatter changed anything)**

```bash
git status
# If changes:
git add .
git commit -m "style(chat): format Sharry chat files"
```
