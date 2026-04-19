"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";

import { DiscoveryItemsList } from "@/components/discovery-items-list";
import { api } from "@/convex/_generated/api";

interface UserSharedItemsListProps {
  userId: string;
}

export function UserSharedItemsList({ userId }: UserSharedItemsListProps) {
  const t = useTranslations("UserProfile");
  const sharedItems = useQuery(api.items.getByOwner, { ownerId: userId });

  return (
    <DiscoveryItemsList
      items={sharedItems}
      loadingLabel={t("loadingItems")}
      emptyContent={
        <div className="text-center p-4 text-muted-foreground">
          {t("noSharedItems")}
        </div>
      }
      summaryLabel={
        sharedItems ? t("sharedItems", { count: sharedItems.length }) : null
      }
    />
  );
}
