"use client";

import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { WishlistDraftCard } from "@/components/wishlist/wishlist-draft-card";
import { WishlistItem } from "@/components/wishlist/wishlist-item";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/routing";
import { useQuery } from "convex/react";
import { ArrowLeft, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

type WishlistPageClientProps = {
	shouldFocusDraft: boolean;
};

export function WishlistPageClient({
	shouldFocusDraft,
}: WishlistPageClientProps) {
	const wishlistItems = useQuery(api.wishlist.list);
	const [sortBy, setSortBy] = useState<"recent" | "upvoted">("recent");
	const [showDraft, setShowDraft] = useState(shouldFocusDraft);
	const [focusToken, setFocusToken] = useState(shouldFocusDraft ? 1 : 0);
	const t = useTranslations("Wishlist");

	const handleMakeRequest = useCallback(() => {
		setShowDraft(true);
		setFocusToken((prev) => prev + 1);
	}, []);

	if (!wishlistItems) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50/50">
				<div className="animate-pulse">{t("loading")}</div>
			</div>
		);
	}

	const sortedItems = [...wishlistItems].sort((a, b) => {
		if (sortBy === "upvoted") {
			return b.votes.length - a.votes.length;
		}
		return b.createdAt - a.createdAt;
	});

	return (
		<main className="min-h-screen bg-gray-50/50">
			<div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<Link
							href="/"
							className="text-muted-foreground hover:text-foreground transition-colors"
						>
							<ArrowLeft className="h-5 w-5" />
						</Link>
						<h1 className="text-xl font-semibold">{t("title")}</h1>
					</div>
					<p className="text-sm text-muted-foreground">{t("subtitle")}</p>
				</div>

				<div className="flex items-center justify-between">
					<Button variant="outline" size="sm" onClick={handleMakeRequest}>
						<Plus className="h-4 w-4 mr-1.5" />
						{t("draftCard.title")}
					</Button>
					<Select
						value={sortBy}
						onValueChange={(v) => setSortBy(v as "recent" | "upvoted")}
					>
						<SelectTrigger className="h-8 w-[140px]">
							<SelectValue placeholder={t("sortBy")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="recent">{t("sortOptions.recent")}</SelectItem>
							<SelectItem value="upvoted">
								{t("sortOptions.upvoted")}
							</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="grid gap-4">
					{showDraft && (
						<WishlistDraftCard
							autoFocus={shouldFocusDraft}
							focusToken={focusToken}
						/>
					)}
					{sortedItems.length === 0 ? (
						<div className="text-center py-12 text-gray-500 bg-white rounded-lg border shadow-sm">
							<p>{t("noItems")}</p>
						</div>
					) : (
						sortedItems.map((item) => (
							<WishlistItem key={item._id} item={item} />
						))
					)}
				</div>
			</div>
		</main>
	);
}
