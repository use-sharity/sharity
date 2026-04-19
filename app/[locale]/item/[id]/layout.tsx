import type { Metadata } from "next";

const ogTitle =
  "Item — View availability and request to foster in Da Lat, Vietnam";
const description =
  "See item details, photos, and pickup location in Da Lat, Vietnam. Check availability, choose dates, send a foster request, and track approvals all in one place.";

export const metadata: Metadata = {
  title: "Item",
  description,
  openGraph: {
    title: ogTitle,
    description,
    url: "/item",
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
    title: ogTitle,
    description,
    images: ["/twitter-image"],
  },
};

export default function ItemLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
