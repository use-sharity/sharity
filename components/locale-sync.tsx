"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { api } from "@/convex/_generated/api";

/**
 * Restores the user's stored locale preference on login or cross-device access.
 * Renders nothing; placed inside a SignedIn boundary in the layout.
 */
export function LocaleSync() {
  const profile = useQuery(api.users.getMyProfile);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (profile?.locale && profile.locale !== locale) {
      router.replace(pathname, { locale: profile.locale });
    }
  }, [profile?.locale, locale, pathname, router]);

  return null;
}
