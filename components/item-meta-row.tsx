import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ItemCategory } from "@/lib/constants";

interface ItemMetaRowProps {
  giveaway?: boolean;
  category?: ItemCategory;
  location?: { lat: number; lng: number; address?: string; ward?: string };
  compact?: boolean;
  giveawayLabel?: string;
  loanLabel?: string;
  categoryLabel?: string;
  locationLabel?: string;
}

export function ItemMetaRow({
  giveaway,
  category,
  location,
  compact = false,
  giveawayLabel = "Giveaway",
  loanLabel = "Loan",
  categoryLabel,
  locationLabel = "Location available",
}: ItemMetaRowProps) {
  const hasContent = giveaway !== undefined || category || location;
  if (!hasContent) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", compact ? "mb-1.5" : "mb-2")}>
      {giveaway ? (
        <Badge>{giveawayLabel}</Badge>
      ) : (
        <Badge variant="outline">{loanLabel}</Badge>
      )}
      {category && (
        <Badge variant="secondary">{categoryLabel ?? category}</Badge>
      )}
      {location && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {location.ward || locationLabel}
        </span>
      )}
    </div>
  );
}
