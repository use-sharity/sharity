#!/usr/bin/env python3
"""Report likely Sharity context-memory drift without editing files."""

from __future__ import annotations

import argparse
import datetime as dt
import os
import pathlib
import subprocess
from dataclasses import dataclass


ROOT = pathlib.Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {
	".md",
	".mdx",
	".ts",
	".tsx",
	".js",
	".jsx",
	".json",
	".toml",
	".yaml",
	".yml",
}
MEMORY_PATHS = (
	"AGENTS.md",
	".codex/context",
	".agents/skills",
	".codex/benchmarks",
	".claude/handoff",
)
DOMAIN_HINTS = {
	"convex": ("convex/", ".codex/context/convex.md", ".agents/skills/sharity-convex/SKILL.md"),
	"react-ui": (
		"app/",
		"components/",
		"messages/",
		".codex/context/react-ui.md",
		".agents/skills/sharity-react/SKILL.md",
	),
	"testing": ("e2e/", "playwright", "vitest", ".codex/context/testing.md", ".agents/skills/sharity-playwright/SKILL.md"),
	"benchmark": (".codex/benchmarks/", ".codex/context/benchmark.md", ".agents/skills/sharity-benchmark/SKILL.md"),
	"memory": (".codex/context/memory.md", ".agents/skills/sharity-memory/SKILL.md"),
}
LEARNING_MARKERS = (
	"TODO",
	"FIXME",
	"IMPORTANT",
	"CRITICAL",
	"pitfall",
	"gotcha",
	"regression",
	"workaround",
	"runbook",
	"handoff",
	"контекст",
	"важно",
	"блокер",
)


@dataclass(frozen=True)
class GitCommit:
	sha: str
	date: str
	subject: str


def run_git(args: list[str], *, strip: bool = True) -> str:
	result = subprocess.run(
		["git", *args],
		cwd=ROOT,
		check=False,
		text=True,
		stdout=subprocess.PIPE,
		stderr=subprocess.PIPE,
	)
	if result.returncode != 0:
		raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
	return result.stdout.strip() if strip else result.stdout


def path_age_days(path: pathlib.Path, now: dt.datetime) -> int | None:
	if not path.exists():
		return None
	mtime = dt.datetime.fromtimestamp(path.stat().st_mtime)
	return max(0, (now - mtime).days)


def recent_commits(days: int) -> list[GitCommit]:
	raw = run_git(["log", f"--since={days} days ago", "--date=short", "--pretty=format:%h%x09%ad%x09%s"])
	if not raw:
		return []
	return [GitCommit(*line.split("\t", 2)) for line in raw.splitlines() if line.count("\t") >= 2]


def changed_files(ref: str) -> list[str]:
	raw = run_git(["diff", "--name-only", ref])
	return [line for line in raw.splitlines() if line]


def uncommitted_files() -> list[str]:
	raw = run_git(["status", "--porcelain=v1", "-z"], strip=False)
	files: list[str] = []
	entries = [entry for entry in raw.split("\0") if entry]
	index = 0
	while index < len(entries):
		entry = entries[index]
		status = entry[:2]
		path = entry[3:] if len(entry) > 3 else ""
		if status.startswith("R") or status.startswith("C"):
			index += 1
			if index < len(entries):
				path = entries[index]
		if path:
			files.append(path)
		index += 1
	return files


def list_files(root: pathlib.Path) -> list[pathlib.Path]:
	if not root.exists():
		return []
	return sorted(path for path in root.rglob("*") if path.is_file() and path.suffix in TEXT_SUFFIXES)


def count_markers(path: pathlib.Path) -> int:
	try:
		text = path.read_text(encoding="utf-8")
	except UnicodeDecodeError:
		return 0
	lower = text.lower()
	return sum(lower.count(marker.lower()) for marker in LEARNING_MARKERS)


