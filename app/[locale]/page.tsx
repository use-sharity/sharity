"use client";

import { ItemList } from "@/components/item-list";
import { OnboardingCarousel } from "@/components/onboarding-carousel";
import { SharePrompt } from "@/components/share-prompt";

import { ClaimButton } from "@/components/claim-button";
import { ClaimItemBack } from "@/components/claim-item-back";
import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useRouter } from "@/i18n/routing";

const ONBOARDING_STORAGE_KEY = "sharity.onboarding.v1.seen";

export default function Home() {
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

	return (
		<main className="min-h-screen bg-gray-50/50">
			<OnboardingCarousel
				open={shouldShowOnboarding}
				onClose={() => setHasSeenOnboarding(true)}
			/>
			<div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
				<div className="text-center space-y-1">
					<h1 className="text-2xl font-bold">{t("title")}</h1>
					<p className="text-muted-foreground">{t("subtitle")}</p>
				</div>

				<Suspense fallback={<div>Loading…</div>}>
					<ItemList
						action={(item) => <ClaimButton item={item} />}
						actionBack={(item) => <ClaimItemBack item={item} />}
						onEmptyMakeRequest={() => {
							router.push("/wishlist");
						}}
					/>
				</Suspense>
			</div>
		</main>
	);
}
