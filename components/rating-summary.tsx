"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StarRating } from "@/components/star-rating";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";

interface RatingSummaryProps {
  userId: string;
  compact?: boolean;
}

export function RatingSummary({ userId, compact = false }: RatingSummaryProps) {
  const summary = useQuery(api.ratings.getRatingSummary, { userId });
  const t = useTranslations("RatingSummary");

  if (summary === undefined) {
    return <div className="text-sm text-muted-foreground">{t("loading")}</div>;
  }

  if (summary.totalRatings === 0) {
    if (compact) {
      return (
        <span className="text-sm text-muted-foreground">{t("noRatings")}</span>
      );
    }
    return (
      <div className="text-sm text-muted-foreground text-center py-2">
        {t("noRatingsYet")}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <StarRating value={summary.averageStars ?? 0} readonly size="sm" />
        <span className="text-sm text-muted-foreground">
          ({summary.totalRatings})
        </span>
      </div>
    );
  }

  return (
    <Card className="py-4 gap-3">
      <CardContent className="px-4 md:px-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <StarRating value={summary.averageStars ?? 0} readonly size="lg" />
            <span className="text-2xl font-bold">{summary.averageStars}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("ratingCount", { count: summary.totalRatings })}
          </p>
        </div>

        {(summary.asLender.count > 0 || summary.asBorrower.count > 0) && (
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">
                {t("asLender")}
              </p>
              {summary.asLender.count > 0 ? (
                <>
                  <StarRating
                    value={summary.asLender.averageStars ?? 0}
                    readonly
                    size="sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ({summary.asLender.count})
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No ratings</p>
              )}
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">
                {t("asBorrower")}
              </p>
              {summary.asBorrower.count > 0 ? (
                <>
                  <StarRating
                    value={summary.asBorrower.averageStars ?? 0}
                    readonly
                    size="sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ({summary.asBorrower.count})
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No ratings</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