def domains_for_paths(paths: list[str]) -> dict[str, int]:
	counts: dict[str, int] = {}
	for path in paths:
		for domain, hints in DOMAIN_HINTS.items():
			if any(hint in path for hint in hints):
				counts[domain] = counts.get(domain, 0) + 1
	return counts


def print_section(title: str) -> None:
	print(f"\n## {title}")


def main() -> int:
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--days", type=int, default=30, help="Lookback window for commits and git diff base.")
	parser.add_argument("--base", default="HEAD", help="Git ref for changed-file comparison.")
	args = parser.parse_args()

	now = dt.datetime.now()
	print("# Sharity Context Memory Audit")
	print(f"Repository: {ROOT}")
	print(f"Generated: {now.strftime('%Y-%m-%d %H:%M:%S')}")
	print(f"Lookback: {args.days} days")

	print_section("Memory File Freshness")
	for rel in MEMORY_PATHS:
		path = ROOT / rel
		age = path_age_days(path, now)
		if age is None:
			print(f"- MISSING {rel}")
		else:
			label = "directory" if path.is_dir() else "file"
			print(f"- {rel} ({label}), last modified {age} day(s) ago")

	print_section("Recent Commits")
	commits = recent_commits(args.days)
	if commits:
		for commit in commits[:20]:
			print(f"- {commit.sha} {commit.date} {commit.subject}")
		if len(commits) > 20:
			print(f"- ... {len(commits) - 20} more")
	else:
		print("- No commits in lookback window.")

	print_section("Changed Files Since Base")
	diff_files = changed_files(args.base)
	if diff_files:
		for path in diff_files[:40]:
			print(f"- {path}")
		if len(diff_files) > 40:
			print(f"- ... {len(diff_files) - 40} more")
	else:
		print("- No committed diff against base.")

	print_section("Uncommitted Files")
	dirty_files = uncommitted_files()
	if dirty_files:
		for path in dirty_files[:60]:
			print(f"- {path}")
		if len(dirty_files) > 60:
			print(f"- ... {len(dirty_files) - 60} more")
	else:
		print("- Working tree is clean.")

	print_section("Domain Drift Signals")
	domain_counts = domains_for_paths(diff_files + dirty_files)
	if domain_counts:
		for domain, count in sorted(domain_counts.items(), key=lambda item: (-item[1], item[0])):
			print(f"- {domain}: {count} changed path(s)")
	else:
		print("- No obvious domain-specific drift from changed paths.")

	print_section("Handoff Learning Markers")
	handoff_files = list_files(ROOT / ".claude" / "handoff")
	marked = [(path, count_markers(path)) for path in handoff_files]
	marked = [(path, count) for path, count in marked if count > 0]
	if marked:
		for path, count in sorted(marked, key=lambda item: (-item[1], str(item[0])))[:20]:
			print(f"- {path.relative_to(ROOT)}: {count} marker(s)")
	else:
		print("- No marker-heavy handoff files found.")

	print_section("Recommended Review")
	if dirty_files or diff_files:
		print("- Check whether current changed domains have corresponding updates in `.codex/context` or `.agents/skills`.")
	else:
		print("- No code/context changes detected; review recent handoffs only if a session just ended.")
	if marked:
		print("- Mine marker-heavy handoffs for reusable procedures, then keep one-off IDs and drafts transient.")
	if domain_counts.get("convex"):
		print("- Compare Convex changes against `.codex/context/convex.md` and `sharity-convex`.")
	if domain_counts.get("react-ui"):
		print("- Compare UI/i18n changes against `.codex/context/react-ui.md` and `sharity-react`.")
	if domain_counts.get("testing"):
		print("- Compare test/browser learnings against `.codex/context/testing.md` and `sharity-playwright`.")
	if domain_counts.get("benchmark"):
		print("- Summarize reusable benchmark findings into `.codex/context/benchmark.md`; keep evidence in run folders.")

	return 0


if __name__ == "__main__":
	raise SystemExit(main())
