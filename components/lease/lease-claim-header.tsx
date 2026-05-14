"use client";

import {
  differenceInCalendarDays,
  endOfToday,
  format,
  isPast,
  isToday,
} from "date-fns";
import type { LucideIcon } from "lucide-react";
import { Calendar, Clock } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { UserLink } from "@/components/user-link";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

type LeaseClaimHeaderProps = {
  claim: Doc<"claims">;
  requestedAt: number;
  stateLabel: string;
  stateVariant: "default" | "secondary" | "outline" | "destructive";
  StateIcon: LucideIcon;
  viewerRole?: "owner" | "borrower";
  ownerId?: string;
};

type DueTone = "complete" | "overdue" | "urgent" | "soon" | "safe";

function getDueTone(claim: Doc<"claims">): DueTone {
  if (
    claim.returnedAt ||
    claim.transferredAt ||
    claim.expiredAt ||
    claim.missingAt
  ) {
    return "complete";
  }

  const endDate = new Date(claim.endDate);
  if (isPast(endDate) && !isToday(endDate)) return "overdue";

  const daysLeft = differenceInCalendarDays(endDate, endOfToday());
  if (daysLeft <= 1) return "urgent";
  if (daysLeft <= 3) return "soon";
  return "safe";
}

function dueClassName(tone: DueTone): string {
  switch (tone) {
    case "complete":
      return "border-muted bg-muted/50 text-muted-foreground";
    case "overdue":
    case "urgent":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "soon":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "safe":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
}

/**
 * Header section for a lease claim card.
 * Shows the other party: owner sees borrower, borrower sees owner.
 */
export function LeaseClaimHeader(props: LeaseClaimHeaderProps) {
  const {
    claim,
    requestedAt,
    stateLabel,
    stateVariant,
    StateIcon,
    viewerRole,
    ownerId,
  } = props;
  const t = useTranslations("LeaseClaim.due");

  // Show the "other" person: borrower sees owner, owner sees borrower
  const displayUserId =
    viewerRole === "borrower" && ownerId ? ownerId : claim.claimerId;
  const dueTone = getDueTone(claim);
  const dueDate = format(new Date(claim.endDate), "MMM d, yyyy");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <UserLink userId={displayUserId} size="sm" />
        <Badge variant={stateVariant} className="gap-1 h-5 text-xs shrink-0">
          <StateIcon className="h-3 w-3" />
          {stateLabel}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {format(new Date(claim.startDate), "MMM d")} –{" "}
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-1.5 py-0.5 font-medium",
                dueClassName(dueTone),
              )}
              title={t("title", { date: dueDate })}
            >
              {t(dueTone, { date: dueDate })}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span>{format(new Date(requestedAt), "MMM d, p")}</span>
        </div>
      </div>
    </div>
  );
}
