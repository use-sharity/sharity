"use client";

import Link from "next/link";

import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ItemForm } from "./item-form";
import { useState } from "react";
import { Doc } from "../convex/_generated/dataModel";
import { ItemCard, useItemCard } from "./item-card";
import { Clock, Pencil, Trash2 } from "lucide-react";
import { ClaimItemBack } from "./claim-item-back";
import { LeaseClaimHeader } from "@/components/lease/lease-claim-header";
import type { MediaImage } from "./item-form";
import { useTranslations, useLocale } from "next-intl";
import { enUS, vi } from "date-fns/locale";

// Badge not available, using span

function UserName({ userId }: { userId: string }) {
  const t = useTranslations("MyItemCard");
  const userInfo = useQuery(api.users.getBasicInfo, { userId });
  if (userInfo === undefined) {
    return <span className="animate-pulse">...</span>;
  }
  return <span>{userInfo.name || t("anonymous")}</span>;
}

function FlipToBackButton(props: { label: string }) {
  const { label } = props;
  const { flipToBack } = useItemCard();
  return (
    <Button variant="outline" size="sm" onClick={flipToBack}>
      {label}
    </Button>
  );
}

function primaryStatusForOwnerClaims(
  claims: Doc<"claims">[] | undefined,
):
  | "available"
  | "pending"
  | "approved"
  | "picked_up"
  | "returned"
  | "expired"
  | "missing" {
  const list = claims ?? [];

  const activeApproved = list.filter((c) => {
    if (c.status !== "approved") return false;
    return !c.returnedAt && !c.transferredAt && !c.expiredAt && !c.missingAt;
  });

  // Prefer lifecycle states of an active approved lease.
  const inUse = activeApproved.find((c) => !!c.pickedUpAt);
  if (inUse) return "picked_up";

  const approved = activeApproved[0];
  if (approved) return "approved";

  const hasPending = list.some((c) => c.status === "pending");
  if (hasPending) return "pending";

  // If nothing active, show the most severe terminal state we can infer.
  if (list.some((c) => !!c.missingAt)) return "missing";
  if (list.some((c) => !!c.expiredAt)) return "expired";
  if (list.some((c) => !!c.returnedAt)) return "returned";

  return "available";
}

function labelForOwnerStatus(
  status: ReturnType<typeof primaryStatusForOwnerClaims>,
  t: (key: string) => string,
): string {
  switch (status) {
    case "available":
      return t("status.available");
    case "pending":
      return t("status.pending");
    case "approved":
      return t("status.approved");
    case "picked_up":
      return t("status.picked_up");
    case "returned":
      return t("status.returned");
    case "expired":
      return t("status.expired");
    case "missing":
      return t("status.missing");
  }
}

function classNameForOwnerStatus(
  status: ReturnType<typeof primaryStatusForOwnerClaims>,
): string {
  switch (status) {
    case "available":
      return "border-transparent bg-blue-50 text-blue-700 hover:bg-blue-50/80";
    case "pending":
      return "border-transparent bg-amber-100 text-amber-900 hover:bg-amber-100/80";
    case "approved":
      return "border-transparent bg-emerald-100 text-emerald-900 hover:bg-emerald-100/80";
    case "picked_up":
      return "border-transparent bg-emerald-100 text-emerald-900 hover:bg-emerald-100/80";
    case "returned":
      return "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80";
    case "expired":
    case "missing":
      return "border-transparent bg-rose-100 text-rose-900 hover:bg-rose-100/80";
  }
}

