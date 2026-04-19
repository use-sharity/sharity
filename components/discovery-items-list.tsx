"use client";

import type { ReactNode } from "react";
import { Package } from "lucide-react";

import {
  DiscoveryCard,
  type DiscoveryCardItem,
} from "@/components/discovery-card";
import { cn } from "@/lib/utils";

export interface DiscoveryItemsListProps {
  items: DiscoveryCardItem[] | undefined;
  loadingLabel: string;
  emptyContent: ReactNode;
  summaryLabel?: ReactNode;
  afterList?: ReactNode;
  className?: string;
}

export function DiscoveryItemsList({
  items,
  loadingLabel,
  emptyContent,
  summaryLabel,
  afterList,
  className,
}: DiscoveryItemsListProps) {
  if (items === undefined) {
    return (
      <div className="text-center p-4 text-muted-foreground">
        {loadingLabel}
      </div>
    );
  }

  if (items.length === 0) {
    return <>{emptyContent}</>;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {summaryLabel && (
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Package className="h-4 w-4" />
          {summaryLabel}
        </div>
      )}
      <div className="grid gap-4">
        {items.map((item) => (
          <DiscoveryCard key={item._id} item={item} />
        ))}
        {afterList}
      </div>
    </div>
  );
}
