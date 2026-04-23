# Context Audit - 2026-04-24

## Audit Inputs

- `AGENTS.md`
- `.codex/context/index.md`
- `.codex/context/memory.md`
- `.agents/skills/sharity-context/SKILL.md`
- `.agents/skills/sharity-memory/SKILL.md`
- `.claude/handoff/state.md`
- `pnpm memory:audit`

## Durable Updates Made

- Added `sharity-memory` as the project skill for deciding where reusable learnings belong.
- Added `.codex/context/memory.md` as the memory runbook and promotion policy.
- Added `scripts/context_memory_audit.py` plus `pnpm memory:audit` for repeatable drift checks.
- Linked memory stewardship from `AGENTS.md`, `.codex/context/index.md`, and `sharity-context`.
- Created a weekly Codex automation named `Sharity memory steward`.
- Added a local launchd catch-up hook, `scripts/sharity_memory_catchup.py`, and `pnpm memory:catchup` so missed weekly slots are queued and retried when the Mac is awake.

## Current Drift Signals

- Current working tree has active Convex, UI, i18n, and chat-related changes.
- `.claude/handoff/state.md` and several older handoff files contain reusable-learning markers.
- Immediate review targets are Convex context, React UI context, and possible migration of Claude skill knowledge into Codex repo skills.

## Left Transient

- One-off IDs, personal contact details, unsent message drafts, and revoked deploy-key notes remain in handoff only.
- No application code was edited as part of this audit setup.

## Follow-Up

- After the current chat/messaging work settles, run `pnpm memory:audit` again and promote only stable implementation lessons.
- Compare `.claude/skills/framer-motion-gestures/SKILL.md` with existing Codex skills before future swipe/deck work.
