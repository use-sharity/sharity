import { WishlistPageClient } from "@/components/wishlist/wishlist-page-client";

type WishlistPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WishlistPage(props: WishlistPageProps) {
  const searchParams = await props.searchParams;
  const draft = searchParams?.draft;
  const shouldFocusDraft = draft === "1";
  return <WishlistPageClient shouldFocusDraft={shouldFocusDraft} />;
}
