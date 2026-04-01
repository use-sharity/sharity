"use client";

import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { ProfileForm } from "@/components/profile-form";
import { RatingSummary } from "@/components/rating-summary";
import { RatingsList } from "@/components/ratings-list";
import { PendingRatings } from "@/components/pending-ratings";
import { ContactInfo } from "@/components/contact-info";
import { CloudinaryImage } from "@/components/cloudinary-image";
import { User, MapPin, Settings, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useState } from "react";
import { useTranslations } from "next-intl";

export default function ProfilePage() {
	const { user, isLoaded } = useUser();
	const profile = useQuery(api.users.getMyProfile);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const t = useTranslations("Profile");

	if (!isLoaded) {
		return (
			<main className="min-h-screen flex items-center justify-center">
				<div className="text-muted-foreground">{t("loading")}</div>
			</main>
		);
	}

	if (!user) {
		return (
			<main className="min-h-screen flex flex-col items-center justify-center gap-4">
				<p className="text-muted-foreground">{t("signInMessage")}</p>
				<Link href="/">
					<Button variant="outline">
						<ArrowLeft className="h-4 w-4 mr-2" />
						{t("backToHome")}
					</Button>
				</Link>
			</main>
		);
	}

	if (profile === undefined) {
		return (
			<main className="min-h-screen flex items-center justify-center">
				<div className="text-muted-foreground">{t("loadingProfile")}</div>
			</main>
		);
	}

	const displayName =
		profile?.name || user.firstName || user.username || "User";
	const avatarUrl = profile?.avatarUrl || user.imageUrl;
	const clerkId = user.id;

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

				{/* Profile Header */}
				<Card className="py-4 gap-4 relative">
					<Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
						<DialogTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								className="absolute top-3 right-3"
							>
								<Settings className="h-4 w-4" />
								<span className="sr-only">{t("edit")}</span>
							</Button>
						</DialogTrigger>
						<DialogContent className="max-h-[90vh] overflow-y-auto">
							<DialogHeader>
								<DialogTitle>{t("editTitle")}</DialogTitle>
							</DialogHeader>
							<ProfileForm
								initialValues={{
									name: profile?.name,
									avatarUrl: profile?.avatarUrl,
									address: profile?.address,
									bio: profile?.bio,
									contacts: profile?.contacts,
								}}
								onSuccess={() => setIsEditOpen(false)}
							/>
						</DialogContent>
					</Dialog>
					<CardContent className="px-4 md:px-6">
						<div className="flex items-start gap-4">
							<div className="relative h-20 w-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 shrink-0">
								{avatarUrl ? (
									avatarUrl.includes("res.cloudinary.com") &&
									avatarUrl.includes("/image/upload/") ? (
										<CloudinaryImage
											src={avatarUrl}
											alt={displayName}
											fill
											sizes="80px"
											className="object-cover"
										/>
									) : (
										// Clerk (or other) avatar URL - not Cloudinary.
										// eslint-disable-next-line @next/next/no-img-element
										<img
											src={avatarUrl}
											alt={displayName}
											className="w-full h-full object-cover"
										/>
									)
								) : (
									<div className="w-full h-full flex items-center justify-center">
										<User className="h-10 w-10 text-gray-400" />
									</div>
								)}
							</div>
							<div className="flex-1 min-w-0">
								<h2 className="text-xl font-semibold truncate">
									{displayName}
								</h2>
								{profile?.address && (
									<p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
										<MapPin className="h-3 w-3" />
										{profile.address}
									</p>
								)}
								<div className="mt-2">
									<RatingSummary userId={clerkId} compact />
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Pending Ratings */}
				<PendingRatings />

				{/* Contact Info */}
				{profile?.contacts && (
					<Card className="py-4 gap-3">
						<CardHeader className="px-4 md:px-6 pb-2">
							<CardTitle className="text-base">{t("contactInfo")}</CardTitle>
						</CardHeader>
						<CardContent className="px-4 md:px-6">
							<ContactInfo contacts={profile.contacts} showValues />
						</CardContent>
					</Card>
				)}

				{/* Ratings */}
				<div className="space-y-4">
					<RatingSummary userId={clerkId} />
					<RatingsList userId={clerkId} />
				</div>
			</div>
		</main>
	);
}
