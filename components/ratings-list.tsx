"use client";

import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";

import { api } from "@/convex/_generated/api";
import { CloudinaryImage } from "@/components/cloudinary-image";
import { StarRating } from "@/components/star-rating";
import { UserLink } from "@/components/user-link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

interface RatingsListProps {
  userId: string;
}

export function RatingsList({ userId }: RatingsListProps) {
  const t = useTranslations("RatingsList");
  const allRatings = useQuery(api.ratings.getRatingsForUser, { userId });
  const lenderRatings = useQuery(api.ratings.getRatingsForUser, {
    userId,
    role: "lender",
  });
  const borrowerRatings = useQuery(api.ratings.getRatingsForUser, {
    userId,
    role: "borrower",
  });

  if (allRatings === undefined) {
    return <div className="text-sm text-muted-foreground">{t("loading")}</div>;
  }

  if (allRatings.length === 0) {
    return null;
  }

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="w-full grid grid-cols-3">
        <TabsTrigger value="all">
          {t("all", { count: allRatings?.length ?? 0 })}
        </TabsTrigger>
        <TabsTrigger value="lender">
          {t("lender", { count: lenderRatings?.length ?? 0 })}
        </TabsTrigger>
        <TabsTrigger value="borrower">
          {t("borrower", { count: borrowerRatings?.length ?? 0 })}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-4">
        <RatingsGrid ratings={allRatings} />
      </TabsContent>

      <TabsContent value="lender" className="mt-4">
        <RatingsGrid ratings={lenderRatings ?? []} />
      </TabsContent>

      <TabsContent value="borrower" className="mt-4">
        <RatingsGrid ratings={borrowerRatings ?? []} />
      </TabsContent>
    </Tabs>
  );
}

interface Rating {
  _id: string;
  fromUserId: string;
  stars: number;
  comment?: string;
  role: "lender" | "borrower";
  createdAt: number;
  photoUrls: string[];
}

function RatingsGrid({ ratings }: { ratings: Rating[] }) {
  const t = useTranslations("RatingsList");

  if (ratings.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">{t("noRatings")}</div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {ratings.map((rating) => (
        <RatingCard key={rating._id} rating={rating} />
      ))}
    </div>
  );
}

function RatingCard({ rating }: { rating: Rating }) {
  const t = useTranslations("RatingsList");
  // TODO: Use next-intl formatter for relative time if possible, or keep date-fns but maybe need locale
  return (
    <Card className="py-4 gap-3">
      <CardContent className="px-4 md:px-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <UserLink userId={rating.fromUserId} size="sm" />
              <Badge variant="outline" className="text-xs">
                {rating.role === "lender" ? t("asLender") : t("asBorrower")}
              </Badge>
            </div>
            <StarRating value={rating.stars} readonly size="sm" />
            {rating.comment && (
              <p className="text-sm text-gray-700">{rating.comment}</p>
            )}
            {rating.photoUrls.length > 0 && (
              <div className="flex gap-2 mt-2">
                {rating.photoUrls.map((url, index) => (
                  <CloudinaryImage
                    key={index}
                    src={url}
                    alt={t("photoAlt", { index: index + 1 })}
                    width={64}
                    height={64}
                    sizes="64px"
                    className="rounded-md border"
                  />
                ))}
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(rating.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
