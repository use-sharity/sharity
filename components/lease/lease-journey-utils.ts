import type { ViewerRole } from "./lease-claim-types";

export type FlowType = "loan" | "giveaway" | "intraday";

export type StepId =
	| "requested"
	| "approved"
	| "pickup_proposed"
	| "pickup_approved"
	| "picked_up"
	| "return_proposed"
	| "return_approved"
	| "returned"
	| "transferred";

export type StepStatus =
	| "completed"
	| "current"
	| "current_action"
	| "future"
	| "error";

export type JourneyStep = {
	id: StepId;
	label: string;
	shortLabel: string;
};

export type ResolvedStep = JourneyStep & {
	status: StepStatus;
	isYourTurn: boolean;
};

export type TerminalError = {
	type: "rejected" | "expired" | "missing" | "past_due";
	afterStepId: StepId;
};

export type EventTimes = {
	requestedAt?: number;
	approvedAt?: number;
	rejectedAt?: number;
	expiredAt?: number;
	missingAt?: number;
	pickedUpAt?: number;
	returnedAt?: number;
	transferredAt?: number;
};

const LOAN_STEPS: JourneyStep[] = [
	{ id: "requested", label: "Requested", shortLabel: "Request" },
	{ id: "approved", label: "Approved", shortLabel: "Approve" },
	{ id: "pickup_proposed", label: "Pickup proposed", shortLabel: "Propose" },
	{ id: "pickup_approved", label: "Pickup approved", shortLabel: "Confirm" },
	{ id: "picked_up", label: "Picked up", shortLabel: "Pickup" },
	{ id: "return_proposed", label: "Return proposed", shortLabel: "Propose" },
	{ id: "return_approved", label: "Return approved", shortLabel: "Confirm" },
	{ id: "returned", label: "Returned", shortLabel: "Return" },
];

const GIVEAWAY_STEPS: JourneyStep[] = [
	{ id: "requested", label: "Requested", shortLabel: "Request" },
	{ id: "approved", label: "Approved", shortLabel: "Approve" },
	{ id: "pickup_proposed", label: "Pickup proposed", shortLabel: "Propose" },
	{ id: "pickup_approved", label: "Pickup approved", shortLabel: "Confirm" },
	{ id: "transferred", label: "Transferred", shortLabel: "Done" },
];

const INTRADAY_STEPS: JourneyStep[] = [
	{ id: "requested", label: "Requested", shortLabel: "Request" },
	{ id: "approved", label: "Approved", shortLabel: "Approve" },
	{ id: "picked_up", label: "Picked up", shortLabel: "Pickup" },
	{ id: "returned", label: "Returned", shortLabel: "Return" },
];

export function getFlowType(
	isGiveaway: boolean,
	isIntraday: boolean,
): FlowType {
	if (isGiveaway) return "giveaway";
	if (isIntraday) return "intraday";
	return "loan";
}

export function getCanonicalSteps(flowType: FlowType): JourneyStep[] {
	switch (flowType) {
		case "giveaway":
			return GIVEAWAY_STEPS;
		case "intraday":
			return INTRADAY_STEPS;
		case "loan":
			return LOAN_STEPS;
	}
}

// Which role needs to act at each step
function getActorForStep(stepId: StepId): ViewerRole | null {
	switch (stepId) {
		case "requested":
			return "borrower";
		case "approved":
			return "owner";
		case "pickup_proposed":
			return null; // either side
		case "pickup_approved":
			return null; // counterpart of proposer
		case "picked_up":
			return null; // either side confirms
		case "return_proposed":
			return null;
		case "return_approved":
			return null;
		case "returned":
			return null;
		case "transferred":
			return null;
		default:
			return null;
	}
}

// Map step IDs to the event types that represent them
const STEP_EVENT_TYPES: Record<StepId, string[]> = {
	requested: ["lease_requested"],
	approved: ["lease_approved"],
	pickup_proposed: ["lease_pickup_proposed"],
	pickup_approved: ["lease_pickup_approved"],
	picked_up: ["lease_picked_up"],
	return_proposed: ["lease_return_proposed"],
	return_approved: ["lease_return_approved"],
	returned: ["lease_returned"],
	transferred: ["lease_transferred"],
};

export function resolveStepStatuses(
	steps: JourneyStep[],
	derivedState: string,
	eventTimes: EventTimes,
	viewerRole: ViewerRole,
	events: Array<{ type: string }>,
): ResolvedStep[] {
	const terminalError = getTerminalError(derivedState);

	// Build a set of event types that have occurred
	const eventTypeSet = new Set(events.map((e) => e.type));

	// Map step ids to whether they have occurred (event-based)
	const stepHasEvent: Record<string, boolean> = {};
	for (const step of steps) {
		const eventTypes = STEP_EVENT_TYPES[step.id];
		stepHasEvent[step.id] = eventTypes
			? eventTypes.some((t) => eventTypeSet.has(t))
			: false;
	}

	// Forward-fill: if step N is completed, all steps before N are also completed
	let lastCompletedIdx = -1;
	for (let i = steps.length - 1; i >= 0; i--) {
		if (stepHasEvent[steps[i].id]) {
			lastCompletedIdx = i;
			break;
		}
	}
	if (lastCompletedIdx > 0) {
		for (let i = 0; i < lastCompletedIdx; i++) {
			stepHasEvent[steps[i].id] = true;
		}
	}

	let passedCurrent = false;
	let foundCurrent = false;

	return steps.map((step) => {
		// If we have a terminal error, check if this step is after the error point
		if (terminalError && passedCurrent) {
			return { ...step, status: "future" as const, isYourTurn: false };
		}

		if (stepHasEvent[step.id]) {
			return { ...step, status: "completed" as const, isYourTurn: false };
		}

		if (!foundCurrent && !passedCurrent) {
			// This is the first uncompleted step — it's current
			foundCurrent = true;
			passedCurrent = true;

			if (terminalError) {
				return { ...step, status: "error" as const, isYourTurn: false };
			}

			const actor = getActorForStep(step.id);
			const isYourTurn = actor === null || actor === viewerRole;

			return {
				...step,
				status: isYourTurn ? ("current_action" as const) : ("current" as const),
				isYourTurn,
			};
		}

		return { ...step, status: "future" as const, isYourTurn: false };
	});
}

export function getTerminalError(
	derivedState: string,
): TerminalError | undefined {
	switch (derivedState) {
		case "rejected":
			return { type: "rejected", afterStepId: "requested" };
		case "expired":
			return { type: "expired", afterStepId: "approved" };
		case "missing":
			return { type: "missing", afterStepId: "picked_up" };
		case "past_due":
			return { type: "past_due", afterStepId: "requested" };
		default:
			return undefined;
	}
}

export function getTerminalErrorLabel(type: TerminalError["type"]): string {
	switch (type) {
		case "rejected":
			return "Rejected";
		case "expired":
			return "Expired";
		case "missing":
			return "Missing";
		case "past_due":
			return "Past due";
	}
}
