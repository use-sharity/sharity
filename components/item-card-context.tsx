"use client";

import { createContext, useContext } from "react";

export interface ItemCardContextValue {
  isFlipped: boolean;
  toggleFlip: () => void;
  flipToFront: () => void;
  flipToBack: () => void;
}

export const ItemCardContext = createContext<ItemCardContextValue | undefined>(
  undefined,
);

export function useItemCard() {
  const context = useContext(ItemCardContext);
  if (!context) {
    throw new Error("useItemCard must be used within an ItemCard");
  }
  return context;
}
