# Coding Model Microbenchmark Report

Run: `20260424-042850`

## Benchmark basis

This task follows the short functional program-synthesis style used by:

- HumanEval, introduced in "Evaluating Large Language Models Trained on Code" (Chen et al., 2021): https://arxiv.org/abs/2107.03374
- MBPP, introduced in "Program Synthesis with Large Language Models" (Austin et al., 2021): https://arxiv.org/abs/2108.07732

It is not copied from a public benchmark item, to reduce benchmark contamination risk.

SWE-bench is a better model for real repository-level tasks, but too heavy for a fast micro-run. Reference: https://arxiv.org/abs/2310.06770

## Task

Implement `summarize_transit(events, now, delay_threshold_hours=12)` for logistics shipment events.

The task checks:

- natural-language spec following;
- grouping and sorting;
- invalid input filtering;
- exact deduplication;
- latest-event tie breaking by input order;
- latest ETA independent from current checkpoint;
- status classification boundaries;
- input immutability.

## Models

| Model | Effort | Agent | Result |
|---|---:|---|---|
| `gpt-5.4-mini` | `medium` | Hooke | Passed official hidden tests |
| `gpt-5.5` | `low` | Bacon | Passed official hidden tests |

## Official Hidden Tests

| Model | Tests | Result |
|---|---:|---|
| `gpt-5.4-mini medium` | 6/6 | PASS |
| `gpt-5.5 low` | 6/6 | PASS |

Both official runs completed in `0.001s` test time.

## Post-Hoc Audit

This is not part of the official score because it was added after both outputs were visible. It checks the Python-specific edge where `bool` is a subclass of `int`, while the spec asks for integer timestamps.

| Model | Bool-as-int audit | Note |
|---|---|---|
| `gpt-5.4-mini medium` | PASS | Used `type(value) is int`, rejecting bool |
| `gpt-5.5 low` | FAIL | Used `isinstance(value, int)`, accepting bool timestamps/ETA |

## Code Size

| Model | Lines |
|---|---:|
| `gpt-5.4-mini medium` | 93 |
| `gpt-5.5 low` | 93 |

## Speed

`gpt-5.4-mini medium` returned first. Exact per-agent timings were not available from the subagent notifications. End-to-end orchestration time, including task artifact creation, both agent waits, tests, audit, and report writing: about 141 seconds.

## Verdict

For this small coding task, both models solved the official benchmark. The edge audit gives the narrow advantage to `gpt-5.4-mini medium`, because it handled Python's `bool`/`int` distinction more strictly. On this class of short function synthesis, `gpt-5.4-mini medium` looks like the better default for cost/speed unless the task requires broader architectural reasoning.
