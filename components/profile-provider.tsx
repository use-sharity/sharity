"use client";

import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProfileForm } from "@/components/profile-form";
import { useTranslations } from "next-intl";

interface ProfileProviderProps {
  children: React.ReactNode;
}

export function ProfileProvider({ children }: ProfileProviderProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const profile = useQuery(api.users.getMyProfile, isSignedIn ? {} : "skip");
  const [dismissed, setDismissed] = useState(false);
  const t = useTranslations("ProfileSetup");

  const needsProfile =
    isLoaded &&
    isSignedIn &&
    profile !== undefined &&
    profile?.hasProfile === false;

  const showSetupModal = needsProfile && !dismissed;

  const handleClose = () => setDismissed(true);

  return (
    <>
      {children}
      {profile && profile.clerkData && (
        <Dialog
          open={showSetupModal}
          onOpenChange={(open) => {
            if (!open) handleClose();
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            <ProfileForm
              initialValues={{
                name: profile.clerkData.name,
                avatarUrl: profile.clerkData.avatarUrl,
              }}
              onSuccess={handleClose}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
