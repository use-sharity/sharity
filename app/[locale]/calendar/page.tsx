"use client";

import { Link } from "@/i18n/routing";

import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";

const EnhancedCalendar = dynamic(
	() =>
		import("@/components/calendar/enhanced-calendar").then(
			(mod) => mod.EnhancedCalendar,
		),
	{
		ssr: false,
		loading: () => (
			<div className="h-[600px] bg-muted/20 animate-pulse rounded-lg" />
		),
	},
);

export default function CalendarPage() {
	const t = useTranslations("Calendar");

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

				<SignedIn>
					<EnhancedCalendar />
				</SignedIn>

				<SignedOut>
					<div className="flex flex-col items-center justify-center gap-4 py-16">
						<p className="text-muted-foreground text-center">
							{t("signInMessage")}
						</p>
						<SignInButton mode="modal">
							<Button variant="outline">{t("signInButton")}</Button>
						</SignInButton>
					</div>
				</SignedOut>
			</div>
		</main>
	);
}
