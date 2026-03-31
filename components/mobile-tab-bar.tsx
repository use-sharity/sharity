"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/i18n/routing";
import { SignedIn } from "@clerk/nextjs";
import {
	ArrowLeftRight,
	CalendarDays,
	Heart,
	Search,
	User,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

const TABS = [
	{ href: "/", icon: Search, labelKey: "home" as const },
	{ href: "/calendar", icon: CalendarDays, labelKey: "calendar" as const },
	{ href: "/my-items", icon: ArrowLeftRight, labelKey: "myItems" as const },
	{ href: "/wishlist", icon: Heart, labelKey: "requests" as const },
	{ href: "/profile", icon: User, labelKey: "profile" as const },
];

export function MobileTabBar() {
	const pathname = usePathname();
	const t = useTranslations("AppHeader");

	// Strip locale prefix for matching (e.g., /en/calendar → /calendar)
	const cleanPath = pathname.replace(/^\/[a-z]{2}(\/|$)/, "/");

	return (
		<SignedIn>
			<nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm">
				<div className="flex items-center justify-around px-2 pt-2.5 pb-4">
					{TABS.map(({ href, icon: Icon, labelKey }) => {
						const isActive =
							href === "/" ? cleanPath === "/" : cleanPath.startsWith(href);

						return (
							<Link
								key={href}
								href={href}
								className={cn(
									"flex flex-col items-center gap-1 px-3 py-1.5 rounded-md text-muted-foreground transition-colors",
									isActive && "text-primary font-semibold",
								)}
							>
								<Icon className="h-6 w-6" />
								<span className="text-[11px] leading-none font-medium">
									{t(labelKey)}
								</span>
							</Link>
						);
					})}
				</div>
			</nav>
		</SignedIn>
	);
}
