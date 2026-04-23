# Coding Model Microbenchmark: Transit Summary

This is a HumanEval/MBPP-style task inspired by short functional program synthesis benchmarks, but it is not copied from a public benchmark item.

Implement exactly one Python function:

```python
def summarize_transit(events, now, delay_threshold_hours=12):
    ...
```

## Input

`events` is a list of dictionaries. A valid event has:

- `"shipment"`: non-empty string
- `"checkpoint"`: non-empty string
- `"time"`: integer Unix timestamp in seconds
- optional `"eta"`: integer Unix timestamp in seconds or `None`

`now` is an integer Unix timestamp in seconds.

## Required behavior

1. Ignore invalid events:
   - missing `"shipment"`, `"checkpoint"`, or `"time"`;
   - non-string or empty `"shipment"`;
   - non-string or empty `"checkpoint"`;
   - non-integer `"time"`;
   - `"eta"` present but neither integer nor `None`.
2. Deduplicate exact duplicate valid events by `(shipment, checkpoint, time, eta)`.
3. Group valid events by shipment.
4. For each shipment, the current checkpoint is from the latest valid event by `"time"`.
   - If two events for the same shipment have the same `"time"`, the later event in input order wins.
5. The latest ETA is taken from the most recent valid event for that shipment whose `"eta"` is not `None`.
   - "Most recent" uses `"time"`, with later input order winning ties.
   - The latest ETA may come from a different event than the current checkpoint.
6. `dwell_hours` is the floor number of hours since the latest event:
   - `max(0, (now - latest_event_time) // 3600)`
7. `status` is:
   - `"delivered"` if the current checkpoint lowercased is exactly `"delivered"`;
   - otherwise `"unknown"` if there is no latest ETA;
   - otherwise `"on_track"` if `now <= latest_eta`;
   - otherwise `"at_risk"` if `now <= latest_eta + delay_threshold_hours * 3600`;
   - otherwise `"delayed"`.
8. Return a list sorted by shipment id ascending. Each item must be:

```python
{
    "shipment": str,
    "current_checkpoint": str,
    "latest_event_time": int,
    "latest_eta": int | None,
    "dwell_hours": int,
    "status": str,
}
```

9. The function must not mutate the input.

## Output requirements

Return code only. Do not include Markdown fences. Do not include explanations.
