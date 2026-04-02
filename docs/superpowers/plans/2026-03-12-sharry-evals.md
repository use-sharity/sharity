# Sharry Evals Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a promptfoo-based evaluation suite for Sharry with 34 test cases covering all knowledge areas, user context, and multilingual behavior.

**Architecture:** Extract the system prompt builder to a shared module (`lib/sharry-prompt.ts`), create a promptfoo ESM provider that calls Claude Haiku 4.5 directly, and define 34 test cases in YAML with a mix of deterministic and LLM-judge assertions. CI via GitHub Actions on relevant PRs.

**Tech Stack:** promptfoo, tsx, @ai-sdk/anthropic, Vercel AI SDK (`generateText`), GitHub Actions

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `lib/sharry-prompt.ts` | Shared prompt constants, types, and builder functions |
| Modify | `app/api/chat/route.ts` | Import from shared module instead of inline definitions |
| Create | `evals/provider.mjs` | Promptfoo custom provider — builds prompt, calls Claude |
| Create | `evals/promptfooconfig.yaml` | All 34 test cases with assertions |
| Create | `.github/workflows/sharry-evals.yml` | CI workflow |
| Modify | `package.json` | Add `eval` and `eval:view` scripts, add promptfoo + tsx devDeps |

**Why `provider.mjs`?** Promptfoo runs providers in Node. Using `.mjs` lets us use ESM `import` syntax. The provider registers the `tsx` loader to import our TypeScript shared module directly.

**Local setup note:** `ANTHROPIC_API_KEY` must be set in your environment (already in `.env.local` for dev). Promptfoo will pick it up automatically.

---

## Chunk 1: Extract shared prompt module + install deps

### Task 1: Extract prompt to shared module

**Files:**
- Create: `lib/sharry-prompt.ts`
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: Create `lib/sharry-prompt.ts`**

Copy the following constants, types, and functions from `app/api/chat/route.ts` (lines 6-147) into a new file:

```typescript
// lib/sharry-prompt.ts

export const SHARRY_IDENTITY = `You are Sharry, Sharity's AI assistant.

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

export const SHARRY_APP_KNOWLEDGE = `## How Sharity works

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

export interface UserContext {
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
	lines.push(
		`- Pending requests on their items: ${ctx.pendingClaimsOnMyItems}`,
	);
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

export function buildSystemPrompt({
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
```

- [ ] **Step 2: Update `app/api/chat/route.ts` to import from shared module**

Replace lines 1-147 (everything above `// --- Route handler ---`) with:

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText } from "ai";
import { buildSystemPrompt } from "@/lib/sharry-prompt";
```

The `POST` handler (lines 149-179) stays exactly the same.

- [ ] **Step 3: Verify build passes**

Run: `pnpm build 2>&1 | tail -20`
Expected: "Compiled successfully" — no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add lib/sharry-prompt.ts app/api/chat/route.ts
git commit -m "refactor: extract Sharry prompt to shared module

Move SHARRY_IDENTITY, SHARRY_APP_KNOWLEDGE, UserContext, and
buildSystemPrompt to lib/sharry-prompt.ts for reuse by eval provider."
```

### Task 2: Install promptfoo, tsx, and add scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install promptfoo and tsx as dev dependencies**

Run: `pnpm add -D promptfoo tsx`

- [ ] **Step 2: Add eval scripts to package.json**

Add to the `"scripts"` section:

```json
"eval": "promptfoo eval -c evals/promptfooconfig.yaml",
"eval:view": "promptfoo eval -c evals/promptfooconfig.yaml && promptfoo view"
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add promptfoo and tsx for Sharry evals"
```

---

## Chunk 2: Provider + test suite

### Task 3: Create the promptfoo provider

**Files:**
- Create: `evals/provider.mjs`

- [ ] **Step 1: Create `evals/provider.mjs`**

```javascript
// evals/provider.mjs
//
// Promptfoo custom provider for Sharry.
// Builds the system prompt from test vars, calls Claude Haiku 4.5.

import { register } from "node:module";

// Register tsx loader so we can import .ts files
register("tsx/esm", import.meta.url);

const { buildSystemPrompt } = await import("../lib/sharry-prompt.ts");
const { anthropic } = await import("@ai-sdk/anthropic");
const { generateText } = await import("ai");

/** @type {import('promptfoo').ApiProvider} */
export default {
	id: () => "sharry-haiku",

	callApi: async (prompt, context) => {
		const userContext = context?.vars?.userContext ?? null;
		const locale = context?.vars?.locale ?? "en";

		const systemPrompt = buildSystemPrompt({ userContext, locale });

		try {
			const result = await generateText({
				model: anthropic("claude-haiku-4-5-20251001"),
				system: systemPrompt,
				prompt,
				maxOutputTokens: 600,
				temperature: 0.5,
			});

			return { output: result.text };
		} catch (error) {
			return { error: error.message ?? String(error) };
		}
	},
};
```

