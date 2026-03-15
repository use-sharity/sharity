# Sharry Tool Use Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Sharry the ability to query Convex on demand via AI SDK tool use, so it can answer detailed questions about items, claims, profiles, notifications, and navigation.

**Architecture:** Server-side tools defined in `lib/sharry-tools.ts`, executed via `ConvexHttpClient` with Clerk auth forwarding. The API route passes tools to `streamText`. The client forwards the Clerk token as an `Authorization` header. No changes to `useChat` — tool calls are invisible to the client.

**Tech Stack:** AI SDK v6 (`streamText` + `tool`), `ConvexHttpClient`, Clerk `useAuth`, Zod schemas

**Spec:** `docs/superpowers/specs/2026-03-15-sharry-tool-use-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/sharry-tools.ts` | Create | All 9 tool definitions (factory function taking `ConvexHttpClient` + `locale`) |
| `app/api/chat/route.ts` | Modify | Add `ConvexHttpClient` setup, auth extraction, pass tools to `streamText` |
| `components/chat-widget.tsx` | Modify | Forward Clerk token as `Authorization` header, render internal links |
| `lib/sharry-prompt.ts` | Modify | Add tool-use guidance section to system prompt |
| `evals/promptfooconfig.yaml` | Modify | Add tool-use test cases |

---

## Chunk 1: Auth Plumbing + First Tool

### Task 1: Forward Clerk token from client

**Files:**
- Modify: `components/chat-widget.tsx:1-75`

- [ ] **Step 1: Add `useAuth` import and ref**

In `chat-widget.tsx`, add `useAuth` import from `@clerk/nextjs` and create a ref for `getToken`:

```typescript
// Add to imports (line 1-9)
import { useAuth } from "@clerk/nextjs";

// Inside ChatWidget(), after localeRef (line 61):
const { getToken } = useAuth();
const getTokenRef = useRef(getToken);
getTokenRef.current = getToken;
```

- [ ] **Step 2: Update custom fetch to include Authorization header**

Replace the transport's `fetch` function to await `getToken()` and set the header:

```typescript
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
						...Object.fromEntries(
							new Headers(init?.headers).entries(),
						),
						...(token
							? { Authorization: `Bearer ${token}` }
							: {}),
					},
				});
			},
		}),
	[],
);
```

- [ ] **Step 3: Verify dev server compiles**

Run: `pnpm dev` (should already be running)
Expected: No TypeScript errors, chat widget still works.

- [ ] **Step 4: Commit**

```bash
git add components/chat-widget.tsx
git commit -m "feat(chat): forward Clerk token in chat transport"
```

---

### Task 2: Create tool definitions module with `getMyItems`

**Files:**
- Create: `lib/sharry-tools.ts`

- [ ] **Step 1: Create `lib/sharry-tools.ts` with `buildTools` factory and first tool**

```typescript
import { tool } from "ai";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "@/convex/_generated/api";

export function buildTools(convex: ConvexHttpClient, locale: string) {
	return {
		getMyItems: tool({
			description:
				"List the user's own items with descriptions, categories, and pending request counts. Use when the user asks about their listed items.",
			parameters: z.object({}),
			execute: async () => {
				try {
					const items = await convex.query(api.items.getMyItems);
					const owned = items.filter((i: any) => i.isOwner);
					return owned.map((i: any) => ({
						name: i.name,
						description: i.description ?? "",
						category: i.category ?? "other",
					}));
				} catch {
					return { error: "Could not fetch your items right now." };
				}
			},
		}),
	};
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit lib/sharry-tools.ts` or check dev server output.
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/sharry-tools.ts
git commit -m "feat(chat): add sharry-tools module with getMyItems tool"
```

---

### Task 3: Wire tools into the API route

**Files:**
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: Update route to create ConvexHttpClient, extract auth, and pass tools**

Replace `app/api/chat/route.ts` with:

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { ConvexHttpClient } from "convex/browser";
import { convertToModelMessages, streamText } from "ai";
import { buildSystemPrompt } from "@/lib/sharry-prompt";
import { buildTools } from "@/lib/sharry-tools";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

export async function POST(request: Request) {
	const token = request.headers
		.get("Authorization")
		?.replace("Bearer ", "");
	const { messages, userContext, locale } = await request.json();

	if (!Array.isArray(messages) || messages.length === 0) {
		return Response.json({ error: "Invalid request" }, { status: 400 });
	}

	const convex = new ConvexHttpClient(convexUrl);
	if (token) convex.setAuth(token);

	const systemPrompt = buildSystemPrompt({ userContext, locale });
	const tools = buildTools(convex, locale);

	try {
		const modelMessages = await convertToModelMessages(messages);
		const result = streamText({
			model: anthropic("claude-haiku-4-5-20251001"),
			system: systemPrompt,
			messages: modelMessages,
			tools,
			maxSteps: 4,
			maxOutputTokens: 800,
			temperature: 0.5,
		});

		return result.toUIMessageStreamResponse();
	} catch {
		return Response.json(
			{ error: "Sharry is taking a break — try again in a moment." },
			{ status: 500 },
		);
	}
}
```

