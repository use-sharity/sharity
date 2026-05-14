"use client";

import { format } from "date-fns";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  MapPin,
  MessageSquare,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import type { ViewerRole } from "./lease-claim-types";

type CoordinationMode = "pickup" | "return";

type MeetupProposal = {
  proposerRole?: ViewerRole;
  proposalId?: string;
  note?: string;
  place?: string;
  windowStartAt?: number;
  windowEndAt?: number;
};

type MeetupApproval = {
  proposalId?: string;
  note?: string;
  place?: string;
  windowStartAt?: number;
  windowEndAt?: number;
};

type LeaseCoordinationChecklistProps = {
  claim: Doc<"claims">;
  mode: CoordinationMode;
  viewerRole: ViewerRole;
  isGiveaway: boolean;
  address?: string;
  proposal?: MeetupProposal;
  approval?: MeetupApproval;
  currentAt: number;
  children?: ReactNode;
};

function formatWindow(startAt: number, endAt: number): string {
  return `${format(new Date(startAt), "MMM d p")} - ${format(new Date(endAt), "p")}`;
}

function formatClaimRange(
  claim: Doc<"claims">,
  mode: CoordinationMode,
): string {
  if (mode === "pickup") {
    return format(new Date(claim.startDate), "MMM d");
  }
  return format(new Date(claim.endDate), "MMM d");
}

export function LeaseCoordinationChecklist({
  claim,
  mode,
  viewerRole,
  isGiveaway,
  address,
  proposal,
  approval,
  currentAt,
  children,
}: LeaseCoordinationChecklistProps) {
  const t = useTranslations("LeaseClaim.journey");
  const isPickup = mode === "pickup";
  const isProposalApproved =
    !!proposal?.proposalId &&
    !!approval?.proposalId &&
    proposal.proposalId === approval.proposalId;
  const isWithinWindow =
    !!proposal &&
    (proposal.windowStartAt === undefined ||
      currentAt >= proposal.windowStartAt) &&
    (proposal.windowEndAt === undefined || currentAt <= proposal.windowEndAt);
  const hasWindowPassed =
    !!proposal &&
    proposal.windowEndAt !== undefined &&
    currentAt > proposal.windowEndAt;

  const steps = useMemo(
    () => [
      {
        key: "requested",
        label: t("steps.requested"),
        done: true,
        current: false,
      },
      {
        key: "approved",
        label: t("steps.approved"),
        done: claim.status === "approved",
        current: false,
      },
      {
        key: "arrangePickup",
        label: t("steps.arrangePickup"),
        done: Boolean(claim.pickedUpAt),
        current: claim.status === "approved" && !claim.pickedUpAt,
      },
      {
        key: "pickedUp",
        label: t("steps.pickedUp"),
        done: Boolean(claim.pickedUpAt),
        current: Boolean(claim.pickedUpAt) && !claim.returnedAt && !isGiveaway,
      },
      {
        key: "returned",
        label: isGiveaway ? t("steps.transferred") : t("steps.returned"),
        done: Boolean(claim.returnedAt || claim.transferredAt),
        current: Boolean(claim.pickedUpAt) && !claim.returnedAt && !isGiveaway,
      },
    ],
    [
      claim.pickedUpAt,
      claim.returnedAt,
      claim.status,
      claim.transferredAt,
      isGiveaway,
      t,
    ],
  );

  const detailTime =
    proposal?.windowStartAt !== undefined && proposal.windowEndAt !== undefined
      ? formatWindow(proposal.windowStartAt, proposal.windowEndAt)
      : formatClaimRange(claim, mode);
  const detailPlace = proposal?.place ?? approval?.place ?? address;
  const detailNote = proposal?.note ?? approval?.note;

  const nextAction = (() => {
    if (!proposal) {
      return isPickup ? t("next.suggestPickup") : t("next.suggestReturn");
    }
    if (!isProposalApproved) {
      return proposal.proposerRole === viewerRole
        ? t("next.waitingForApproval")
        : t("next.approveWindow");
    }
    if (hasWindowPassed) {
      return t("next.windowPassed");
    }
    if (!isWithinWindow) {
      return t("next.waitForWindow");
    }
    return isPickup ? t("next.confirmPickup") : t("next.confirmReturn");
  })();

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {steps.map((step) => (
          <span
            key={step.key}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium",
              step.done
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : step.current
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-border bg-background text-muted-foreground",
            )}
          >
            {step.done ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <Circle className="h-3 w-3" />
            )}
            {step.label}
          </span>
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">
          {isPickup ? t("pickupTitle") : t("returnTitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {isPickup ? t("pickupHelper") : t("returnHelper")}
        </p>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="flex gap-2 rounded-md border bg-background p-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">
              {isPickup ? t("place.pickup") : t("place.return")}
            </p>
            <p className="text-muted-foreground">
              {detailPlace || t("place.fallback")}
            </p>
          </div>
        </div>
        <div className="flex gap-2 rounded-md border bg-background p-2">
          <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">
              {isPickup ? t("time.pickup") : t("time.return")}
            </p>
            <p className="text-muted-foreground">{detailTime}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 rounded-md border bg-background p-2 text-xs">
        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">{t("note.title")}</p>
          <p className="text-muted-foreground">
            {detailNote || t("note.body")}
          </p>
        </div>
      </div>

      <div className="rounded-md border border-primary/15 bg-primary/5 px-2.5 py-2 text-xs">
        <span className="font-medium">{t("next.label")}</span> {nextAction}
      </div>

      {children ? <div className="space-y-2">{children}</div> : null}
    </div>
  );
}
