# Sharry Evals — Design Spec

## Overview

Promptfoo-based evaluation suite for Sharry, the AI chat assistant. Tests cover all knowledge areas in the system prompt, user context awareness, and multilingual behavior. Runs locally via CLI and on PRs via GitHub Actions.

## Goals

- Systematically verify Sharry's knowledge across all app features
- Catch regressions when the system prompt changes
- Validate user-context-aware responses (stage, counts)
- Verify multilingual behavior (EN, VI, RU)

## Architecture

```
promptfoo eval
  → evals/provider.js
      → imports buildSystemPrompt from lib/sharry-prompt.ts
      → builds system prompt using test vars (userContext, locale)
      → calls Claude Haiku 4.5 via @ai-sdk/anthropic
  → evals/promptfooconfig.yaml
      → 34 test cases with assertions
  → terminal output or promptfoo web viewer
```

Promptfoo calls Claude Haiku 4.5 directly — no running dev server needed. The system prompt builder is extracted to a shared module so both the API route and the eval provider use the same logic.

### Why not test the HTTP route?

Testing the `/api/chat` endpoint would require a running Next.js server, streaming response parsing, and adds network latency. Since Sharry's behavior is entirely determined by the system prompt + model, testing the prompt directly is simpler, faster, and just as accurate.

## Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `lib/sharry-prompt.ts` | Extracted `buildSystemPrompt`, `SHARRY_IDENTITY`, `SHARRY_APP_KNOWLEDGE`, `UserContext` type |
| Modify | `app/api/chat/route.ts` | Import from `lib/sharry-prompt.ts` instead of defining inline |
| Create | `evals/provider.js` | Promptfoo JS provider — builds prompt, calls Claude |
| Create | `evals/promptfooconfig.yaml` | Test suite — 34 test cases with assertions |
| Create | `.github/workflows/sharry-evals.yml` | CI workflow for PRs |

## Shared Prompt Module (`lib/sharry-prompt.ts`)

Extract from `app/api/chat/route.ts`:

- `SHARRY_IDENTITY` constant
- `SHARRY_APP_KNOWLEDGE` constant
- `UserContext` interface
- `buildUserContext()` function
- `buildSystemPrompt()` function

The route imports and uses these. The eval provider also imports `buildSystemPrompt`.

## Promptfoo Provider (`evals/provider.js`)

A custom JS provider that:

1. Reads `vars.userContext` and `vars.locale` from the test case
2. Calls `buildSystemPrompt({ userContext, locale })`
3. Calls Claude Haiku 4.5 via `generateText` from the AI SDK
4. Returns the response text

```javascript
// evals/provider.js
module.exports = {
  id: () => "sharry-haiku",
  callApi: async (prompt, context) => {
    const { userContext, locale } = context.vars;
    const systemPrompt = buildSystemPrompt({ userContext, locale });
    // call Claude Haiku 4.5 with system + prompt
    // return { output: response.text }
  },
};
```

**Note:** Since the project uses TypeScript + ESM, the provider may need to use dynamic imports or a small wrapper. Implementation details will be resolved in the plan.

## Test Suite (`evals/promptfooconfig.yaml`)

### Assertion Strategy

- **Deterministic** (`icontains`, `not-icontains`, `regex`): For terminology, anti-terms, emoji rules. Free and fast.
- **LLM-as-judge** (`llm-rubric`): For quality, completeness, tone, accuracy. Uses Claude Haiku as grader.

### Test Cases (34 total)

#### 1. Brand & Identity (4 tests)

| Input | Assertions |
|-------|------------|
| "What is Sharity?" | `llm-rubric`: mentions Da Lat, sharing community, practical tone. `icontains`: "neighbors" |
| "Who are you?" | `icontains`: "Sharry". `llm-rubric`: warm, not corporate |
| "Why should I use this?" | `not-icontains`: "users", "customers", "platform" |
| Casual greeting "hey what's up" | `regex`: at most one emoji, not at message start |

#### 2. Sharing Flow (4 tests)

| Input | Assertions |
|-------|------------|
| "How do I share an item?" | `icontains`: "+". `llm-rubric`: covers name, description, photos, category, location |
| "How do I approve a request?" | `icontains`: "My Items". `llm-rubric`: mentions pending requests |
| "What happens after I approve?" | `llm-rubric`: mentions pickup coordination |
| "How do I confirm a return?" | `llm-rubric`: accurate return flow |

#### 3. Fostering Flow (3 tests)

| Input | Assertions |
|-------|------------|
| "How does fostering work?" | `icontains`: "calendar". `llm-rubric`: browse → request → approval → pickup → return |
| "How do I request an item?" | `llm-rubric`: mentions date selection and calendar |
| "How do I return an item?" | `llm-rubric`: accurate return process |

