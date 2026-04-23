import copy
import importlib.util
import pathlib
import sys
import unittest


def load_solution(path):
    spec = importlib.util.spec_from_file_location("solution", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules["solution"] = module
    spec.loader.exec_module(module)
    return module.summarize_transit


class SummarizeTransitTests(unittest.TestCase):
    def setUp(self):
        self.fn = load_solution(pathlib.Path(sys.argv[-1]).resolve())

    def test_groups_sorting_statuses_and_dwell(self):
        now = 1_000_000
        events = [
            {"shipment": "B", "checkpoint": "Origin", "time": now - 20 * 3600, "eta": now - 15 * 3600},
            {"shipment": "A", "checkpoint": "Port", "time": now - 2 * 3600, "eta": now + 3600},
            {"shipment": "C", "checkpoint": "Customs", "time": now - 7 * 3600},
            {"shipment": "D", "checkpoint": "Delivered", "time": now - 30 * 3600, "eta": now - 100 * 3600},
        ]
        result = self.fn(events, now)
        self.assertEqual([row["shipment"] for row in result], ["A", "B", "C", "D"])
        self.assertEqual(result[0]["status"], "on_track")
        self.assertEqual(result[0]["dwell_hours"], 2)
        self.assertEqual(result[1]["status"], "delayed")
        self.assertEqual(result[2]["status"], "unknown")
        self.assertEqual(result[3]["status"], "delivered")

    def test_tie_breaks_latest_event_and_latest_eta_by_input_order(self):
        now = 10_000
        events = [
            {"shipment": "X", "checkpoint": "Port", "time": 1_000, "eta": 20_000},
            {"shipment": "X", "checkpoint": "Warehouse", "time": 2_000, "eta": None},
            {"shipment": "X", "checkpoint": "Customs", "time": 2_000, "eta": 15_000},
            {"shipment": "X", "checkpoint": "Gate", "time": 2_000, "eta": None},
        ]
        row = self.fn(events, now)[0]
        self.assertEqual(row["current_checkpoint"], "Gate")
        self.assertEqual(row["latest_event_time"], 2_000)
        self.assertEqual(row["latest_eta"], 15_000)
        self.assertEqual(row["status"], "on_track")

    def test_deduplicates_exact_duplicates_but_keeps_later_nonduplicate_tie(self):
        now = 10_000
        duplicate = {"shipment": "S", "checkpoint": "Port", "time": 5_000, "eta": 6_000}
        events = [
            duplicate,
            dict(duplicate),
            {"shipment": "S", "checkpoint": "Truck", "time": 5_000, "eta": 6_000},
        ]
        row = self.fn(events, now, delay_threshold_hours=1)[0]
        self.assertEqual(row["current_checkpoint"], "Truck")
        self.assertEqual(row["status"], "delayed")

    def test_invalid_events_are_ignored(self):
        now = 10_000
        events = [
            {"shipment": "", "checkpoint": "Port", "time": 1, "eta": 2},
            {"shipment": "A", "checkpoint": "", "time": 1, "eta": 2},
            {"shipment": "A", "checkpoint": "Port", "time": "1", "eta": 2},
            {"shipment": "A", "checkpoint": "Port", "time": 1, "eta": "2"},
            {"shipment": "B", "checkpoint": "Port", "time": 1, "eta": None},
        ]
        result = self.fn(events, now)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["shipment"], "B")
        self.assertIsNone(result[0]["latest_eta"])

    def test_future_event_has_zero_dwell_and_threshold_boundary(self):
        now = 100_000
        at_risk_boundary = now - (12 * 3600)
        events = [
            {"shipment": "A", "checkpoint": "FutureScan", "time": now + 3600, "eta": now + 7200},
            {"shipment": "B", "checkpoint": "Border", "time": now - 3600, "eta": at_risk_boundary},
        ]
        result = {row["shipment"]: row for row in self.fn(events, now)}
        self.assertEqual(result["A"]["dwell_hours"], 0)
        self.assertEqual(result["A"]["status"], "on_track")
        self.assertEqual(result["B"]["status"], "at_risk")

    def test_input_not_mutated(self):
        events = [
            {"shipment": "A", "checkpoint": "Port", "time": 1, "eta": 2},
            {"shipment": "A", "checkpoint": "Rail", "time": 3, "eta": None},
        ]
        before = copy.deepcopy(events)
        self.fn(events, 10_000)
        self.assertEqual(events, before)


if __name__ == "__main__":
    unittest.main(argv=[sys.argv[0]])
