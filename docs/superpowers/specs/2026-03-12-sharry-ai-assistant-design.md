# Sharry — AI Assistant for Sharity (Phase 1 Design)

## Overview

Sharry is a context-aware AI chat assistant embedded in Sharity as a floating widget. It helps users navigate the platform, answers questions about features and rules, and uses the brand voice to keep the experience warm and practical.

Phase 1 ships a fully functional chat bot with user context awareness. Proactive nudges and conflict resolution are deferred to later phases.

## Goals

- Help users who find the platform unintuitive by answering questions in real time
- Make the experience more pleasant with a warm, brand-aligned personality
- Provide personalized guidance based on the user's current state (new user, active lender, etc.)
- Support all 3 app languages (EN, VI, RU)

## Non-Goals (Phase 1)

- Proactive nudges (auto-opening chat on stage transitions)
- Conflict resolution / dispute mediation
- Photo handling in chat
- Chat history persistence across sessions
- Rate limiting (not reliable in serverless; add Upstash later if needed)

## Architecture

```
User ↔ ChatWidget (useChat) ↔ POST /api/chat ↔ Claude Haiku 4.5 (Anthropic API)
                ↕
         Convex (getUserContext query)
```

### Components

| Component | File | Purpose |
|-----------|------|---------|
| API Route | `app/api/chat/route.ts` | Builds system prompt, calls Claude via Vercel AI SDK |
| Chat Widget | `components/chat-widget.tsx` | Floating bubble + chat panel UI |
| User Context Query | `convex/chat.ts` | Fetches user stage and counts from DB |

### Dependencies

```bash
pnpm add ai @ai-sdk/anthropic
```

- `ai` — Vercel AI SDK core: `streamText()` server-side, `useChat()` client-side
- `@ai-sdk/anthropic` — Anthropic provider for Vercel AI SDK

### Environment Variable

```env
ANTHROPIC_API_KEY=<key>
```

The `@ai-sdk/anthropic` provider picks this up automatically — no explicit config needed.

## Sharry — Character & Voice

### Identity

- **Name:** Sharry
- **Backstory:** Named after "Sharity." A bird character (species TBD — hoopoe, shrike, or cuckoo from the Dalat region). The bird identity is flavor for a future avatar illustration, not the personality driver.
- **Avatar (Phase 1):** Green circle with "S" letter — placeholder until custom illustration.

### Personality

Follows the Sharity brand voice exactly:

- **Tone:** Friendly and plain-spoken. Sounds like a real person, not a startup. Calm, direct, warm.
- **Always:** Practical, specific, grounded in everyday situations.
- **Never:** Word-buzzy, moralistic, corporate, over-enthusiastic.

### Language Pack

Uses Sharity terminology consistently:

| Element | Term |
|---------|------|
| Community members | Neighbors |
| The act of lending | Sharing |
| Someone borrowing | Fostering |
| A listed item | Item |

### Emoji Rules

- One emoji per message, max — sometimes none
- Place at the end of a sentence or as a natural accent, never the start
- Use for warmth (👋 👀 📸 ✅), not for decoration (🎉🎊🥳🔥)
- No emoji chains or repeated emoji
- Skip emojis on serious topics (consent, rules, conflict)

### Multilingual Behavior

- Default to the app's current locale (EN, VI, or RU)
- If the user writes in a different language, switch to that language
- Maintain personality and brand terms across all languages

### Example Messages

**Welcome (new user):**
> Hey 👋 I'm Sharry. I can help you find your way around, answer questions about sharing or fostering items, or explain how things work. What's on your mind?

**How-to response:**
> Tap the **+** button on the home page. Add a name, description, some photos, and pick a category. Your neighbors will see it right away 📸

**Context-aware nudge:**
> You have 2 pending requests 👀 Head to My Items to review them — the neighbors are waiting.

## System Prompt Structure

The system prompt is built from static knowledge + dynamic user context, assembled per request.

### Layer 1: Identity & Personality

Sharry's character definition, brand voice rules, emoji guidelines.

### Layer 2: Language Behavior

Instructions to default to app locale, adapt to user's language, maintain brand terms.

### Layer 3: App Knowledge

Static guide covering:

