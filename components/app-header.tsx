"use client";

import Link from "next/link";

import {
	SignInButton,
	SignUpButton,
	SignedIn,
	SignedOut,
	UserButton,
} from "@clerk/nextjs";
import {
	ArrowLeftRight,
	CalendarDays,
	Heart,
	Search,
	User,
} from "lucide-react";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";

function SharityLogo({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 200 200"
			className={className}
		>
			<defs>
				<mask id="ring-cutout">
					<rect width="200" height="200" fill="white" />
					<circle cx="100" cy="100" r="56" fill="black" />
				</mask>
			</defs>
			<g mask="url(#ring-cutout)">
				<rect
					x="8"
					y="8"
					width="76"
					height="76"
					rx="16"
					ry="16"
					fill="#2d4a44"
				/>
				<rect
					x="116"
					y="8"
					width="76"
					height="76"
					rx="16"
					ry="16"
					fill="#2d4a44"
				/>
				<rect
					x="8"
					y="116"
					width="76"
					height="76"
					rx="16"
					ry="16"
					fill="#2d4a44"
				/>
				<rect
					x="116"
					y="116"
					width="76"
					height="76"
					rx="16"
					ry="16"
					fill="#2d4a44"
				/>
			</g>
			<circle cx="100" cy="100" r="36" fill="#68958e" />
		</svg>
	);
}

export function AppHeader() {
	const t = useTranslations("AppHeader");
	return (
		<header className="w-full flex justify-center">
			<div className="w-full max-w-4xl flex items-center gap-2 p-4 md:px-8 md:py-5">
				<Link
					href="/"
					className="flex-shrink-0 hover:opacity-80 transition-opacity"
				>
					<SharityLogo className="h-8 w-8" />
				</Link>

				<SignedOut>
					<div className="flex gap-2 items-center ml-auto">
						<LanguageSwitcher />
						<SignInButton mode="modal">
							<Button variant="ghost" size="sm">
								{t("signIn")}
							</Button>
						</SignInButton>
						<SignUpButton mode="modal">
							<Button size="sm">{t("signUp")}</Button>
						</SignUpButton>
					</div>
				</SignedOut>

				<SignedIn>
					<nav className="hidden md:flex items-center gap-2 ml-auto mr-8">
						<Link href="/">
							<Button variant="ghost" size="sm">
								<Search className="h-4 w-4 mr-1" />
								{t("home")}
							</Button>
						</Link>
						<Link href="/my-items">
							<Button variant="ghost" size="sm">
								<ArrowLeftRight className="h-4 w-4 mr-1" />
								{t("myItems")}
							</Button>
						</Link>
						<Link href="/calendar">
							<Button variant="ghost" size="sm">
								<CalendarDays className="h-4 w-4 mr-1" />
								{t("calendar")}
							</Button>
						</Link>
						<Link href="/wishlist">
							<Button variant="ghost" size="sm">
								<Heart className="h-4 w-4 mr-1" />
								{t("requests")}
							</Button>
						</Link>
					</nav>
					<div className="hidden md:flex items-center gap-1 ml-auto">
						<LanguageSwitcher />
						<NotificationBell />
						<Link href="/profile">
							<Button variant="ghost" size="icon">
								<User className="h-4 w-4" />
								<span className="sr-only">{t("profile")}</span>
							</Button>
						</Link>
						<UserButton />
					</div>

					<div className="flex md:hidden items-center gap-2 ml-auto">
						<LanguageSwitcher />
						<NotificationBell />
						<Link href="/profile">
							<Button variant="ghost" size="icon">
								<User className="h-4 w-4" />
								<span className="sr-only">{t("profile")}</span>
							</Button>
						</Link>
						<UserButton />
					</div>
				</SignedIn>
			</div>
		</header>
	);
}
