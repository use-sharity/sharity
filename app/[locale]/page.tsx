"use client";

import { ItemList } from "@/components/item-list";
import { OnboardingCarousel } from "@/components/onboarding-carousel";

import { Suspense, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useRouter } from "@/i18n/routing";

const ONBOARDING_STORAGE_KEY = "sharity.onboarding.v1.seen";

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function Home() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useLocalStorage<boolean>(
    ONBOARDING_STORAGE_KEY,
    false,
  );
  const isClient = useIsClient();
  const t = useTranslations("Home");
  const router = useRouter();

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
            onEmptyMakeRequest={() => {
              router.push("/wishlist");
            }}
          />
        </Suspense>
      </div>
    </main>
  );
}
