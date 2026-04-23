# Sharity In-App Chat Benchmark Scorecard

Run id: `20260424-032033`
Date: `2026-04-24`
Base ref: `origin/main`
Base commit: `c7ff8d051f292c3c39dffc10359035dbcb08de90`

## Setup

Both agents started from the same commit in separate worktrees and received the same uncommitted context package:

- `AGENTS.md`
- `.agents/skills/sharity-*`
- `.codex/context/*`
- `.codex/benchmarks/in-app-chat-task.md`
- `.codex/benchmarks/chat-verification-runbook.md`
- `.codex/benchmarks/runs/20260424-032033/context-pack.md`
- `.codex/benchmarks/runs/20260424-032033/agent-prompt.md`

Execution surfaces:

- Claude: Claude Code CLI, model alias `opus`, worktree `/Users/dmitrysurkov/Developer/Personal/sharity-benchmarks/claude-in-app-chat-20260424-032033`.
- Codex: Codex desktop app GPT-5.5 subagent, worktree `/Users/dmitrysurkov/Developer/Personal/sharity-benchmarks/codex-in-app-chat-20260424-032033`.

Important fairness caveats:

- The local `codex-cli 0.123.0` model catalog did not expose `gpt-5.5`, so the Codex side ran through the GPT-5.5-capable app/subagent surface. This is a tool-surface difference, not a task-prompt difference.
- Browser verification was not fully fair/completed because `.env.local` and E2E auth secrets were not copied into the benchmark worktrees. Both agents were blocked on Convex/Clerk config for Playwright. This is an orchestrator setup flaw and should be fixed before treating browser evidence as measured model quality.

## Agent Outputs

Claude created a `/[locale]/messages` prototype:

- Backend: `convex/messaging.ts`, conversation schema, read markers, system helper.
- UI: conversation list, thread, header bell, message owner button.
- Entry points: item detail borrower button, owner per-claim button.
- Lifecycle system messages: request, approve, reject only.

Codex GPT-5.5 created a `/[locale]/chat` prototype:

- Backend: `convex/messaging.ts`, conversation schema with owner/borrower indexes, read markers, internal lifecycle recorder.
- UI: chat list, thread, header navigation/badge, item chat button.
- Entry points: item detail, discovery card, lease claim card.
- Lifecycle system messages: request, approve, reject, cancel, pickup/return propose/approve/confirm, expired, missing.

## Size

Tracked diff only, excluding untracked new files and copied context package:

| Agent | Tracked files | Insertions | Deletions |
| --- | ---: | ---: | ---: |
| Claude | 8 | 132 | 0 |
| Codex GPT-5.5 | 10 | 426 | 29 |

Key untracked implementation files:

| Agent | New backend | New UI routes/components |
| --- | ---: | ---: |
| Claude | `convex/messaging.ts` 443 lines | 493 lines |
| Codex GPT-5.5 | `convex/messaging.ts` 455 lines | 415 lines |

Claude CLI result metadata:

- Duration: `767244ms` (12m 47s)
- Turns: `100`
- Reported API cost: `$7.91`

Codex GPT-5.5 app/subagent did not emit comparable token/cost timing metadata into the raw log. Based on run launch/log artifact timestamps, the implementation completed in roughly `12m 10s-12m 20s`. Treat this as approximate because the app/subagent surface did not provide Claude-style `duration_ms`.

Speed result:

- Claude: exact `12m 47s`.
- Codex GPT-5.5: approximate `~12m 15s`.
- Practical verdict: **near tie, Codex slightly faster in this run**, but not a strong metric due different execution surfaces and telemetry quality.

## Orchestrator Verification

Commands were rerun by the orchestrator after both agents completed.

