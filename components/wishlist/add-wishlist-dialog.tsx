"use client";

import { WishlistDraftCard } from "./wishlist-draft-card";

export function AddWishlistDialog() {
  // This component used to open a modal dialog. It now renders the inline draft card
  // to ensure there is no longer a request dialog anywhere.
  return <WishlistDraftCard />;
}
