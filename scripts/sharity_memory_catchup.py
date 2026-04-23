#!/usr/bin/env python3
"""Catch up missed Sharity memory-steward automation runs."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import subprocess
import sys
from typing import Any

try:
	import tomllib
except ModuleNotFoundError:  # pragma: no cover
	tomllib = None  # type: ignore[assignment]


ROOT = pathlib.Path(__file__).resolve().parents[1]
CODEX_HOME = pathlib.Path(os.environ.get("CODEX_HOME") or pathlib.Path.home() / ".codex")
AUTOMATION_ID = "sharity-memory-steward"
AUTOMATION_TOML = CODEX_HOME / "automations" / AUTOMATION_ID / "automation.toml"
STATE_PATH = ROOT / ".codex" / "memory" / ".catchup-state.json"
LOG_DIR = ROOT / ".codex" / "memory" / "catchup-logs"
LOCK_PATH = ROOT / ".codex" / "memory" / ".catchup.lock"
DEFAULT_MODEL = "gpt-5.5"
FRIDAY = 4
SCHEDULE_HOUR = 10
SCHEDULE_MINUTE = 0


def now_local() -> dt.datetime:
	return dt.datetime.now().astimezone()


def parse_ms_timestamp(value: Any) -> dt.datetime | None:
	if not isinstance(value, int):
		return None
	return dt.datetime.fromtimestamp(value / 1000).astimezone()


def read_automation() -> dict[str, Any]:
	if not AUTOMATION_TOML.exists() or tomllib is None:
		return {}
	with AUTOMATION_TOML.open("rb") as handle:
		return dict(tomllib.load(handle))


def read_state() -> dict[str, Any]:
	if not STATE_PATH.exists():
		return {}
	return json.loads(STATE_PATH.read_text(encoding="utf-8"))


def write_state(state: dict[str, Any]) -> None:
	STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
	STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def next_slot_on_or_after(value: dt.datetime) -> dt.datetime:
	value = value.astimezone()
	candidate = value.replace(hour=SCHEDULE_HOUR, minute=SCHEDULE_MINUTE, second=0, microsecond=0)
	days_until = (FRIDAY - candidate.weekday()) % 7
	candidate = candidate + dt.timedelta(days=days_until)
	if candidate < value:
		candidate += dt.timedelta(days=7)
	return candidate


def due_slots(started_at: dt.datetime, current_time: dt.datetime, covered: set[str]) -> list[str]:
	slots: list[str] = []
	slot = next_slot_on_or_after(started_at)
	while slot <= current_time:
		value = slot.isoformat(timespec="minutes")
		if value not in covered:
			slots.append(value)
		slot += dt.timedelta(days=7)
	return slots


def acquire_lock() -> bool:
	try:
		fd = os.open(LOCK_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
	except FileExistsError:
		return False
	with os.fdopen(fd, "w", encoding="utf-8") as handle:
		handle.write(f"{os.getpid()}\n{now_local().isoformat(timespec='seconds')}\n")
	return True


def release_lock() -> None:
	try:
		LOCK_PATH.unlink()
	except FileNotFoundError:
		pass


def build_prompt(slots: list[str]) -> str:
	slot_list = "\n".join(f"- {slot}" for slot in slots)
	return f"""This is a catch-up run for the Sharity memory steward automation.

Missed scheduled slots:
{slot_list}

In /Users/dmitrysurkov/Developer/Personal/sharity-vinhloc, perform a Sharity memory/context stewardship audit. Load AGENTS.md, .agents/skills/sharity-context/SKILL.md, .agents/skills/sharity-memory/SKILL.md, .codex/context/index.md, and .codex/context/memory.md. Run `pnpm memory:audit` and inspect recent changes, .claude/handoff/state.md, marker-heavy .claude/handoff/*.md files, .codex/benchmarks/runs, .codex/context, and .agents/skills.

Decide whether any reusable project learning should be promoted into AGENTS.md, .codex/context/*.md, or .agents/skills/*/SKILL.md. Apply only concise, low-risk durable memory updates; do not edit application code. Never read or print secrets, never send external messages, never commit, push, or open PRs.

Always write a dated summary report under .codex/memory/ with: missed slots covered, audit inputs, durable updates made, items intentionally left transient, and follow-up questions if human judgment is needed.
"""


def run_codex(model: str, slots: list[str]) -> tuple[int, pathlib.Path, pathlib.Path]:
	LOG_DIR.mkdir(parents=True, exist_ok=True)
	stamp = now_local().strftime("%Y%m%d-%H%M%S")
	log_path = LOG_DIR / f"{stamp}-codex.log"
	final_path = LOG_DIR / f"{stamp}-final.md"
	command = [
		"caffeinate",
		"-i",
		"codex",
		"exec",
		"-m",
		model,
		"-a",
		"never",
		"--sandbox",
		"danger-full-access",
		"-C",
		str(ROOT),
		"--output-last-message",
		str(final_path),
		"-",
	]
	env = os.environ.copy()
	env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
	with log_path.open("w", encoding="utf-8") as log_file:
		process = subprocess.run(
			command,
			input=build_prompt(slots),
			text=True,
			stdout=log_file,
			stderr=subprocess.STDOUT,
			check=False,
			env=env,
		)
	return process.returncode, log_path, final_path


def main() -> int:
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--check", action="store_true", help="Run only if scheduled slots are overdue.")
	parser.add_argument("--force", action="store_true", help="Run a catch-up audit even if no slot is overdue.")
	parser.add_argument("--dry-run", action="store_true", help="Print due slots without running Codex.")
	args = parser.parse_args()

	automation = read_automation()
	state = read_state()
	current_time = now_local()
	model = str(automation.get("model") or DEFAULT_MODEL)
	started_at = parse_ms_timestamp(automation.get("created_at")) or current_time
	covered = set(state.get("covered_due_at", []))
	slots = due_slots(started_at, current_time, covered)
	if args.force and not slots:
		slots = [current_time.isoformat(timespec="minutes")]

	print(f"automation={AUTOMATION_ID}")
	print(f"now={current_time.isoformat(timespec='seconds')}")
	print(f"due_slots={len(slots)}")
	for slot in slots:
		print(f"- {slot}")

	if args.dry_run or not slots:
		return 0
	if not acquire_lock():
		print(f"lock_exists={LOCK_PATH}", file=sys.stderr)
		return 0

	try:
		state.setdefault("runs", [])
		state["last_checked_at"] = current_time.isoformat(timespec="seconds")
		write_state(state)
		returncode, log_path, final_path = run_codex(model, slots)
		finished_at = now_local().isoformat(timespec="seconds")
		run_record = {
			"started_at": current_time.isoformat(timespec="seconds"),
			"finished_at": finished_at,
			"due_slots": slots,
			"returncode": returncode,
			"log_path": str(log_path),
			"final_path": str(final_path),
		}
		state = read_state()
		state.setdefault("runs", []).append(run_record)
		state["last_checked_at"] = finished_at
		if returncode == 0:
			state["last_success_at"] = finished_at
			state["covered_due_at"] = sorted(covered.union(slots))
		else:
			state["last_failure_at"] = finished_at
		write_state(state)
		print(f"returncode={returncode}")
		print(f"log={log_path}")
		print(f"final={final_path}")
		return returncode
	finally:
		release_lock()


if __name__ == "__main__":
	raise SystemExit(main())
