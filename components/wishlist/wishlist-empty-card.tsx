"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTranslations } from "next-intl";

type WishlistPromptCardProps = {
	onMakeRequest?: () => void;
};

export function WishlistPromptCard({ onMakeRequest }: WishlistPromptCardProps) {
	const t = useTranslations("Wishlist");

	return (
		<div className="p-6 bg-white rounded-lg border shadow-sm space-y-4 text-center">
			<h3 className="text-lg font-semibold">{t("emptyCard.title")}</h3>
			<p className="text-muted-foreground">{t("emptyCard.description")}</p>
			<div className="grid gap-2">
				<Link href="/wishlist" className="block">
					<Button variant="outline" className="w-full">
						{t("emptyCard.seeFull")}
					</Button>
				</Link>
				{onMakeRequest ? (
					<Button className="w-full" type="button" onClick={onMakeRequest}>
						{t("emptyCard.makeRequest")}
					</Button>
				) : (
					<Link href="/wishlist?draft=1" className="block">
						<Button className="w-full">{t("emptyCard.makeRequest")}</Button>
					</Link>
				)}
			</div>
		</div>
	);
}
