# AI Assistant Feature — Sharity

## Overview

Build a context-aware AI assistant for Sharity that works in two modes:

1. **Proactive guide** — detects user's stage and pops up with relevant tips (AI-driven onboarding)
2. **On-demand assistant** — user opens chat and asks questions, bot answers with personalized context

The bot knows the user's real state from the database (items, claims, stage) and gives actionable guidance, not generic FAQ answers.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Chat Widget (floating, bottom-right)           │
│  - useChat() hook from @ai-sdk/react            │
│  - Suggested questions (dynamic by stage)       │
│  - Streaming handled automatically by SDK       │
│  - Proactive nudges on stage transitions        │
└────────────────┬────────────────────────────────┘
                 │ POST /api/chat (SDK data stream)
                 ▼
┌─────────────────────────────────────────────────┐
│  Next.js API Route (app/api/chat/route.ts)      │
│  1. Build system prompt = static guide +        │
│     dynamic user state                          │
│  2. streamText() via @ai-sdk/openai provider    │
│  3. Return result.toDataStreamResponse()        │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│  Convex DB   │  │  OpenRouter API   │
│  (user ctx)  │  │  (Qwen 2.5 72B)  │
└──────────────┘  └──────────────────┘
```

## LLM Setup — Vercel AI SDK + OpenRouter + Qwen 2.5 72B

We use **Vercel AI SDK** (`ai` + `@ai-sdk/openai`) for streaming and React hooks, with **OpenRouter** as the API gateway. Cost: ~$0.001 per message.

### Dependencies

```bash
pnpm add ai @ai-sdk/openai
```

- `ai` — Vercel AI SDK core: `streamText()` on the server, `useChat()` on the client
- `@ai-sdk/openai` — OpenAI-compatible provider (works with OpenRouter out of the box)

### Environment Variable

Add to `.env.local`:

```env
OPENROUTER_API_KEY=<ask Dmitry for the key>
```

### Provider Setup

```typescript
import { createOpenAI } from "@ai-sdk/openai";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Use as: openrouter("qwen/qwen-2.5-72b-instruct")
```

The Vercel AI SDK handles streaming, parsing, and React state — no manual SSE code needed.

## Files to Create

### 1. `app/api/chat/route.ts` — Chat API

Uses Vercel AI SDK's `streamText()` — handles streaming, error handling, and response formatting automatically.

```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// --- Static app guide (the bot's knowledge about Sharity) ---

const APP_GUIDE = `You are Sharity's AI assistant — a friendly guide that helps users navigate the app.
Sharity is a sharing platform where people lend and borrow items from each other.

IMPORTANT: Always respond in the same language the user writes in.

## How Sharity Works

### For Lenders (sharing your items)
1. Click "+" button to add a new item
2. Fill in: name, description, photos, category, location
3. Your item appears on the main page for others to find
4. When someone requests your item → you get a notification
5. Go to "My Items" → click the item → review pending claims
6. Approve or reject each request
7. After approval → coordinate pickup with the borrower
8. When they return it → confirm the return

### For Borrowers (finding items)
1. Browse items on the main page or search by category
2. Click on an item → select dates on the calendar
3. Click "Request" → the owner gets notified
4. Wait for approval (check notifications)
5. Once approved → coordinate pickup with the owner
6. Return the item when your lease period ends

### Key Pages
- **Home (Browse)**: See all available items from other users
- **My Items**: Your listed items + items you're borrowing
- **Notifications**: Updates on claims, approvals, pickups, returns
- **Profile**: Edit your name, avatar, contacts, bio
- **Wishlist**: Request items you wish someone would share

### Item Categories
kitchen, furniture, electronics, clothing, books, sports, other

### Claim Flow
pending → approved/rejected → picked_up → returned

### Tips
- Add clear photos to your items — they get more requests
- Set min/max lease days so borrowers know your preferences
- Check notifications regularly for pending requests
- Rate your experience after each transaction

## Behavior Rules
- Be concise, friendly, and helpful
- Give specific navigation hints ("go to My Items tab", "click the + button in the top right")
- If you don't know something — say so honestly
- Never make up features that don't exist
`;

// --- Dynamic user context (injected before each request) ---

interface UserContext {
  stage: string;
  itemCount: number;
  activeBorrows: number;
  pendingClaimsOnMyItems: number;
}

function buildUserContext(ctx: UserContext): string {
  const lines = [`## Your Current State`];
  lines.push(`- Stage: ${ctx.stage}`);
  lines.push(`- Items listed: ${ctx.itemCount}`);
  lines.push(`- Active borrows: ${ctx.activeBorrows}`);
  lines.push(`- Pending claims to review: ${ctx.pendingClaimsOnMyItems}`);

  if (ctx.stage === "new_user") {
    lines.push(`\nThis user just signed up. Encourage them to add their first item or browse what's available.`);
  } else if (ctx.stage === "has_items_no_activity") {
    lines.push(`\nThis user has items but no one has requested them yet. Encourage patience or suggest improving their listings.`);
  } else if (ctx.stage === "has_pending_claims") {
    lines.push(`\nThis user has pending claims to review! Remind them to check My Items.`);
  }

  return lines.join("\n");
}

// --- Main handler ---