- **Navigation:** All pages and how to reach them (Home/Browse, My Items, Wishlist, Profile, Notifications, Item detail)
- **Sharing flow:** How to add an item (+ button → form → photos → category → location)
- **Fostering flow:** Browse → click item → select dates on calendar → submit request → wait for approval → pickup → return
- **Claim lifecycle:** pending → approved/rejected → picked_up → returned (for loans) or transferred (for giveaways). Also: expired, missing. Full pickup/return flow involves proposal + approval steps.
- **Giveaway items:** Items can be marked as giveaways — no lease duration, ownership transfers permanently. Completion tracked via `transferredAt` instead of `returnedAt`.
- **Item categories:** kitchen, furniture, electronics, clothing, books, sports, other
- **Calendar:** How availability works, owner blocked periods
- **Ratings:** Both sides rate after transaction, 1-5 stars
- **Notifications:** What triggers them, where to find them

### Layer 4: Rules & Consent

- Max 5 pending claims per item
- Can't request your own item
- Approved claim dates can't overlap
- Only owner can approve/reject
- Only claimer can cancel their own request
- Consent/terms reminders (content TBD — to be pulled from consent form when it exists)

### Layer 5: Community Context

- Sharity is based in Da Lat, Vietnam
- Community of expats and locals
- Practical sharing philosophy: "No need to buy something you'll use once"
- Not moralistic — just practical and friendly

### Layer 6: Dynamic User Context (injected per request)

```typescript
interface UserContext {
  stage: "new_user" | "has_items_no_activity" | "has_pending_claims" | "active_user";
  itemCount: number;
  activeBorrows: number;
  pendingClaimsOnMyItems: number;
  pendingMyRequests: number;
}
```

Stage-specific guidance injected into the prompt:

| Stage | Guidance for Sharry |
|-------|-------------------|
| `new_user` | Encourage to add first item or browse what's available |
| `has_items_no_activity` | Suggest patience or improving listings (better photos, descriptions) |
| `has_pending_claims` | Remind to check My Items for pending requests |
| `active_user` | General help, no special nudge |

## API Route Design (`app/api/chat/route.ts`)

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

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

- `buildSystemPrompt()` assembles layers 1-5 (static) + layer 6 (dynamic user context) + locale instruction
- `locale` is passed from the client (read via `useLocale()` from next-intl) to set Sharry's default response language
- `maxTokens: 600` — allows for longer multilingual responses (Vietnamese/Russian use more tokens than English)
- `temperature: 0.5` — balanced between consistent factual answers and personality warmth
- No rate limiting — serverless in-memory maps don't persist across instances

**Security note:** `userContext` is passed from the client and not re-validated server-side. This is an accepted tradeoff for Phase 1 — the context is advisory only (affects tone and suggestions, not permissions or data access). The LLM cannot perform mutations. If needed later, context can be re-fetched server-side via Convex `fetchQuery`.

## Convex Query Design (`convex/chat.ts`)

```typescript
export const getUserContext = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    // Use indexes, not full table scans
    const myItems = await ctx.db
      .query("items")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    const myClaims = await ctx.db
      .query("claims")
      .withIndex("by_claimer", (q) => q.eq("claimerId", userId))
      .collect();

    // Get claims on my items using by_item index
    const claimsOnMyItems = [];
    for (const item of myItems) {
      const claims = await ctx.db
        .query("claims")
        .withIndex("by_item", (q) => q.eq("itemId", item._id))
        .collect();
      claimsOnMyItems.push(...claims);
    }

    const pendingOnMyItems = claimsOnMyItems.filter((c) => c.status === "pending");
    const activeBorrows = myClaims.filter(
      (c) => c.status === "approved" && c.pickedUpAt != null && c.returnedAt == null && c.transferredAt == null,
    );

    // Determine stage
    let stage = "active_user";
    if (myItems.length === 0 && myClaims.length === 0) {
      stage = "new_user";
    } else if (myItems.length > 0 && claimsOnMyItems.length === 0 && myClaims.length === 0) {
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

**Index requirement:** The `items` table already has a `by_owner` index on `ownerId` (confirmed in schema.ts). No schema changes needed.

**Known limitation:** The N+1 query pattern (one claims query per item) is fine for early usage but should be optimized with a compound index if users accumulate many items.

## Chat Widget Design (`components/chat-widget.tsx`)

### Layout

- **Floating bubble:** Fixed position, bottom-right, above mobile tab bar. Forest Green (#2D4A35), 48px circle, chat icon. `z-50`.
- **Chat panel (open):**
  - Mobile: full-screen overlay
  - Desktop (sm: breakpoint): 400×520px floating panel, bottom-right, rounded corners, border, shadow
  - Backdrop blur for slight transparency

### Structure

```
<ChatWidget>
  ├── Bubble (toggle button, visible when closed)
  └── Panel (visible when open)
      ├── Header ("Sharry" + close button)
      ├── Messages area (scrollable)
      │   ├── Welcome message (when empty)
      │   ├── Suggested questions (when empty, stage-based)
      │   └── Message list (user right-aligned, bot left-aligned with avatar)
      └── Input bar (text input + send button)
