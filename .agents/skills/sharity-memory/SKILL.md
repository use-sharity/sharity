---
name: sharity-memory
description: Maintain Sharity's durable project memory after substantial work: decide what belongs in AGENTS.md, .codex/context, repo skills, benchmark logs, or transient handoff files.
---

# Sharity Memory Stewardship

Use this skill when the user asks to preserve learnings, update project memory, review context quality, or set up self-learning/context-management workflows.

## Goal

Keep useful project knowledge durable without turning project instructions into a noisy activity log.

The memory system has three layers:

1. `AGENTS.md` stores broad, stable project rules that every agent must know.
2. `.codex/context/*.md` stores compact domain runbooks and current project facts.
3. `.agents/skills/*/SKILL.md` stores triggerable procedures for recurring work patterns and hard-won pitfalls.

Use `.claude/handoff/state.md` and `.claude/handoff/*.md` only as transient recovery inputs unless a handoff contains a reusable rule.

## Update Decision Tree

For each completed work session or context audit, classify each learning:

- Update `AGENTS.md` only when the rule is global, stable, and should affect every task.
- Update `.codex/context/<domain>.md` when the learning is project-specific context, a current system shape, a runbook, an environment caveat, or a known pitfall.
- Update `.agents/skills/<skill>/SKILL.md` when the learning changes how agents should perform a recurring task.
- Create a new skill when at least two future tasks need the same specialized workflow and an existing skill would become unfocused.
- Create or update `.codex/benchmarks/runs/*` when the learning is evidence from a benchmark or verification pass.
- Leave the learning in handoff only when it is temporary state, a one-off ID, an unsent draft, or a short-lived blocker.

## Safety Rules

- Prefer additive, concise updates over broad rewrites.
- Never store secrets, tokens, private API responses, personal contact details, or production data dumps in durable memory.
- Do not copy whole chat transcripts into memory. Extract decisions, pitfalls, commands, and file references.
- Keep line-level references only when they are likely to remain useful; otherwise reference files or modules.
- Preserve user and agent work already present in the worktree.
- If unsure whether a fact is stable, write it to a dated audit report first and ask before promoting it.

## Audit Workflow

1. Read `.codex/context/memory.md`.
2. Run:

   ```bash
   python3 scripts/context_memory_audit.py --days 30
   ```

3. Review recent commits, uncommitted file categories, `.claude/handoff/state.md`, `.claude/handoff/*.md`, `.codex/benchmarks/runs/*`, and changed repo skills/context files.
4. Decide whether memory is stale, missing, duplicated, or overgrown.
5. Apply only clear updates. Otherwise write recommendations to `.codex/memory/YYYYMMDD-context-audit.md`.

## Output

Report:

- what changed in durable memory;
- what was intentionally left transient;
- any follow-up memory work that needs human judgment.
