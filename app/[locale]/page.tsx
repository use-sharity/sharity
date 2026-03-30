"use client";

import { ItemList } from "@/components/item-list";
import { OnboardingCarousel } from "@/components/onboarding-carousel";
import { WishlistDraftCard } from "@/components/wishlist/wishlist-draft-card";
import { WishlistItem } from "@/components/wishlist/wishlist-item";

import { ClaimButton } from "@/components/claim-button";
import { ClaimItemBack } from "@/components/claim-item-back";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useRouter } from "@/i18n/routing";

const ONBOARDING_STORAGE_KEY = "sharity.onboarding.v1.seen";

export default function Home() {
	const wishlistItems = useQuery(api.wishlist.list);
	const [wishlistSortBy, setWishlistSortBy] = useState<"recent" | "upvoted">(
		"recent",
	);
	const [hasSeenOnboarding, setHasSeenOnboarding] = useLocalStorage<boolean>(
		ONBOARDING_STORAGE_KEY,
		false,
	);
	const [isClient, setIsClient] = useState(false);
	const t = useTranslations("Home");
	const router = useRouter();

	useEffect(() => {
		setIsClient(true);
	}, []);

	const shouldShowOnboarding = isClient && !hasSeenOnboarding;

	const sortedWishlistItems = wishlistItems
		? [...wishlistItems]
				.sort((a, b) => {
					if (wishlistSortBy === "upvoted") {
						return b.votes.length - a.votes.length;
					}
					return b.createdAt - a.createdAt;
				})
				.slice(0, 3)
		: null;

	return (
		<main className="min-h-screen flex flex-col items-center bg-gray-50/50">
			<OnboardingCarousel
				open={shouldShowOnboarding}
				onClose={() => setHasSeenOnboarding(true)}
			/>
			<div className="w-full max-w-6xl p-4 md:p-8 space-y-8">
				<div className="text-center space-y-2">
					<h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
					<p className="text-xl text-gray-600 mt-2">{t("subtitle")}</p>
				</div>

				{/* Browse — full width */}
				<Suspense fallback={<div className="w-full max-w-2xl">Loading…</div>}>
					<ItemList
						action={(item) => <ClaimButton item={item} />}
						actionBack={(item) => <ClaimItemBack item={item} />}
						onEmptyMakeRequest={() => {
							router.push("/wishlist");
						}}
					/>
				</Suspense>

				{/* Top Requests section */}
				<section className="space-y-4">
					<div className="flex items-center justify-between gap-2">
						<h2 className="text-lg font-semibold">{t("topRequests")}</h2>
						<Select
							value={wishlistSortBy}
							onValueChange={(v) =>
								setWishlistSortBy(v as "recent" | "upvoted")
							}
						>
							<SelectTrigger className="h-8 w-[180px]">
								<SelectValue placeholder={t("sortBy")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="recent">
									{t("sortOptions.recent")}
								</SelectItem>
								<SelectItem value="upvoted">
									{t("sortOptions.upvoted")}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<WishlistDraftCard />

					{!sortedWishlistItems ? (
						<div className="text-sm text-muted-foreground">Loading...</div>
					) : sortedWishlistItems.length === 0 ? (
						<div className="text-sm text-muted-foreground">
							{t("noRequests")}
						</div>
					) : (
						<div className="grid gap-2 md:grid-cols-3">
							{sortedWishlistItems.map((item) => (
								<WishlistItem key={item._id} item={item} />
							))}
						</div>
					)}

					<Link href="/wishlist" className="block">
						<Button variant="outline" className="w-full">
							{t("seeFullWishlist")}
						</Button>
					</Link>
				</section>
			</div>
		</main>
	);
}
