# Benchmark Task: In-App Chat Prototype

You are working in the Sharity Vinh Loc repository.

## Context

Load project instructions and repo skills first:

- `AGENTS.md`
- `.agents/skills/sharity-context/SKILL.md`
- `.agents/skills/sharity-convex/SKILL.md`
- `.agents/skills/sharity-react/SKILL.md`
- `.agents/skills/sharity-playwright/SKILL.md`
- `.codex/context/index.md`
- `.codex/context/convex.md`
- `.codex/context/react-ui.md`
- `.codex/context/testing.md`
- `.codex/context/in-app-chat.md`
- `.codex/benchmarks/chat-verification-runbook.md`

## Task

Implement a prototype of in-app 1:1 chat for Sharity.

## Requirements

- Chat is between borrower and owner and is scoped to an item.
- Backend is Convex.
- Do not reuse `convex/chat.ts`; it belongs to the Sharry AI assistant.
- Add schema, queries, mutations, and internal helpers as needed.
- Add conversation list and conversation thread UI under localized routes.
- Add entry points from item and claim surfaces.
- Add unread count/read marker behavior.
- Add system messages for major claim lifecycle events where practical.
- Update all relevant locale message files (`en`, `vi`, `ru`) for visible copy.
- Preserve existing business rules and do not weaken auth/authorization.

## Non-Requirements

- No attachments.
- No typing indicators.
- No presence.
- No push/email notifications.
- No edit/delete.
- No commits, pushes, PRs, or external messages.

## Verification

Run what is feasible and report exact results:

```bash
pnpm convex codegen
pnpm exec tsc --noEmit
pnpm lint
pnpm test
BASE_URL=http://localhost:3001 pnpm exec playwright test --reporter=line
```

If tooling fails because of the local environment, explain the blocker and whether it is caused by your changes.

For UI/browser behavior, use either the project Playwright runner or the Claude-compatible Playwright skill executor. Capture screenshot evidence for chat list/thread on desktop and mobile when feasible.

## Final Response

Summarize:

- files changed;
- what works;
- what remains incomplete;
- verification results;
- risks you see in your own implementation.
