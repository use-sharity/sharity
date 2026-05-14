"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import type { ViewerRole } from "./lease-claim-types";
import {
  type FlowType,
  type ResolvedStep,
  getCanonicalSteps,
  getTerminalError,
  resolveStepStatuses,
} from "./lease-journey-utils";

type LeaseJourneyStepperProps = {
  flowType: FlowType;
  derivedState: string;
  eventTimes: { [key: string]: number | undefined };
  viewerRole: ViewerRole;
  events: Array<{ type: string }>;
  compact?: boolean;
};

function StepDot({ step }: { step: ResolvedStep }) {
  if (step.status === "completed") {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3.5 w-3.5" />
      </div>
    );
  }

  if (step.status === "error") {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive text-white">
        <X className="h-3.5 w-3.5" />
      </div>
    );
  }

  if (step.status === "current_action") {
    return (
      <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        <div className="absolute h-6 w-6 animate-ping rounded-full bg-amber-400/40" />
        <div className="h-4 w-4 rounded-full border-2 border-amber-500 bg-amber-100" />
      </div>
    );
  }

  if (step.status === "current") {
    return (
      <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        <div className="absolute h-6 w-6 animate-ping rounded-full bg-primary/30" />
        <div className="h-4 w-4 rounded-full border-2 border-primary bg-primary/10" />
      </div>
    );
  }

  // future
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center">
      <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 bg-background" />
    </div>
  );
}

function StepConnector({
  completed,
  isError,
}: {
  completed: boolean;
  isError: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-1 h-0.5 min-w-2",
        completed
          ? "bg-emerald-500"
          : isError
            ? "bg-destructive/40"
            : "bg-muted-foreground/20",
      )}
    />
  );
}

function stepLabelKey(stepId: ResolvedStep["id"]) {
  return `steps.${stepId}`;
}

export function LeaseJourneyStepper(props: LeaseJourneyStepperProps) {
  const {
    flowType,
    derivedState,
    eventTimes,
    viewerRole,
    events,
    compact = false,
  } = props;
  const t = useTranslations("LeaseClaim.journey.stepper");

  const steps = useMemo(() => getCanonicalSteps(flowType), [flowType]);

  const resolvedSteps = useMemo(
    () =>
      resolveStepStatuses(steps, derivedState, eventTimes, viewerRole, events),
    [steps, derivedState, eventTimes, viewerRole, events],
  );

  const terminalError = useMemo(
    () => getTerminalError(derivedState),
    [derivedState],
  );

  return (
    <div className="w-full">
      {/* Horizontal stepper */}
      <div className="flex items-center w-full">
        {resolvedSteps.map((step, i) => (
          <div
            key={step.id}
            className={cn("flex items-center", i === 0 ? "" : "flex-1")}
          >
            {i > 0 && (
              <StepConnector
                completed={step.status === "completed"}
                isError={step.status === "error"}
              />
            )}
            <StepDot step={step} />
          </div>
        ))}
        {terminalError && <TerminalErrorDot />}
      </div>

      {/* Labels */}
      <div className="flex items-start w-full mt-1.5">
        {resolvedSteps.map((step, i) => (
          <div
            key={step.id}
            className={cn(
              "flex items-start justify-center",
              i === 0 ? "w-10 -ml-2" : "flex-1 ml-0.5",
            )}
          >
            <span
              data-testid={`lease-step-label-${step.id}`}
              className={cn(
                "max-w-16 text-center leading-tight",
                compact ? "text-[9px] sm:text-[10px]" : "text-[10px]",
                step.status === "completed"
                  ? "text-emerald-700 font-medium"
                  : step.status === "current_action"
                    ? "text-amber-700 font-semibold"
                    : step.status === "current"
                      ? "text-foreground font-medium"
                      : step.status === "error"
                        ? "text-destructive font-medium"
                        : "text-muted-foreground/60",
              )}
            >
              {t(stepLabelKey(step.id))}
            </span>
          </div>
        ))}
        {terminalError && (
          <div className="flex items-start justify-center w-10 -mr-2 ml-0.5">
            <span className="text-[10px] leading-tight text-center text-destructive font-medium">
              {t(`terminal.${terminalError.type}`)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function TerminalErrorDot() {
  return (
    <>
      <div className="flex-1 h-0.5 min-w-2 bg-destructive/40 border-t border-dashed border-destructive/60" />
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive text-white">
        <X className="h-3.5 w-3.5" />
      </div>
    </>
  );
}
