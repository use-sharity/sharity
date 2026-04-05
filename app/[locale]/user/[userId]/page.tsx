"use client";

import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RatingSummary } from "@/components/rating-summary";
import { RatingsList } from "@/components/ratings-list";
import { UserHistory } from "@/components/user-history";
import { ContactInfo } from "@/components/contact-info";
import { CloudinaryImage } from "@/components/cloudinary-image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, MapPin, ArrowLeft, Calendar } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.userId as string;

  const { user: currentUser } = useUser();
  const profile = useQuery(api.users.getProfile, { userId });
  const profileWithContacts = useQuery(api.users.getProfileWithContacts, {
    userId,
  });
  const t = useTranslations("UserProfile");

  // If this is the current user, redirect to their own profile page
  if (currentUser?.id === userId) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{t("redirecting")}</p>
        <Link href="/profile">
          <Button>{t("goToProfile")}</Button>
        </Link>
      </main>
    );
  }

  if (profile === undefined) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">{t("loading")}</div>
      </main>
    );
  }

  if (profile === null) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{t("notFound")}</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("backToHome")}
          </Button>
        </Link>
      </main>
    );
  }

  const hasFullContactAccess = profileWithContacts !== null;

  return (
    <main className="min-h-screen bg-gray-50/50">
      <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
        </div>

        {/* Profile Header */}
        <Card>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="relative h-20 w-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 shrink-0">
                {profile.avatarUrl ? (
                  <CloudinaryImage
                    src={profile.avatarUrl}
                    alt={profile.name || "User"}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-10 w-10 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold truncate">
                  {profile.name || "Anonymous User"}
                </h2>
                {profile.address && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    {profile.address}
                  </p>
                )}
                {profile.createdAt && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    {t("memberSince", {
                      date: format(new Date(profile.createdAt), "MMMM yyyy"),
                    })}
                  </p>
                )}
                <div className="mt-2">
                  <RatingSummary userId={userId} compact />
                </div>
              </div>
            </div>
            {profile.bio && (
              <p className="text-sm text-muted-foreground mt-4 whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("contactInfo")}</CardTitle>
          </CardHeader>
          <CardContent>
            {hasFullContactAccess && profileWithContacts ? (
              <ContactInfo contacts={profileWithContacts.contacts} showValues />
            ) : (
              <ContactInfo availableContacts={profile.availableContacts} />
            )}
          </CardContent>
        </Card>

        {/* Tabs for History and Ratings */}
        <Tabs defaultValue="ratings" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="ratings">{t("tabs.ratings")}</TabsTrigger>
            <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
          </TabsList>

          <TabsContent value="ratings" className="mt-4 space-y-4">
            <RatingSummary userId={userId} />
            <RatingsList userId={userId} />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <UserHistory userId={userId} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
