"use client";

import { Link } from "@/i18n/routing";

import { SignInButton, SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { MyItemsList } from "@/components/my-items-list";
import { ShareItemSheet } from "@/components/share-item-sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserHistory } from "@/components/user-history";

function MyItemsTabs() {
  const { user, isLoaded } = useUser();
  const t = useTranslations("MyItems");

  if (!isLoaded || !user) {
    return <div className="text-center p-4">{t("loading")}</div>;
  }

  return (
    <Tabs defaultValue="borrowing" className="w-full">
      <TabsList className="w-full grid grid-cols-3">
        <TabsTrigger value="borrowing">{t("tabs.borrowing")}</TabsTrigger>
        <TabsTrigger value="shared">{t("tabs.shared")}</TabsTrigger>
        <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
      </TabsList>
      <TabsContent value="borrowing" className="mt-4">
        <MyItemsList variant="borrowing" />
      </TabsContent>
      <TabsContent value="shared" className="mt-4">
        <MyItemsList variant="shared" />
      </TabsContent>
      <TabsContent value="history" className="mt-4">
        <UserHistory userId={user.id} />
      </TabsContent>
    </Tabs>
  );
}

export default function MyItemsPage() {
  const t = useTranslations("MyItems");

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
          <ShareItemSheet variant="prompt" />
          <MyItemsTabs />
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
