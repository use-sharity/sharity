import type { Metadata } from "next";

const ogTitle =
	"Wishlist — Request and vote on needed items in Da Lat, Vietnam";
const description =
	"Request items you can't find in Da Lat, Vietnam and vote on what others need. Help the neighborhood prioritize popular requests and find items worth sharing next.";

export const metadata: Metadata = {
	title: "Wishlist",
	description,
	openGraph: {
		title: ogTitle,
		description,
		url: "/wishlist",
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

export default function WishlistLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return <>{children}</>;
}