#### 4. Giveaways (2 tests)

| Input | Assertions |
|-------|------------|
| "What are giveaway items?" | `llm-rubric`: permanent transfer, no return needed |
| "How is a giveaway different from fostering?" | `llm-rubric`: correctly distinguishes the two |

#### 5. Rules & Limits (3 tests)

| Input | Assertions |
|-------|------------|
| "Can I request my own item?" | `llm-rubric`: says no |
| "How many requests can an item have?" | `icontains`: "5" |
| "Who can cancel a request?" | `llm-rubric`: only the requester/fosterer can cancel |

#### 6. Pages & Navigation (6 tests)

| Input | Assertions |
|-------|------------|
| "Where do I see my items?" | `icontains`: "My Items" |
| "How do ratings work?" | `llm-rubric`: both sides rate, 1-5 stars |
| "How does the wishlist work?" | `llm-rubric`: request items you wish existed, others can vote |
| "Where do I see my notifications?" | `icontains`: "Notifications". `llm-rubric`: mentions requests, approvals, pickups, returns |
| "What categories can I choose from?" | `icontains-any`: "kitchen", "furniture", "electronics", "books" |
| "How do I edit my profile?" | `llm-rubric`: mentions name, avatar, contacts, bio |

#### 7. User Context Awareness (4 tests)

Each test injects a different `userContext` via vars:

| Stage | Input | Assertions |
|-------|-------|------------|
| `new_user` (0 items, 0 borrows) | "Any tips?" | `llm-rubric`: encourages adding first item or browsing |
| `has_items_no_activity` (3 items, 0 claims) | "Nobody's requesting my stuff" | `llm-rubric`: suggests improving listings (photos, descriptions) |
| `has_pending_claims` (2 pending) | "What should I do?" | `icontains`: "pending". `llm-rubric`: nudges to review requests |
| `active_user` | "How's it going?" | `llm-rubric`: general help, no forced nudge |

#### 8. Multilingual (4 tests)

| Locale | Input | Assertions |
|--------|-------|------------|
| `ru` | "Как добавить вещь?" | `llm-rubric`: responds in Russian, explains adding an item |
| `vi` | "Làm sao để mượn đồ?" | `llm-rubric`: responds in Vietnamese, explains fostering |
| `en` | "Привет, расскажи о Sharity" | `llm-rubric`: switches to Russian (language detection overrides locale) |
| `en` | "What is Sharity?" | `llm-rubric`: responds in English |

#### 9. Context Numbers (4 tests)

Each test injects specific counts in `userContext`:

| Context | Input | Assertions |
|---------|-------|------------|
| `{itemCount: 3, activeBorrows: 1, pendingClaimsOnMyItems: 2}` | "What's going on with my stuff?" | `llm-rubric`: references specific counts |
| `{itemCount: 0, activeBorrows: 0}` | "How many items do I have?" | `llm-rubric`: says they haven't listed anything |
| `{activeBorrows: 3}` | "What am I fostering?" | `llm-rubric`: mentions fostering 3 items |
| `{pendingMyRequests: 2}` | "Did anyone respond to my requests?" | `llm-rubric`: references 2 pending outgoing requests |

## CI Integration (`.github/workflows/sharry-evals.yml`)

**Trigger:** PRs that modify:
- `app/api/chat/**`
- `lib/sharry-prompt.ts`
- `evals/**`

**Steps:**
1. Checkout + install deps
2. `npx promptfoo eval --output results.json`
3. Fail if overall pass rate < 90%

**Secrets required:** `ANTHROPIC_API_KEY` in GitHub Actions secrets.

## Running Locally

```bash
# Run all evals
npx promptfoo eval

# View results in browser
npx promptfoo view

# Run specific test by description
npx promptfoo eval --filter-description "What is Sharity"
```

Add to `package.json` scripts:
```json
{
  "eval": "promptfoo eval",
  "eval:view": "promptfoo eval && promptfoo view"
}
```

## Cost

- ~34 test cases per run
- ~1K input tokens + ~200 output tokens per case (Claude Haiku 4.5)
- `llm-rubric` adds one grading call per assertion (~30 extra calls)
- **~$0.20 per run**, under $5/month with normal PR cadence

## Non-Goals

- Testing the HTTP route or streaming behavior (covered by manual testing)
- Testing Convex query (`getUserContext`) — that's a DB concern, not an LLM concern
- Chat history / multi-turn conversation testing (Phase 1 is single-turn)
- Load testing or latency benchmarking
