"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { ItemImageCarousel } from "@/components/item-image-carousel";
import { ItemMetaRow } from "@/components/item-meta-row";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserLink } from "@/components/user-link";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Link, useRouter } from "@/i18n/routing";
import type { ItemCategory } from "@/lib/constants";

export interface DiscoveryCardItem extends Doc<"items"> {
  imageUrls?: string[];
  category?: ItemCategory;
  location?: { lat: number; lng: number; address?: string; ward?: string };
  isRequested?: boolean;
  isOwn?: boolean;
  owner?: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

interface DiscoveryCardProps {
  item: DiscoveryCardItem;
}

export function DiscoveryCard({ item }: DiscoveryCardProps) {
  const t = useTranslations("DiscoveryCard");
  const tCategories = useTranslations("Categories");
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const startConversation = useMutation(api.messaging.startConversation);

  const handleMessageOwner = async () => {
    const conversationId = await startConversation({
      otherUserId: item.ownerId,
      itemId: item._id,
    });
    router.push(`/chat/${conversationId}`);
  };

  const claimLabel = item.isOwn
    ? t("yourItem")
    : item.isRequested
      ? t("manageRequest")
      : t("claim");

  return (
    <Card className="gap-3 py-7">
      <CardHeader className="gap-3">
        {item.imageUrls && item.imageUrls.length > 0 && (
          <ItemImageCarousel
            imageUrls={item.imageUrls}
            name={item.name}
            aspectRatio="video"
            sizes="(max-width: 768px) 100vw, 672px"
          />
        )}
        <div className="flex justify-between items-start">
          <CardTitle>
            <Link href={`/item/${item._id}`} className="hover:underline">
              {item.name}
            </Link>
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent>
        <ItemMetaRow
          giveaway={item.giveaway ?? false}
          category={item.category}
          location={item.location}
          compact={false}
          giveawayLabel={t("giveaway")}
          loanLabel={t("loan")}
          categoryLabel={item.category ? tCategories(item.category) : undefined}
          locationLabel={t("locationAvailable")}
        />
        {item.description && (
          <p className="text-gray-600 line-clamp-2">{item.description}</p>
        )}
      </CardContent>

      <CardFooter>
        <div className="flex justify-between items-center w-full">
          <UserLink
            userId={item.ownerId}
            size="sm"
            initialUserInfo={item.owner}
          />
          <div className="flex items-center gap-2">
            {isSignedIn && !item.isOwn && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMessageOwner}
                className="gap-1"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {t("messageOwner")}
              </Button>
            )}
            <Button
              variant={item.isOwn ? "outline" : "default"}
              size="sm"
              asChild
            >
              <Link href={`/item/${item._id}`}>{claimLabel}</Link>
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
