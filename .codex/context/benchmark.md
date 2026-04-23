# Claude Code vs Codex Benchmark Context

## Purpose

This benchmark is meant to compare real agent quality on a real Sharity task, not synthetic puzzle performance.

## Fairness Model

- Same starting commit.
- Same repository context.
- Same task prompt.
- Separate branches and worktrees.
- No cross-contamination: one agent must not see the other's patch or review before finishing.
- Same stop rules: no commit, push, PR, or external send unless explicitly authorized.
- Same verification rubric.

## Branch Naming

- Claude worktree branch: `bench/claude-in-app-chat`
- Codex worktree branch: `bench/codex-in-app-chat`
- Benchmark orchestration branch/context files may stay in the main working tree unless the user asks to commit them.

## Rubric

Score each implementation 0-5:

- Requirements coverage.
- Correctness and security of Convex auth/authz.
- Fit with existing schema and lifecycle patterns.
- UI integration and locale correctness.
- Type safety and generated-file hygiene.
- Verification quality.
- Browser/UX evidence quality.
- Maintainability and patch size.

Also list blocking bugs separately. A high score with a blocking bug should still lose.

## Output

For each run, capture:

- raw command log;
- final agent message;
- git diff stats;
- verification outputs;
- Playwright/browser verification results and screenshot evidence;
- review findings;
- score table;
- final recommendation.

## Runbooks

- Task prompt: `.codex/benchmarks/in-app-chat-task.md`.
- Verification runbook: `.codex/benchmarks/chat-verification-runbook.md`.
- Scorecard template: `.codex/benchmarks/scorecard-template.md`.

## Tooling Notes

- The intended Codex benchmark model is `gpt-5.5`, not `gpt-5.3-codex`.
- A read-only CLI sanity check on 2026-04-24 failed for `gpt-5.5` with the active Codex CLI auth, then succeeded only when explicitly forced to `gpt-5.3-codex`. That fallback is diagnostic only and must not be used as the final comparison model.
- If `codex exec -m gpt-5.5` is unavailable, fix CLI auth/config first or run the Codex side through a GPT-5.5-capable Codex app/subagent surface and record the execution surface.
