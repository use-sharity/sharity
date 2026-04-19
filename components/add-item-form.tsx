"use client";

import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { trackItemListed } from "@/lib/posthog/events";
import { ItemForm } from "./item-form";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";

interface AddItemFormProps {
  hideMyItemsLink?: boolean;
  onSuccess?: (itemId?: string) => void;
}

export function AddItemForm({
  hideMyItemsLink = false,
  onSuccess,
}: AddItemFormProps = {}) {
  const createItem = useMutation(api.items.create);
  const t = useTranslations("AddItemForm");

  return (
    <>
      <SignedIn>
        <ItemForm
          onSubmit={async (values) => {
            const itemId = await createItem(values);
            trackItemListed({
              item_id: itemId,
              has_images: (values.imageCloudinary?.length ?? 0) > 0,
              mode: values.giveaway ? "giveaway" : "lease",
            });
            onSuccess?.(itemId);
          }}
          submitLabel={t("submit")}
          enableModeSwitch
          hideMyItemsLink={hideMyItemsLink}
        />
      </SignedIn>
      <SignedOut>
        <Card className="bg-gray-50 border-dashed">
          <CardHeader>
            <CardTitle className="text-center text-gray-500">
              {t("signInTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <SignInButton mode="modal">
              <Button variant="outline">{t("signIn")}</Button>
            </SignInButton>
          </CardContent>
        </Card>
      </SignedOut>
    </>
  );
}
