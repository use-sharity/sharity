"use client";

import { useQuery } from "convex/react";
import { Package } from "lucide-react";
import { isPast, isToday } from "date-fns";
import { api } from "../convex/_generated/api";
import { OwnerManagementItem, BorrowerManagementItem } from "./management-row";
import { useTranslations } from "next-intl";

interface MyItemsListProps {
  variant?: "borrowing" | "shared";
}

function borrowingUrgencyScore(endDate: number): number {
  const endDateObj = new Date(endDate);
  if (isPast(endDateObj)) return 0; // overdue = most urgent
  if (isToday(endDateObj)) return 1;
  const daysUntilDue = Math.ceil(
    (endDate - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (daysUntilDue <= 3) return 2;
  return 3;
}

export function MyItemsList({ variant }: MyItemsListProps) {
  const items = useQuery(api.items.getMyItems);
  const borrowedItems = useQuery(api.items.getMyBorrowedItems);
  const t = useTranslations("MyItems");

  if (items === undefined || borrowedItems === undefined) {
    return <div className="text-center p-4">{t("loading")}</div>;
  }

  const ownedItems = items.filter((i) => i.isOwner);

  // Sort borrowed items by urgency: overdue → due today → due soon → on time
  const sortedBorrowedItems = [...(borrowedItems ?? [])].sort(
    (a, b) =>
      borrowingUrgencyScore(a.claim.endDate) -
      borrowingUrgencyScore(b.claim.endDate),
  );

  if (variant === "borrowing") {
    if (sortedBorrowedItems.length === 0) {
      return (
        <div className="text-center p-4 text-gray-500">{t("noBorrowing")}</div>
      );
    }

    return (
      <div className="space-y-2">
        {sortedBorrowedItems.map((item) => (
          <BorrowerManagementItem key={item._id} item={item} />
        ))}
      </div>
    );
  }

  if (variant === "shared") {
    if (ownedItems.length === 0) {
      return (
        <div className="text-center p-4 text-gray-500">{t("noShared")}</div>
      );
    }

    return (
      <div className="space-y-2">
        {ownedItems.map((item) => (
          <OwnerManagementItem key={item._id} item={item} />
        ))}
      </div>
    );
  }

  const hasNoItems =
    ownedItems.length === 0 && sortedBorrowedItems.length === 0;

  if (hasNoItems) {
    return <div className="text-center p-4 text-gray-500">{t("noItems")}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Items I'm Borrowing Section */}
      {sortedBorrowedItems.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-medium text-gray-700">
              {t("borrowingTitle")}
            </h2>
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {sortedBorrowedItems.length}
            </span>
          </div>
          <div className="space-y-2">
            {sortedBorrowedItems.map((item) => (
              <BorrowerManagementItem key={item._id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* My Items Section */}
      {ownedItems.length > 0 && (
        <section className="space-y-2">
          {sortedBorrowedItems.length > 0 && (
            <h2 className="text-sm font-medium text-gray-700">
              {t("myItemsTitle")}
            </h2>
          )}
          <div className="space-y-2">
            {ownedItems.map((item) => (
              <OwnerManagementItem key={item._id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
