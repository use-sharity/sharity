"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/routing";
import { SignedIn } from "@clerk/nextjs";
import { ArrowLeftRight, CalendarDays, Heart, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { ShareItemSheet } from "@/components/share-item-sheet";
import { cn } from "@/lib/utils";

const NAV_TABS = [
  { href: "/", icon: Search, labelKey: "home" as const },
  { href: "/my-items", icon: ArrowLeftRight, labelKey: "myItems" as const },
] as const;

const NAV_TABS_RIGHT = [
  { href: "/calendar", icon: CalendarDays, labelKey: "calendar" as const },
  { href: "/wishlist", icon: Heart, labelKey: "requests" as const },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();
  const t = useTranslations("AppHeader");

  // Strip locale prefix for matching (e.g., /en/calendar → /calendar)
  const cleanPath = pathname.replace(/^\/[a-z]{2}(\/|$)/, "/");
  if (cleanPath.startsWith("/chat")) return null;

  const renderTab = ({
    href,
    icon: Icon,
    labelKey,
  }: (typeof NAV_TABS)[number] | (typeof NAV_TABS_RIGHT)[number]) => {
    const isActive =
      href === "/" ? cleanPath === "/" : cleanPath.startsWith(href);

    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex-1 flex flex-col items-center gap-1 px-1 pt-2.5 pb-1.5 text-muted-foreground transition-colors border-t-[3px] border-transparent -mt-px",
          isActive && "text-foreground border-t-foreground",
        )}
      >
        <span className="flex items-center justify-center h-7 w-7">
          <Icon className="h-6 w-6" />
        </span>
        <span
          className={cn(
            "text-[10px] leading-none text-center truncate max-w-[64px]",
            isActive ? "font-semibold" : "font-medium",
          )}
        >
          {t(labelKey)}
        </span>
      </Link>
    );
  };

  return (
    <SignedIn>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-sm md:hidden">
        <div className="flex items-center justify-around px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {NAV_TABS.map(renderTab)}
          <ShareItemSheet variant="tab" />
          {NAV_TABS_RIGHT.map(renderTab)}
        </div>
      </nav>
    </SignedIn>
  );
}
