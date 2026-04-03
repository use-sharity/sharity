"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { List, Map } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

import { Doc } from "../convex/_generated/dataModel";

import { ReactNode } from "react";
import { UserLink } from "@/components/user-link";
import { ItemCard } from "./item-card";
import { CategoryFilter } from "./category-filter";
import type { ItemCategory } from "@/lib/constants";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SharePrompt } from "@/components/share-prompt";
import { WishlistPromptCard } from "@/components/wishlist/wishlist-empty-card";
import { useTranslations } from "next-intl";

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
	action,
	actionBack,
	onEmptyMakeRequest,
}: {
	action?: (item: Doc<"items"> & { isRequested?: boolean }) => ReactNode;
	actionBack?: (item: Doc<"items"> & { isRequested?: boolean }) => ReactNode;
	onEmptyMakeRequest?: () => void;
}) {
	const t = useTranslations("ItemList");
	const items = useQuery(api.items.get);
	const searchParams = useSearchParams();
	const urlQuery = searchParams.get("q") ?? "";
	const [search, setSearch] = useState(() => urlQuery);
	const [selectedCategories, setSelectedCategories] = useState<ItemCategory[]>(
		[],
	);
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [giveawayOnly, setGiveawayOnly] = useState(false);

	const filteredItems = items?.filter((item) => {
		const needle = search.trim().toLowerCase();
		const itemText = `${item.name} ${item.description ?? ""}`.toLowerCase();

		// (1) keyword AND category (when both are set)
		const matchesSearch = needle.length === 0 || itemText.includes(needle);

		// (2) categories are OR'd together
		const matchesCategory =
			selectedCategories.length === 0 ||
			(item.category !== undefined &&
				selectedCategories.includes(item.category));

		const matchesGiveaway = !giveawayOnly || Boolean(item.giveaway);

		return matchesSearch && matchesCategory && matchesGiveaway;
	});

	return (
		<div className="w-full space-y-4">
			<div className="flex flex-col gap-3">
				<div className="flex gap-2">
					<Input
						placeholder={t("searchPlaceholder")}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="flex-1"
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
				<div className="flex gap-2 items-center">
					<CategoryFilter
						selected={selectedCategories}
						onChange={setSelectedCategories}
					/>
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
							<ItemsMap items={filteredItems || []} />
							{filteredItems?.filter((i) => i.location).length === 0 && (
								<p className="text-sm text-muted-foreground text-center">
									{t("noLocationItems")}
								</p>
							)}
						</>
					)}
				</div>
			) : (
				<div className="grid gap-4">
					{items === undefined ? (
						<p>{t("loading")}</p>
					) : items.length === 0 ? (
						<WishlistPromptCard onMakeRequest={onEmptyMakeRequest} />
					) : filteredItems?.length === 0 ? (
						<WishlistPromptCard onMakeRequest={onEmptyMakeRequest} />
					) : (
						filteredItems?.map((item) => (
							<ItemCard
								key={item._id}
								item={item}
								backContent={actionBack && actionBack(item)}
								footer={
									<div className="flex justify-between items-center w-full">
										<UserLink userId={item.ownerId} size="sm" />
										{action && action(item)}
									</div>
								}
							/>
						))
					)}
					{onEmptyMakeRequest && filteredItems && filteredItems.length > 0 && (
						<WishlistPromptCard onMakeRequest={onEmptyMakeRequest} />
					)}
				</div>
			)}
		</div>
	);
}