| Check | Claude | Codex GPT-5.5 |
| --- | --- | --- |
| `pnpm exec tsc --noEmit` | pass | pass |
| `pnpm test` | pass, 3 files / 29 tests | pass, 3 files / 29 tests |
| `pnpm convex codegen` | fail: no `CONVEX_DEPLOYMENT` | fail: no `CONVEX_DEPLOYMENT` |
| `pnpm lint` | fail on existing repo-wide lint issues | fail on existing repo-wide lint issues |
| changed-files `eslint` | fail because touched `app/[locale]/item/[id]/page.tsx` contains an existing React lint error | pass |
| Playwright/browser | not run successfully; missing Convex/Clerk env in worktree | not run successfully; missing Convex/Clerk env in worktree |

## Review Findings

Claude:

- Medium: `convex/messaging.ts` uses prototype-scale scans for conversation lists and unread count: `ctx.db.query("conversations").order("desc").take(500)` then filters by participant. This can miss older conversations with recent messages if `_creationTime` and `lastMessageAt` diverge, and it will not scale.
- Medium: system messages are wired only to `requestItem`, `approveClaim`, and `rejectClaim`. The task asked for major lifecycle events where practical; pickup/return/expired/missing/cancel are not covered.
- Low: system event names are `lease_requested`, `lease_approved`, `lease_rejected`, which diverge from the task/context naming (`claim_requested`, etc.) and from the broader lease lifecycle vocabulary.
- Low: changed-files lint is not green because the touched item page already has a React lint violation. The patch did not introduce that exact line, but a merge-ready workflow would still need to address it or avoid touching that file without fixing it.
- Low: manual edit to `convex/_generated/api.d.ts` is a temporary workaround; real Convex codegen is still required.

Codex GPT-5.5:

- Medium: unread counting still scans messages per conversation and `getUnreadCount` collects all conversations before filtering. Better indexed than Claude for list views, but still prototype-scale for global unread.
- Medium: lifecycle messages are scheduled asynchronously, so chat system messages can lag behind the claim mutation. This is acceptable for prototype UX but should be explicit.
- Low: mobile header chat icon lacks the desktop numeric unread badge presentation; the chat route remains accessible.
- Low: changed `app/[locale]/item/[id]/page.tsx` to wrap an existing effect `setState` in `queueMicrotask`, which makes changed-files ESLint pass but deserves a separate review rather than being mixed with chat work.
- Low: manual edit to `convex/_generated/api.d.ts` is a temporary workaround; real Convex codegen is still required.

## Scores

Scale: 0 to 5 per category.

| Category | Claude | Codex GPT-5.5 | Notes |
| --- | ---: | ---: | --- |
| Requirement coverage | 3.2 | 4.4 | Codex covers more entry points and lifecycle events. |
| Convex/auth correctness | 3.9 | 4.2 | Both enforce participants; Codex has better owner/borrower indexes. |
| Project pattern fit | 3.7 | 4.0 | Both avoid `convex/chat.ts`; Codex fits lifecycle hooks more broadly. |
| UI/i18n completeness | 3.8 | 4.0 | Both localize; Codex adds `/chat`, discovery, claim entry points. |
| Verification hygiene | 2.4 | 3.0 | Both blocked on codegen/Playwright; Codex changed-files ESLint passes. |
| Maintainability | 3.7 | 3.5 | Claude is smaller; Codex is broader but touches more surfaces. |
| Browser evidence | 0.5 | 0.5 | Neither produced real screenshots due env setup. |

Total:

- Claude: `21.2 / 35`
- Codex GPT-5.5: `23.6 / 35`

## Verdict

Winner for this task: **Codex GPT-5.5**, primarily due to broader product coverage and better integration with claim lifecycle events.

The result is not a fully production-grade benchmark because browser verification was not executed in a configured environment. The code-quality/static part is fair enough to compare implementation choices, but the UX/realtime part remains unmeasured.

Recommended next action:

Use the Codex GPT-5.5 implementation as the base for the real prototype branch, then before demo:

1. Copy or securely load the dev env into the selected worktree without printing secrets.
2. Run real `pnpm convex codegen`.
3. Replace manual generated API edits.
4. Run changed-files ESLint, `tsc`, tests, and a Playwright two-user chat flow.
5. Capture desktop/mobile screenshots.