- [ ] **Step 2: Smoke-test the provider import**

Run: `node evals/provider.mjs 2>&1 | head -5`
Expected: No crash (the module loads and exits silently). If it crashes with an import error, check that `tsx` is installed and the path to `lib/sharry-prompt.ts` is correct.

- [ ] **Step 3: Commit**

```bash
git add evals/provider.mjs
git commit -m "feat(evals): add promptfoo provider for Sharry"
```

### Task 4: Create the test suite

**Files:**
- Create: `evals/promptfooconfig.yaml`

- [ ] **Step 1: Create `evals/promptfooconfig.yaml`**

```yaml
# evals/promptfooconfig.yaml
# Sharry AI assistant evaluation suite — 34 test cases

description: "Sharry chatbot evals"

providers:
  - file://provider.mjs

prompts:
  - "{{prompt}}"

defaultTest:
  options:
    provider: "anthropic:messages:claude-haiku-4-5-20251001"

tests:
  # ── 1. Brand & Identity (4 tests) ──────────────────────────

  - description: "Brand: What is Sharity?"
    vars:
      prompt: "What is Sharity?"
      locale: "en"
    assert:
      - type: icontains
        value: "neighbors"
      - type: llm-rubric
        value: "The response mentions Da Lat, describes a sharing community, and has a practical warm tone. It should not sound corporate or over-enthusiastic."

  - description: "Brand: Who are you?"
    vars:
      prompt: "Who are you?"
      locale: "en"
    assert:
      - type: icontains
        value: "Sharry"
      - type: llm-rubric
        value: "The response is warm and friendly, identifies as Sharry, and does not sound corporate or robotic."

  - description: "Brand: No corporate terms"
    vars:
      prompt: "Why should I use this?"
      locale: "en"
    assert:
      - type: not-icontains
        value: "users"
      - type: not-icontains
        value: "customers"
      - type: not-icontains
        value: "platform"

  - description: "Brand: Emoji restraint"
    vars:
      prompt: "Hey what's up"
      locale: "en"
    assert:
      - type: javascript
        value: |
          const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
          const emojis = (output || '').match(emojiRegex) || [];
          return emojis.length <= 1;

  # ── 2. Sharing Flow (4 tests) ──────────────────────────────

  - description: "Sharing: How to share an item"
    vars:
      prompt: "How do I share an item?"
      locale: "en"
    assert:
      - type: icontains
        value: "+"
      - type: llm-rubric
        value: "The response explains how to add an item and mentions: name, description, photos, category, and location."

  - description: "Sharing: How to approve a request"
    vars:
      prompt: "How do I approve a request?"
      locale: "en"
    assert:
      - type: icontains
        value: "My Items"
      - type: llm-rubric
        value: "The response explains how to find and approve pending requests on your items."

  - description: "Sharing: What happens after approval"
    vars:
      prompt: "What happens after I approve a request?"
      locale: "en"
    assert:
      - type: llm-rubric
        value: "The response mentions coordinating pickup with the borrower, including a pickup time proposal."

  - description: "Sharing: How to confirm a return"
    vars:
      prompt: "How do I confirm that someone returned my item?"
      locale: "en"
    assert:
      - type: llm-rubric
        value: "The response accurately describes the return confirmation flow."

  # ── 3. Fostering Flow (3 tests) ────────────────────────────

  - description: "Fostering: How does it work"
    vars:
      prompt: "How does fostering work?"
      locale: "en"
    assert:
      - type: icontains
        value: "calendar"
      - type: llm-rubric
        value: "The response covers the full fostering flow: browse items, request with dates, wait for approval, coordinate pickup, and return when done."

  - description: "Fostering: How to request an item"
    vars:
      prompt: "How do I request an item?"
      locale: "en"
    assert:
      - type: llm-rubric
        value: "The response mentions selecting dates on the calendar and submitting a request."

  - description: "Fostering: How to return an item"
    vars:
      prompt: "How do I return an item?"
      locale: "en"
    assert:
      - type: llm-rubric
        value: "The response accurately describes the return process."

  # ── 4. Giveaways (2 tests) ────────────────────────────────

  - description: "Giveaways: What are they"
    vars:
      prompt: "What are giveaway items?"
      locale: "en"
    assert:
      - type: llm-rubric
        value: "The response explains that giveaway items transfer permanently with no return needed."

  - description: "Giveaways: Difference from fostering"
    vars:
      prompt: "How is a giveaway different from fostering?"
      locale: "en"
    assert:
      - type: llm-rubric
        value: "The response correctly distinguishes giveaways (permanent transfer) from fostering (temporary loan with return)."

  # ── 5. Rules & Limits (3 tests) ───────────────────────────

  - description: "Rules: Can't request own item"
    vars:
      prompt: "Can I request my own item?"
      locale: "en"
    assert:
      - type: llm-rubric
        value: "The response clearly states that you cannot request your own item."

  - description: "Rules: Max pending requests"
    vars:
      prompt: "How many requests can an item have?"
      locale: "en"
    assert:
      - type: icontains
        value: "5"

  - description: "Rules: Who can cancel"
    vars:
      prompt: "Who can cancel a request?"
      locale: "en"
    assert:
      - type: llm-rubric
        value: "The response states that only the person who made the request (the fosterer/requester) can cancel it."

  # ── 6. Pages & Navigation (6 tests) ───────────────────────

  - description: "Pages: Where are my items"
    vars:
      prompt: "Where do I see my items?"
      locale: "en"
    assert:
      - type: icontains
        value: "My Items"

  - description: "Pages: How do ratings work"
    vars:
      prompt: "How do ratings work?"
      locale: "en"
    assert:
      - type: llm-rubric
        value: "The response explains that both sides rate after a transaction, with 1-5 stars."

  - description: "Pages: How does the wishlist work"
    vars:
      prompt: "How does the wishlist work?"
      locale: "en"
    assert:
      - type: llm-rubric
        value: "The response explains the wishlist: request items you wish someone would share, others can vote on wishes."

  - description: "Pages: Notifications"
    vars:
      prompt: "Where do I see my notifications?"
      locale: "en"
    assert:
      - type: icontains
        value: "Notifications"
      - type: llm-rubric
        value: "The response mentions that notifications cover requests, approvals, pickups, returns, and ratings."

  - description: "Pages: Item categories"
    vars:
      prompt: "What categories can I choose from?"
      locale: "en"
    assert:
      - type: icontains-any
        value:
          - "kitchen"
          - "furniture"
          - "electronics"
          - "books"

  - description: "Pages: Edit profile"
    vars:
      prompt: "How do I edit my profile?"
      locale: "en"
    assert:
      - type: llm-rubric
        value: "The response explains how to edit your profile, mentioning name, avatar, contacts, or bio."

  # ── 7. User Context Awareness (4 tests) ───────────────────

  - description: "Context: New user tips"
    vars:
      prompt: "Any tips for getting started?"
      locale: "en"
      userContext:
        stage: "new_user"
        itemCount: 0
        activeBorrows: 0
        pendingClaimsOnMyItems: 0
        pendingMyRequests: 0
    assert:
      - type: llm-rubric
        value: "The response encourages a new user to add their first item or browse what's available."

  - description: "Context: No activity on items"
    vars:
      prompt: "Nobody's requesting my stuff, what should I do?"
      locale: "en"
      userContext:
        stage: "has_items_no_activity"
        itemCount: 3
        activeBorrows: 0
        pendingClaimsOnMyItems: 0
        pendingMyRequests: 0
    assert:
      - type: llm-rubric
        value: "The response suggests improving listings with better photos or descriptions, or patience."

  - description: "Context: Has pending claims"
    vars:
      prompt: "What should I do next?"
      locale: "en"
      userContext:
        stage: "has_pending_claims"
        itemCount: 2
        activeBorrows: 0
        pendingClaimsOnMyItems: 2
        pendingMyRequests: 0
    assert:
      - type: icontains
        value: "pending"
      - type: llm-rubric
        value: "The response nudges the user to review their pending requests in My Items."

  - description: "Context: Active user, no nudge"
    vars:
      prompt: "How's it going?"
      locale: "en"
      userContext:
        stage: "active_user"
        itemCount: 5
        activeBorrows: 2
        pendingClaimsOnMyItems: 0
        pendingMyRequests: 1
    assert:
      - type: llm-rubric
        value: "The response provides general help without forcing a specific nudge or action."

  # ── 8. Multilingual (4 tests) ─────────────────────────────

  - description: "Language: Russian locale"
    vars:
      prompt: "Как добавить вещь?"
      locale: "ru"
    assert:
      - type: llm-rubric
        value: "The response is in Russian and explains how to add an item to Sharity."

  - description: "Language: Vietnamese locale"
    vars:
      prompt: "Làm sao để mượn đồ?"
      locale: "vi"
    assert:
      - type: llm-rubric
        value: "The response is in Vietnamese and explains how fostering (borrowing) works."

  - description: "Language: Switches to Russian from English locale"
    vars:
      prompt: "Привет, расскажи о Sharity"
      locale: "en"
    assert:
      - type: llm-rubric
        value: "The response is in Russian because the user wrote in Russian, even though the default locale is English."

  - description: "Language: Stays in English"
    vars:
      prompt: "What is Sharity?"
      locale: "en"
    assert:
      - type: llm-rubric
        value: "The response is in English."

  # ── 9. Context Numbers (4 tests) ──────────────────────────

  - description: "Numbers: References item and request counts"
    vars:
      prompt: "What's going on with my stuff?"
      locale: "en"
      userContext:
        stage: "has_pending_claims"
        itemCount: 3
        activeBorrows: 1
        pendingClaimsOnMyItems: 2
        pendingMyRequests: 0
    assert:
      - type: llm-rubric
        value: "The response references specific numbers from the user context: 3 items listed, 2 pending requests, or 1 item being fostered."

  - description: "Numbers: Zero items"
    vars:
      prompt: "How many items do I have?"
      locale: "en"
      userContext:
        stage: "new_user"
        itemCount: 0
        activeBorrows: 0
        pendingClaimsOnMyItems: 0
        pendingMyRequests: 0
    assert:
      - type: llm-rubric
        value: "The response acknowledges the user hasn't listed any items yet."

  - description: "Numbers: Active borrows count"
    vars:
      prompt: "What am I fostering right now?"
      locale: "en"
      userContext:
        stage: "active_user"
        itemCount: 2
        activeBorrows: 3
        pendingClaimsOnMyItems: 0
        pendingMyRequests: 0
    assert:
      - type: llm-rubric
        value: "The response mentions that the user is currently fostering 3 items."

  - description: "Numbers: Pending outgoing requests"
    vars:
      prompt: "Did anyone respond to my requests?"
      locale: "en"
      userContext:
        stage: "active_user"
        itemCount: 1
        activeBorrows: 0
        pendingClaimsOnMyItems: 0
        pendingMyRequests: 2
    assert:
      - type: llm-rubric
        value: "The response references the user's 2 pending outgoing requests."
```

