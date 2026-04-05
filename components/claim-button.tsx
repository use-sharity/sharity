"use client";

import { Button } from "@/components/ui/button";
import { Doc } from "../convex/_generated/dataModel";
import { useAuth } from "@clerk/nextjs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useItemCard } from "./item-card";
import { useTranslations } from "next-intl";

interface ClaimButtonProps {
  item: Doc<"items"> & { isRequested?: boolean };
}

export function ClaimButton({ item }: ClaimButtonProps) {
  const { isSignedIn } = useAuth();
  const t = useTranslations("ClaimButton");
  // useItemCard must be called unconditionally at the top level
  const { flipToBack } = useItemCard();
  // requestItem and availability moved to ClaimItemBack
  // state moved to ClaimItemBack

  if (item.isRequested) {
    return (
      <Button variant="secondary" onClick={flipToBack}>
        {t("manageRequest")}
      </Button>
    );
  }

  // This check relies on the parent query adding `isOwner` or similar check,
  // checking strictly via auth might be safer but `isRequested` covers the "already interacted" case.
  // If the user IS the owner, calling this might fail on backend, but UI wise we might want to hide it
  // or rely on `item.ownerId === userId` check if we had userId.
  // For now, if unsigned in, we show sign in tooltip.

  if (!isSignedIn) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="inline-flex cursor-default">
              <Button disabled className="opacity-50">
                {t("claim")}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t("signInTooltip")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Calculate disabled dates
  // Moved to ClaimItemBack

  // If not signed in, show tooltip (existing logic)
  // ... (Wait, I need to keep the early return for not signed in)

  // Actually, let's just rewrite the component body.

  // NOTE: The previous code handled `item.isRequested` check. Keeping it.

  return <Button onClick={flipToBack}>{t("claim")}</Button>;
}
