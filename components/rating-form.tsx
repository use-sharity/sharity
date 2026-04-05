"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCloudinaryUpload } from "@imaxis/cloudinary-convex/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadList,
  FileUploadItemPreview,
  FileUploadItemMetadata,
  FileUploadItemDelete,
} from "@/components/ui/file-upload";
import { UploadCloudIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toCloudinaryRef, type CloudinaryRef } from "@/lib/cloudinary-ref";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/image-constants";
import { useTranslations } from "next-intl";

interface RatingFormProps {
  claimId: Id<"claims">;
  targetRole: "lender" | "borrower";
  itemName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function RatingForm({
  claimId,
  targetRole,
  itemName,
  onSuccess,
  onCancel,
}: RatingFormProps) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("Ratings");

  const createRating = useMutation(api.ratings.createRating);
  const { upload: uploadToCloudinary } = useCloudinaryUpload(
    api.cloudinary.upload,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (stars === 0) {
      toast.error(t("form.selectRating"));
      return;
    }

    setIsSubmitting(true);

    try {
      const photoCloudinary: CloudinaryRef[] = [];
      for (const file of files) {
        const result = (await uploadToCloudinary(file, {
          folder: "ratings",
          tags: ["ratings"],
        })) as unknown;
        photoCloudinary.push(toCloudinaryRef(result));
      }

      await createRating({
        claimId,
        stars,
        comment: comment.trim() || undefined,
        photoCloudinary:
          photoCloudinary.length > 0 ? photoCloudinary : undefined,
      });

      toast.success(t("form.success"));
      onSuccess?.();
    } catch (error) {
      console.error("Error submitting rating:", error);
      toast.error(t("form.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="text-sm text-muted-foreground">
        {t("form.title", {
          role: targetRole === "lender" ? t("lender") : t("borrower"),
          item: itemName,
        })}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("form.ratingLabel")}</Label>
        <StarRating value={stars} onChange={setStars} size="lg" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="comment">{t("form.commentLabel")}</Label>
        <Textarea
          id="comment"
          placeholder={t("form.commentPlaceholder")}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={isSubmitting}
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("form.photoLabel")}</Label>
        <FileUpload
          maxFiles={3}
          accept="image/*"
          value={files}
          onValueChange={setFiles}
          multiple
          maxSize={MAX_IMAGE_SIZE_BYTES}
          onFileReject={(file, message) => {
            toast.error(`${message} (${file.name})`);
          }}
        >
          <FileUploadDropzone className="h-24 bg-gray-50/50 border-dashed">
            <div className="flex flex-col items-center gap-1 text-muted-foreground text-xs">
              <UploadCloudIcon className="size-6 text-muted-foreground/50" />
              <span>{t("form.photoHelp")}</span>
            </div>
          </FileUploadDropzone>
          <FileUploadList>
            {files.map((file, i) => (
              <FileUploadItem key={i} value={file}>
                <FileUploadItemPreview />
                <FileUploadItemMetadata size="sm" />
                <FileUploadItemDelete />
              </FileUploadItem>
            ))}
          </FileUploadList>
        </FileUpload>
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {t("form.cancel")}
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting || stars === 0}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {t("form.submitting")}
            </>
          ) : (
            t("form.submit")
          )}
        </Button>
      </div>
    </form>
  );
}
