"use client";

import type { LucideIcon } from "lucide-react";
import {
  UtensilsCrossed,
  Sofa,
  Smartphone,
  Shirt,
  BookOpen,
  Dumbbell,
  Package,
} from "lucide-react";
import { renderToString } from "react-dom/server";
import { cn } from "@/lib/utils";
import type { ItemCategory } from "@/lib/constants";

const CATEGORY_ICON_MAP: Record<ItemCategory, LucideIcon> = {
  kitchen: UtensilsCrossed,
  furniture: Sofa,
  electronics: Smartphone,
  clothing: Shirt,
  books: BookOpen,
  sports: Dumbbell,
  other: Package,
};

interface CreateMarkerIconOptions {
  category?: ItemCategory;
  selected?: boolean;
  L: typeof import("leaflet");
}

/**
 * Creates a custom Leaflet divIcon with a category-specific Lucide icon
 * inside a rounded white circle.
 */
export function createMarkerIcon({
  category,
  selected = false,
  L,
}: CreateMarkerIconOptions) {
  const IconComponent = category ? CATEGORY_ICON_MAP[category] : Package;

  const iconHtml = renderToString(
    <div
      className={cn(
        "flex items-center justify-center rounded-full border-2 bg-white shadow-lg transition-all",
        "hover:scale-110 cursor-pointer",
        selected
          ? "border-emerald-500 w-12 h-12 scale-125"
          : "border-gray-300 w-10 h-10",
      )}
    >
      <IconComponent
        className={cn(
          "transition-all",
          selected ? "w-6 h-6 text-emerald-500" : "w-5 h-5 text-gray-700",
        )}
      />
    </div>,
  );

  return L.divIcon({
    html: iconHtml,
    className: "custom-marker-icon",
    iconSize: selected ? [48, 48] : [40, 40],
    iconAnchor: selected ? [24, 24] : [20, 20],
  });
}
