"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AvatarUpload } from "@/components/avatar-upload";
import { Loader2, MessageCircle, Phone, Facebook } from "lucide-react";
import { toast } from "sonner";
import type { CloudinaryRef } from "@/lib/cloudinary-ref";
import { useTranslations } from "next-intl";

type DigestFrequency = "daily" | "weekly" | "off";

interface ProfileFormProps {
  initialValues?: {
    name?: string | null;
    avatarUrl?: string | null;
    avatarCloudinary?: CloudinaryRef;
    address?: string | null;
    bio?: string | null;
    contacts?: {
      telegram?: string;
      whatsapp?: string;
      facebook?: string;
      phone?: string;
    } | null;
    digestFrequency?: DigestFrequency | null;
  };
  onSuccess?: () => void;
}

export function ProfileForm({ initialValues, onSuccess }: ProfileFormProps) {
  const [name, setName] = useState(initialValues?.name || "");
  const [address, setAddress] = useState(initialValues?.address || "");
  const [bio, setBio] = useState(initialValues?.bio || "");
  const [telegram, setTelegram] = useState(
    initialValues?.contacts?.telegram || "",
  );
  const [whatsapp, setWhatsapp] = useState(
    initialValues?.contacts?.whatsapp || "",
  );
  const [facebook, setFacebook] = useState(
    initialValues?.contacts?.facebook || "",
  );
  const [phone, setPhone] = useState(initialValues?.contacts?.phone || "");
  const [avatarCloudinary, setAvatarCloudinary] = useState<
    CloudinaryRef | undefined
  >(initialValues?.avatarCloudinary);
  const [digestFrequency, setDigestFrequency] = useState<DigestFrequency>(
    initialValues?.digestFrequency ?? "daily",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("Profile");

  const updateProfile = useMutation(api.users.updateProfile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const contacts = {
        telegram: telegram.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        facebook: facebook.trim() || undefined,
        phone: phone.trim() || undefined,
      };

      // Only include contacts if at least one is set
      const hasContacts = Object.values(contacts).some((v) => v);

      const payload: Parameters<typeof updateProfile>[0] = {
        name: name.trim() || undefined,
        address: address.trim() || undefined,
        bio: bio.trim() || undefined,
        contacts: hasContacts ? contacts : undefined,
        digestFrequency,
      };
      if (avatarCloudinary) {
        payload.avatarCloudinary = avatarCloudinary;
      }

      await updateProfile(payload);

      toast.success(t("toasts.updated"));
      onSuccess?.();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(t("toasts.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex justify-center">
        <AvatarUpload
          currentUrl={initialValues?.avatarUrl}
          onUpload={setAvatarCloudinary}
          size="lg"
          disabled={isSubmitting}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input
          id="name"
          type="text"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="address">{t("address")}</Label>
        <Input
          id="address"
          type="text"
          placeholder={t("addressPlaceholder")}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="bio">{t("bio")}</Label>
          <span className="text-xs text-muted-foreground">
            {bio.length}/500
          </span>
        </div>
        <Textarea
          id="bio"
          placeholder={t("bioPlaceholder")}
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 500))}
          disabled={isSubmitting}
          rows={3}
          className="resize-none"
        />
      </div>

      <div className="flex flex-col gap-4">
        <Label className="text-base">{t("contactInfo")}</Label>
        <p className="text-sm text-muted-foreground -mt-2">
          {t("contactInfoDesc")}
        </p>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 flex justify-center">
              <MessageCircle className="h-5 w-5 text-blue-500" />
            </div>
            <Input
              type="text"
              placeholder={t("telegram")}
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 flex justify-center">
              <MessageCircle className="h-5 w-5 text-green-500" />
            </div>
            <Input
              type="text"
              placeholder={t("whatsapp")}
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 flex justify-center">
              <Facebook className="h-5 w-5 text-blue-600" />
            </div>
            <Input
              type="text"
              placeholder={t("facebook")}
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 flex justify-center">
              <Phone className="h-5 w-5 text-gray-600" />
            </div>
            <Input
              type="tel"
              placeholder={t("phone")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("digestFrequency")}</Label>
        <p className="text-sm text-muted-foreground">
          {t("digestFrequencyDesc")}
        </p>
        <div className="flex gap-1 rounded-md border p-1 w-fit">
          {(["daily", "weekly", "off"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDigestFrequency(option)}
              disabled={isSubmitting}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                digestFrequency === option
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(
                option === "daily"
                  ? "digestDaily"
                  : option === "weekly"
                    ? "digestWeekly"
                    : "digestOff",
              )}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            {t("saving")}
          </>
        ) : (
          t("save")
        )}
      </Button>
    </form>
  );
}
