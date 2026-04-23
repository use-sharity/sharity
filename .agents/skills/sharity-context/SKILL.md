---
name: sharity-context
description: Load Sharity project context before planning or implementing non-trivial work in this repository, especially benchmark runs, feature work, handoffs, or when comparing Codex with Claude Code.
---

# Sharity Context

Use this skill before substantial project work. It mirrors the Claude Code project context pattern while using Codex-native repo skills and `AGENTS.md` discovery.

## Required Context Load

1. Read `AGENTS.md` first. Treat it as the project instruction source of truth.
2. Read `.codex/context/index.md`.
3. Follow only the links relevant to the task:
   - Backend/schema/Convex work: `.codex/context/convex.md`.
   - React UI, routes, i18n, mobile UX: `.codex/context/react-ui.md`.
   - In-app chat prototype: `.codex/context/in-app-chat.md`.
   - Claude/Codex benchmark: `.codex/context/benchmark.md`.
   - Memory/context stewardship: `.codex/context/memory.md`.
   - Interrupted-session recovery: `.claude/handoff/state.md`.
4. Read the existing files before editing them. Prefer `rg` for search.
5. Preserve user and agent work already present in the worktree. Do not revert unrelated changes.

## Output Expectations

Before implementing, state:
- which context files you loaded;
- the exact task scope you inferred;
- the verification commands you intend to run.

For benchmark work, create or update a short run log under `.codex/benchmarks/runs/` instead of relying on conversation memory.
