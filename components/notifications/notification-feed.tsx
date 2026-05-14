"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTrackedPickup } from "@/hooks/use-tracked-pickup";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { format, formatDistanceToNow } from "date-fns";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function NotificationFeed() {
  const t = useTranslations("Notifications");
  const notifications = useQuery(api.notifications.get);
  const pendingRatings = useQuery(api.ratings.getMyPendingRatings);
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const approveClaim = useMutation(api.items.approveClaim);
  const rejectClaim = useMutation(api.items.rejectClaim);
  const approvePickupWindow = useMutation(api.items.approvePickupWindow);
  const approveReturnWindow = useMutation(api.items.approveReturnWindow);
  const markPickedUp = useTrackedPickup();
  const markReturned = useMutation(api.items.markReturned);
  const router = useRouter();
  const [now] = useState(() => Date.now());

  if (notifications === undefined) {
    return <div className="p-4 text-center">{t("loading")}</div>;
  }

  if (notifications.length === 0) {
    return <div className="p-4 text-center text-gray-500">{t("empty")}</div>;
  }

  const handleMarkRead = async (id: Id<"notifications">) => {
    await markAsRead({ notificationId: id });
  };

  const navigateToItem = (itemId: Id<"items">) => {
    router.push(`/item/${itemId}`);
  };

  const getNotificationActionContext = (n: (typeof notifications)[number]) => {
    const itemId = n.itemId as Id<"items">;
    const claimId = n.requestId as Id<"claims"> | undefined;
    const windowStartAt = n.windowStartAt as number | undefined;
    const windowEndAt = n.windowEndAt as number | undefined;
    return { itemId, claimId, windowStartAt, windowEndAt };
  };

  const handleNotificationClick = (
    n: (typeof notifications)[number],
    context: { itemId: Id<"items"> },
  ) => {
    const { itemId } = context;

    if (n.type === "rating_received") {
      router.push("/profile");
      if (!n.isRead) {
        void handleMarkRead(n._id);
      }
      return;
    }

    navigateToItem(itemId);

    if (!n.isRead) {
      void handleMarkRead(n._id);
    }
  };

  const renderedNotifications = notifications.map((n) => {
    const { itemId, claimId, windowStartAt, windowEndAt } =
      getNotificationActionContext(n);

    const isWindowExpired =
      typeof windowEndAt === "number" && windowEndAt < now;

    const claim = n.claim;
    const isClaimApproved = claim?.status === "approved";
    const isClaimPickedUp = Boolean(claim?.pickedUpAt);
    const isClaimReturned = Boolean(claim?.returnedAt);
    const isClaimExpired = Boolean(claim?.expiredAt);
    const isClaimMissing = Boolean(claim?.missingAt);
    const isClaimTransferred = Boolean(claim?.transferredAt);

    const isGiveaway = Boolean(n.item?.giveaway);
    const isTransferred = isClaimTransferred;

    let message = "";
    const itemName = n.item?.name || "";
    switch (n.type) {
      case "new_request":
        message = t("messages.new_request", { itemName });
        break;
      case "request_approved":
        message = t("messages.request_approved", { itemName });
        break;
      case "request_rejected":
        message = t("messages.request_rejected", { itemName });
        break;
      case "item_available":
        message = t("messages.item_available", { itemName });
        break;
      case "pickup_proposed":
        if (windowStartAt && windowEndAt) {
          message = t("messages.pickup_proposed_window", {
            itemName,
            start: format(new Date(windowStartAt), "MMM d p"),
            end: format(new Date(windowEndAt), "p"),
          });
        } else {
          message = t("messages.pickup_proposed", { itemName });
        }
        break;
      case "pickup_approved":
        if (windowStartAt && windowEndAt) {
          message = t("messages.pickup_approved_window", {
            itemName,
            start: format(new Date(windowStartAt), "MMM d p"),
            end: format(new Date(windowEndAt), "p"),
          });
        } else {
          message = t("messages.pickup_approved", { itemName });
        }
        break;
      case "pickup_confirmed":
        message =
          isGiveaway && isTransferred
            ? t("messages.transfer_completed", { itemName })
            : t("messages.pickup_confirmed", { itemName });
        break;
      case "pickup_expired":
        message = t("messages.pickup_expired", { itemName });
        break;
      case "return_proposed":
        if (windowStartAt && windowEndAt) {
          message = t("messages.return_proposed_window", {
            itemName,
            start: format(new Date(windowStartAt), "MMM d p"),
            end: format(new Date(windowEndAt), "p"),
          });
        } else {
          message = t("messages.return_proposed", { itemName });
        }
        break;
      case "return_approved":
        if (windowStartAt && windowEndAt) {
          message = t("messages.return_approved_window", {
            itemName,
            start: format(new Date(windowStartAt), "MMM d p"),
            end: format(new Date(windowEndAt), "p"),
          });
        } else {
          message = t("messages.return_approved", { itemName });
        }
        break;
      case "return_confirmed":
        message = t("messages.return_confirmed", { itemName });
        break;
      case "return_missing":
        message = t("messages.return_missing", { itemName });
        break;
      case "rate_transaction":
        message = t("messages.rate_transaction", { itemName });
        break;
      case "rating_received":
        const raterName = (n as { raterName?: string | null }).raterName;
        message = raterName
          ? t("messages.rating_received_named", { itemName, raterName })
          : t("messages.rating_received", { itemName });
        break;
      default:
        message = t("messages.default");
    }

    const renderAction = () => {
      if (n.type === "new_request") {
        const isPending = n.claim?.status === "pending";
        const isApproved = n.claim?.status === "approved";
        const isRejected = n.claim?.status === "rejected";

        if (!isPending && (isApproved || isRejected)) {
          return (
            <span
              className={`text-xs px-2 py-1 rounded ${
                isApproved
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {isApproved ? t("actions.approved") : t("actions.rejected")}
            </span>
          );
        }

        const canAct = !!claimId && isPending;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-destructive hover:text-destructive"
              disabled={!canAct}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!claimId) return;
                try {
                  await rejectClaim({ id: itemId, claimId });
                  toast.success(t("toasts.rejected"));
                  await handleMarkRead(n._id);
                } catch (error: unknown) {
                  const message =
                    error instanceof Error ? error.message : String(error);
                  toast.error(message);
                }
              }}
            >
              Reject
            </Button>
            <Button
              size="sm"
              className="h-7"
              disabled={!canAct}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!claimId) return;
                try {
                  await approveClaim({ id: itemId, claimId });
                  toast.success(t("toasts.approved"));
                  await handleMarkRead(n._id);
                } catch (error: unknown) {
                  const message =
                    error instanceof Error ? error.message : String(error);
                  toast.error(message);
                }
              }}
            >
              {t("actions.approve")}
            </Button>
          </div>
        );
      }

      if (n.type === "pickup_proposed") {
        const canApprove =
          claimId &&
          isClaimApproved &&
          !isClaimPickedUp &&
          !isClaimExpired &&
          !isWindowExpired;

        if (!canApprove) {
          let reason = "Action unavailable";
          if (!isClaimApproved) reason = "Request not approved";
          else if (isClaimPickedUp) reason = "Already picked up";
          else if (isClaimExpired) reason = "Lease expired";
          else if (isWindowExpired) reason = "Pickup window expired";

          return (
            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500">
              {reason}
            </span>
          );
        }

        return (
          <Button
            size="sm"
            className="h-7"
            disabled={!canApprove}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!claimId) return;
              try {
                await approvePickupWindow({ itemId, claimId });
                toast.success(t("toasts.pickupApproved"));
                await handleMarkRead(n._id);
              } catch (error: unknown) {
                const message =
                  error instanceof Error ? error.message : String(error);
                toast.error(message);
              }
            }}
          >
            {t("actions.approve")}
          </Button>
        );
      }

      if (n.type === "return_proposed") {
        if (isGiveaway || isTransferred) {
          return (
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateToItem(itemId);
              }}
            >
              View
            </Button>
          );
        }

        const canApprove =
          claimId &&
          isClaimApproved &&
          isClaimPickedUp &&
          !isClaimReturned &&
          !isClaimExpired &&
          !isClaimMissing &&
          !isWindowExpired;

        if (!canApprove) {
          let reason = t("reasons.unavailable");
          if (!isClaimApproved) reason = t("reasons.notApproved");
          else if (!isClaimPickedUp) reason = t("reasons.notPickedUp");
          else if (isClaimReturned) reason = t("reasons.alreadyReturned");
          else if (isClaimExpired) reason = t("reasons.leaseExpired");
          else if (isClaimMissing) reason = t("reasons.itemMissing");
          else if (isWindowExpired) reason = t("reasons.returnWindowExpired");

          return (
            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500">
              {reason}
            </span>
          );
        }

        return (
          <Button
            size="sm"
            className="h-7"
            disabled={!canApprove}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!claimId) return;
              try {
                await approveReturnWindow({ itemId, claimId });
                toast.success(t("toasts.returnApproved"));
                await handleMarkRead(n._id);
              } catch (error: unknown) {
                const message =
                  error instanceof Error ? error.message : String(error);
                toast.error(message);
              }
            }}
          >
            {t("actions.approve")}
          </Button>
        );
      }

      if (n.type === "pickup_approved") {
        const canConfirm =
          claimId &&
          isClaimApproved &&
          !isClaimPickedUp &&
          !isClaimExpired &&
          !isWindowExpired;

        if (!canConfirm) {
          let reason = t("reasons.unavailable");
          if (!isClaimApproved) reason = t("reasons.notApproved");
          else if (isClaimPickedUp) reason = t("reasons.alreadyPickedUp");
          else if (isClaimExpired) reason = t("reasons.leaseExpired");
          else if (isWindowExpired) reason = t("reasons.pickupWindowExpired");

          return (
            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500">
              {reason}
            </span>
          );
        }

        return (
          <Button
            size="sm"
            className="h-7"
            disabled={!canConfirm}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!claimId) return;
              try {
                await markPickedUp({ itemId, claimId });
                toast.success(t("toasts.pickupConfirmed"));
                await handleMarkRead(n._id);
              } catch (error: unknown) {
                const message =
                  error instanceof Error ? error.message : String(error);
                toast.error(message);
              }
            }}
          >
            {t("actions.confirm")}
          </Button>
        );
      }

      if (n.type === "return_approved") {
        if (isGiveaway || isTransferred) {
          return (
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateToItem(itemId);
              }}
            >
              View
            </Button>
          );
        }

        // Check if action is still valid
        const canConfirm =
          claimId &&
          isClaimApproved &&
          isClaimPickedUp &&
          !isClaimReturned &&
          !isClaimExpired &&
          !isClaimMissing &&
          !isWindowExpired;

        if (!canConfirm) {
          let reason = t("reasons.unavailable");
          if (!isClaimApproved) reason = t("reasons.notApproved");
          else if (!isClaimPickedUp) reason = t("reasons.notPickedUp");
          else if (isClaimReturned) reason = t("reasons.alreadyReturned");
          else if (isClaimExpired) reason = t("reasons.leaseExpired");
          else if (isClaimMissing) reason = t("reasons.itemMissing");
          else if (isWindowExpired) reason = t("reasons.returnWindowExpired");

          return (
            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500">
              {reason}
            </span>
          );
        }

        return (
          <Button
            size="sm"
            className="h-7"
            disabled={!canConfirm}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!claimId) return;
              try {
                await markReturned({ itemId, claimId });
                toast.success(t("toasts.returnConfirmed"));
                await handleMarkRead(n._id);
              } catch (error: unknown) {
                const message =
                  error instanceof Error ? error.message : String(error);
                toast.error(message);
              }
            }}
          >
            {t("actions.confirm")}
          </Button>
        );
      }

      if (
        n.type === "pickup_confirmed" ||
        n.type === "pickup_expired" ||
        n.type === "return_confirmed" ||
        n.type === "return_missing"
      ) {
        return (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigateToItem(itemId);
            }}
          >
            {t("actions.view")}
          </Button>
        );
      }

      if (n.type === "rate_transaction") {
        if (pendingRatings === undefined) {
          return null;
        }

        const pendingRating = pendingRatings.find(
          (pending) => pending.claimId === claimId,
        );

        if (!pendingRating) {
          return null;
        }

        return (
          <Button
            size="sm"
            className="h-7"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(
                `/item/${itemId}?rateClaimId=${claimId}&targetRole=${pendingRating.targetRole}`,
              );
              if (!n.isRead) {
                void handleMarkRead(n._id);
              }
            }}
          >
            {t("actions.rate")}
          </Button>
        );
      }

      if (n.type === "rating_received") {
        return (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push("/profile");
              if (!n.isRead) {
                void handleMarkRead(n._id);
              }
            }}
          >
            {t("actions.view")}
          </Button>
        );
      }

      if (n.type === "request_approved" && n.item?.ownerId) {
        return (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(`/user/${n.item?.ownerId}`);
            }}
          >
            {t("actions.viewProfile")}
          </Button>
        );
      }

      return null;
    };

    return (
      <Card
        key={n._id}
        className={`p-3 mb-2 flex justify-between items-start gap-2 ${
          n.isRead ? "bg-gray-50" : "bg-white border-blue-200 shadow-sm"
        }`}
        onClick={() => handleNotificationClick(n, { itemId })}
      >
        <div className="flex-1 cursor-pointer">
          <p
            className={`text-sm ${n.isRead ? "text-gray-600" : "font-medium text-gray-900"}`}
          >
            {message}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatDistanceToNow(n.createdAt, { addSuffix: true })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {renderAction()}
          {!n.isRead && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                handleMarkRead(n._id);
              }}
            >
              <span className="sr-only">{t("markAsRead")}</span>
              <div className="h-2 w-2 rounded-full bg-blue-500" />
            </Button>
          )}
        </div>
      </Card>
    );
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-popover overflow-hidden">
      <div className="p-2 border-b flex justify-between items-center gap-2 sticky top-0 bg-popover z-10">
        <span className="font-semibold text-sm shrink-0">{t("title")}</span>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 shrink-0"
          onClick={() => markAllAsRead({})}
        >
          {t("markAllRead")} <Check className="ml-1 h-3 w-3" />
        </Button>
      </div>
      <div className="overflow-y-auto p-2 flex-1 scrollbar-thin scrollbar-thumb-gray-200">
        {renderedNotifications}
      </div>
    </div>
  );
}