- [ ] **Step 2: Test manually in browser**

Open chat, ask "tell me about my items in detail". Sharry should call the `getMyItems` tool and respond with item names, descriptions, and categories.

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat(chat): wire tools into streamText with ConvexHttpClient auth"
```

---

## Chunk 2: Remaining Tools

### Task 4: Add browsing & discovery tools

**Files:**
- Modify: `lib/sharry-tools.ts`

- [ ] **Step 1: Add `getMyBorrowedItems`, `browseItems`, `getItemDetails`, `getItemAvailability`**

Add these tools inside the `buildTools` return object:

```typescript
getMyBorrowedItems: tool({
	description:
		"List items the user is currently fostering, with owner name and return dates. Use when the user asks what they're borrowing.",
	parameters: z.object({}),
	execute: async () => {
		try {
			const items = await convex.query(
				api.items.getMyBorrowedItems,
			);
			// getMyBorrowedItems returns { ...item, owner: { name }, claim: { endDate } }
			return items.map((i: any) => ({
				name: i.name,
				ownerName: i.owner?.name ?? "a neighbor",
				endDate: i.claim?.endDate
					? new Date(i.claim.endDate).toLocaleDateString(locale)
					: "unknown",
			}));
		} catch {
			return {
				error: "Could not fetch your borrowed items right now.",
			};
		}
	},
}),

browseItems: tool({
	description:
		"Search available items from other neighbors. Filter by name/keyword and/or category. Use when the user wants to find something to borrow.",
	parameters: z.object({
		query: z
			.string()
			.optional()
			.describe("Search term to match against item names"),
		category: z
			.string()
			.optional()
			.describe(
				"Category filter: kitchen, furniture, electronics, clothing, books, sports, other",
			),
	}),
	execute: async ({ query, category }) => {
		try {
			const allItems = await convex.query(api.items.get);
			let filtered = allItems;
			if (query) {
				const q = query.toLowerCase();
				filtered = filtered.filter((i: any) =>
					i.name.toLowerCase().includes(q),
				);
			}
			if (category) {
				filtered = filtered.filter(
					(i: any) => i.category === category,
				);
			}
			const top10 = filtered.slice(0, 10);
			return top10.map((i: any) => ({
				id: i._id,
				name: i.name,
				description: i.description ?? "",
				category: i.category ?? "other",
			}));
		} catch {
			return {
				error: "Could not search items right now.",
			};
		}
	},
}),

getItemDetails: tool({
	description:
		"Get full details of a specific item by ID: description, category, owner name, location. Use after browseItems to learn more about a specific item.",
	parameters: z.object({
		itemId: z.string().describe("The item ID from browseItems results"),
	}),
	execute: async ({ itemId }) => {
		try {
			const item = await convex.query(api.items.getById, {
				id: itemId as any, // ConvexHttpClient accepts string IDs at runtime
			});
			if (!item) return { error: "Item not found." };
			// getById returns { ...item, isOwner } — ownerId is a Clerk user ID, resolve name separately
			const ownerInfo = await convex.query(api.users.getBasicInfo, {
				userId: item.ownerId,
			});
			return {
				name: item.name,
				description: item.description ?? "",
				category: item.category ?? "other",
				ownerName: ownerInfo?.name ?? "a neighbor",
				location: item.location?.address ?? null,
			};
		} catch {
			return { error: "Could not fetch item details right now." };
		}
	},
}),

