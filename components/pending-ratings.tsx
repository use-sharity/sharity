"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RatingForm } from "@/components/rating-form";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { format } from "date-fns";
import { CloudinaryImage } from "@/components/cloudinary-image";
import { useTranslations } from "next-intl";

export function PendingRatings() {
  const t = useTranslations("Ratings");
  const pendingRatings = useQuery(api.ratings.getMyPendingRatings);
  const [selectedClaim, setSelectedClaim] = useState<{
    claimId: Id<"claims">;
    targetRole: "lender" | "borrower";
    itemName: string;
  } | null>(null);

  if (pendingRatings === undefined) {
    return null; // Loading
  }

  if (pendingRatings.length === 0) {
    return null; // No pending ratings
  }

  return (
    <>
      <Card className="border-yellow-200 bg-yellow-50/50 py-4 gap-3">
        <CardHeader className="px-4 md:px-6 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            {t("pendingTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <p className="text-sm text-muted-foreground mb-2">
            {t("pendingDesc", { count: pendingRatings.length })}
          </p>
          <div className="flex flex-col gap-2">
            {pendingRatings.map((pending) => (
              <div
                key={pending.claimId}
                className="flex items-center justify-between gap-2 p-2 bg-white rounded-md border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {pending.itemImageUrl && (
                    <CloudinaryImage
                      src={pending.itemImageUrl}
                      alt={pending.itemName}
                      width={40}
                      height={40}
                      sizes="40px"
                      className="rounded"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {pending.itemName}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {pending.targetRole === "lender"
                          ? t("asLender")
                          : t("asBorrower")}
                      </Badge>
                      {pending.targetUserName && (
                        <span className="text-xs text-muted-foreground">
                          {t("with", { name: pending.targetUserName })}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(pending.startDate), "MMM d")} -{" "}
                        {format(new Date(pending.endDate), "MMM d")}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSelectedClaim({
                      claimId: pending.claimId,
                      targetRole: pending.targetRole,
                      itemName: pending.itemName,
                    })
                  }
                >
                  {t("rate")}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={selectedClaim !== null}
        onOpenChange={() => setSelectedClaim(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("leaveRating")}</DialogTitle>
          </DialogHeader>
          {selectedClaim && (
            <RatingForm
              claimId={selectedClaim.claimId}
              targetRole={selectedClaim.targetRole}
              itemName={selectedClaim.itemName}
              onSuccess={() => setSelectedClaim(null)}
              onCancel={() => setSelectedClaim(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
