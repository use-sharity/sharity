"use client";

import { useQuery } from "convex/react";
import { List, Map } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { DiscoveryItemsList } from "@/components/discovery-items-list";
import {
  OwnerSearchInput,
  type SelectedOwner,
} from "@/components/owner-search-input";
import { SharePrompt } from "@/components/share-prompt";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { WishlistPromptCard } from "@/components/wishlist/wishlist-empty-card";
import type { ItemCategory } from "@/lib/constants";
import { parseItemSearchQuery } from "@/lib/item-search";
import { cn } from "@/lib/utils";
import { api } from "../convex/_generated/api";
import { CategoryFilter } from "./category-filter";

// Dynamic import to avoid SSR hydration issues with Leaflet
function ItemsMapLoading() {
  const t = useTranslations("ItemList");
  return (
    <div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
      <p className="text-muted-foreground">{t("loadingMap")}</p>
    </div>
  );
}

const ItemsMap = dynamic(
  () => import("./items-map").then((mod) => mod.ItemsMap),
  {
    ssr: false,
    loading: () => <ItemsMapLoading />,
  },
);

type ViewMode = "list" | "map";

export function ItemList({
  onEmptyMakeRequest,
}: {
  onEmptyMakeRequest?: () => void;
}) {
  const t = useTranslations("ItemList");
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(() => urlQuery);
  const [selectedOwners, setSelectedOwners] = useState<SelectedOwner[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<ItemCategory[]>(
    [],
  );
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [giveawayOnly, setGiveawayOnly] = useState(false);
  const [hideMyItems, setHideMyItems] = useState(false);
  const parsedSearch = useMemo(() => parseItemSearchQuery(search), [search]);

  const items = useQuery(api.items.searchDiscovery, {
    queryText: parsedSearch.itemQuery,
    ownerQueries: parsedSearch.ownerQueries,
    selectedOwnerIds: selectedOwners.map((owner) => owner.userId),
    categories: selectedCategories,
    giveawayOnly,
    hideMyItems,
    limit: 50,
  });

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <OwnerSearchInput
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={setSearch}
            selectedOwners={selectedOwners}
            onSelectedOwnersChange={setSelectedOwners}
          />
          <div className="flex border rounded-md">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded-r-none",
                viewMode === "list" && "bg-muted",
              )}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("map")}
              className={cn("rounded-l-none", viewMode === "map" && "bg-muted")}
            >
              <Map className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <CategoryFilter
            selected={selectedCategories}
            onChange={setSelectedCategories}
            className="flex-1 min-w-36"
          />
          <label className="flex items-center gap-1.5 shrink-0 text-sm cursor-pointer">
            <Switch
              size="sm"
              checked={hideMyItems}
              onCheckedChange={setHideMyItems}
            />
            {t("hideMyItems")}
          </label>
          <label className="flex items-center gap-1.5 shrink-0 text-sm cursor-pointer">
            <Switch
              size="sm"
              checked={giveawayOnly}
              onCheckedChange={setGiveawayOnly}
            />
            {t("giveaway")}
          </label>
        </div>
      </div>

      <SharePrompt />

      {viewMode === "map" ? (
        <div className="space-y-2">
          {items === undefined ? (
            <p>{t("loading")}</p>
          ) : (
            <>
              <ItemsMap items={items || []} />
              {items?.filter((i) => i.location).length === 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  {t("noLocationItems")}
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <DiscoveryItemsList
          items={items}
          loadingLabel={t("loading")}
          emptyContent={
            <WishlistPromptCard onMakeRequest={onEmptyMakeRequest} />
          }
          afterList={
            onEmptyMakeRequest && items && items.length > 0 ? (
              <WishlistPromptCard onMakeRequest={onEmptyMakeRequest} />
            ) : null
          }
        />
      )}
    </div>
  );
}
