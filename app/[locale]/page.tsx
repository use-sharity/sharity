"use client";

import { AddItemForm } from "@/components/add-item-form";
import { ItemList } from "@/components/item-list";
import { OnboardingCarousel } from "@/components/onboarding-carousel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Gift, ListChecks, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useLocalStorage } from "@/hooks/use-local-storage";

const ONBOARDING_STORAGE_KEY = "sharity.onboarding.v1.seen";

export default function Home() {
	const [desktopLeftTab, setDesktopLeftTab] = useState<"share" | "request">(
		"share",
	);
	const [desktopRequestFocusToken, setDesktopRequestFocusToken] = useState(0);
	const [mobileTab, setMobileTab] = useState<"browse" | "wishlist" | "manage">(
		"browse",
	);
	const [mobileWishlistFocusToken, setMobileWishlistFocusToken] = useState(0);
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

	useEffect(() => {
		setIsClient(true);
	}, []);

	const shouldShowOnboarding = isClient && !hasSeenOnboarding;

	return (
		<main className="min-h-screen flex flex-col items-center bg-gray-50/50">
			<OnboardingCarousel
				open={shouldShowOnboarding}
				onClose={() => setHasSeenOnboarding(true)}
			/>
			<div className="w-full max-w-6xl p-4 md:p-8 space-y-8">
				<div className="text-center space-y-2">
					<h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
					<p className="text-xl text-gray-600">{t("subtitle")}</p>
				</div>

				{/* Desktop Layout: Split View */}
				<div className="hidden md:grid md:grid-cols-[350px_1fr] lg:grid-cols-[400px_1fr] gap-8 items-start justify-center">
					<div className="sticky top-8">
						<Tabs
							value={desktopLeftTab}
							onValueChange={(v) => setDesktopLeftTab(v as "share" | "request")}
							className="w-full"
						>
							<TabsList className="w-full grid grid-cols-2">
								<TabsTrigger value="share">
									<Gift className="h-4 w-4" />
									{t("tabs.share")}
								</TabsTrigger>
								<TabsTrigger value="request">
									<ListChecks className="h-4 w-4" />
									{t("tabs.request")}
								</TabsTrigger>
							</TabsList>
							<TabsContent value="share" className="mt-4">
								<AddItemForm />
							</TabsContent>
							<TabsContent value="request" className="mt-4 space-y-4">
								<WishlistDraftCard
									autoFocus={desktopRequestFocusToken > 0}
									focusToken={desktopRequestFocusToken}
								/>
								<div className="mt-4 flex items-center justify-between gap-2">
									<div className="text-sm font-medium">{t("topRequests")}</div>
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
								{!wishlistItems ? (
									<div className="mt-2 text-sm text-muted-foreground">
										Loading...
									</div>
								) : (
									(() => {
										const sortedItems = [...wishlistItems].sort((a, b) => {
											if (wishlistSortBy === "upvoted") {
												return b.votes.length - a.votes.length;
											}
											return b.createdAt - a.createdAt;
										});
										const topItems = sortedItems.slice(0, 3);

										if (topItems.length === 0) {
											return (
												<div className="mt-2 text-sm text-muted-foreground">
													{t("noRequests")}
												</div>
											);
										}

										return (
											<div className="mt-2 grid gap-2">
												{topItems.map((item) => (
													<WishlistItem key={item._id} item={item} compact />
												))}
											</div>
										);
									})()
								)}
								<Link href="/wishlist" className="mt-3 block">
									<Button variant="outline" className="w-full">
										{t("seeFullWishlist")}
									</Button>
								</Link>
							</TabsContent>
						</Tabs>
					</div>
					<div className="w-full">
						<Suspense
							fallback={<div className="w-full max-w-2xl">Loading…</div>}
						>
							<ItemList
								action={(item) => <ClaimButton item={item} />}
								actionBack={(item) => <ClaimItemBack item={item} />}
								onEmptyMakeRequest={() => {
									setDesktopLeftTab("request");
									setDesktopRequestFocusToken((n) => n + 1);
								}}
							/>
						</Suspense>
					</div>
				</div>

				{/* Mobile Layout: Tabs with Bottom Navigation */}
				<div className="md:hidden pb-20">
					<Tabs
						value={mobileTab}
						onValueChange={(v) => setMobileTab(v as typeof mobileTab)}
						className="w-full"
					>
						<TabsContent value="browse" className="mt-0 space-y-4">
							<h2 className="text-lg font-semibold px-1">{t("tabs.browse")}</h2>
							<Suspense
								fallback={<div className="w-full max-w-2xl">Loading…</div>}
							>
								<ItemList
									action={(item) => <ClaimButton item={item} />}
									actionBack={(item) => <ClaimItemBack item={item} />}
									onEmptyMakeRequest={() => {
										setMobileTab("wishlist");
										setMobileWishlistFocusToken((n) => n + 1);
									}}
								/>
							</Suspense>
						</TabsContent>

						<TabsContent value="wishlist" className="mt-0 space-y-4">
							<h2 className="text-lg font-semibold px-1">
								{t("tabs.request")}
							</h2>
							<WishlistDraftCard
								autoFocus={mobileWishlistFocusToken > 0}
								focusToken={mobileWishlistFocusToken}
							/>
							<div className="flex items-center justify-between gap-2 px-1">
								<div className="text-sm font-medium">{t("topRequests")}</div>
								<Select
									value={wishlistSortBy}
									onValueChange={(v) =>
										setWishlistSortBy(v as "recent" | "upvoted")
									}
								>
									<SelectTrigger className="h-8 w-[160px]">
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
							{!wishlistItems ? (
								<div className="px-1 text-sm text-muted-foreground">
									Loading...
								</div>
							) : (
								(() => {
									const sortedItems = [...wishlistItems].sort((a, b) => {
										if (wishlistSortBy === "upvoted") {
											return b.votes.length - a.votes.length;
										}
										return b.createdAt - a.createdAt;
									});
									const topItems = sortedItems.slice(0, 3);

									if (topItems.length === 0) {
										return (
											<div className="px-1 text-sm text-muted-foreground">
												{t("noRequests")}
											</div>
										);
									}

									return topItems.map((item) => (
										<WishlistItem key={item._id} item={item} />
									));
								})()
							)}
							<Link href="/wishlist" className="block">
								<Button variant="outline" className="w-full">
									{t("seeFullWishlist")}
								</Button>
							</Link>
						</TabsContent>

						<TabsContent value="manage" className="mt-0 space-y-4">
							<h2 className="text-lg font-semibold px-1">{t("tabs.share")}</h2>
							<AddItemForm />
						</TabsContent>

						<div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 p-2 z-50">
							<TabsList className="w-full grid grid-cols-3 h-auto">
								<TabsTrigger value="browse" className="py-3">
									<Search className="h-4 w-4" />
									{t("tabs.browse")}
								</TabsTrigger>
								<TabsTrigger value="wishlist" className="py-3">
									<ListChecks className="h-4 w-4" />
									{t("tabs.request")}
								</TabsTrigger>
								<TabsTrigger value="manage" className="py-3">
									<Gift className="h-4 w-4" />
									{t("tabs.share")}
								</TabsTrigger>
							</TabsList>
						</div>
					</Tabs>
				</div>
			</div>
		</main>
	);
}
