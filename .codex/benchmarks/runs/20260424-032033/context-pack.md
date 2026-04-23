# Sharity In-App Chat Benchmark Context Pack

Run id: `20260424-032033`
Base commit: `c7ff8d051f292c3c39dffc10359035dbcb08de90`
Task: implement Sharity in-app 1:1 chat prototype.

## Execution Surfaces

- Claude side: Claude Code CLI in `/Users/dmitrysurkov/Developer/Personal/sharity-benchmarks/claude-in-app-chat-20260424-032033`.
- Codex side: Codex App GPT-5.5 agent in `/Users/dmitrysurkov/Developer/Personal/sharity-benchmarks/codex-in-app-chat-20260424-032033`.

Reason: the local `codex-cli 0.123.0` model catalog currently does not expose `gpt-5.5`; it exposes `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, and `gpt-5.3-codex-spark`. The benchmark must not downgrade Codex to 5.3.

## Mandatory Context Load

Both agents must read:

- `AGENTS.md`
- `.agents/skills/sharity-context/SKILL.md`
- `.agents/skills/sharity-convex/SKILL.md`
- `.agents/skills/sharity-react/SKILL.md`
- `.agents/skills/sharity-playwright/SKILL.md`
- `.agents/skills/sharity-benchmark/SKILL.md`
- `.codex/context/index.md`
- `.codex/context/convex.md`
- `.codex/context/react-ui.md`
- `.codex/context/testing.md`
- `.codex/context/in-app-chat.md`
- `.codex/context/benchmark.md`
- `.codex/benchmarks/in-app-chat-task.md`
- `.codex/benchmarks/chat-verification-runbook.md`

Optional if needed:

- `.claude/handoff/state.md` for historical product context, not as implementation source.
- Existing Claude project skills under `.claude/skills/`, especially `convex-patterns`, `react-patterns`, and `clerk-testing-auth`.

## Task Scope

Implement a prototype of in-app 1:1 chat:

- Borrower and owner chat, scoped to an item.
- Convex backend.
- Do not reuse `convex/chat.ts`; that is Sharry AI assistant.
- Add schema, queries, mutations, and internal helpers as needed.
- Add localized conversation list and thread UI.
- Add item/claim entry points.
- Add unread/read behavior.
- Add system messages for major claim lifecycle events where practical.
- Update visible copy in `messages/en.json`, `messages/vi.json`, and `messages/ru.json`.
- Preserve auth, authorization, and existing claim business rules.

Non-scope:

- No attachments.
- No typing indicators.
- No presence.
- No push/email notifications.
- No edit/delete.
- No commits, pushes, PRs, or external messages.

## Required Verification

Run what is feasible and report exact output status:

```bash
pnpm convex codegen
pnpm exec tsc --noEmit
pnpm lint
pnpm test
BASE_URL=http://localhost:3001 pnpm exec playwright test --reporter=line
```

For Playwright/browser verification, either:

- use project Playwright tests from `playwright.config.ts`; or
- use the Claude-compatible Playwright executor:

```bash
cd /Users/dmitrysurkov/.claude/plugins/cache/playwright-skill/playwright-skill/4.1.0/skills/playwright-skill
node run.js /tmp/playwright-test-chat.js
```

If a check cannot run, report the exact blocker and whether it is environmental or caused by the patch.

## Evidence Expectations

Each agent should leave in its final answer:

- files changed;
- implementation summary;
- what is incomplete;
- verification commands and results;
- browser evidence, screenshots, or explicit reason browser check was not possible;
- risks in its own implementation.

The orchestrator will separately capture diffs, logs, scorecard, and review findings.