```

### Behavior

- `useChat({ api: "/api/chat", body: { userContext, locale } })` — manages all state
- `locale` read from `useLocale()` (next-intl) and passed in body
- `append()` for sending suggested questions programmatically
- Auto-scroll to bottom on new messages
- Auto-focus input when panel opens
- Loading indicator: three animated dots in an empty bot message bubble
- Error state: if streaming fails, show inline error message ("Sharry is taking a break — try again in a moment")
- Accessibility: `role="dialog"` on panel, `aria-live="polite"` on messages area, Escape key closes panel

### Brand Styling

| Element | Color |
|---------|-------|
| Bubble background | Forest Green #2D4A35 |
| Bubble icon | Cream #F0EBE0 |
| Bot avatar | Forest Green circle with "S" |
| Bot messages | Cream #F0EBE0 background, Ink #1C1C1A text |
| User messages | Forest Green #2D4A35 background, Cream #F0EBE0 text |
| Input field | Cream #F0EBE0 background |
| Send button | Forest Green #2D4A35 |
| Borders/dividers | Warm Grey #E0D9CE |
| Muted text | Stone #7A7570 |
| Suggestion pills | White background, Forest Green text, Warm Grey border |

### Suggested Questions by Stage

| Stage | Suggestions |
|-------|-------------|
| `new_user` | "How do I share an item?", "How does fostering work?", "What is Sharity?" |
| `has_items_no_activity` | "How can I improve my listings?", "How does fostering work?", "Where are my items?" |
| `has_pending_claims` | "How do I approve a request?", "What happens after approval?", "How do I contact a neighbor?" |
| `active_user` | "How do I return an item?", "How do ratings work?", "How does the calendar work?" |
| Not logged in | "What is Sharity?", "How does sharing work?", "How do I sign up?" |

## Integration

Add `<ChatWidget />` to the app layout, inside providers:

Add `<ChatWidget />` in `app/[locale]/layout.tsx`, inside the providers, after `<Toaster />`:

```tsx
// app/[locale]/layout.tsx — after <Toaster />
<ChatWidget />
```

## Files to Create / Modify

| Action | File | Description |
|--------|------|-------------|
| Create | `app/api/chat/route.ts` | API route with streamText + system prompt |
| Create | `components/chat-widget.tsx` | Floating bubble + chat panel |
| Create | `convex/chat.ts` | getUserContext query |
| Modify | `app/[locale]/layout.tsx` | Add `<ChatWidget />` after `<Toaster />` |
| Modify | `.env.local` | Add `ANTHROPIC_API_KEY` |

## Future Phases

| Phase | Scope | Timeline |
|-------|-------|----------|
| Phase 2 | Proactive nudges — auto-open on stage transitions, badge on bubble, localStorage for dismissed nudges | Next sprint |
| Phase 3 | Conflict resolution — first-line dispute mediation, reading lease activity context | Later |
| Phase 4 | Photo handling — receiving/viewing Cloudinary photos in chat as evidence | Later |
| Phase 5 | Chat history persistence — store conversations in Convex | Later |

## Testing

- Manual testing across all 3 languages
- Verify suggested questions change based on user stage
- Test with logged-out user (no context, generic suggestions)
- Test streaming behavior (partial messages render progressively)
- Test mobile layout (full-screen panel, bubble above tabs)
- Test desktop layout (floating panel, proper positioning)