getItemAvailability: tool({
	description:
		"Get the availability calendar for an item — which date ranges are booked vs free. Use when the user asks when an item is available.",
	parameters: z.object({
		itemId: z.string().describe("The item ID"),
	}),
	execute: async ({ itemId }) => {
		try {
			const ranges = await convex.query(api.items.getAvailability, {
				id: itemId as any,
			});
			if (ranges.length === 0) return { available: "fully available" };
			return {
				bookedRanges: ranges.map((r: any) => ({
					from: new Date(r.startDate).toLocaleDateString(locale),
					to: new Date(r.endDate).toLocaleDateString(locale),
				})),
			};
		} catch {
			return {
				error: "Could not fetch availability right now.",
			};
		}
	},
}),
```

- [ ] **Step 2: Test in browser**

Ask "find me something in electronics". Sharry should call `browseItems` and list results.
Ask "when is [item name] available?" — should call `getItemAvailability`.

- [ ] **Step 3: Commit**

```bash
git add lib/sharry-tools.ts
git commit -m "feat(chat): add browsing and discovery tools"
```

---

### Task 5: Add claims, profile, notifications, and navigation tools

**Files:**
- Modify: `lib/sharry-tools.ts`

- [ ] **Step 1: Add `getClaimsOnItem`, `getUserProfile`, `getNotifications`, `navigateTo`**

Add these tools inside the `buildTools` return object:

```typescript
getClaimsOnItem: tool({
	description:
		"Look up who has requested or is fostering a specific item owned by the user. Takes an item name and resolves it. Use when the user asks about requests on their items.",
	parameters: z.object({
		itemName: z
			.string()
			.describe("Name of the user's item (partial match OK)"),
	}),
	execute: async ({ itemName }) => {
		try {
			const items = await convex.query(api.items.getMyItems);
			const owned = items.filter((i: any) => i.isOwner);
			const q = itemName.toLowerCase();
			const matches = owned.filter((i: any) =>
				i.name.toLowerCase().includes(q),
			);
			if (matches.length === 0) {
				return {
					error: `No item found matching "${itemName}". Your items: ${owned.map((i: any) => i.name).join(", ")}`,
				};
			}
			if (matches.length > 1) {
				return {
					clarify: `Multiple items match: ${matches.map((i: any) => i.name).join(", ")}. Which one?`,
				};
			}
			const item = matches[0];
			const claims = await convex.query(api.items.getClaims, {
				id: item._id,
			});
			// getClaims returns raw claim docs — claimerId is a Clerk user ID, resolve names
			const enriched = await Promise.all(
				claims.map(async (c: any) => {
					const claimer = await convex.query(
						api.users.getBasicInfo,
						{ userId: c.claimerId },
					);
					return {
						claimerName: claimer?.name ?? "a neighbor",
						status: c.status,
						startDate: new Date(c.startDate).toLocaleDateString(locale),
						endDate: new Date(c.endDate).toLocaleDateString(locale),
					};
				}),
			);
			return enriched;
		} catch {
			return { error: "Could not look up claims right now." };
		}
	},
}),

getUserProfile: tool({
	description:
		"Get public profile info and rating summary for a user. Use when the user asks about someone (e.g., a person who requested their item).",
	parameters: z.object({
		userId: z.string().describe("The user ID to look up"),
	}),
	execute: async ({ userId }) => {
		try {
			const [profile, ratings] = await Promise.all([
				convex.query(api.users.getProfile, { userId }),
				convex.query(api.ratings.getRatingSummary, { userId }),
			]);
			return {
				name: profile?.name ?? "Unknown",
				bio: profile?.bio ?? "",
				averageStars: ratings?.averageStars ?? null,
				totalRatings: ratings?.totalRatings ?? 0,
			};
		} catch {
			return { error: "Could not fetch profile right now." };
		}
	},
}),