export async function POST(request: Request) {
  const { messages, userContext } = await request.json();

  const systemPrompt = userContext
    ? `${APP_GUIDE}\n\n${buildUserContext(userContext)}`
    : APP_GUIDE;

  const result = streamText({
    model: openrouter("qwen/qwen-2.5-72b-instruct"),
    system: systemPrompt,
    messages,
    maxTokens: 500,
    temperature: 0.7,
  });

  return result.toDataStreamResponse();
}
```

### 2. `components/chat-widget.tsx` — Chat UI

Uses Vercel AI SDK's `useChat()` hook — handles messages state, streaming, loading state, and form submission automatically.

```tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { useQuery } from "convex/react";
import { useRef, useEffect, useState, useCallback } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { api } from "@/convex/_generated/api";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch user context from Convex
  const userContext = useQuery(api.chat.getUserContext);

  // Vercel AI SDK handles: messages, input, streaming, loading — all of it
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: "/api/chat",
    body: { userContext },
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);

  const sendSuggestion = (text: string) => {
    append({ role: "user", content: text });
  };

  const suggestions = [
    "How do I add an item?",
    "How does borrowing work?",
    "What happens after I approve a request?",
    "How do I return an item?",
  ];

  return (
    <>
      {/* Toggle button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110"
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed right-0 bottom-0 z-50 flex h-full w-full flex-col bg-background/95 backdrop-blur-xl sm:right-6 sm:bottom-6 sm:h-[520px] sm:w-[400px] sm:rounded-xl sm:border sm:shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="font-semibold">Sharity Assistant</span>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close chat">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="mb-4 rounded-lg bg-primary/10 p-3 text-sm">
                Hi! I'm Sharity's assistant. I can help you navigate the app, explain features, or answer questions. What would you like to know?
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`mb-3 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}>
                  {message.content || (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <span className="animate-pulse">●</span>
                      <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>●</span>
                      <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>●</span>
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Suggested questions */}
            {messages.length === 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => sendSuggestion(s)} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted/50">
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t px-4 py-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Ask me anything..."
                disabled={isLoading}
                className="flex-1 rounded-lg bg-muted/30 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:bg-muted/50"
              />
              <button type="submit" disabled={!input.trim() || isLoading} className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
```

### 3. Convex Query — User Context

Create a query that returns the user's current state. The chat widget fetches this before each message.

```typescript
// convex/chat.ts
import { query } from "./_generated/server";

export const getUserContext = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = identity.subject;

    // Get user's items
    const allItems = await ctx.db.query("items").collect();
    const myItems = allItems.filter((i) => i.ownerId === userId);

    // Get claims
    const allClaims = await ctx.db.query("claims").collect();
    const myClaims = allClaims.filter((c) => c.claimerId === userId);
    const claimsOnMyItems = allClaims.filter((c) =>
      myItems.some((i) => i._id === c.itemId),
    );

    const pendingClaimsOnMyItems = claimsOnMyItems.filter(
      (c) => c.status === "pending",
    );
    const activeBorrows = myClaims.filter((c) => c.status === "approved");

    // Determine stage
    let stage = "active_user";
    if (myItems.length === 0 && myClaims.length === 0) {
      stage = "new_user";
    } else if (myItems.length > 0 && claimsOnMyItems.length === 0 && myClaims.length === 0) {
      stage = "has_items_no_activity";
    } else if (pendingClaimsOnMyItems.length > 0) {
      stage = "has_pending_claims";
    }

    return {
      stage,
      itemCount: myItems.length,
      activeBorrows: activeBorrows.length,
      pendingClaimsOnMyItems: pendingClaimsOnMyItems.length,
      pendingMyRequests: myClaims.filter((c) => c.status === "pending").length,
    };
  },
});
```

### 4. Wire it up in layout

Add `<ChatWidget />` to `app/layout.tsx` (inside the ClerkProvider + ConvexProvider):

```tsx
<ClerkProvider>
  <ConvexClientProvider>
    {children}
    <ChatWidget />
  </ConvexClientProvider>
</ClerkProvider>
```

## Proactive Mode (Phase 2)

After the basic chat works, add proactive nudges:

1. Track user's stage in a `useEffect`
2. When stage changes (e.g. first login, first pending claim) → auto-open chat with a contextual message
3. Store "dismissed nudges" in localStorage so we don't annoy users

```typescript
// Inside ChatWidget
const userContext = useQuery(api.chat.getUserContext);

useEffect(() => {
  if (!userContext) return;
  const dismissed = localStorage.getItem("sharity_dismissed_nudges") ?? "[]";
  const dismissedSet = new Set(JSON.parse(dismissed));

  if (userContext.stage === "new_user" && !dismissedSet.has("welcome")) {
    setIsOpen(true);
    setMessages([{
      role: "assistant",
      content: "Welcome to Sharity! 👋 I can help you get started. Would you like to add your first item or browse what's available?",
    }]);
  }

  if (userContext.pendingClaimsOnMyItems > 0 && !dismissedSet.has("pending_claims")) {
    // Show a subtle badge on the chat icon instead of auto-opening
  }
}, [userContext]);
```

## Tech Notes

- **No RAG / no vector DB / no embeddings** — all knowledge is in the system prompt
- **Cost**: ~$0.001 per message (Qwen 2.5 72B via OpenRouter)
- **Dependencies**: `ai`, `@ai-sdk/openai` (new), `lucide-react` (already in project)
- **Streaming**: handled automatically by Vercel AI SDK (`streamText` + `useChat`)
- The chat widget is fully self-contained — one API route + one component
- **What the SDK gives us**: no manual SSE parsing, no manual message state management, built-in error/loading states, `useChat()` hook with `append()` for programmatic messages

## Sharity Database Schema (for context)

The app has these main tables:

- **items** — things people share (name, description, photos, category, location)
- **claims** — borrow requests (pending → approved/rejected → picked_up → returned)
- **item_activity** — activity log for items (created, loan_started, picked_up, returned)
- **lease_activity** — detailed lease event log (requested, approved, pickup, return, etc.)
- **notifications** — user notifications
- **users** — user profiles (name, avatar, contacts, bio)
- **wishlist** — requested items
- **ratings** — transaction ratings (1-5 stars)

The bot reads from these tables (via the `getUserContext` query) to understand where the user is.
