import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import { Badge } from "@/components/ui/badge";

// --- Owner status types ---

export type OwnerItemStatus =
  | "available"
  | "pending"
  | "approved"
  | "picked_up"
  | "returned"
  | "expired"
  | "missing";

type ClaimLike = {
  status: "pending" | "approved" | "rejected" | "expired";
  returnedAt?: number;
  transferredAt?: number;
  expiredAt?: number;
  missingAt?: number;
  pickedUpAt?: number;
};

export function primaryStatusForOwnerClaims(
  claims: ClaimLike[] | undefined,
): OwnerItemStatus {
  const list = claims ?? [];

  const activeApproved = list.filter((c) => {
    if (c.status !== "approved") return false;
    return !c.returnedAt && !c.transferredAt && !c.expiredAt && !c.missingAt;
  });

  const inUse = activeApproved.find((c) => !!c.pickedUpAt);
  if (inUse) return "picked_up";

  const approved = activeApproved[0];
  if (approved) return "approved";

  const hasPending = list.some((c) => c.status === "pending");
  if (hasPending) return "pending";

  if (list.some((c) => !!c.missingAt)) return "missing";
  if (list.some((c) => !!c.expiredAt)) return "expired";
  if (list.some((c) => !!c.returnedAt)) return "returned";

  return "available";
}

function ownerStatusClassName(status: OwnerItemStatus): string {
  switch (status) {
    case "available":
      return "border-transparent bg-blue-50 text-blue-700 hover:bg-blue-50/80";
    case "pending":
      return "border-transparent bg-amber-100 text-amber-900 hover:bg-amber-100/80";
    case "approved":
    case "picked_up":
      return "border-transparent bg-emerald-100 text-emerald-900 hover:bg-emerald-100/80";
    case "returned":
      return "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80";
    case "expired":
    case "missing":
      return "border-transparent bg-rose-100 text-rose-900 hover:bg-rose-100/80";
  }
}

interface OwnerStatusBadgeProps {
  status: OwnerItemStatus;
  label: string;
  suffix?: string;
}

export function OwnerStatusBadge({
  status,
  label,
  suffix,
}: OwnerStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${ownerStatusClassName(status)}`}
    >
      {label}
      {suffix ? (
        <span className="ml-2 hidden sm:inline text-xs text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

// --- Due status (borrower) ---

export type DueStatus = "overdue" | "due_today" | "due_soon" | "on_time";

export function getDueStatus(endDate: number): {
  status: DueStatus;
  label: string;
} {
  const endDateObj = new Date(endDate);

  if (isPast(endDateObj)) {
    return {
      status: "overdue",
      label: `Overdue by ${formatDistanceToNow(endDateObj)}`,
    };
  }

  if (isToday(endDateObj)) {
    return { status: "due_today", label: "Due today" };
  }

  const now = Date.now();
  const daysUntilDue = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
  if (daysUntilDue <= 3) {
    return {
      status: "due_soon",
      label: `Due in ${daysUntilDue} day${daysUntilDue > 1 ? "s" : ""}`,
    };
  }

  return {
    status: "on_time",
    label: `Due on ${format(endDateObj, "MMM d")}`,
  };
}

function dueStatusClassName(status: DueStatus): string {
  switch (status) {
    case "overdue":
      return "border-transparent bg-rose-100 text-rose-900 hover:bg-rose-100/80";
    case "due_today":
    case "due_soon":
      return "border-transparent bg-amber-100 text-amber-900 hover:bg-amber-100/80";
    case "on_time":
      return "border-transparent bg-emerald-100 text-emerald-900 hover:bg-emerald-100/80";
  }
}

interface DueStatusBadgeProps {
  endDate: number;
}

export function DueStatusBadge({ endDate }: DueStatusBadgeProps) {
  const { status, label } = getDueStatus(endDate);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${dueStatusClassName(status)}`}
    >
      {label}
    </span>
  );
}

// --- Giveaway / borrowed badge ---

interface ItemModeBadgeProps {
  giveaway?: boolean;
  borrowed?: boolean;
  giveawayLabel?: string;
  loanLabel?: string;
  label?: string;
}

export function ItemModeBadge({
  giveaway,
  borrowed,
  giveawayLabel,
  loanLabel,
  label,
}: ItemModeBadgeProps) {
  if (giveaway) {
    return (
      <Badge className="border-transparent bg-amber-100 text-amber-900 hover:bg-amber-100/80">
        {giveawayLabel ?? label ?? "Giveaway"}
      </Badge>
    );
  }
  if (borrowed) {
    return (
      <Badge className="border-transparent bg-indigo-100 text-indigo-800 hover:bg-indigo-100/80">
        {label ?? "Borrowed"}
      </Badge>
    );
  }
  return <Badge variant="outline">{loanLabel ?? label ?? "Loan"}</Badge>;
}
