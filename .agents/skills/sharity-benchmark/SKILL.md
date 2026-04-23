---
name: sharity-benchmark
description: Run or prepare a fair Claude Code versus Codex benchmark on real Sharity tasks using equal context, separate branches/worktrees, structured prompts, verification logs, and a scoring rubric.
---

# Sharity Benchmark Workflow

Use this skill when comparing Claude Code and Codex on the same Sharity task.

## Fairness Requirements

1. Start both agents from the same git commit and same task prompt.
2. Use separate worktrees and branches:
   - `bench/claude-<task>`
   - `bench/codex-<task>`
3. Give both agents the same context package:
   - `AGENTS.md`
   - `.agents/skills/sharity-*`
   - `.codex/context/*`
   - the benchmark task prompt under `.codex/benchmarks/`
4. Do not include the other agent's output in either prompt.
5. Do not push, open PRs, or commit unless the user explicitly asks for it.
6. Capture raw logs and final summaries under `.codex/benchmarks/runs/<timestamp>/`.

## Metrics

Record:

- starting commit and branch;
- model/tool command used;
- wall-clock time;
- files changed;
- lines changed;
- TypeScript/lint/build/test results;
- whether generated Convex files were handled correctly;
- implementation completeness against task acceptance criteria;
- review findings, ordered by severity.

## Recommended Commands

Codex:

```bash
codex -m gpt-5.5 -a never exec --json --sandbox danger-full-access -C <worktree> - < task.md
```

Claude:

```bash
claude -p --permission-mode bypassPermissions --output-format stream-json --append-system-prompt "Follow repository instructions. Do not commit, push, or send external messages." "$(cat task.md)"
```

If a tool cannot run because of auth/subscription/rate limits, record that as benchmark infrastructure failure, not model quality.

Current local note: a read-only CLI sanity check on 2026-04-24 failed for `gpt-5.5` with the active Codex CLI auth, then succeeded only when explicitly forced to `gpt-5.3-codex`. Do not treat that fallback as the benchmark. If `gpt-5.5` is unavailable through `codex exec`, either fix CLI auth/config first or run the Codex side through a GPT-5.5-capable Codex app/subagent surface and record the execution surface.
