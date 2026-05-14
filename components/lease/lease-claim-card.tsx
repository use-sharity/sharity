"use client";

import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import {
  AlertTriangle,
  BellRing,
  Check,
  Clock,
  MessageCircle,
  Package,
  PackageCheck,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { LeaseActionDialog } from "./lease-action-dialog";
import type { LeaseActivityEvent } from "./lease-activity-timeline";
import { LeaseClaimHeader } from "./lease-claim-header";
import type {
  ApproveClaimArgs,
  CancelClaimArgs,
  MarkLeaseStatusArgs,
  MutationResult,
  RecordLeaseArgs,
  RecordPickupArgs,
  RejectClaimArgs,
  ViewerRole,
} from "./lease-claim-types";
import { LeaseCoordinationChecklist } from "./lease-coordination-checklist";
import { LeaseJourneyStepper } from "./lease-journey-stepper";
import { LeaseJourneyTimeline } from "./lease-journey-timeline";
import { getFlowType } from "./lease-journey-utils";
import { LeaseProposeWindowDialog } from "./lease-propose-window-dialog";

function getLeaseState(claim: Doc<"claims">): string {
  if (claim.status === "rejected") return "rejected";
  if (claim.status === "approved") return "approved";
  return "requested";
}

function badgeVariantForState(
  state: string,
): "default" | "secondary" | "outline" | "destructive" {
  switch (state) {
    case "approved":
      return "default";
    case "requested":
      return "secondary";
    case "picked_up":
      return "default";
    case "transferred":
      return "outline";
    case "returned":
      return "outline";
    case "expired":
      return "destructive";
    case "past_due":
      return "destructive";
    case "missing":
      return "destructive";
    case "rejected":
      return "destructive";
    default:
      return "secondary";
  }
}

function getStateIcon(state: string) {
  switch (state) {
    case "requested":
      return Clock;
    case "approved":
      return Check;
    case "rejected":
      return X;
    case "picked_up":
      return Package;
    case "transferred":
      return PackageCheck;
    case "returned":
      return PackageCheck;
    case "expired":
    case "past_due":
    case "missing":
      return AlertTriangle;
    default:
      return Clock;
  }
}

type NextActionNotice = {
  tone: "action" | "waiting" | "next" | "done" | "problem";
  title: string;
  body: string;
  required?: string;
  optional?: string;
};

// Manages a single lease claim with activity and status actions.
export function LeaseClaimCard(props: {
  itemId: Id<"items">;
  claim: Doc<"claims">;
  viewerRole: ViewerRole;
  isGiveaway: boolean;
  coordinationAddress?: string;
  ownerId?: string;
  layout?: "card" | "embedded";
  approveClaim?: (args: ApproveClaimArgs) => MutationResult;
  rejectClaim?: (args: RejectClaimArgs) => MutationResult;
  cancelClaim?: (args: CancelClaimArgs) => MutationResult;
  markPickedUp: (args: RecordPickupArgs) => MutationResult;
  markReturned: (args: RecordLeaseArgs) => MutationResult;
  markExpired?: (args: MarkLeaseStatusArgs) => MutationResult;
  markMissing?: (args: MarkLeaseStatusArgs) => MutationResult;
}) {
  const {
    itemId,
    claim,
    viewerRole,
    isGiveaway,
    coordinationAddress,
    ownerId,
    layout = "card",
    approveClaim,
    rejectClaim,
    cancelClaim,
    markPickedUp,
    markReturned,
    markExpired,
    markMissing,
  } = props;
  const t = useTranslations("LeaseClaim");
  const events = useQuery(api.items.getLeaseActivity, { claimId: claim._id });
  const conversationSummary = useQuery(
    api.messaging.getClaimConversationSummary,
    {
      itemId,
      claimId: claim._id,
    },
  );
  const leaseEvents = events as LeaseActivityEvent[] | undefined;

  const isOwner = viewerRole === "owner";
  const isApproved = claim.status === "approved";

  const isIntradayLease = useMemo(() => {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const ONE_DAY_MS = 24 * ONE_HOUR_MS;

    const duration = claim.endDate - claim.startDate;
    if (duration <= 0 || duration >= ONE_DAY_MS) return false;
    if (
      claim.startDate % ONE_HOUR_MS !== 0 ||
      claim.endDate % ONE_HOUR_MS !== 0
    ) {
      return false;
    }
    const start = new Date(claim.startDate);
    const end = new Date(claim.endDate);
    return (
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate()
    );
  }, [claim.startDate, claim.endDate]);

  const proposePickupWindow = useMutation(api.items.proposePickupWindow);
  const approvePickupWindow = useMutation(api.items.approvePickupWindow);
  const proposeReturnWindow = useMutation(api.items.proposeReturnWindow);
  const approveReturnWindow = useMutation(api.items.approveReturnWindow);
  const startConversation = useMutation(api.messaging.startConversation);
  const router = useRouter();

  const handleMessage = async () => {
    const otherUserId = isOwner ? claim.claimerId : (ownerId ?? "");
    if (!otherUserId) return;
    const conversationId = await startConversation({
      otherUserId,
      itemId,
      claimId: claim._id,
    });
    router.push(`/chat/${conversationId}`);
  };

  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isApprovingPickupTime, setIsApprovingPickupTime] = useState(false);
  const [isApprovingReturnTime, setIsApprovingReturnTime] = useState(false);

  const eventTimes = useMemo(() => {
    const byType = new Map<LeaseActivityEvent["type"], number>();
    if (leaseEvents) {
      for (const e of leaseEvents) {
        const existing = byType.get(e.type);
        if (existing === undefined || e.createdAt > existing) {
          byType.set(e.type, e.createdAt);
        }
      }
    }
    const latestKnown = (...values: Array<number | undefined>) => {
      const known = values.filter(
        (value): value is number => typeof value === "number",
      );
      return known.length > 0 ? Math.max(...known) : undefined;
    };
    return {
      requestedAt: byType.get("lease_requested") ?? claim._creationTime,
      approvedAt: byType.get("lease_approved"),
      rejectedAt:
        byType.get("lease_rejected") ??
        (claim.status === "rejected" ? claim._creationTime : undefined),
      expiredAt: latestKnown(claim.expiredAt, byType.get("lease_expired")),
      missingAt: latestKnown(claim.missingAt, byType.get("lease_missing")),
      pickedUpAt: latestKnown(claim.pickedUpAt, byType.get("lease_picked_up")),
      returnedAt: latestKnown(claim.returnedAt, byType.get("lease_returned")),
      transferredAt: latestKnown(
        claim.transferredAt,
        byType.get("lease_transferred"),
      ),
    };
  }, [
    leaseEvents,
    claim._creationTime,
    claim.expiredAt,
    claim.missingAt,
    claim.pickedUpAt,
    claim.returnedAt,
    claim.status,
    claim.transferredAt,
  ]);

  const derivedState = useMemo(() => {
    const terminalState = [
      { state: "rejected", at: eventTimes.rejectedAt },
      { state: "expired", at: eventTimes.expiredAt },
      { state: "missing", at: eventTimes.missingAt },
      { state: "returned", at: eventTimes.returnedAt },
      { state: "transferred", at: eventTimes.transferredAt },
    ]
      .filter((entry): entry is { state: string; at: number } =>
        Boolean(entry.at),
      )
      .sort((a, b) => b.at - a.at)[0];
    if (terminalState) return terminalState.state;
    if (eventTimes.pickedUpAt) return "picked_up";
    if (eventTimes.approvedAt) return "approved";
    // Check if pending request has a start date before today.
    // Uses UTC day components with ±1 day tolerance to match backend logic
    // and handle timezone differences when claim.startDate was stored as local midnight.
    // Requests that start earlier *today* should still be approvable.
    if (claim.status === "pending") {
      const now = Date.now();
      const nowDate = new Date(now);
      const nowYear = nowDate.getUTCFullYear();
      const nowMonth = nowDate.getUTCMonth();
      const nowDay = nowDate.getUTCDate();

      const startDate = new Date(claim.startDate);
      const startYear = startDate.getUTCFullYear();
      const startMonth = startDate.getUTCMonth();
      const startDay = startDate.getUTCDate();

      // Check if start date is before today (allowing ±1 day tolerance for timezone differences)
      const isBeforeToday =
        startYear < nowYear ||
        (startYear === nowYear &&
          (startMonth < nowMonth ||
            (startMonth === nowMonth && startDay < nowDay - 1)));

      if (isBeforeToday) {
        return "past_due";
      }
    }
    if (eventTimes.requestedAt) return "requested";
    return getLeaseState(claim);
  }, [claim, eventTimes]);

  const pickupProposal = useMemo(() => {
    const e = leaseEvents?.find((ev) => ev.type === "lease_pickup_proposed");
    if (!e) return undefined;
    const proposerRole: ViewerRole =
      e.actorId === claim.claimerId ? "borrower" : "owner";
    return {
      actorId: e.actorId,
      proposerRole,
      proposalId: e.proposalId,
      note: e.note,
      place: e.place,
      windowStartAt: e.windowStartAt,
      windowEndAt: e.windowEndAt,
    };
  }, [leaseEvents, claim.claimerId]);

  const pickupApproval = useMemo(() => {
    const e = leaseEvents?.find((ev) => ev.type === "lease_pickup_approved");
    if (!e) return undefined;
    const approverRole: ViewerRole =
      e.actorId === claim.claimerId ? "borrower" : "owner";
    return {
      actorId: e.actorId,
      approverRole,
      proposalId: e.proposalId,
      note: e.note,
      place: e.place,
      windowStartAt: e.windowStartAt,
      windowEndAt: e.windowEndAt,
    };
  }, [leaseEvents, claim.claimerId]);

  const returnProposal = useMemo(() => {
    const e = leaseEvents?.find((ev) => ev.type === "lease_return_proposed");
    if (!e) return undefined;
    const proposerRole: ViewerRole =
      e.actorId === claim.claimerId ? "borrower" : "owner";
    return {
      actorId: e.actorId,
      proposerRole,
      proposalId: e.proposalId,
      note: e.note,
      place: e.place,
      windowStartAt: e.windowStartAt,
      windowEndAt: e.windowEndAt,
    };
  }, [leaseEvents, claim.claimerId]);

  const returnApproval = useMemo(() => {
    const e = leaseEvents?.find((ev) => ev.type === "lease_return_approved");
    if (!e) return undefined;
    const approverRole: ViewerRole =
      e.actorId === claim.claimerId ? "borrower" : "owner";
    return {
      actorId: e.actorId,
      approverRole,
      proposalId: e.proposalId,
      note: e.note,
      place: e.place,
      windowStartAt: e.windowStartAt,
      windowEndAt: e.windowEndAt,
    };
  }, [leaseEvents, claim.claimerId]);

  const now = Date.now();
  const pickupProposalActive =
    pickupProposal &&
    (pickupProposal.windowEndAt === undefined ||
      now <= pickupProposal.windowEndAt);
  const pickupApproved =
    pickupProposal &&
    pickupApproval &&
    pickupApproval.proposalId &&
    pickupApproval.proposalId === pickupProposal.proposalId;
  const pickupConfirmWindowOpen =
    pickupProposalActive &&
    pickupProposal &&
    pickupApproved &&
    (pickupProposal.windowStartAt === undefined ||
      now >= pickupProposal.windowStartAt) &&
    (pickupProposal.windowEndAt === undefined ||
      now <= pickupProposal.windowEndAt);
  const isAwaitingPickup =
    isApproved &&
    !eventTimes.pickedUpAt &&
    !eventTimes.expiredAt &&
    !eventTimes.rejectedAt;
  const isBeforeScheduledPickup = now < claim.startDate;
  const canRecordPickup = isAwaitingPickup;
  const defaultPickupProposalAt = useMemo(() => {
    const ONE_MINUTE_MS = 60 * 1000;
    return now - ONE_MINUTE_MS;
  }, [now]);
  const hasMissedApprovedPickupWindow =
    Boolean(pickupApproved) &&
    typeof pickupProposal?.windowEndAt === "number" &&
    now > pickupProposal.windowEndAt;
  const returnProposalActive =
    returnProposal &&
    (returnProposal.windowEndAt === undefined ||
      now <= returnProposal.windowEndAt);
  const returnApproved =
    returnProposal &&
    returnApproval &&
    returnApproval.proposalId &&
    returnApproval.proposalId === returnProposal.proposalId;
  const returnProposalWindowStartAt = returnProposal?.windowStartAt;
  const returnProposalHasMeetingTime =
    typeof returnProposalWindowStartAt === "number";
  const returnProposalMeetingTime = returnProposalHasMeetingTime
    ? format(new Date(returnProposalWindowStartAt), "MMM d, p")
    : undefined;
  const returnConfirmWindowOpen =
    returnProposalActive &&
    returnProposal &&
    (returnProposal.windowStartAt === undefined ||
      now >= returnProposal.windowStartAt) &&
    (returnProposal.windowEndAt === undefined ||
      now <= returnProposal.windowEndAt);
  const isAwaitingReturn =
    !isGiveaway &&
    isApproved &&
    !!eventTimes.pickedUpAt &&
    !eventTimes.returnedAt &&
    !eventTimes.transferredAt &&
    !eventTimes.missingAt &&
    !eventTimes.rejectedAt;
  const canResolveMissingAsReturned =
    !isGiveaway &&
    isOwner &&
    isApproved &&
    !!eventTimes.pickedUpAt &&
    !!eventTimes.missingAt &&
    !!returnProposal &&
    !eventTimes.returnedAt &&
    !eventTimes.transferredAt &&
    !eventTimes.expiredAt &&
    !eventTimes.rejectedAt;
  const canRecordReturn =
    (isAwaitingReturn || canResolveMissingAsReturned) &&
    isOwner &&
    !!returnProposal &&
    (Boolean(returnApproved) || canResolveMissingAsReturned);
  const isPastDue = derivedState === "past_due";
  const canBorrowerCancel =
    !isOwner &&
    !!cancelClaim &&
    (claim.status === "pending" || claim.status === "approved") &&
    !isPastDue &&
    !eventTimes.pickedUpAt &&
    !eventTimes.returnedAt &&
    !eventTimes.expiredAt &&
    !eventTimes.missingAt &&
    !eventTimes.rejectedAt;

  const canMarkExpired =
    isOwner &&
    isApproved &&
    !eventTimes.pickedUpAt &&
    !eventTimes.expiredAt &&
    !eventTimes.rejectedAt &&
    (!isBeforeScheduledPickup || hasMissedApprovedPickupWindow);
  const canMarkMissing =
    !isGiveaway &&
    isOwner &&
    isApproved &&
    !!eventTimes.pickedUpAt &&
    !!returnProposal &&
    !eventTimes.returnedAt &&
    !eventTimes.transferredAt &&
    !eventTimes.missingAt &&
    !eventTimes.rejectedAt;

  const showStructuredMeetupDetails = false;
  const nextActionNotice = useMemo<NextActionNotice>(() => {
    const time = format(new Date(claim.startDate), "MMM d, p");
    const ownerKey = isOwner ? "owner" : "borrower";

    if (derivedState === "past_due") {
      return {
        tone: "problem",
        title: t("nextAction.title.problem"),
        body: t(`nextAction.${ownerKey}.pastDue`),
      };
    }

    if (derivedState === "rejected") {
      return {
        tone: "problem",
        title: t("nextAction.title.done"),
        body: t(`nextAction.${ownerKey}.rejected`),
      };
    }

    if (derivedState === "expired") {
      return {
        tone: "problem",
        title: t("nextAction.title.problem"),
        body: t(`nextAction.${ownerKey}.expired`),
      };
    }

    if (derivedState === "missing") {
      return {
        tone: "problem",
        title: t("nextAction.title.problem"),
        body: t(`nextAction.${ownerKey}.missing`),
      };
    }

    if (derivedState === "returned" || derivedState === "transferred") {
      return {
        tone: "done",
        title: t("nextAction.title.done"),
        body: t(`nextAction.${ownerKey}.${derivedState}`),
      };
    }

    if (claim.status === "pending") {
      return isOwner
        ? {
            tone: "action",
            title: t("nextAction.title.action"),
            body: t("nextAction.owner.requested"),
          }
        : {
            tone: "waiting",
            title: t("nextAction.title.waiting"),
            body: t("nextAction.borrower.requested"),
          };
    }

    if (isAwaitingPickup) {
      if (pickupProposal && pickupProposalActive && !pickupApproved) {
        return pickupProposal.proposerRole !== viewerRole
          ? {
              tone: "action",
              title: t("nextAction.title.action"),
              body: t(`nextAction.${ownerKey}.pickupProposalNeedsApproval`),
              required: t(`nextAction.${ownerKey}.pickupApprovalRequired`),
              optional: t(
                `nextAction.${ownerKey}.pickupOptionalSuggestAnother`,
              ),
            }
          : {
              tone: "waiting",
              title: t("nextAction.title.waiting"),
              body: t(`nextAction.${ownerKey}.pickupProposalPending`),
              required: t(`nextAction.${ownerKey}.pickupPendingRequired`),
              optional: t(
                `nextAction.${ownerKey}.pickupOptionalSuggestAnother`,
              ),
            };
      }

      if (pickupApproved && pickupProposal) {
        if (pickupConfirmWindowOpen) {
          return isOwner
            ? {
                tone: "waiting",
                title: t("nextAction.title.waiting"),
                body: t("nextAction.owner.earlyPickupReady"),
                required: t("nextAction.owner.pickupApprovedRequired"),
                optional: t("nextAction.owner.pickupOptionalChange"),
              }
            : {
                tone: "action",
                title: t("nextAction.title.action"),
                body: t("nextAction.borrower.earlyPickupReady"),
                required: t("nextAction.borrower.pickupApprovedRequired"),
                optional: t("nextAction.borrower.pickupOptionalChange"),
              };
        }
        if (
          typeof pickupProposal.windowStartAt === "number" &&
          now < pickupProposal.windowStartAt
        ) {
          return {
            tone: isOwner ? "waiting" : "action",
            title: isOwner
              ? t("nextAction.title.waiting")
              : t("nextAction.title.action"),
            body: isOwner
              ? t("nextAction.owner.approvedBeforeStart", {
                  time: format(
                    new Date(pickupProposal.windowStartAt),
                    "MMM d, p",
                  ),
                })
              : t("nextAction.borrower.approvedBeforeStart", {
                  time: format(
                    new Date(pickupProposal.windowStartAt),
                    "MMM d, p",
                  ),
                }),
            required: t(`nextAction.${ownerKey}.pickupApprovedRequired`),
            optional: t(`nextAction.${ownerKey}.pickupOptionalChange`),
          };
        }
      }

      if (isBeforeScheduledPickup) {
        return {
          tone: isOwner ? "waiting" : "action",
          title: isOwner
            ? t("nextAction.title.waiting")
            : t("nextAction.title.action"),
          body: isOwner
            ? t("nextAction.owner.approvedBeforeStartWithReschedule", {
                time,
              })
            : t("nextAction.borrower.approvedBeforeStartWithReschedule", {
                time,
              }),
          required: t(`nextAction.${ownerKey}.pickupRequired`),
          optional: t(`nextAction.${ownerKey}.pickupOptional`),
        };
      }

      return isOwner
        ? {
            tone: "waiting",
            title: t("nextAction.title.waiting"),
            body: t("nextAction.owner.awaitingPickup"),
            required: t("nextAction.owner.pickupRequired"),
            optional: t("nextAction.owner.pickupOptional"),
          }
        : {
            tone: "action",
            title: t("nextAction.title.action"),
            body: t("nextAction.borrower.awaitingPickup"),
            required: t("nextAction.borrower.pickupRequired"),
            optional: t("nextAction.borrower.pickupOptional"),
          };
    }

    if (isAwaitingReturn) {
      if (isOwner) {
        if (!returnProposal) {
          return {
            tone: "waiting",
            title: t("nextAction.title.waiting"),
            body: t("nextAction.owner.awaitingReturnRequest"),
          };
        }
        if (!returnApproved) {
          return returnProposal.proposerRole !== viewerRole
            ? {
                tone: "action",
                title: t("nextAction.title.action"),
                body: t("nextAction.owner.returnProposalNeedsApproval"),
              }
            : {
                tone: "waiting",
                title: t("nextAction.title.waiting"),
                body: t("nextAction.owner.returnProposalPending"),
              };
        }
        return {
          tone: "action",
          title: t("nextAction.title.action"),
          body: t("nextAction.owner.returnRequested"),
        };
      }

      if (!returnProposal) {
        return {
          tone: "action",
          title: t("nextAction.title.action"),
          body: t("nextAction.borrower.awaitingReturn"),
        };
      }
      if (!returnApproved) {
        return returnProposal.proposerRole !== viewerRole
          ? {
              tone: "action",
              title: t("nextAction.title.action"),
              body: t("nextAction.borrower.returnProposalNeedsApproval"),
            }
          : {
              tone: "waiting",
              title: t("nextAction.title.waiting"),
              body: t("nextAction.borrower.returnProposalPending"),
            };
      }
      return {
        tone: "waiting",
        title: t("nextAction.title.waiting"),
        body: t("nextAction.borrower.returnRequested"),
      };
    }

    return {
      tone: "next",
      title: t("nextAction.title.next"),
      body: t(`nextAction.${ownerKey}.fallback`),
    };
  }, [
    claim.startDate,
    claim.status,
    derivedState,
    isAwaitingPickup,
    isAwaitingReturn,
    isBeforeScheduledPickup,
    isOwner,
    now,
    pickupApproved,
    pickupConfirmWindowOpen,
    pickupProposal,
    pickupProposalActive,
    returnApproved,
    returnProposal,
    t,
    viewerRole,
  ]);
  const StateIcon = getStateIcon(derivedState);

  const toErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

  const flowType = getFlowType(
    isGiveaway,
    isIntradayLease,
    !showStructuredMeetupDetails,
  );
  const returnPlanCard =
    isAwaitingReturn || canResolveMissingAsReturned ? (
      <div className="space-y-2 rounded-md border bg-background p-2.5">
        <div className="text-xs text-muted-foreground">
          {returnProposal ? (
            <>
              {returnApproved
                ? t("return.proposedApproved")
                : t("return.proposed")}{" "}
              {returnProposalMeetingTime ? (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-950">
                  {returnProposalMeetingTime}
                </span>
              ) : (
                <span className="font-medium text-foreground/80">
                  {t("return.notSet")}
                </span>
              )}
              {returnApproved ? null : ` ${t("return.pendingApproval")}`}
            </>
          ) : (
            t("journey.next.suggestReturn")
          )}
        </div>
        {returnProposal ? (
          <div className="space-y-1.5 rounded-md bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-foreground/80">
                {t("return.meetingTimeLabel")}
              </span>{" "}
              {returnProposalMeetingTime ? (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-950">
                  {returnProposalMeetingTime}
                </span>
              ) : (
                <span>{t("return.notSet")}</span>
              )}
            </div>
            <div>
              <span className="font-medium text-foreground/80">
                {t("return.placeLabel")}
              </span>{" "}
              {returnProposal.place || t("return.notSet")}
            </div>
            <div>
              <span className="font-medium text-foreground/80">
                {t("return.noteDetailsLabel")}
              </span>{" "}
              {returnProposal.note || t("return.noNote")}
            </div>
            {!returnProposalMeetingTime ? (
              <div className="pt-1 text-amber-700">
                {t("return.setMeetingTimeHint")}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <LeaseProposeWindowDialog
            title={t("return.propose")}
            triggerLabel={
              returnProposal
                ? t("journey.suggestAnother")
                : t("journey.suggestReturnTime")
            }
            triggerIcon={PackageCheck}
            triggerVariant="outline"
            triggerSize="sm"
            triggerClassName="w-full h-8"
            confirmLabel={t("actions.sendProposal")}
            cancelLabel={t("actions.cancel")}
            fixedDate={new Date(returnProposal?.windowStartAt ?? claim.endDate)}
            defaultWindowStartAt={
              returnProposal?.windowStartAt ?? claim.endDate
            }
            defaultPlace={returnProposal?.place ?? coordinationAddress}
            defaultDetails={returnProposal?.note}
            disabled={
              isApproving ||
              isRejecting ||
              isCancelling ||
              isApprovingPickupTime ||
              isApprovingReturnTime
            }
            onConfirm={async ({ windowStartAt, place, note }) => {
              if (isGiveaway) return;
              setIsApprovingReturnTime(true);
              try {
                await proposeReturnWindow({
                  itemId,
                  claimId: claim._id,
                  windowStartAt,
                  place,
                  note,
                });
                toast.success(t("return.sentToast"));
              } catch (error: unknown) {
                toast.error(toErrorMessage(error));
                throw error;
              } finally {
                setIsApprovingReturnTime(false);
              }
            }}
          />

          {returnProposal &&
          !returnApproved &&
          returnProposal.proposerRole !== viewerRole ? (
            returnProposalHasMeetingTime ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="w-full h-8"
                disabled={
                  isApproving ||
                  isRejecting ||
                  isCancelling ||
                  isApprovingPickupTime ||
                  isApprovingReturnTime
                }
                onClick={async () => {
                  setIsApprovingReturnTime(true);
                  try {
                    await approveReturnWindow({
                      itemId,
                      claimId: claim._id,
                    });
                    toast.success(t("return.approvedToast"));
                  } catch (error: unknown) {
                    toast.error(toErrorMessage(error));
                  } finally {
                    setIsApprovingReturnTime(false);
                  }
                }}
              >
                {isApprovingReturnTime
                  ? t("return.approving")
                  : t("return.approve")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-8"
                disabled
              >
                {t("return.setMeetingTimeFirst")}
              </Button>
            )
          ) : returnProposal ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8"
              disabled
            >
              <PackageCheck className="mr-1.5 h-3.5 w-3.5" />
              {returnApproved ? t("return.approved") : t("return.requested")}
            </Button>
          ) : null}
        </div>
      </div>
    ) : null;

  const inner = (
    <>
      <CardHeader>
        <LeaseClaimHeader
          claim={claim}
          requestedAt={eventTimes.requestedAt ?? claim._creationTime}
          stateLabel={t(`status.${derivedState}`)}
          stateVariant={badgeVariantForState(derivedState)}
          StateIcon={StateIcon}
          viewerRole={viewerRole}
          ownerId={ownerId}
        />

        <div className="pt-2">
          <LeaseJourneyStepper
            flowType={flowType}
            derivedState={derivedState}
            eventTimes={eventTimes}
            viewerRole={viewerRole}
            events={leaseEvents ?? []}
            compact
          />
        </div>

        <div
          data-testid="lease-next-action"
          className={cn(
            "mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
            nextActionNotice.tone === "action"
              ? "animate-pulse border-amber-300 bg-amber-50 text-amber-950 shadow-sm"
              : nextActionNotice.tone === "problem"
                ? "border-destructive/30 bg-destructive/5 text-foreground"
                : nextActionNotice.tone === "done"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                  : nextActionNotice.tone === "next"
                    ? "border-primary/25 bg-primary/5 text-foreground"
                    : "border-border bg-muted/30 text-muted-foreground",
          )}
        >
          <BellRing
            className={cn(
              "mt-0.5 h-3.5 w-3.5 shrink-0",
              nextActionNotice.tone === "action"
                ? "text-amber-600"
                : nextActionNotice.tone === "problem"
                  ? "text-destructive"
                  : nextActionNotice.tone === "done"
                    ? "text-emerald-700"
                    : "text-muted-foreground",
            )}
          />
          <div className="min-w-0 space-y-0.5">
            <div className="font-semibold">{nextActionNotice.title}</div>
            <div className="leading-snug">{nextActionNotice.body}</div>
            {nextActionNotice.required || nextActionNotice.optional ? (
              <div className="mt-2 grid gap-1.5">
                {nextActionNotice.required ? (
                  <div className="flex gap-2 leading-snug">
                    <span className="shrink-0 font-semibold text-foreground">
                      {t("nextAction.required")}
                    </span>
                    <span>{nextActionNotice.required}</span>
                  </div>
                ) : null}
                {nextActionNotice.optional ? (
                  <div className="flex gap-2 leading-snug">
                    <span className="shrink-0 font-semibold text-foreground">
                      {t("nextAction.optional")}
                    </span>
                    <span>{nextActionNotice.optional}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isPastDue && (
          <div className="pb-3 text-xs text-muted-foreground">
            {t("pastDueMessage")}
          </div>
        )}

        {canBorrowerCancel && (
          <div className="pb-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-destructive hover:text-destructive"
              disabled={isApproving || isRejecting || isCancelling}
              onClick={async () => {
                if (!cancelClaim) return;
                setIsCancelling(true);
                try {
                  await cancelClaim({ claimId: claim._id });
                } finally {
                  setIsCancelling(false);
                }
              }}
            >
              {isCancelling
                ? t("actions.cancelling")
                : t("actions.cancelRequest")}
            </Button>
          </div>
        )}

        {returnPlanCard ? <div className="pb-3">{returnPlanCard}</div> : null}

        {(isOwner || viewerRole === "borrower") &&
        claim.status !== "rejected" ? (
          <div className="pb-3">
            <button
              type="button"
              onClick={handleMessage}
              className="flex w-full items-start gap-2 rounded-md border border-primary/45 bg-primary/5 p-2.5 text-left text-xs shadow-xs transition-colors hover:border-primary/70 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                <MessageCircle className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold text-primary">
                  {t("chat.title")}
                  {conversationSummary?.hasUnread ? (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none text-primary-foreground">
                      {t("chat.unread")}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-foreground/75">
                  {conversationSummary?.lastMessagePreview || t("chat.empty")}
                </span>
              </span>
            </button>
          </div>
        ) : null}

        {isOwner && claim.status === "pending" && !isPastDue && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              size="sm"
              className="h-9 w-full"
              disabled={isApproving || isRejecting || isCancelling}
              onClick={async () => {
                if (!approveClaim) return;
                setIsApproving(true);
                try {
                  await approveClaim({ claimId: claim._id, id: itemId });
                } finally {
                  setIsApproving(false);
                }
              }}
            >
              {isApproving ? (
                t("actions.approving")
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  {t("actions.approve")}
                </>
              )}
            </Button>

            {rejectClaim ? (
              <LeaseActionDialog
                title={
                  isGiveaway
                    ? t("rejectDialog.titleGiveaway")
                    : t("rejectDialog.titleLease")
                }
                description={
                  isGiveaway
                    ? t("rejectDialog.descGiveaway")
                    : t("rejectDialog.descLease")
                }
                triggerLabel={t("actions.reject")}
                triggerIcon={X}
                triggerVariant="outline"
                triggerSize="sm"
                triggerClassName="h-9 w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                confirmLabel={t("actions.rejectRequest")}
                confirmVariant="destructive"
                cancelLabel={t("actions.cancel")}
                noteConfig={{
                  id: "reject-note",
                  label: t("rejectDialog.reasonLabel"),
                  placeholder: t("rejectDialog.reasonPlaceholder"),
                  rows: 3,
                }}
                disabled={isApproving}
                onBusyChange={setIsRejecting}
                onConfirm={async () =>
                  await rejectClaim({ claimId: claim._id, id: itemId })
                }
              />
            ) : null}
          </div>
        )}

        {(isOwner || viewerRole === "borrower") &&
          claim.status === "approved" && (
            <div className="space-y-2">
              {isIntradayLease ? (
                <div className="text-xs text-muted-foreground">
                  {t("intraday.note")}
                </div>
              ) : null}
              {canRecordPickup && !isOwner ? (
                <LeaseActionDialog
                  title={t("pickup.confirmTitle")}
                  description={t("pickup.confirmDesc")}
                  triggerLabel={t("actions.iReceivedItem")}
                  triggerIcon={Package}
                  triggerSize="sm"
                  triggerClassName="w-full h-9"
                  confirmLabel={t("actions.iReceivedItem")}
                  cancelLabel={t("actions.cancel")}
                  noteConfig={{
                    id: "pickup-note",
                    label: t("pickup.noteLabel"),
                    placeholder: t("pickup.notePlaceholder"),
                    rows: 2,
                  }}
                  photoConfig={{
                    label: t("pickup.photoLabel"),
                    maxFiles: 5,
                    accept: "image/*",
                    folder: "leases",
                  }}
                  onConfirm={async ({ note, photoCloudinary }) => {
                    try {
                      await markPickedUp({
                        itemId,
                        claimId: claim._id,
                        note,
                        photoCloudinary,
                        isGiveaway,
                        approvedAt: claim.approvedAt,
                      });
                      toast.success(t("pickup.confirmedToast"));
                    } catch (error: unknown) {
                      toast.error(toErrorMessage(error));
                      throw error;
                    }
                  }}
                />
              ) : null}

              {isAwaitingPickup && isOwner ? (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {isBeforeScheduledPickup && !pickupConfirmWindowOpen
                    ? t("pickup.waitForStart", {
                        time: format(new Date(claim.startDate), "MMM d, p"),
                      })
                    : t("pickup.waitForBorrower")}
                </div>
              ) : null}

              {isAwaitingPickup ? (
                <div className="space-y-2 rounded-md border bg-background p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5 text-xs">
                      <div className="font-semibold text-foreground">
                        {t("pickup.planTitle")}
                      </div>
                      <div className="text-muted-foreground">
                        {pickupProposal ? (
                          <>
                            {pickupApproved
                              ? t("pickup.rescheduleApproved")
                              : t("pickup.rescheduleProposed")}{" "}
                            {pickupProposal.windowStartAt !== undefined ? (
                              <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-950">
                                {format(
                                  new Date(pickupProposal.windowStartAt),
                                  "MMM d, p",
                                )}
                              </span>
                            ) : (
                              t("journey.detailsSaved")
                            )}
                            {pickupApproved
                              ? null
                              : ` ${t("pickup.pendingApproval")}`}
                          </>
                        ) : (
                          t("pickup.notSet")
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {pickupApproved
                        ? t("pickup.approvedPill")
                        : pickupProposal
                          ? t("pickup.pendingPill")
                          : t("pickup.optionalPill")}
                    </span>
                  </div>

                  {!pickupProposal ? (
                    <div className="rounded-md bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
                      {t("pickup.notSetHint")}
                    </div>
                  ) : null}

                  {pickupProposal?.place || pickupProposal?.note ? (
                    <div className="space-y-1 rounded-md bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
                      {pickupProposal.place ? (
                        <div>
                          <span className="font-medium text-foreground/80">
                            {t("pickup.placeLabel")}
                          </span>{" "}
                          {pickupProposal.place}
                        </div>
                      ) : null}
                      {pickupProposal.note ? (
                        <div>
                          <span className="font-medium text-foreground/80">
                            {t("pickup.noteDetailsLabel")}
                          </span>{" "}
                          {pickupProposal.note}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <LeaseProposeWindowDialog
                      title={t("pickup.planDialogTitle")}
                      description={t("pickup.planDialogDesc")}
                      triggerLabel={
                        pickupProposal
                          ? t("pickup.suggestDifferentTime")
                          : t("pickup.suggestTime")
                      }
                      triggerIcon={Package}
                      triggerVariant="outline"
                      triggerSize="sm"
                      triggerClassName="w-full h-8"
                      confirmLabel={t("actions.sendProposal")}
                      cancelLabel={t("actions.cancel")}
                      fixedDate={new Date(defaultPickupProposalAt)}
                      defaultWindowStartAt={
                        pickupProposal?.windowStartAt ?? defaultPickupProposalAt
                      }
                      defaultPlace={
                        pickupProposal?.place ?? coordinationAddress
                      }
                      defaultDetails={pickupProposal?.note}
                      disabled={
                        isApproving ||
                        isRejecting ||
                        isCancelling ||
                        isApprovingPickupTime ||
                        isApprovingReturnTime
                      }
                      onConfirm={async ({ windowStartAt, place, note }) => {
                        try {
                          await proposePickupWindow({
                            itemId,
                            claimId: claim._id,
                            windowStartAt,
                            place,
                            note,
                          });
                          toast.success(t("pickup.sentToast"));
                        } catch (error: unknown) {
                          toast.error(toErrorMessage(error));
                          throw error;
                        }
                      }}
                    />

                    {pickupProposal &&
                    pickupProposalActive &&
                    !pickupApproved &&
                    pickupProposal.proposerRole !== viewerRole ? (
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full h-8"
                        disabled={
                          isApproving ||
                          isRejecting ||
                          isCancelling ||
                          isApprovingPickupTime ||
                          isApprovingReturnTime
                        }
                        onClick={async () => {
                          setIsApprovingPickupTime(true);
                          try {
                            await approvePickupWindow({
                              itemId,
                              claimId: claim._id,
                            });
                            toast.success(t("pickup.approvedToast"));
                          } catch (error: unknown) {
                            toast.error(toErrorMessage(error));
                          } finally {
                            setIsApprovingPickupTime(false);
                          }
                        }}
                      >
                        {isApprovingPickupTime
                          ? t("pickup.approving")
                          : t("pickup.approveReschedule")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {canRecordReturn ? (
                <LeaseActionDialog
                  title={t("return.confirmTitle")}
                  description={t("return.confirmDesc")}
                  triggerLabel={t("actions.markReturned")}
                  triggerIcon={PackageCheck}
                  triggerSize="sm"
                  triggerClassName="w-full h-9"
                  confirmLabel={t("actions.markReturned")}
                  cancelLabel={t("actions.cancel")}
                  noteConfig={{
                    id: "return-note",
                    label: t("return.noteLabel"),
                    placeholder: t("return.notePlaceholder"),
                    rows: 2,
                  }}
                  photoConfig={{
                    label: t("return.photoLabel"),
                    maxFiles: 5,
                    accept: "image/*",
                    folder: "leases",
                  }}
                  onConfirm={async ({ note, photoCloudinary }) => {
                    try {
                      await markReturned({
                        itemId,
                        claimId: claim._id,
                        note,
                        photoCloudinary,
                      });
                      toast.success(t("return.confirmedToast"));
                    } catch (error: unknown) {
                      toast.error(toErrorMessage(error));
                      throw error;
                    }
                  }}
                />
              ) : null}

              {showStructuredMeetupDetails && canRecordPickup && (
                <LeaseCoordinationChecklist
                  claim={claim}
                  mode="pickup"
                  viewerRole={viewerRole}
                  isGiveaway={isGiveaway}
                  address={coordinationAddress}
                  proposal={pickupProposal}
                  approval={pickupApproval}
                  currentAt={now}
                >
                  {pickupProposal ? (
                    <div className="text-xs text-muted-foreground">
                      {pickupApproved
                        ? t("pickup.proposedApproved")
                        : t("pickup.proposed")}{" "}
                      {pickupProposal.windowStartAt !== undefined &&
                      pickupProposal.windowEndAt !== undefined
                        ? `${format(new Date(pickupProposal.windowStartAt), "MMM d p")}–${format(new Date(pickupProposal.windowEndAt), "p")}`
                        : t("journey.detailsSaved")}
                      {pickupApproved
                        ? null
                        : ` ${t("pickup.pendingApproval")}`}
                    </div>
                  ) : null}

                  <LeaseProposeWindowDialog
                    title={t("pickup.propose")}
                    triggerLabel={
                      pickupProposal
                        ? t("journey.suggestAnother")
                        : t("journey.suggestPickupTime")
                    }
                    triggerIcon={Package}
                    triggerSize="sm"
                    triggerClassName="w-full h-8"
                    confirmLabel={t("actions.sendProposal")}
                    cancelLabel={t("actions.cancel")}
                    fixedDate={new Date(claim.startDate)}
                    defaultWindowStartAt={pickupProposal?.windowStartAt}
                    defaultPlace={pickupProposal?.place ?? coordinationAddress}
                    defaultDetails={pickupProposal?.note}
                    disabled={
                      isApproving ||
                      isRejecting ||
                      isCancelling ||
                      isApprovingPickupTime ||
                      isApprovingReturnTime
                    }
                    onConfirm={async ({ windowStartAt, place, note }) => {
                      try {
                        await proposePickupWindow({
                          itemId,
                          claimId: claim._id,
                          windowStartAt,
                          place,
                          note,
                        });
                        toast.success(t("pickup.sentToast"));
                      } catch (error: unknown) {
                        toast.error(toErrorMessage(error));
                        throw error;
                      }
                    }}
                  />

                  {pickupProposal && pickupProposalActive ? (
                    pickupApproved ? (
                      pickupConfirmWindowOpen ? (
                        <LeaseActionDialog
                          title={t("pickup.confirmTitle")}
                          description={t("pickup.confirmDesc")}
                          triggerLabel={t("pickup.confirmAction")}
                          triggerIcon={Package}
                          triggerSize="sm"
                          triggerClassName="w-full h-8"
                          confirmLabel={t("pickup.confirmAction")}
                          cancelLabel={t("actions.cancel")}
                          noteConfig={{
                            id: "pickup-note",
                            label: t("pickup.noteLabel"),
                            placeholder: t("pickup.notePlaceholder"),
                            rows: 2,
                          }}
                          photoConfig={{
                            label: t("pickup.photoLabel"),
                            maxFiles: 5,
                            accept: "image/*",
                            folder: "leases",
                          }}
                          onConfirm={async ({ note, photoCloudinary }) => {
                            try {
                              await markPickedUp({
                                itemId,
                                claimId: claim._id,
                                note,
                                photoCloudinary,
                                isGiveaway,
                                approvedAt: claim.approvedAt,
                              });
                              toast.success(t("pickup.confirmedToast"));
                            } catch (error: unknown) {
                              toast.error(toErrorMessage(error));
                              throw error;
                            }
                          }}
                        />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="w-full">
                              <Button size="sm" className="w-full h-8" disabled>
                                {t("pickup.confirmAction")}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent sideOffset={6}>
                            {pickupProposal.windowStartAt !== undefined &&
                            pickupProposal.windowEndAt !== undefined
                              ? t.rich("pickup.confirmAvailable", {
                                  start: format(
                                    new Date(pickupProposal.windowStartAt),
                                    "MMM d p",
                                  ),
                                  end: format(
                                    new Date(pickupProposal.windowEndAt),
                                    "p",
                                  ),
                                })
                              : t("pickup.waitForApproval")}
                          </TooltipContent>
                        </Tooltip>
                      )
                    ) : pickupProposal.proposerRole !== viewerRole ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8"
                        disabled={
                          isApproving ||
                          isRejecting ||
                          isCancelling ||
                          isApprovingPickupTime ||
                          isApprovingReturnTime
                        }
                        onClick={async () => {
                          setIsApprovingPickupTime(true);
                          try {
                            await approvePickupWindow({
                              itemId,
                              claimId: claim._id,
                            });
                            toast.success(t("pickup.approvedToast"));
                          } catch (error: unknown) {
                            toast.error(toErrorMessage(error));
                          } finally {
                            setIsApprovingPickupTime(false);
                          }
                        }}
                      >
                        {isApprovingPickupTime
                          ? t("pickup.approving")
                          : t("pickup.approve")}
                      </Button>
                    ) : null
                  ) : pickupProposal ? (
                    <div className="text-xs text-muted-foreground">
                      {t("pickup.windowPassed")}
                    </div>
                  ) : null}
                </LeaseCoordinationChecklist>
              )}

              {showStructuredMeetupDetails && canRecordReturn && (
                <LeaseCoordinationChecklist
                  claim={claim}
                  mode="return"
                  viewerRole={viewerRole}
                  isGiveaway={isGiveaway}
                  address={coordinationAddress}
                  proposal={returnProposal}
                  approval={returnApproval}
                  currentAt={now}
                >
                  {returnProposal ? (
                    <div className="text-xs text-muted-foreground">
                      {returnApproved
                        ? t("return.proposedApproved")
                        : t("return.proposed")}{" "}
                      {returnProposalMeetingTime ?? t("return.notSet")}
                      {returnApproved
                        ? null
                        : ` ${t("return.pendingApproval")}`}
                    </div>
                  ) : null}

                  <LeaseProposeWindowDialog
                    title={t("return.propose")}
                    triggerLabel={
                      returnProposal
                        ? t("journey.suggestAnother")
                        : t("journey.suggestReturnTime")
                    }
                    triggerIcon={PackageCheck}
                    triggerSize="sm"
                    triggerClassName="w-full h-8"
                    confirmLabel={t("actions.sendProposal")}
                    cancelLabel={t("actions.cancel")}
                    fixedDate={new Date(claim.endDate)}
                    defaultWindowStartAt={returnProposal?.windowStartAt}
                    defaultPlace={returnProposal?.place ?? coordinationAddress}
                    defaultDetails={returnProposal?.note}
                    disabled={
                      isApproving ||
                      isRejecting ||
                      isCancelling ||
                      isApprovingPickupTime ||
                      isApprovingReturnTime
                    }
                    onConfirm={async ({ windowStartAt, place, note }) => {
                      if (isGiveaway) return;
                      try {
                        await proposeReturnWindow({
                          itemId,
                          claimId: claim._id,
                          windowStartAt,
                          place,
                          note,
                        });
                        toast.success(t("return.sentToast"));
                      } catch (error: unknown) {
                        toast.error(toErrorMessage(error));
                        throw error;
                      }
                    }}
                  />

                  {returnProposal && returnProposalActive ? (
                    returnApproved ? (
                      returnConfirmWindowOpen ? (
                        <LeaseActionDialog
                          title={t("return.confirmTitle")}
                          description={t("return.confirmDesc")}
                          triggerLabel={t("return.confirmAction")}
                          triggerIcon={PackageCheck}
                          triggerSize="sm"
                          triggerClassName="w-full h-8"
                          confirmLabel={t("return.confirmAction")}
                          cancelLabel={t("actions.cancel")}
                          noteConfig={{
                            id: "return-note",
                            label: t("return.noteLabel"),
                            placeholder: t("return.notePlaceholder"),
                            rows: 2,
                          }}
                          photoConfig={{
                            label: t("return.photoLabel"),
                            maxFiles: 5,
                            accept: "image/*",
                            folder: "leases",
                          }}
                          onConfirm={async ({ note, photoCloudinary }) => {
                            try {
                              await markReturned({
                                itemId,
                                claimId: claim._id,
                                note,
                                photoCloudinary,
                              });
                              toast.success(t("return.confirmedToast"));
                            } catch (error: unknown) {
                              toast.error(toErrorMessage(error));
                              throw error;
                            }
                          }}
                        />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="w-full">
                              <Button size="sm" className="w-full h-8" disabled>
                                {t("return.confirmAction")}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent sideOffset={6}>
                            {returnProposal.windowStartAt !== undefined &&
                            returnProposal.windowEndAt !== undefined
                              ? t.rich("return.confirmAvailable", {
                                  start: format(
                                    new Date(returnProposal.windowStartAt),
                                    "MMM d p",
                                  ),
                                  end: format(
                                    new Date(returnProposal.windowEndAt),
                                    "p",
                                  ),
                                })
                              : t("return.waitForApproval")}
                          </TooltipContent>
                        </Tooltip>
                      )
                    ) : returnProposal.proposerRole !== viewerRole ? (
                      returnProposalHasMeetingTime ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-8"
                          disabled={
                            isApproving ||
                            isRejecting ||
                            isCancelling ||
                            isApprovingPickupTime ||
                            isApprovingReturnTime
                          }
                          onClick={async () => {
                            setIsApprovingReturnTime(true);
                            try {
                              await approveReturnWindow({
                                itemId,
                                claimId: claim._id,
                              });
                              toast.success(t("return.approvedToast"));
                            } catch (error: unknown) {
                              toast.error(toErrorMessage(error));
                            } finally {
                              setIsApprovingReturnTime(false);
                            }
                          }}
                        >
                          {isApprovingReturnTime
                            ? t("return.approving")
                            : t("return.approve")}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-8"
                          disabled
                        >
                          {t("return.setMeetingTimeFirst")}
                        </Button>
                      )
                    ) : null
                  ) : returnProposal ? (
                    <div className="text-xs text-muted-foreground">
                      {t("return.windowPassed")}
                    </div>
                  ) : null}
                </LeaseCoordinationChecklist>
              )}

              {isOwner && (canMarkExpired || canMarkMissing) && (
                <div className="flex gap-2">
                  {canMarkExpired && markExpired && (
                    <LeaseActionDialog
                      title={
                        isGiveaway
                          ? t("expiredDialog.titleGiveaway")
                          : t("expiredDialog.titleLease")
                      }
                      description={
                        isGiveaway
                          ? t("expiredDialog.descGiveaway")
                          : t("expiredDialog.descLease")
                      }
                      triggerLabel={t("actions.markPickupMissed")}
                      triggerIcon={AlertTriangle}
                      triggerVariant="outline"
                      triggerSize="sm"
                      triggerClassName="flex-1 h-7 text-xs text-destructive hover:text-destructive"
                      confirmLabel={t("actions.markPickupMissed")}
                      confirmVariant="destructive"
                      cancelLabel={t("actions.cancel")}
                      noteConfig={{
                        id: "expired-note",
                        label: t("expiredDialog.noteLabel"),
                        placeholder: t("expiredDialog.notePlaceholder"),
                        rows: 2,
                      }}
                      onConfirm={async ({ note }) =>
                        await markExpired({
                          itemId,
                          claimId: claim._id,
                          note,
                        })
                      }
                    />
                  )}

                  {canMarkMissing && markMissing && (
                    <LeaseActionDialog
                      title={t("missingDialog.title")}
                      description={t("missingDialog.description")}
                      triggerLabel={t("actions.markMissing")}
                      triggerIcon={AlertTriangle}
                      triggerVariant="outline"
                      triggerSize="sm"
                      triggerClassName="flex-1 h-7 text-xs text-destructive hover:text-destructive"
                      confirmLabel={t("actions.markMissing")}
                      confirmVariant="destructive"
                      cancelLabel={t("actions.cancel")}
                      noteConfig={{
                        id: "missing-note",
                        label: t("missingDialog.noteLabel"),
                        placeholder: t("missingDialog.notePlaceholder"),
                        rows: 2,
                      }}
                      onConfirm={async ({ note }) =>
                        await markMissing({
                          itemId,
                          claimId: claim._id,
                          note,
                        })
                      }
                    />
                  )}
                </div>
              )}
            </div>
          )}

        <LeaseJourneyTimeline
          flowType={flowType}
          derivedState={derivedState}
          eventTimes={eventTimes}
          events={leaseEvents}
          viewerRole={viewerRole}
          claimerId={claim.claimerId}
        />
      </CardContent>
    </>
  );

  return layout === "embedded" ? (
    inner
  ) : (
    <Card data-testid="claim-card">{inner}</Card>
  );
}
