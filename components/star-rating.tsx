"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
  showValue = false,
}: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-1">
      {stars.map((star) => {
        const isFilled = star <= value;
        const isHalf = !isFilled && star - 0.5 <= value;

        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star)}
            className={cn(
              "transition-colors",
              readonly
                ? "cursor-default"
                : "cursor-pointer hover:scale-110 transition-transform",
            )}
          >
            <Star
              className={cn(
                sizeClasses[size],
                isFilled || isHalf
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-transparent text-gray-300",
              )}
            />
          </button>
        );
      })}
      {showValue && value > 0 && (
        <span className="ml-1 text-sm text-muted-foreground">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
