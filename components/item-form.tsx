"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useCloudinaryUpload } from "@imaxis/cloudinary-convex/react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Id } from "@/convex/_generated/dataModel";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadList,
  FileUploadItemPreview,
  FileUploadItemMetadata,
  FileUploadItemDelete,
} from "@/components/ui/file-upload";
import {
  UploadCloudIcon,
  X,
  MapPin,
  Loader2,
  Map,
  ListChecks,
} from "lucide-react";
import { CloudinaryImage } from "@/components/cloudinary-image";
import {
  LocationPickerDialog,
  type LocationPickerValue,
} from "./location-picker-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslations } from "next-intl";

import { type ItemCategory, ITEM_CATEGORIES } from "@/lib/constants";

export interface Location {
  lat: number;
  lng: number;
  address?: string;
  ward?: string;
}
import { toast } from "sonner";
import { toCloudinaryRef, type CloudinaryRef } from "@/lib/cloudinary-ref";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/image-constants";

export type MediaImage =
  | { source: "cloudinary"; publicId: string; url: string }
  | { source: "storage"; storageId: Id<"_storage">; url: string };

type CloudinaryMediaImage = Extract<MediaImage, { source: "cloudinary" }>;

interface ItemFormProps {
  initialValues?: {
    name: string;
    description: string;
    images?: MediaImage[];
    category?: ItemCategory;
    location?: Location;
    giveaway?: boolean;
    minLeaseDays?: number;
    maxLeaseDays?: number;
  };
  onSubmit: (values: {
    name: string;
    description: string;
    imageStorageIds?: Id<"_storage">[];
    imageCloudinary?: CloudinaryRef[];
    category?: ItemCategory;
    location?: Location;
    giveaway?: boolean;
    minLeaseDays?: number;
    maxLeaseDays?: number;
  }) => Promise<void>;
  submitLabel?: string;
  enableModeSwitch?: boolean;
  hideMyItemsLink?: boolean;
  footerActions?: React.ReactNode;
}

