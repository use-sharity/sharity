"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ItemImageCarousel } from "@/components/item-image-carousel";
import { ItemMetaRow } from "@/components/item-meta-row";
import { BorrowerRequestPanel } from "@/components/lease/borrower-request-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { UserLink } from "@/components/user-link";
import type { Doc } from "@/convex/_generated/dataModel";
import type { ItemCategory } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface DiscoveryCardItem extends Doc<"items"> {
  imageUrls?: string[];
  category?: ItemCategory;
  location?: { lat: number; lng: number; address?: string; ward?: string };
  isRequested?: boolean;
  isOwn?: boolean;
  owner?: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

interface DiscoveryCardProps {
  item: DiscoveryCardItem;
}

export function DiscoveryCard({ item }: DiscoveryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = useTranslations("DiscoveryCard");
  const tCategories = useTranslations("Categories");

  const claimLabel = item.isOwn
    ? t("yourItem")
    : item.isRequested
      ? t("manageRequest")
      : t("claim");

  return (
    <Card className="gap-3 py-7">
      <CardHeader className="gap-3">
        {item.imageUrls && item.imageUrls.length > 0 && (
          <ItemImageCarousel
            imageUrls={item.imageUrls}
            name={item.name}
            aspectRatio="video"
            sizes="(max-width: 768px) 100vw, 672px"
          />
        )}
        <div className="flex justify-between items-start">
          <CardTitle>
            <Link href={`/item/${item._id}`} className="hover:underline">
              {item.name}
            </Link>
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent>
        <ItemMetaRow
          giveaway={item.giveaway ?? false}
          category={item.category}
          location={item.location}
          compact={false}
          giveawayLabel={t("giveaway")}
          loanLabel={t("loan")}
          categoryLabel={item.category ? tCategories(item.category) : undefined}
          locationLabel={t("locationAvailable")}
        />
        {item.description && (
          <p className="text-gray-600 line-clamp-2">{item.description}</p>
        )}
      </CardContent>

      <CardFooter>
        <div className="flex justify-between items-center w-full">
          <UserLink
            userId={item.ownerId}
            size="sm"
            initialUserInfo={item.owner}
          />
          {item.isOwn ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/item/${item._id}`}>{claimLabel}</Link>
            </Button>
          ) : (
            <Button
              variant={isExpanded ? "secondary" : "default"}
              size="sm"
              onClick={() => setIsExpanded((v) => !v)}
              aria-expanded={isExpanded}
              className="gap-1"
            >
              {claimLabel}
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </CardFooter>

      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <Separator />
          <div className="px-6 pt-4 pb-2 space-y-4">
            <BorrowerRequestPanel item={item} fullWidth embedded />
          </div>
        </div>
      </div>
    </Card>
  );
}
