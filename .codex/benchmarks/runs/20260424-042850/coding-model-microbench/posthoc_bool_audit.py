import importlib.util
import pathlib
import sys


def load_solution(path):
    spec = importlib.util.spec_from_file_location("solution", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.summarize_transit


def main():
    fn = load_solution(pathlib.Path(sys.argv[1]).resolve())
    result = fn(
        [
            {"shipment": "BAD_TIME", "checkpoint": "Port", "time": True, "eta": 10},
            {"shipment": "BAD_ETA", "checkpoint": "Port", "time": 1, "eta": False},
            {"shipment": "GOOD", "checkpoint": "Port", "time": 1, "eta": None},
        ],
        100,
    )
    shipments = [row["shipment"] for row in result]
    if shipments != ["GOOD"]:
        raise AssertionError(f"Expected only GOOD shipment, got {shipments!r}")
    print("OK")


if __name__ == "__main__":
    main()