export function ItemForm({
  initialValues,
  onSubmit,
  submitLabel = "Submit",
  enableModeSwitch = false,
  hideMyItemsLink = false,
  footerActions,
}: ItemFormProps) {
  const t = useTranslations("ItemForm");
  const tCategories = useTranslations("Categories");
  const [name, setName] = useState(initialValues?.name || "");
  const [description, setDescription] = useState(
    initialValues?.description || "",
  );
  const isEditMode = !!initialValues;
  const [persistedGiveaway, setPersistedGiveaway] = useLocalStorage<boolean>(
    "item-form-giveaway-mode",
    false,
  );

  const [giveaway, setGiveaway] = useState(
    isEditMode ? Boolean(initialValues.giveaway) : false,
  );

  useEffect(() => {
    if (!isEditMode) {
      setGiveaway(persistedGiveaway);
    }
  }, [persistedGiveaway, isEditMode]);
  const [minLeaseDays, setMinLeaseDays] = useState(() => {
    if (Boolean(initialValues?.giveaway)) return "";
    return typeof initialValues?.minLeaseDays === "number"
      ? String(initialValues.minLeaseDays)
      : "";
  });
  const [maxLeaseDays, setMaxLeaseDays] = useState(() => {
    if (Boolean(initialValues?.giveaway)) return "";
    return typeof initialValues?.maxLeaseDays === "number"
      ? String(initialValues.maxLeaseDays)
      : "";
  });
  const [pendingGiveaway, setPendingGiveaway] = useState<boolean | null>(null);
  const [isModeConfirmOpen, setIsModeConfirmOpen] = useState(false);
  const [category, setCategory] = useState<ItemCategory | undefined>(
    initialValues?.category,
  );
  const [location, setLocation] = useState<Location | undefined>(
    initialValues?.location,
  );
  const [address, setAddress] = useState(
    initialValues?.location?.address || "",
  );
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);

  const [existingImages, setExistingImages] = useState<CloudinaryMediaImage[]>(
    (initialValues?.images ?? []).filter(
      (img): img is CloudinaryMediaImage => img.source === "cloudinary",
    ),
  );

  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const notifications = useQuery(api.notifications.get);
  const { upload: uploadToCloudinary } = useCloudinaryUpload(
    api.cloudinary.upload,
  );

  const hasMyItemsStatus = (notifications ?? []).some(
    (n) => n.type === "new_request" && n.claim?.status === "pending",
  );

  const imageKey = (img: CloudinaryMediaImage): string => img.publicId;

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t("validation.geolocationNotSupported"));
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: address || undefined,
        });
        setIsGettingLocation(false);
        toast.success(t("validation.locationCaptured"));
      },
      (error) => {
        setIsGettingLocation(false);
        toast.error(t("validation.locationError", { error: error.message }));
      },
    );
  };

  const handleLocationSelect = (loc: LocationPickerValue) => {
    setLocation({
      lat: loc.lat,
      lng: loc.lng,
      address: loc.address,
      ward: loc.ward,
    });
    setAddress(loc.address || "");
    toast.success(t("validation.locationSelected"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setIsSubmitting(true);

    try {
      const parseOptionalDays = (
        label: string,
        raw: string,
      ): number | undefined => {
        const trimmed = raw.trim();
        if (trimmed.length === 0) return undefined;

        const n = Number(trimmed);
        if (!Number.isFinite(n) || !Number.isInteger(n)) {
          throw new Error(t("validation.mustBeInteger", { label }));
        }
        if (n < 1) {
          throw new Error(t("validation.mustBeAtLeastOne", { label }));
        }
        return n;
      };

      const minLeaseDaysValue = giveaway
        ? undefined
        : parseOptionalDays("Min lease length", minLeaseDays);
      const maxLeaseDaysValue = giveaway
        ? undefined
        : parseOptionalDays("Max lease length", maxLeaseDays);

      if (
        minLeaseDaysValue !== undefined &&
        maxLeaseDaysValue !== undefined &&
        minLeaseDaysValue > maxLeaseDaysValue
      ) {
        throw new Error(t("validation.minMaxError"));
      }

      // 1. Upload new files to Cloudinary
      const newCloudinary: CloudinaryRef[] = [];
      for (const file of files) {
        const result = (await uploadToCloudinary(file, {
          folder: "items",
          tags: ["items"],
        })) as unknown;
        newCloudinary.push(toCloudinaryRef(result));
      }

      // 2. Keep existing Cloudinary images
      const existingCloudinary = existingImages.map((img) => ({
        publicId: img.publicId,
        secureUrl: img.url,
      }));

      const finalCloudinary = [...existingCloudinary, ...newCloudinary];

      // Build location with address if coordinates exist
      const finalLocation = location
        ? { ...location, address: address || undefined }
        : undefined;

      await onSubmit({
        name,
        description,
        imageCloudinary:
          finalCloudinary.length > 0 ? finalCloudinary : undefined,
        category,
        location: finalLocation,
        giveaway: enableModeSwitch ? giveaway : undefined,
        minLeaseDays: minLeaseDaysValue,
        maxLeaseDays: maxLeaseDaysValue,
      });

      if (!initialValues) {
        setName("");
        setDescription("");
        setExistingImages([]);
        setFiles([]);
        setCategory(undefined);
        setLocation(undefined);
        setAddress("");
        setMinLeaseDays("");
        setMaxLeaseDays("");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingSlots = 5 - existingImages.length;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 min-w-0">
      {enableModeSwitch ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <Label htmlFor="giveaway-mode">{t("giveawayMode")}</Label>
              <div className="text-xs text-muted-foreground">
                {t("giveawayDesc")}
              </div>
            </div>
            <Switch
              id="giveaway-mode"
              checked={giveaway}
              disabled={isSubmitting}
              onCheckedChange={(next) => {
                setPendingGiveaway(next);
                setIsModeConfirmOpen(true);
              }}
            />
          </div>

          <AlertDialog
            open={isModeConfirmOpen}
            onOpenChange={(open) => {
              setIsModeConfirmOpen(open);
              if (!open) setPendingGiveaway(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("switchMode.title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("switchMode.description")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("switchMode.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (pendingGiveaway === null) return;
                    setGiveaway(pendingGiveaway);
                    if (!isEditMode) {
                      setPersistedGiveaway(pendingGiveaway);
                    }
                    if (pendingGiveaway) {
                      setMinLeaseDays("");
                      setMaxLeaseDays("");
                    }
                    setPendingGiveaway(null);
                    setIsModeConfirmOpen(false);
                  }}
                >
                  {t("switchMode.confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("itemName")}</Label>
        <Input
          id="name"
          type="text"
          placeholder={t("itemNamePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="desc">{t("description")}</Label>
        <Input
          id="desc"
          type="text"
          placeholder={t("descriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      {giveaway ? (
        <div className="text-xs text-muted-foreground">
          {t("giveawaylimitDesc")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label>{t("leaseLengthLimits")}</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="min-lease-days" className="text-xs">
                {t("minLeaseDays")}
              </Label>
              <Input
                id="min-lease-days"
                type="number"
                step={1}
                min={1}
                placeholder={t("minLeaseDaysPlaceholder")}
                value={minLeaseDays}
                onChange={(e) => setMinLeaseDays(e.target.value)}
                disabled={isSubmitting}
                inputMode="numeric"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="max-lease-days" className="text-xs">
                {t("maxLeaseDays")}
              </Label>
              <Input
                id="max-lease-days"
                type="number"
                step={1}
                min={1}
                placeholder={t("maxLeaseDaysPlaceholder")}
                value={maxLeaseDays}
                onChange={(e) => setMaxLeaseDays(e.target.value)}
                disabled={isSubmitting}
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {t("sameDayNote")}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">{t("category")}</Label>
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as ItemCategory)}
          disabled={isSubmitting}
        >
          <SelectTrigger id="category">
            <SelectValue placeholder={t("selectCategory")} />
          </SelectTrigger>
          <SelectContent>
            {ITEM_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {tCategories(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("location")}</Label>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder={t("addressPlaceholder")}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isSubmitting}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsLocationDialogOpen(true)}
            disabled={isSubmitting}
            title={t("pickOnMap")}
          >
            <Map className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleGetLocation}
            disabled={isSubmitting || isGettingLocation}
            title={t("getCurrentLocation")}
          >
            {isGettingLocation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
          </Button>
        </div>
        {location && (
          <p className="text-xs text-muted-foreground">
            📍 {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </p>
        )}
        <LocationPickerDialog
          open={isLocationDialogOpen}
          onOpenChange={setIsLocationDialogOpen}
          value={location}
          onSelect={handleLocationSelect}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("imagesLabel")}</Label>

        {/* Existing Images List */}
        {existingImages.length > 0 && (
          <div className="grid grid-cols-5 gap-2 mb-2">
            {existingImages.map((img) => (
              <div key={imageKey(img)} className="relative group aspect-square">
                <div className="relative w-full h-full">
                  <CloudinaryImage
                    src={img.url}
                    alt="Item"
                    fill
                    sizes="96px"
                    className="rounded-md border object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setExistingImages((prev) =>
                      prev.filter((p) => imageKey(p) !== imageKey(img)),
                    )
                  }
                  className="absolute top-1 right-1 bg-black/50 hover:bg-red-600 text-white p-1 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* File Upload Area */}
        {remainingSlots > 0 ? (
          <FileUpload
            maxFiles={remainingSlots}
            accept="image/*"
            value={files}
            onValueChange={setFiles}
            multiple={remainingSlots > 1}
            maxSize={MAX_IMAGE_SIZE_BYTES}
            onFileReject={(file, message) => {
              toast.error(
                t("validation.fileReject", { message, fileName: file.name }),
              );
            }}
            // Removed onUpload to disable auto-upload
          >
            <FileUploadDropzone className="h-32 bg-gray-50/50 border-dashed transition-colors hover:bg-gray-50/80 hover:border-primary/20">
              <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
                <UploadCloudIcon className="size-8 text-muted-foreground/50" />
                <div className="flex flex-col items-center">
                  <span className="font-semibold text-foreground">
                    {t("clickToUpload")}
                  </span>
                  <span>{t("dragAndDrop")}</span>
                  <span className="text-xs text-muted-foreground/75">
                    {existingImages.length > 0
                      ? t("uploadingExample", {
                          count: remainingSlots,
                          s: remainingSlots !== 1 ? "s" : "",
                        })
                      : t("uploadLimit")}
                  </span>
                </div>
              </div>
            </FileUploadDropzone>
            <FileUploadList>
              {files.map((file, i) => (
                <FileUploadItem key={i} value={file}>
                  <FileUploadItemPreview />
                  <FileUploadItemMetadata />
                  <FileUploadItemDelete />
                </FileUploadItem>
              ))}
            </FileUploadList>
          </FileUpload>
        ) : (
          <div className="p-4 border border-dashed rounded-md bg-gray-50 text-center text-sm text-gray-500">
            {t("uploadLimitReached")}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">{footerActions}</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? t("uploadingSaving") : submitLabel}
          </Button>
          {!hideMyItemsLink && (
            <Button
              asChild
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
            >
              <Link href="/my-items" className="relative">
                <ListChecks className="h-4 w-4" />
                {t("myItems")}
                {hasMyItemsStatus ? (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-background" />
                ) : null}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
