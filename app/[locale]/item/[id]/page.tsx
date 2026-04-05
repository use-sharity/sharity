"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ItemActivityTimeline } from "@/components/item-activity-timeline";
import { BorrowerRequestPanel } from "@/components/lease/borrower-request-panel";
import { LeaseClaimCard } from "@/components/lease/lease-claim-card";
import { ItemForm } from "@/components/item-form";
import { RatingForm } from "@/components/rating-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Toggle } from "@/components/ui/toggle";
import { ItemCalendar } from "@/components/item-calendar";
import {
  CloudinaryImage,
  isCloudinaryImageUrl,
} from "@/components/cloudinary-image";
import { cn } from "@/lib/utils";
import { useItemCalendar } from "@/hooks/use-item-calendar";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useTranslations } from "next-intl";

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: Id<"items"> }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tCategories = useTranslations("Categories");
  const tDetail = useTranslations("ItemDetail");
  const tCommon = useTranslations("Common");

  const item = useQuery(api.items.getById, { id });
  const activity = useQuery(api.items.getItemActivity, { itemId: id });
  const pendingRatings = useQuery(api.ratings.getMyPendingRatings);

  // Mutations for Owner
  const updateItem = useMutation(api.items.update);
  const switchItemMode = useMutation(api.items.switchItemMode);
  const deleteItem = useMutation(api.items.deleteItem);
  const approveClaim = useMutation(api.items.approveClaim);
  const rejectClaim = useMutation(api.items.rejectClaim);
  const markPickedUp = useMutation(api.items.markPickedUp);
  const markReturned = useMutation(api.items.markReturned);
  const markExpired = useMutation(api.items.markExpired);
  const markMissing = useMutation(api.items.markMissing);

  // UI State
  const [isEditing, setIsEditing] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedRatingClaim, setSelectedRatingClaim] = useState<{
    claimId: Id<"claims">;
    targetRole: "lender" | "borrower";
    itemName: string;
  } | null>(null);
  const claimCardRefs = useRef<Map<Id<"claims">, HTMLDivElement>>(new Map());

  const focusClaimCard = (claimId: Id<"claims">) => {
    const el = claimCardRefs.current.get(claimId);
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el.focus();
  };

  // Auto-open rating dialog if rateClaimId is in URL params
  useEffect(() => {
    const rateClaimId = searchParams.get("rateClaimId");
    const targetRoleParam = searchParams.get("targetRole");
    const targetRole: "lender" | "borrower" | null =
      targetRoleParam === "lender" || targetRoleParam === "borrower"
        ? targetRoleParam
        : null;

    if (rateClaimId && targetRole && pendingRatings && item) {
      const pendingRating = pendingRatings.find(
        (p) => p.claimId === rateClaimId && p.targetRole === targetRole,
      );

      if (pendingRating && !selectedRatingClaim) {
        setSelectedRatingClaim({
          claimId: rateClaimId as Id<"claims">,
          targetRole,
          itemName: pendingRating.itemName,
        });
        // Clean up URL params
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("rateClaimId");
        newUrl.searchParams.delete("targetRole");
        router.replace(newUrl.pathname + newUrl.search, { scroll: false });
      }
    }
  }, [searchParams, pendingRatings, item, selectedRatingClaim, router]);

  const ownerRequests = ((item?.requests ?? []) as Doc<"claims">[]) ?? [];
  const ownerCalendarState = useItemCalendar({
    mode: "owner",
    itemId: id,
    requests: ownerRequests,
    months: 2,
    onFocusClaim: focusClaimCard,
  });

  const requestsToShow = ownerRequests.filter((req) => {
    if (showInactive) return true;
    // Active means:
    // 1. Pending
    // 2. Approved AND NOT (returned OR transferred OR expired OR missing)
    if (req.status === "pending") return true;
    if (req.status === "approved") {
      return (
        !req.returnedAt &&
        !req.transferredAt &&
        !req.expiredAt &&
        !req.missingAt
      );
    }
    return false;
  });

  const approveClaimAction = async (
    args: Parameters<typeof approveClaim>[0],
  ) => {
    await approveClaim(args);
  };
  const rejectClaimAction = async (args: Parameters<typeof rejectClaim>[0]) => {
    await rejectClaim(args);
  };
  const markPickedUpAction = async (
    args: Parameters<typeof markPickedUp>[0],
  ) => {
    await markPickedUp(args);
  };
  const markReturnedAction = async (
    args: Parameters<typeof markReturned>[0],
  ) => {
    await markReturned(args);
  };
  const markExpiredAction = async (args: Parameters<typeof markExpired>[0]) => {
    await markExpired(args);
  };
  const markMissingAction = async (args: Parameters<typeof markMissing>[0]) => {
    await markMissing(args);
  };

  if (item === undefined) {
    return <div className="p-8 text-center">{tCommon("loading")}</div>;
  }

  if (item === null) {
    return <div className="p-8 text-center">{tDetail("notFound")}</div>;
  }

  const imageUrls = (item.imageUrls ?? []).filter(isCloudinaryImageUrl);

  const pendingRatingsForItem =
    pendingRatings?.filter((pending) => pending.itemId === id) ?? [];

  const getRatingPrompt = (
    isGiveaway: boolean,
    targetRole: "lender" | "borrower",
    targetUserName: string | null,
  ): string => {
    if (isGiveaway) {
      if (targetUserName) {
        return targetRole === "lender"
          ? tDetail("ratePrompt.receiveFromUser", { targetUserName })
          : tDetail("ratePrompt.giveToUser", { targetUserName });
      }
      return targetRole === "lender"
        ? tDetail("ratePrompt.receive")
        : tDetail("ratePrompt.give");
    }
    if (targetUserName) {
      return targetRole === "lender"
        ? tDetail("ratePrompt.borrowFromUser", { targetUserName })
        : tDetail("ratePrompt.lendToUser", { targetUserName });
    }
    return targetRole === "lender"
      ? tDetail("ratePrompt.borrow")
      : tDetail("ratePrompt.lend");
  };

  const rateTransactionSection =
    pendingRatingsForItem.length > 0 && !selectedRatingClaim ? (
      <Card className="border-yellow-200 bg-yellow-50/60">
        <CardContent className="py-3 px-4 space-y-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <p className="text-sm font-medium">
              {tDetail("rate")}{" "}
              {pendingRatingsForItem.length > 1
                ? tDetail("rateTransactions")
                : tDetail("rateTransaction")}
            </p>
          </div>
          <div className="space-y-2">
            {pendingRatingsForItem.map((pending) => {
              const ratingPrompt = getRatingPrompt(
                item.giveaway ?? false,
                pending.targetRole,
                pending.targetUserName,
              );
              return (
                <div
                  key={pending.claimId}
                  className="flex items-center justify-between gap-3 p-2 bg-white rounded-md border"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium">
                      {tDetail("reviewTransaction")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ratingPrompt}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSelectedRatingClaim({
                        claimId: pending.claimId as Id<"claims">,
                        targetRole: pending.targetRole,
                        itemName: pending.itemName,
                      })
                    }
                  >
                    {tDetail("rate")}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    ) : null;

  const ownerCalendar = item.isOwner ? (
    <div className="bg-white border rounded-lg p-4 w-full">
      <div className="flex justify-center w-full max-w-full">
        <ItemCalendar {...ownerCalendarState.calendarProps} />
      </div>
    </div>
  ) : null;

  const imageSection =
    imageUrls.length > 0 ? (
      <div className="relative rounded-lg overflow-hidden bg-gray-100 border">
        <Carousel className="w-full">
          <CarouselContent>
            {imageUrls.map((url, index) => (
              <CarouselItem key={index}>
                <div className="aspect-[4/3] relative">
                  <CloudinaryImage
                    src={url}
                    alt={tDetail("imageAlt", {
                      name: item.name,
                      index: index + 1,
                    })}
                    fill
                    sizes="(max-width: 1024px) 100vw, 560px"
                    className="object-cover"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {imageUrls.length > 1 && (
            <>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </>
          )}
        </Carousel>
      </div>
    ) : null;

  const detailsSection = (
    <div>
      <div className="flex justify-between items-start">
        <h1 className="text-xl md:text-2xl font-bold mb-2">{item.name}</h1>
        {item.isOwner && (
          <Badge variant="outline">{tDetail("youOwnThis")}</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {item.giveaway ? <Badge>{tDetail("giveaway")}</Badge> : null}
        {item.category && (
          <Badge variant="secondary">{tCategories(item.category)}</Badge>
        )}
        {item.location && (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {item.isOwner
              ? item.location.address ||
                `${item.location.lat.toFixed(4)}, ${item.location.lng.toFixed(4)}`
              : item.location.ward || tDetail("locationAvailable")}
          </span>
        )}
      </div>
      <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
        {item.description}
      </p>
    </div>
  );

  const ownerItemActions = item.isOwner ? (
    <div className="flex flex-wrap gap-4">
      <Button variant="outline" onClick={() => setIsEditing((v) => !v)}>
        {isEditing ? tDetail("cancel") : tDetail("editItem")}
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">{tDetail("deleteItem")}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tDetail("deleteConfirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tDetail("deleteConfirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tDetail("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await deleteItem({ id: item._id });
                toast.success(tDetail("itemDeleted"));
                router.push("/");
              }}
            >
              {tDetail("deleteConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  ) : null;

  const viewSection = (
    <div
      data-state={isEditing ? "closed" : "open"}
      className={cn(
        "grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out",
        "data-[state=open]:grid-rows-[1fr] data-[state=closed]:grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="space-y-6 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-top-2">
          {detailsSection}
          {imageSection}
        </div>
      </div>
    </div>
  );

  const editSection = (
    <div
      data-state={isEditing ? "open" : "closed"}
      className={cn(
        "grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out",
        "data-[state=open]:grid-rows-[1fr] data-[state=closed]:grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-top-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{tDetail("editItem")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ItemForm
                initialValues={{
                  name: item.name,
                  description: item.description || "",
                  images: item.images,
                  category: item.category,
                  location: item.location,
                  giveaway: Boolean(item.giveaway),
                  minLeaseDays: item.minLeaseDays,
                  maxLeaseDays: item.maxLeaseDays,
                }}
                enableModeSwitch
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
                    category: values.category,
                    location: values.location,
                    minLeaseDays: values.minLeaseDays,
                    maxLeaseDays: values.maxLeaseDays,
                  });
                  setIsEditing(false);
                  toast.success(tDetail("itemUpdated"));
                }}
                submitLabel={tDetail("saveChanges")}
                hideMyItemsLink
                footerActions={
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    {tDetail("cancel")}
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  const leftColumn = (
    <>
      <div className="space-y-6">
        {viewSection}
        {rateTransactionSection}
        {!isEditing ? ownerItemActions : null}
        {editSection}
      </div>
      <Dialog
        open={selectedRatingClaim !== null}
        onOpenChange={() => setSelectedRatingClaim(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tDetail("leaveRating")}</DialogTitle>
          </DialogHeader>
          {selectedRatingClaim && (
            <RatingForm
              claimId={selectedRatingClaim.claimId}
              targetRole={selectedRatingClaim.targetRole}
              itemName={selectedRatingClaim.itemName}
              onSuccess={() => setSelectedRatingClaim(null)}
              onCancel={() => setSelectedRatingClaim(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  const ownerActionsSection = (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold">
            {tDetail("requests", { count: item.requests?.length || 0 })}
          </h3>
          <Toggle
            pressed={showInactive}
            onPressedChange={setShowInactive}
            variant="outline"
            size="sm"
            aria-label={tDetail("toggleInactiveRequests")}
          >
            {showInactive ? tDetail("hideInactive") : tDetail("showInactive")}
          </Toggle>
        </div>
        {item.requests && item.requests.length > 0 ? (
          <div className="space-y-4">
            {requestsToShow.map((claim) => (
              <div
                key={claim._id}
                tabIndex={-1}
                ref={(el) => {
                  if (el) claimCardRefs.current.set(claim._id, el);
                  else claimCardRefs.current.delete(claim._id);
                }}
                className={cn(
                  "outline-none scroll-mt-24",
                  ownerCalendarState.hoveredClaimId === claim._id &&
                    "ring-2 ring-primary rounded-lg",
                )}
              >
                <LeaseClaimCard
                  itemId={item._id}
                  claim={claim}
                  viewerRole="owner"
                  isGiveaway={Boolean(item.giveaway)}
                  approveClaim={approveClaimAction}
                  rejectClaim={rejectClaimAction}
                  markPickedUp={markPickedUpAction}
                  markReturned={markReturnedAction}
                  markExpired={markExpiredAction}
                  markMissing={markMissingAction}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">{tDetail("noRequests")}</p>
        )}
      </div>
    </div>
  );

  const ownerRightColumn = (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">
        {tDetail("availabilityAndRequests")}
      </h2>
      {ownerCalendar}
      <div>{ownerActionsSection}</div>
      <div className="border-t pt-6">
        <h3 className="text-base font-semibold mb-3">{tDetail("activity")}</h3>
        <ItemActivityTimeline
          events={activity}
          isGiveaway={Boolean(item.giveaway)}
        />
      </div>
    </div>
  );

  const borrowerRightColumn = (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">
        {tDetail("checkAvailabilityAndRequest")}
      </h2>
      {!item.giveaway && (item.minLeaseDays || item.maxLeaseDays) ? (
        <div className="text-sm text-muted-foreground">
          {tDetail("leaseLength")}
          {typeof item.minLeaseDays === "number"
            ? tDetail("minDays", { count: item.minLeaseDays })
            : null}
          {typeof item.minLeaseDays === "number" &&
          typeof item.maxLeaseDays === "number"
            ? ", "
            : null}
          {typeof item.maxLeaseDays === "number"
            ? tDetail("maxDays", { count: item.maxLeaseDays })
            : null}
        </div>
      ) : null}
      <BorrowerRequestPanel item={item} fullWidth />
      <div className="border-t pt-6">
        <h3 className="text-base font-semibold mb-3">{tDetail("activity")}</h3>
        <ItemActivityTimeline
          events={activity}
          isGiveaway={Boolean(item.giveaway)}
        />
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50/50">
      <div className="max-w-2xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-2 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" /> {tDetail("backToItems")}
          </Button>
        </div>

        {leftColumn}

        {item.isOwner ? ownerRightColumn : borrowerRightColumn}
      </div>
    </main>
  );
}
