"use client";

import { format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

import { CloudinaryImage } from "@/components/cloudinary-image";
import { Button } from "@/components/ui/button";
import { UserLink } from "@/components/user-link";
import { cn } from "@/lib/utils";
import type { LeaseActivityEvent } from "./lease-activity-timeline";
import type { ViewerRole } from "./lease-claim-types";
import type { EventTimes, FlowType, StepId } from "./lease-journey-utils";
import {
	getCanonicalSteps,
	getTerminalError,
	getTerminalErrorLabel,
	resolveStepStatuses,
} from "./lease-journey-utils";

type LeaseJourneyTimelineProps = {
	flowType: FlowType;
	derivedState: string;
	eventTimes: EventTimes;
	events: LeaseActivityEvent[] | undefined;
	viewerRole: ViewerRole;
	claimerId: string;
};

function Actor({ actorId }: { actorId: string }) {
	if (actorId === "system") {
		return <span>System</span>;
	}
	return <UserLink userId={actorId} size="sm" showAvatar={false} />;
}

// Map step IDs to the event types that represent them
const STEP_TO_EVENT_TYPES: Record<StepId, string[]> = {
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

function getEventsForStep(
	stepId: StepId,
	events: LeaseActivityEvent[],
): LeaseActivityEvent[] {
	const types = STEP_TO_EVENT_TYPES[stepId] ?? [];
	return events.filter((e) => types.includes(e.type));
}

function getFutureMilestoneDescription(
	stepId: StepId,
	viewerRole: ViewerRole,
): string {
	switch (stepId) {
		case "requested":
			return "Borrower sends a request";
		case "approved":
			return viewerRole === "owner"
				? "You approve the request"
				: "Owner approves";
		case "pickup_proposed":
			return "Either side proposes a pickup time";
		case "pickup_approved":
			return "Counterpart approves the pickup time";
		case "picked_up":
			return "Item is picked up";
		case "return_proposed":
			return "Either side proposes a return time";
		case "return_approved":
			return "Counterpart approves the return time";
		case "returned":
			return "Item is returned";
		case "transferred":
			return "Item is transferred";
	}
}

function formatEventTitle(event: LeaseActivityEvent): string {
	switch (event.type) {
		case "lease_requested":
			return "Requested";
		case "lease_approved":
			return "Approved";
		case "lease_rejected":
			return "Rejected";
		case "lease_expired":
			return "Expired";
		case "lease_missing":
			return "Missing";
		case "lease_pickup_proposed":
			return "Pickup proposed";
		case "lease_pickup_approved":
			return "Pickup time approved";
		case "lease_return_proposed":
			return "Return proposed";
		case "lease_return_approved":
			return "Return time approved";
		case "lease_picked_up":
			return "Picked up";
		case "lease_returned":
			return "Returned";
		default:
			return "Lease activity";
	}
}

function TimelineEvent({ event }: { event: LeaseActivityEvent }) {
	const photoUrls = event.photoUrls ?? [];

	return (
		<div className="min-w-0 pb-1">
			<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
				<span className="text-sm font-medium">{formatEventTitle(event)}</span>
				<span className="text-xs text-muted-foreground">
					{format(new Date(event.createdAt), "MMM d, yyyy p")}
				</span>
				<span className="text-xs text-muted-foreground flex items-center gap-1">
					by <Actor actorId={event.actorId} />
				</span>
			</div>

			{event.note && (
				<div className="text-xs text-muted-foreground break-all">
					{event.note}
				</div>
			)}

			{(event.type === "lease_pickup_proposed" ||
				event.type === "lease_pickup_approved" ||
				event.type === "lease_return_proposed" ||
				event.type === "lease_return_approved") &&
				typeof event.windowStartAt === "number" &&
				typeof event.windowEndAt === "number" && (
					<div className="text-xs text-muted-foreground">
						Window: {format(new Date(event.windowStartAt), "MMM d p")}–
						{format(new Date(event.windowEndAt), "p")}
					</div>
				)}

			{photoUrls.length > 0 && (
				<div className="mt-1.5 flex flex-wrap gap-2">
					{photoUrls.map((url) => (
						<a
							key={url}
							href={url}
							target="_blank"
							rel="noopener noreferrer"
							className="block"
						>
							<CloudinaryImage
								src={url}
								alt="Lease photo"
								width={64}
								height={64}
								sizes="64px"
								className="h-16 w-16 rounded-md border object-cover"
							/>
						</a>
					))}
				</div>
			)}
		</div>
	);
}

// Resolve timestamps for all steps. For forward-filled steps without a direct
// event, fall back to the nearest known timestamp from a later step.
function resolveAllStepTimestamps(
	steps: StepId[],
	eventTimes: EventTimes,
	events: LeaseActivityEvent[],
): Record<string, number | undefined> {
	const directMap: Record<string, number | undefined> = {};

	for (const stepId of steps) {
		switch (stepId) {
			case "requested":
				directMap[stepId] = eventTimes.requestedAt;
				break;
			case "approved":
				directMap[stepId] = eventTimes.approvedAt;
				break;
			case "picked_up":
				directMap[stepId] = eventTimes.pickedUpAt;
				break;
			case "returned":
				directMap[stepId] = eventTimes.returnedAt;
				break;
			case "transferred":
				directMap[stepId] = eventTimes.transferredAt;
				break;
			case "pickup_proposed":
			case "pickup_approved":
			case "return_proposed":
			case "return_approved": {
				const eventType = `lease_${stepId}` as LeaseActivityEvent["type"];
				const ev = [...events].reverse().find((e) => e.type === eventType);
				directMap[stepId] = ev?.createdAt;
				break;
			}
		}
	}

	// Backward-fill: for steps without a timestamp, use the nearest later known time
	const result: Record<string, number | undefined> = {};
	let nextKnown: number | undefined;
	for (let i = steps.length - 1; i >= 0; i--) {
		const id = steps[i];
		if (directMap[id] !== undefined) {
			nextKnown = directMap[id];
		}
		result[id] = directMap[id] ?? nextKnown;
	}

	return result;
}

function CompletedStepFallback({
	stepId,
	events,
	stepTimestamps,
}: {
	stepId: StepId;
	events: LeaseActivityEvent[];
	stepTimestamps: Record<string, number | undefined>;
}) {
	const labelMap: Partial<Record<StepId, string>> = {
		requested: "Requested",
		approved: "Approved",
		pickup_proposed: "Pickup proposed",
		pickup_approved: "Pickup approved",
		picked_up: "Picked up",
		return_proposed: "Return proposed",
		return_approved: "Return approved",
		returned: "Returned",
		transferred: "Transferred",
	};

	const timestamp = stepTimestamps[stepId];

	// For pickup steps, find the agreed window from lease_pickup_approved
	let agreedWindow: { start: number; end: number } | undefined;
	if (stepId === "pickup_proposed" || stepId === "pickup_approved") {
		const approved = events.find((e) => e.type === "lease_pickup_approved");
		if (
			approved &&
			typeof approved.windowStartAt === "number" &&
			typeof approved.windowEndAt === "number"
		) {
			agreedWindow = {
				start: approved.windowStartAt,
				end: approved.windowEndAt,
			};
		}
	}

	// For return steps, find the agreed window from lease_return_approved
	if (stepId === "return_proposed" || stepId === "return_approved") {
		const approved = events.find((e) => e.type === "lease_return_approved");
		if (
			approved &&
			typeof approved.windowStartAt === "number" &&
			typeof approved.windowEndAt === "number"
		) {
			agreedWindow = {
				start: approved.windowStartAt,
				end: approved.windowEndAt,
			};
		}
	}

	return (
		<div className="min-w-0">
			<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
				<span className="text-sm text-muted-foreground">
					{labelMap[stepId] ?? stepId}
				</span>
				{timestamp && (
					<span className="text-xs text-muted-foreground">
						{format(new Date(timestamp), "MMM d, yyyy p")}
					</span>
				)}
			</div>
			{agreedWindow && (
				<div className="text-xs text-muted-foreground">
					Agreed: {format(new Date(agreedWindow.start), "MMM d, p")}–
					{format(new Date(agreedWindow.end), "p")}
				</div>
			)}
		</div>
	);
}

export function LeaseJourneyTimeline(props: LeaseJourneyTimelineProps) {
	const { flowType, derivedState, eventTimes, events, viewerRole } = props;

	const [expanded, setExpanded] = useState(false);

	const steps = useMemo(() => getCanonicalSteps(flowType), [flowType]);

	const resolvedSteps = useMemo(
		() =>
			resolveStepStatuses(
				steps,
				derivedState,
				eventTimes,
				viewerRole,
				events ?? [],
			),
		[steps, derivedState, eventTimes, viewerRole, events],
	);

	const stepTimestamps = useMemo(
		() =>
			resolveAllStepTimestamps(
				steps.map((s) => s.id),
				eventTimes,
				events ?? [],
			),
		[steps, eventTimes, events],
	);

	const terminalError = useMemo(
		() => getTerminalError(derivedState),
		[derivedState],
	);

	// Get terminal error events (rejected, expired, missing)
	const terminalEvents = useMemo(() => {
		if (!events || !terminalError) return [];
		const typeMap: Record<string, string> = {
			rejected: "lease_rejected",
			expired: "lease_expired",
			missing: "lease_missing",
		};
		const eventType = typeMap[terminalError.type];
		if (!eventType) return [];
		return events.filter((e) => e.type === eventType);
	}, [events, terminalError]);

	if (!events) {
		return (
			<div className="text-sm text-muted-foreground">Loading journey...</div>
		);
	}

	return (
		<div className="border-t pt-2">
			<Button
				size="sm"
				variant="ghost"
				className="w-full justify-between h-8 px-2"
				onClick={() => setExpanded((v) => !v)}
			>
				<span className="text-xs font-medium">Journey timeline</span>
				{expanded ? (
					<ChevronUp className="h-3.5 w-3.5" />
				) : (
					<ChevronDown className="h-3.5 w-3.5" />
				)}
			</Button>

			{expanded && (
				<div className="mt-2 ml-1">
					{resolvedSteps.map((step, i) => {
						const stepEvents = getEventsForStep(step.id, events);
						const isLast = i === resolvedSteps.length - 1 && !terminalError;

						return (
							<div key={step.id} className="flex gap-3">
								{/* Vertical line + dot */}
								<div className="flex flex-col items-center">
									<TimelineDot status={step.status} />
									{!isLast && (
										<div
											className={cn(
												"w-px flex-1 min-h-4",
												step.status === "completed"
													? "bg-emerald-500"
													: step.status === "current" ||
															step.status === "current_action"
														? "bg-primary/30"
														: "bg-muted-foreground/20 border-l border-dashed border-muted-foreground/30",
											)}
										/>
									)}
								</div>

								{/* Content */}
								<div className="pb-3 min-w-0 flex-1">
									{step.status === "completed" && stepEvents.length > 0 ? (
										stepEvents.map((event) => (
											<TimelineEvent key={event._id} event={event} />
										))
									) : step.status === "completed" ? (
										<CompletedStepFallback
											stepId={step.id}
											events={events}
											stepTimestamps={stepTimestamps}
										/>
									) : step.status === "current" ||
										step.status === "current_action" ? (
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<span className="text-sm font-medium">
													{step.label}
												</span>
												{step.isYourTurn && (
													<span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
														Action needed
													</span>
												)}
											</div>
										</div>
									) : (
										<div className="min-w-0">
											<span className="text-xs text-muted-foreground/60">
												{getFutureMilestoneDescription(step.id, viewerRole)}
											</span>
										</div>
									)}
								</div>
							</div>
						);
					})}

					{/* Terminal error node */}
					{terminalError && (
						<div className="flex gap-3">
							<div className="flex flex-col items-center">
								<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive text-white">
									<span className="text-[10px] font-bold">!</span>
								</div>
							</div>
							<div className="pb-3 min-w-0 flex-1">
								{terminalEvents.length > 0 ? (
									terminalEvents.map((event) => (
										<TimelineEvent key={event._id} event={event} />
									))
								) : (
									<span className="text-sm font-medium text-destructive">
										{getTerminalErrorLabel(terminalError.type)}
									</span>
								)}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function TimelineDot({
	status,
}: {
	status: "completed" | "current" | "current_action" | "future" | "error";
}) {
	if (status === "completed") {
		return (
			<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white mt-0.5">
				<svg
					className="h-3 w-3"
					viewBox="0 0 12 12"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M2.5 6L5 8.5L9.5 3.5"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</div>
		);
	}

	if (status === "current_action") {
		return (
			<div className="relative flex h-5 w-5 shrink-0 items-center justify-center mt-0.5">
				<div className="absolute h-5 w-5 animate-ping rounded-full bg-amber-400/40" />
				<div className="h-3.5 w-3.5 rounded-full border-2 border-amber-500 bg-amber-100" />
			</div>
		);
	}

	if (status === "current") {
		return (
			<div className="relative flex h-5 w-5 shrink-0 items-center justify-center mt-0.5">
				<div className="absolute h-5 w-5 animate-ping rounded-full bg-primary/30" />
				<div className="h-3.5 w-3.5 rounded-full border-2 border-primary bg-primary/10" />
			</div>
		);
	}

	if (status === "error") {
		return (
			<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive text-white mt-0.5">
				<span className="text-[10px] font-bold">!</span>
			</div>
		);
	}

	// future
	return (
		<div className="flex h-5 w-5 shrink-0 items-center justify-center mt-0.5">
			<div className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground/40" />
		</div>
	);
}