getNotifications: tool({
	description:
		"Get the user's recent notifications (requests, approvals, pickups, returns, ratings). Use when the user asks for updates or what's new.",
	parameters: z.object({}),
	execute: async () => {
		try {
			const notifs = await convex.query(api.notifications.get);
			const recent = notifs.slice(0, 10);
			// notifications.get returns { ...n, item, claim, raterName }
			// n has: type, isRead, createdAt — no "message" or "itemName" field
			return recent.map((n: any) => ({
				type: n.type.replace(/_/g, " "),
				isRead: n.isRead,
				itemName: n.item?.name ?? null,
				createdAt: n.createdAt
					? new Date(n.createdAt).toLocaleDateString(locale)
					: null,
			}));
		} catch {
			return { error: "Could not fetch notifications right now." };
		}
	},
}),

navigateTo: tool({
	description:
		"Generate a link to a page in the app. Use when the user wants to go somewhere or you want to point them to a specific page.",
	parameters: z.object({
		page: z
			.enum([
				"home",
				"my-items",
				"profile",
				"wishlist",
				"notifications",
				"item-detail",
			])
			.describe("The page to navigate to"),
		itemId: z
			.string()
			.optional()
			.describe("Required for item-detail page"),
	}),
	execute: async ({ page, itemId }) => {
		const paths: Record<string, string> = {
			home: `/${locale}`,
			"my-items": `/${locale}/my-items`,
			profile: `/${locale}/profile`,
			wishlist: `/${locale}/wishlist`,
			notifications: `/${locale}/notifications`,
			"item-detail": `/${locale}/items/${itemId ?? ""}`,
		};
		return { url: paths[page] ?? `/${locale}` };
	},
}),
```

- [ ] **Step 2: Test in browser**

Ask "who requested my [item]?" — should call `getClaimsOnItem`.
Ask "any updates?" — should call `getNotifications`.
Ask "take me to my items" — should call `navigateTo` and mention the link.

- [ ] **Step 3: Commit**

```bash
git add lib/sharry-tools.ts
git commit -m "feat(chat): add claims, profile, notifications, and navigation tools"
```

---

## Chunk 3: Prompt Update + Link Rendering + Evals

### Task 6: Update system prompt with tool-use guidance

**Files:**
- Modify: `lib/sharry-prompt.ts`

- [ ] **Step 1: Add tool-use section to `buildSystemPrompt`**

Add a new `SHARRY_TOOL_GUIDANCE` constant and include it in the prompt:

```typescript
export const SHARRY_TOOL_GUIDANCE = `## Using tools
You have tools to look up live data. Follow these rules:
- If you can answer from the user's current state above, do so. Only call a tool when you need more detail.
- When you get results from a tool, summarize them conversationally. Don't dump raw data.
- If a tool returns an error, tell the user you couldn't look that up and suggest they check the app directly.
- If a tool returns a clarification (multiple matches), ask the user which one they meant.
- When you use navigateTo, include the URL naturally in your response so the user can tap it.
- Never mention photos or images — the chat cannot display them.
- Never mention tool names or that you're "calling a function." Just answer naturally.`;
```

In `buildSystemPrompt`, add it after `SHARRY_APP_KNOWLEDGE`:

```typescript
parts.push(SHARRY_APP_KNOWLEDGE);
parts.push(SHARRY_TOOL_GUIDANCE);
```

- [ ] **Step 2: Verify dev server compiles**

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/sharry-prompt.ts
git commit -m "feat(chat): add tool-use guidance to system prompt"
```

---

### Task 7: Render internal links in chat messages

**Files:**
- Modify: `components/chat-widget.tsx:229-287`

- [ ] **Step 1: Add link detection and rendering to message display**

Replace the plain text rendering with a function that detects internal links and wraps them in anchor tags. Add this helper above `ChatWidget`:

```typescript
function renderMessageContent(text: string, locale: string) {
	// Match internal paths like /en/my-items or /en/items/abc123
	const linkRegex = /(\/(en|vi|ru)\/[a-zA-Z0-9\-\/]+)/g;
	const parts = text.split(linkRegex);

	if (parts.length === 1) return text;

	const elements: React.ReactNode[] = [];
	let lastIndex = 0;
	for (const match of text.matchAll(linkRegex)) {
		const before = text.slice(lastIndex, match.index);
		if (before) elements.push(before);
		elements.push(
			<a
				key={match.index}
				href={match[0]}
				style={{ color: "#2D4A35", textDecoration: "underline" }}
			>
				{match[0]}
			</a>,
		);
		lastIndex = match.index! + match[0].length;
	}
	const after = text.slice(lastIndex);
	if (after) elements.push(after);
	return <>{elements}</>;
}
```

