# Memory And Context Management

This project uses a deliberate memory system so useful work survives context resets without bloating every future prompt.

## Durable Memory Surfaces

- `AGENTS.md` is the broad project contract. Keep only stable rules and high-level project facts here.
- `.codex/context/index.md` is the compact entrypoint for Codex runs.
- `.codex/context/*.md` files are scoped runbooks and current project facts.
- `.agents/skills/*/SKILL.md` files are triggerable workflows for repeatable work.
- `.codex/benchmarks/runs/*` stores benchmark and verification evidence.

## Transient Memory Surfaces

- `.claude/handoff/state.md` is the latest interrupted-session recovery snapshot.
- `.claude/handoff/*.md` files are useful sources for mining patterns, but they are not automatically durable.
- Test output, screenshots, traces, and local logs become durable only when linked from a benchmark or audit report.

## Promotion Criteria

Promote a fact from transient memory into durable memory when it is:

- reusable across future sessions;
- specific enough to change agent behavior;
- validated by code, tests, user decision, or repeated failure;
- safe to store without secrets or private production data.

Do not promote:

- one-off user messages or drafts;
- private contact data;
- revoked credentials or secret values;
- task-local IDs unless they explain a reusable debugging pattern;
- stale implementation details that are easy to rediscover from code.

## Cadence

- After substantial work: run the memory audit script and update relevant context/skills if there is a clear durable learning.
- Weekly: run a broader context drift audit against recent commits, handoffs, benchmark artifacts, and uncommitted context changes.
- A local launchd catch-up hook checks for missed weekly slots every 15 minutes while the Mac is awake.
- Before benchmark work: ensure `.codex/context/*` and `.agents/skills/*` contain the same stable guidance that Claude receives through `.claude/skills`.

## Manual Audit Command

```bash
python3 scripts/context_memory_audit.py --days 30
```

The script prints a report and exits non-zero only on script/runtime errors. It does not edit files.

## Missed-Run Catch-Up

The weekly Codex automation is backed by a local catch-up hook:

- automation id: `sharity-memory-steward`;
- script: `scripts/sharity_memory_catchup.py`;
- LaunchAgent: `~/Library/LaunchAgents/com.sharity.memory-catchup.plist`;
- state: `.codex/memory/.catchup-state.json` (gitignored);
- logs: `.codex/memory/catchup-logs/` and `~/Library/Logs/Sharity/memory-catchup.*.log`.

The LaunchAgent cannot run while the Mac is asleep, but it runs at login and every 15 minutes while awake. If Friday 10:00 was missed, the script records the missed slot in its queue and runs one catch-up Codex audit covering all pending slots. Successful slots are marked covered; failed slots remain pending for the next check.

Manual commands:

```bash
pnpm memory:catchup
python3 scripts/sharity_memory_catchup.py --check --dry-run
python3 scripts/sharity_memory_catchup.py --force
```

## Agent Audit Prompt

When running as an autonomous Codex automation, inspect the script output and then:

1. update `.codex/context/*.md` or `.agents/skills/*/SKILL.md` for clear, low-risk durable learnings;
2. write a dated report under `.codex/memory/`;
3. avoid application code changes;
4. avoid commits, pushes, external messages, and secret reads unless explicitly requested.

## Current Known Gaps To Watch

- Claude skills may contain newer procedural knowledge than `.agents/skills`.
- Handoff files often contain useful operational lessons mixed with one-off state.
- Benchmark run artifacts should be summarized into context only when they reveal a reusable rule, not after every run.
