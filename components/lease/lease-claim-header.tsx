"use client";

import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";
import { Calendar, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { UserLink } from "@/components/user-link";
import type { Doc } from "@/convex/_generated/dataModel";

type LeaseClaimHeaderProps = {
  claim: Doc<"claims">;
  requestedAt: number;
  stateLabel: string;
  stateVariant: "default" | "secondary" | "outline" | "destructive";
  StateIcon: LucideIcon;
  viewerRole?: "owner" | "borrower";
  ownerId?: string;
};

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

  // Show the "other" person: borrower sees owner, owner sees borrower
  const displayUserId =
    viewerRole === "borrower" && ownerId ? ownerId : claim.claimerId;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <UserLink userId={displayUserId} size="sm" />
        <Badge variant={stateVariant} className="gap-1 h-5 text-xs shrink-0">
          <StateIcon className="h-3 w-3" />
          {stateLabel}
        </Badge>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {format(new Date(claim.startDate), "MMM d")} –{" "}
            {format(new Date(claim.endDate), "MMM d, yyyy")}
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
