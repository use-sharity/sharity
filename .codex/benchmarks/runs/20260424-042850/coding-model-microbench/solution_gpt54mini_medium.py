def summarize_transit(events, now, delay_threshold_hours=12):
    unique_events = set()
    shipments = {}

    def is_int(value):
        return type(value) is int

    for index, event in enumerate(events):
        if not isinstance(event, dict):
            continue

        if "shipment" not in event or "checkpoint" not in event or "time" not in event:
            continue

        shipment = event["shipment"]
        checkpoint = event["checkpoint"]
        time = event["time"]

        if not isinstance(shipment, str) or not shipment:
            continue
        if not isinstance(checkpoint, str) or not checkpoint:
            continue
        if not is_int(time):
            continue

        eta_present = "eta" in event
        eta = event.get("eta", None)
        if eta_present and eta is not None and not is_int(eta):
            continue

        dedup_key = (shipment, checkpoint, time, eta)
        if dedup_key in unique_events:
            continue
        unique_events.add(dedup_key)

        state = shipments.get(shipment)
        current_key = (time, index)

        if state is None:
            state = {
                "latest_event_key": current_key,
                "latest_event_time": time,
                "current_checkpoint": checkpoint,
                "latest_eta_key": None,
                "latest_eta": None,
            }
            shipments[shipment] = state
        else:
            if current_key > state["latest_event_key"]:
                state["latest_event_key"] = current_key
                state["latest_event_time"] = time
                state["current_checkpoint"] = checkpoint

        if eta is not None:
            eta_key = (time, index)
            if state["latest_eta_key"] is None or eta_key > state["latest_eta_key"]:
                state["latest_eta_key"] = eta_key
                state["latest_eta"] = eta

    results = []
    delay_threshold_seconds = delay_threshold_hours * 3600

    for shipment in sorted(shipments.keys()):
        state = shipments[shipment]
        latest_event_time = state["latest_event_time"]
        latest_eta = state["latest_eta"]
        current_checkpoint = state["current_checkpoint"]

        dwell_hours = max(0, (now - latest_event_time) // 3600)

        if current_checkpoint.lower() == "delivered":
            status = "delivered"
        elif latest_eta is None:
            status = "unknown"
        elif now <= latest_eta:
            status = "on_track"
        elif now <= latest_eta + delay_threshold_seconds:
            status = "at_risk"
        else:
            status = "delayed"

        results.append(
            {
                "shipment": shipment,
                "current_checkpoint": current_checkpoint,
                "latest_event_time": latest_event_time,
                "latest_eta": latest_eta,
                "dwell_hours": dwell_hours,
                "status": status,
            }
        )

    return results
