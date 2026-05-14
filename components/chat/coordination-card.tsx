"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
  PackageCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LeaseProposeWindowDialog } from "@/components/lease/lease-propose-window-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type CoordinationMode = "pickup" | "return";

function formatPlanTime(value?: number): string | null {
  if (value === undefined) return null;
  return format(new Date(value), "MMM d, HH:mm");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

interface CoordinationCardProps {
  conversationId: Id<"conversations">;
}

export function CoordinationCard({ conversationId }: CoordinationCardProps) {
  const t = useTranslations("ChatCoordination");
  const { isSignedIn } = useAuth();
  const coordination = useQuery(
    api.messaging.getConversationCoordination,
    isSignedIn ? { conversationId } : "skip",
  );
  const proposePickup = useMutation(api.items.proposePickupWindow);
  const proposeReturn = useMutation(api.items.proposeReturnWindow);
  const approvePickup = useMutation(api.items.approvePickupWindow);
  const approveReturn = useMutation(api.items.approveReturnWindow);
  const markPickedUp = useMutation(api.items.markPickedUp);
  const markReturned = useMutation(api.items.markReturned);

  const mode = useMemo<CoordinationMode | null>(() => {
    if (!coordination) return null;
    const { claim, item } = coordination;
    if (claim.status !== "approved") return null;
    if (claim.expiredAt || claim.missingAt || claim.returnedAt) return null;
    if (!claim.pickedUpAt) return "pickup";
    if (!item.giveaway && !claim.transferredAt) return "return";
    return null;
  }, [coordination]);

  const plan = mode
    ? mode === "pickup"
      ? coordination?.pickup
      : coordination?.return
    : null;
  const proposal = plan?.proposal ?? null;
  const approval = plan?.approval ?? null;
  const isApproved =
    Boolean(proposal?.proposalId) &&
    approval?.proposalId === proposal?.proposalId;
  const canConfirmReceived =
    mode === "pickup" && coordination?.viewerRole === "borrower";
  const canRequestReturn =
    mode === "return" && coordination?.viewerRole === "borrower";
  const canConfirmReturned =
    mode === "return" &&
    coordination?.viewerRole === "owner" &&
    Boolean(proposal);
  const canQuickRequestReturn = canRequestReturn && !proposal;
  const canSavePlan = mode === "pickup" || canRequestReturn;
  const canApprovePlan =
    Boolean(proposal?.proposalId) &&
    !isApproved &&
    proposal?.actorId !== coordination?.currentUserId &&
    (mode === "pickup" || coordination?.viewerRole === "owner");

  const [isSaving, setIsSaving] = useState(false);
  const [isMilestoneBusy, setIsMilestoneBusy] = useState(false);

  if (coordination === undefined) return null;
  if (!coordination || !mode) return null;

  const timeLabel = formatPlanTime(proposal?.windowStartAt);
  const statusLabel = proposal
    ? isApproved
      ? t("status.approved")
      : t("status.pending")
    : t("status.empty");
  const savePlanLabel =
    mode === "pickup" ? t("actions.savePickup") : t("actions.saveReturn");
  const approvePlanLabel =
    mode === "pickup" ? t("actions.approvePickup") : t("actions.approveReturn");
  const milestoneLabel = canConfirmReceived
    ? t("actions.iReceivedItem")
    : canQuickRequestReturn
      ? t("actions.returnItem")
      : t("actions.markReturned");
  const title = mode === "pickup" ? t("pickupTitle") : t("returnTitle");
  const fallbackDetails =
    mode === "pickup" ? t("pickupFallback") : t("returnFallback");
  const defaultWindowStartAt =
    proposal?.windowStartAt ??
    (mode === "pickup"
      ? coordination.claim.startDate
      : coordination.claim.endDate);

  const handleSavePlan = async (nextPlan: {
    windowStartAt: number;
    place?: string;
    note?: string;
  }) => {
    setIsSaving(true);
    try {
      const args = {
        itemId: coordination.item._id,
        claimId: coordination.claim._id,
        windowStartAt: nextPlan.windowStartAt,
        place: nextPlan.place,
        note: nextPlan.note,
      };
      if (mode === "pickup") {
        await proposePickup(args);
      } else {
        await proposeReturn(args);
      }
      toast.success(t("toast.saved"));
    } catch (error: unknown) {
      toast.error(toErrorMessage(error));
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprovePlan = async () => {
    setIsSaving(true);
    try {
      const args = {
        itemId: coordination.item._id,
        claimId: coordination.claim._id,
      };
      if (mode === "pickup") {
        await approvePickup(args);
      } else {
        await approveReturn(args);
      }
      toast.success(t("toast.approved"));
    } catch (error: unknown) {
      toast.error(toErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleMilestone = async () => {
    setIsMilestoneBusy(true);
    try {
      const args = {
        itemId: coordination.item._id,
        claimId: coordination.claim._id,
      };
      if (canConfirmReceived) {
        await markPickedUp(args);
      } else if (canQuickRequestReturn) {
        await proposeReturn(args);
      } else if (canConfirmReturned) {
        await markReturned(args);
      }
      toast.success(t("toast.milestoneSaved"));
    } catch (error: unknown) {
      toast.error(toErrorMessage(error));
    } finally {
      setIsMilestoneBusy(false);
    }
  };

  return (
    <section className="shrink-0 border-b bg-background">
      <div className="mx-auto max-w-2xl px-4 py-2 md:px-8">
        <div className="rounded-md border bg-card px-3 py-2 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">{title}</h2>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {timeLabel ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5" />
                    {timeLabel}
                  </span>
                ) : null}
                {proposal?.place ? (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{proposal.place}</span>
                  </span>
                ) : null}
                {!timeLabel && !proposal?.place ? (
                  <span>{proposal?.note ?? fallbackDetails}</span>
                ) : null}
              </div>
            </div>
            <Badge variant={isApproved ? "default" : "outline"}>
              {isApproved ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
              {statusLabel}
            </Badge>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {canSavePlan ? (
              <LeaseProposeWindowDialog
                title={title}
                description={fallbackDetails}
                triggerLabel={savePlanLabel}
                triggerIcon={CalendarClock}
                triggerVariant="outline"
                triggerSize="sm"
                triggerClassName="h-8 flex-1 min-w-[10rem]"
                confirmLabel={savePlanLabel}
                cancelLabel={t("actions.cancel")}
                fixedDate={new Date(defaultWindowStartAt)}
                defaultWindowStartAt={defaultWindowStartAt}
                defaultPlace={proposal?.place ?? coordination.item.address}
                defaultDetails={proposal?.note}
                disabled={isSaving || isMilestoneBusy}
                onConfirm={handleSavePlan}
                onBusyChange={setIsSaving}
              />
            ) : null}
            {canApprovePlan ? (
              <Button
                type="button"
                size="sm"
                onClick={handleApprovePlan}
                disabled={isSaving || isMilestoneBusy}
                className="h-8 flex-1 min-w-[9rem]"
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                {isSaving ? t("actions.approving") : approvePlanLabel}
              </Button>
            ) : null}
            {canConfirmReceived ||
            canQuickRequestReturn ||
            canConfirmReturned ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleMilestone}
                disabled={isSaving || isMilestoneBusy}
                className="h-8 flex-1 min-w-[9rem]"
              >
                <PackageCheck className="mr-1.5 h-3.5 w-3.5" />
                {isMilestoneBusy ? t("actions.saving") : milestoneLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
