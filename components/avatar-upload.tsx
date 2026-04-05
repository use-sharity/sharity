"use client";

import { useState, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { useCloudinaryUpload } from "@imaxis/cloudinary-convex/react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toCloudinaryRef, type CloudinaryRef } from "@/lib/cloudinary-ref";
import { CloudinaryImage } from "@/components/cloudinary-image";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/image-constants";

interface AvatarUploadProps {
  currentUrl?: string | null;
  onUpload: (avatar: CloudinaryRef) => void;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const sizeClasses = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
};

export function AvatarUpload({
  currentUrl,
  onUpload,
  size = "md",
  disabled = false,
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload: uploadToCloudinary } = useCloudinaryUpload(
    api.cloudinary.upload,
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size against global image limit
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const maxMb = Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024));
      toast.error(`Image is too large (max ${maxMb} MB)`);
      return;
    }

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setIsUploading(true);

    try {
      const result = (await uploadToCloudinary(file, {
        folder: "avatars",
        tags: ["avatars"],
      })) as unknown;
      onUpload(toCloudinaryRef(result));
      toast.success("Avatar uploaded");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload avatar");
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const displayUrl = previewUrl || currentUrl;
  const isCloudinaryUrl = displayUrl
    ? displayUrl.includes("res.cloudinary.com") &&
      displayUrl.includes("/image/upload/")
    : false;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "relative rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200",
          sizeClasses[size],
        )}
      >
        {displayUrl ? (
          previewUrl || !isCloudinaryUrl ? (
            // Local preview URLs (blob:) and non-Cloudinary URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <CloudinaryImage
              src={displayUrl}
              alt="Avatar"
              fill
              sizes="128px"
              className="object-cover"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="h-1/2 w-1/2 text-gray-400" />
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading}
      >
        <Camera className="h-4 w-4 mr-1" />
        {currentUrl || previewUrl ? "Change" : "Upload"}
      </Button>
    </div>
  );
}
