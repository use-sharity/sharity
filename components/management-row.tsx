"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Eye, Settings } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  primaryStatusForOwnerClaims,
  OwnerStatusBadge,
  DueStatusBadge,
  ItemModeBadge,
  getDueStatus,
  type OwnerItemStatus,
} from "@/components/item-status-badge";
import { cloudinaryThumbnailUrl } from "@/components/cloudinary-image";
import { ItemEditActions } from "@/components/item-edit-actions";
import type { MediaImage } from "@/components/item-form";

// --- Shared thumbnail ---

function RowThumbnail({ url, name }: { url: string; name: string }) {
  const thumbUrl = cloudinaryThumbnailUrl(url);
  if (!thumbUrl) return null;
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
      <Image
        src={thumbUrl}
        alt={name}
        width={48}
        height={48}
        unoptimized
        className="h-full w-full object-cover"
      />
    </div>
  );
}

// --- Owner row ---

interface OwnerItem extends Doc<"items"> {
  imageUrls?: string[];
  images?: MediaImage[];
}

function ownerStatusDotClass(status: OwnerItemStatus): string {
  switch (status) {
    case "pending":
      return "bg-amber-400";
    case "approved":
    case "picked_up":
      return "bg-emerald-500";
    case "returned":
      return "bg-slate-400";
    case "expired":
    case "missing":
      return "bg-rose-500";
    case "available":
      return "bg-blue-400";
  }
}

function OwnerManagementRow({ item }: { item: OwnerItem }) {
  const t = useTranslations("ManagementRow");
  const claims = useQuery(api.items.getClaims, { id: item._id });
  const status = primaryStatusForOwnerClaims(claims);

  const pendingCount = (claims ?? []).filter(
    (c) => c.status === "pending",
  ).length;

  const activeApprovedClaim = (claims ?? []).find(
    (c) =>
      c.status === "approved" && !c.returnedAt && !c.expiredAt && !c.missingAt,
  );

  const manageLabel = (() => {
    if (status === "pending") return t("review");
    if (status === "approved" || status === "picked_up") return t("manage");
    return t("open");
  })();

  const manageIcon =
    status === "approved" || status === "picked_up" ? (
      <Settings className="h-4 w-4" />
    ) : null;

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm flex items-stretch gap-3">
      {item.imageUrls?.[0] && (
        <RowThumbnail url={item.imageUrls[0]} name={item.name} />
      )}
      {/* Left col: dot+title / badges */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              ownerStatusDotClass(status),
            )}
            aria-hidden="true"
          />
          <Link
            href={`/item/${item._id}`}
            className="min-w-0 truncate text-sm font-medium hover:underline"
          >
            {item.name}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pl-[18px]">
          <ItemModeBadge
            giveaway={item.giveaway}
            giveawayLabel={t("giveaway")}
            loanLabel={t("loan")}
          />
          <OwnerStatusBadge
            status={status}
            label={t(`status.${status}`)}
            suffix={
              activeApprovedClaim
                ? `${t("by")} … (${format(activeApprovedClaim.startDate, "MMM d")} – ${format(activeApprovedClaim.endDate, "MMM d")})`
                : undefined
            }
          />
        </div>
      </div>

      {/* Right col: minor buttons / major button */}
      <div className="flex flex-col items-end justify-between gap-1 shrink-0">
        <ItemEditActions item={item} />
        <Link href={`/item/${item._id}`}>
          <Button size="sm">
            {manageIcon}
            {manageLabel}
            {status === "pending" && pendingCount > 1 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-bold">
                {pendingCount}
              </span>
            )}
          </Button>
        </Link>
      </div>
    </div>
  );
}

// --- Borrower row ---

interface BorrowedItem extends Doc<"items"> {
  imageUrls?: string[];
  images?: MediaImage[];
  claim: {
    _id: Id<"claims">;
    startDate: number;
    endDate: number;
    pickedUpAt?: number;
  };
  owner: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

function formatOwnerName(owner: BorrowedItem["owner"]): string {
  if (owner.name) return owner.name;
  if (owner.id.length <= 16) return owner.id;
  return `${owner.id.slice(0, 8)}...${owner.id.slice(-6)}`;
}

function BorrowerManagementRow({ item }: { item: BorrowedItem }) {
  const t = useTranslations("ManagementRow");
  const { status } = getDueStatus(item.claim.endDate);
  const isOverdue = status === "overdue";

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm flex items-stretch gap-3">
      {item.imageUrls?.[0] && (
        <RowThumbnail url={item.imageUrls[0]} name={item.name} />
      )}
      {/* Left col: dot+title / badges+owner */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              isOverdue ? "bg-rose-500" : "bg-emerald-500",
            )}
            aria-hidden="true"
          />
          <Link
            href={`/item/${item._id}`}
            className="min-w-0 truncate text-sm font-medium hover:underline"
          >
            {item.name}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pl-[18px]">
          <ItemModeBadge
            giveaway={item.giveaway}
            giveawayLabel={t("giveaway")}
            loanLabel={t("loan")}
          />
          <DueStatusBadge endDate={item.claim.endDate} />
          <span className="text-xs text-muted-foreground">
            {t("borrowedFrom", { name: formatOwnerName(item.owner) })}
          </span>
        </div>
      </div>

      {/* Right col: view button (bottom-aligned) */}
      <div className="flex flex-col items-end justify-end shrink-0">
        <Link href={`/item/${item._id}`}>
          <Button variant={isOverdue ? "destructive" : "default"} size="sm">
            <Eye className="h-4 w-4" />
            {t("viewDetails")}
          </Button>
        </Link>
      </div>
    </div>
  );
}

// --- Public exports ---

export function OwnerManagementItem({ item }: { item: OwnerItem }) {
  return <OwnerManagementRow item={item} />;
}

export function BorrowerManagementItem({ item }: { item: BorrowedItem }) {
  return <BorrowerManagementRow item={item} />;
}