export function MyItemCard({
  item,
  isOwner = true,
}: {
  item: Doc<"items"> & {
    imageUrls?: string[];
    images?: MediaImage[];
  };
  isOwner?: boolean;
}) {
  const updateItem = useMutation(api.items.update);
  const switchItemMode = useMutation(api.items.switchItemMode);
  const deleteItem = useMutation(api.items.deleteItem);
  const approveClaim = useMutation(api.items.approveClaim);
  const rejectClaim = useMutation(api.items.rejectClaim);
  const claims = useQuery(
    api.items.getClaims,
    isOwner ? { id: item._id } : "skip",
  );

  const t = useTranslations("MyItemCard");
  const locale = useLocale();
  const dateLocale = locale === "vi" ? vi : enUS;

  const [editingId, setEditingId] = useState<string | null>(null);

  const pendingClaims = (claims ?? []).filter((c) => c.status === "pending");
  const status = primaryStatusForOwnerClaims(claims);
  const activeApprovedClaim = (claims ?? []).find((c) => {
    if (c.status !== "approved") return false;
    return !c.returnedAt && !c.expiredAt && !c.missingAt;
  });
  const nextPendingClaim =
    pendingClaims.length > 0
      ? [...pendingClaims].sort((a, b) => a.startDate - b.startDate)[0]
      : undefined;
  const hasActionableBack = Boolean(
    isOwner && (nextPendingClaim || activeApprovedClaim),
  );

  const rightHeader = !isOwner ? (
    <div className="flex items-center gap-2">
      {item.giveaway ? (
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-amber-100 text-amber-900 hover:bg-amber-100/80">
          {t("giveaway")}
        </span>
      ) : null}
      {item.giveaway ? null : (
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-indigo-100 text-indigo-800 hover:bg-indigo-100/80">
          {t("borrowed")}
        </span>
      )}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      {item.giveaway ? (
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-amber-100 text-amber-900 hover:bg-amber-100/80">
          {t("giveaway")}
        </span>
      ) : null}
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${classNameForOwnerStatus(status)}`}
      >
        {labelForOwnerStatus(status, t)}

        {activeApprovedClaim ? (
          <span className="ml-2 hidden sm:inline text-xs text-muted-foreground">
            {t("by")} <UserName userId={activeApprovedClaim.claimerId} /> (
            {format(activeApprovedClaim.startDate, "MMM d", {
              locale: dateLocale,
            })}{" "}
            -{" "}
            {format(activeApprovedClaim.endDate, "MMM d", {
              locale: dateLocale,
            })}
            )
          </span>
        ) : null}
      </span>
    </div>
  );

  return (
    <ItemCard
      item={item}
      rightHeader={rightHeader}
      density="compact"
      hideDescription
      hideMetaRow
      backContent={
        hasActionableBack ? (
          <ClaimItemBack item={item} viewerRole="owner" />
        ) : undefined
      }
      footer={
        isOwner ? (
          <div className="flex justify-end gap-2 w-full">
            {hasActionableBack ? (
              <FlipToBackButton label={t("review")} />
            ) : null}
            <Dialog
              open={editingId === item._id}
              onOpenChange={(open) => setEditingId(open ? item._id : null)}
            >
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">{t("edit")}</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("editTitle")}</DialogTitle>
                </DialogHeader>
                <ItemForm
                  initialValues={{
                    name: item.name,
                    description: item.description || "",
                    images: item.images,
                    giveaway: Boolean(item.giveaway),
                  }}
                  enableModeSwitch
                  hideMyItemsLink
                  onSubmit={async (values) => {
                    if (
                      typeof values.giveaway === "boolean" &&
                      values.giveaway !== Boolean(item.giveaway)
                    ) {
                      await switchItemMode({
                        id: item._id,
                        giveaway: values.giveaway,
                      });
                    }
                    await updateItem({
                      id: item._id,
                      name: values.name,
                      description: values.description,
                      imageCloudinary: values.imageCloudinary,
                    });
                    setEditingId(null);
                  }}
                  submitLabel={t("saveChanges")}
                  footerActions={
                    <DialogClose asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        {t("cancel")}
                      </Button>
                    </DialogClose>
                  }
                />
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">{t("delete")}</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("deleteConfirm.title")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("deleteConfirm.description")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {t("deleteConfirm.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteItem({ id: item._id })}
                  >
                    {t("deleteConfirm.confirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <div className="flex justify-end gap-2 w-full">
            <Link href={`/item/${item._id}`}>
              <Button variant="secondary" size="sm">
                {t("open")}
              </Button>
            </Link>
          </div>
        )
      }
    >
      <div className="space-y-3">
        {!isOwner ? (
          <div className="text-xs text-muted-foreground">
            {t.rich("receivedFrom", {
              user: () => <UserName userId={item.ownerId} />,
            })}
          </div>
        ) : null}

        {item.description ? (
          <p className="text-gray-600 text-sm line-clamp-2">
            {item.description}
          </p>
        ) : null}

        {isOwner && nextPendingClaim ? (
          <div className="rounded-md border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {t("pendingRequests", {
                  count: pendingClaims.length,
                  s: pendingClaims.length > 1 ? "s" : "",
                })}
              </div>
            </div>
            <LeaseClaimHeader
              claim={nextPendingClaim}
              requestedAt={
                nextPendingClaim.requestedAt ?? nextPendingClaim._creationTime
              }
              stateLabel={t("awaitingApproval")}
              stateVariant="secondary"
              StateIcon={Clock}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-destructive hover:text-destructive"
                onClick={() =>
                  rejectClaim({ claimId: nextPendingClaim._id, id: item._id })
                }
              >
                {t("reject")}
              </Button>
              <Button
                size="sm"
                className="flex-1 h-8"
                onClick={() =>
                  approveClaim({ claimId: nextPendingClaim._id, id: item._id })
                }
              >
                {t("approve")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </ItemCard>
  );
}