- [ ] **Step 2: Run a single test to validate setup**

Run: `pnpm eval -- --filter-description "Brand: What is Sharity?" 2>&1 | tail -20`
Expected: One test runs and produces a result (pass or fail). Confirms provider + YAML are working.

- [ ] **Step 3: Run full eval suite**

Run: `pnpm eval 2>&1 | tail -30`
Expected: 34 tests run. Some may fail — that's fine for initial run. Review output.

- [ ] **Step 4: Commit**

```bash
git add evals/promptfooconfig.yaml
git commit -m "feat(evals): add 34 test cases for Sharry chatbot

Covers brand voice, sharing/fostering/giveaway flows, rules,
navigation, user context awareness, multilingual, and context numbers."
```

---

## Chunk 3: CI workflow + final verification

### Task 5: Add GitHub Actions workflow

**Files:**
- Create: `.github/workflows/sharry-evals.yml`

- [ ] **Step 1: Create `.github/workflows/sharry-evals.yml`**

```yaml
name: Sharry Evals

on:
  pull_request:
    paths:
      - "app/api/chat/**"
      - "lib/sharry-prompt.ts"
      - "evals/**"

jobs:
  eval:
    name: Run Sharry evals
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - run: pnpm eval -- --output results.json
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Check pass rate
        run: |
          node -e "
            const r = require('./results.json');
            const results = r.results?.results ?? r.results ?? [];
            const total = results.length;
            const passed = results.filter(t => t.success).length;
            const rate = total > 0 ? (passed / total * 100).toFixed(1) : 0;
            console.log('Pass rate: ' + rate + '%');
            if (parseFloat(rate) < 90) {
              console.error('FAIL: Pass rate ' + rate + '% is below 90% threshold');
              process.exit(1);
            }
          "
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/sharry-evals.yml
git commit -m "ci: add GitHub Actions workflow for Sharry evals

Runs promptfoo eval on PRs touching chat route, prompt module, or
evals config. Fails if pass rate drops below 90%."
```

### Task 6: Final verification and cleanup

- [ ] **Step 1: Run full eval suite**

Run: `pnpm eval 2>&1 | tail -30`
Expected: 34 tests run. Note the pass rate.

- [ ] **Step 2: Review failures (if any)**

If tests fail, determine if the issue is:
- **Bad assertion** (too strict or wrong expectation) → fix the YAML
- **Bad prompt behavior** (Sharry genuinely doesn't know something) → that's a real finding, leave it as a failing test and note it

- [ ] **Step 3: Build check**

Run: `pnpm build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 4: Final commit with any fixes**

```bash
git add -A
git commit -m "fix(evals): adjust assertions based on initial run"
```
