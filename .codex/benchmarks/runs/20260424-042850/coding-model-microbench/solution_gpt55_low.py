def summarize_transit(events, now, delay_threshold_hours=12):
    seen = set()
    shipments = {}

    for index, event in enumerate(events):
        if not isinstance(event, dict):
            continue
        if "shipment" not in event or "checkpoint" not in event or "time" not in event:
            continue

        shipment = event["shipment"]
        checkpoint = event["checkpoint"]
        event_time = event["time"]
        eta = event.get("eta", None)

        if not isinstance(shipment, str) or shipment == "":
            continue
        if not isinstance(checkpoint, str) or checkpoint == "":
            continue
        if not isinstance(event_time, int):
            continue
        if "eta" in event and eta is not None and not isinstance(eta, int):
            continue

        key = (shipment, checkpoint, event_time, eta)
        if key in seen:
            continue
        seen.add(key)

        if shipment not in shipments:
            shipments[shipment] = {
                "current_checkpoint": checkpoint,
                "latest_event_time": event_time,
                "latest_event_index": index,
                "latest_eta": None,
                "latest_eta_time": None,
                "latest_eta_index": None,
            }

        summary = shipments[shipment]

        if (
            event_time > summary["latest_event_time"]
            or (
                event_time == summary["latest_event_time"]
                and index > summary["latest_event_index"]
            )
        ):
            summary["current_checkpoint"] = checkpoint
            summary["latest_event_time"] = event_time
            summary["latest_event_index"] = index

        if eta is not None and (
            summary["latest_eta_time"] is None
            or event_time > summary["latest_eta_time"]
            or (
                event_time == summary["latest_eta_time"]
                and index > summary["latest_eta_index"]
            )
        ):
            summary["latest_eta"] = eta
            summary["latest_eta_time"] = event_time
            summary["latest_eta_index"] = index

    result = []
    for shipment in sorted(shipments):
        summary = shipments[shipment]
        latest_eta = summary["latest_eta"]
        dwell_hours = max(0, (now - summary["latest_event_time"]) // 3600)

        if summary["current_checkpoint"].lower() == "delivered":
            status = "delivered"
        elif latest_eta is None:
            status = "unknown"
        elif now <= latest_eta:
            status = "on_track"
        elif now <= latest_eta + delay_threshold_hours * 3600:
            status = "at_risk"
        else:
            status = "delayed"

        result.append(
            {
                "shipment": shipment,
                "current_checkpoint": summary["current_checkpoint"],
                "latest_event_time": summary["latest_event_time"],
                "latest_eta": latest_eta,
                "dwell_hours": dwell_hours,
                "status": status,
            }
        )

    return result
