import { ClerkProvider } from "@clerk/nextjs";
import type { Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import "leaflet/dist/leaflet.css";
import "../globals.css";
import { AppContentShell } from "@/components/app-content-shell";
import { AppHeader } from "@/components/app-header";
import { ChatWidget } from "@/components/chat-widget";
import { EnsureEmail } from "@/components/ensure-email";
import { LocaleSync } from "@/components/locale-sync";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { PostHogIdentify } from "@/components/posthog-identify";
import { ProfileProvider } from "@/components/profile-provider";
import { Toaster } from "@/components/ui/sonner";
import { ConvexClientProvider } from "../ConvexClientProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  viewportFit: "cover",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Layout.metadata" });

  return {
    metadataBase: new URL("https://sharity-dalat.com"),
    title: {
      default: t("title.default"),
      template: t("title.template"),
    },
    description: t("description"),
    openGraph: {
      type: "website",
      siteName: t("openGraph.siteName"),
      title: t("openGraph.title"),
      description: t("openGraph.description"),
      url: "/",
      locale: t("openGraph.locale"),
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "Sharity",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("twitter.title"),
      description: t("twitter.description"),
      images: ["/twitter-image"],
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <ClerkProvider>
      <html lang={locale}>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <NextIntlClientProvider messages={messages}>
            <ConvexClientProvider>
              <PostHogIdentify />
              <ProfileProvider>
                <LocaleSync />
                <EnsureEmail />
                <AppHeader />
                <AppContentShell>{children}</AppContentShell>
                <MobileTabBar />
                <Toaster />
                <ChatWidget />
              </ProfileProvider>
            </ConvexClientProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