Then in the message rendering (line ~264), replace `{text || (` with `{text ? renderMessageContent(text, locale) : (`.

- [ ] **Step 2: Test in browser**

Ask "take me to my items". Sharry should respond with a tappable link.

- [ ] **Step 3: Commit**

```bash
git add components/chat-widget.tsx
git commit -m "feat(chat): render internal links in chat messages"
```

---

### Task 8: Add tool-use eval test cases

**Files:**
- Modify: `evals/promptfooconfig.yaml`

- [ ] **Step 1: Add "Tool Use" test category**

Add new test cases to the `tests` array in `promptfooconfig.yaml`. Note: these test the prompt/tool interaction via the eval provider. Since the eval provider uses `generateText` (not `streamText` with tools), these tests verify the prompt guidance — that Sharry says "let me check" or references data correctly when given tool-like context.

```yaml
  # ── Tool Use Awareness (4 cases) ──
  - vars:
      prompt: "who requested my Electric Drill?"
      userContext:
        stage: "has_pending_claims"
        itemCount: 3
        itemNames: ["Electric Drill", "Yoga Mat", "Camping Tent"]
        activeBorrows: 0
        fosteringItemNames: []
        pendingClaimsOnMyItems: 2
        pendingMyRequests: 0
    assert:
      - type: llm-rubric
        value: "Response should reference the Electric Drill by name and acknowledge pending requests. Should not say it can't see the user's data."

  - vars:
      prompt: "find me something in electronics"
      userContext:
        stage: "active_user"
        itemCount: 1
        itemNames: ["Yoga Mat"]
        activeBorrows: 0
        fosteringItemNames: []
        pendingClaimsOnMyItems: 0
        pendingMyRequests: 0
    assert:
      - type: llm-rubric
        value: "Response should offer to help find electronics items or suggest browsing the home page. Should not say it can't search."

  - vars:
      prompt: "any updates for me?"
      userContext:
        stage: "active_user"
        itemCount: 2
        itemNames: ["Drill", "Tent"]
        activeBorrows: 1
        fosteringItemNames: ["Blender"]
        pendingClaimsOnMyItems: 1
        pendingMyRequests: 0
    assert:
      - type: llm-rubric
        value: "Response should reference the user's activity (pending request, fostering a Blender) or offer to check notifications. Should not deflect."

  - vars:
      prompt: "take me to my items"
      userContext:
        stage: "active_user"
        itemCount: 2
        itemNames: ["Drill", "Tent"]
        activeBorrows: 0
        fosteringItemNames: []
        pendingClaimsOnMyItems: 0
        pendingMyRequests: 0
    assert:
      - type: llm-rubric
        value: "Response should direct the user to the My Items page. Can reference the page name or provide navigation guidance."
```

- [ ] **Step 2: Run evals**

```bash
./scripts/run-evals.sh
```

Expected: All tests pass (including new ones).

- [ ] **Step 3: Commit**

```bash
git add evals/promptfooconfig.yaml
git commit -m "test(evals): add tool-use awareness test cases"
```

---

### Task 9: Manual integration testing

- [ ] **Step 1: Test all 9 tools end-to-end in the browser**

Open the chat widget and test these conversations:
1. "what items do I have listed?" → should list items with details
2. "what am I fostering?" → should list borrowed items with owner/dates
3. "who requested my [item name]?" → should show claims
4. "find me a drill" → should search available items
5. "tell me more about that one" (after browse) → should get item details
6. "when is it available?" → should show calendar availability
7. "who is [person]?" → may not have userId context, but should handle gracefully
8. "any updates?" → should show notifications
9. "take me to my items" → should include a tappable link

- [ ] **Step 2: Test edge cases**

1. Ask about items when logged out → should say "sign in first"
2. Ask "who requested my nonexistent thing?" → should handle no-match gracefully
3. Ask a simple question answerable from context ("how many items do I have?") → should NOT call a tool, should answer from prefetched context

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(chat): address integration test findings"
```
