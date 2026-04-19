"use client";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
} from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { useCloudinaryUpload } from "@imaxis/cloudinary-convex/react";
import { toCloudinaryRef, type CloudinaryRef } from "@/lib/cloudinary-ref";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Plus, UploadCloudIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/image-constants";
import { useTranslations } from "next-intl";

type WishlistDraftCardProps = {
  autoFocus?: boolean;
  focusToken?: number;
};

export function WishlistDraftCard({
  autoFocus,
  focusToken,
}: WishlistDraftCardProps) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const t = useTranslations("Wishlist");

  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [showMatchAlert, setShowMatchAlert] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createWishlist = useMutation(api.wishlist.create);
  const items = useQuery(api.items.get);
  const { upload: uploadToCloudinary } = useCloudinaryUpload(
    api.cloudinary.upload,
  );

  useEffect(() => {
    if (autoFocus) {
      // Let the card mount before focusing.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [autoFocus]);

  useEffect(() => {
    if (typeof focusToken !== "number") return;
    if (focusToken <= 0) return;
    {
      // Let the card mount before focusing.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [focusToken]);

  const matchCount = useMemo(() => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    if (!items) return 0;
    const needle = trimmed.toLowerCase();
    return items.filter((item) => {
      const itemText = (
        item.name +
        " " +
        (item.description || "")
      ).toLowerCase();
      return itemText.includes(needle);
    }).length;
  }, [items, text]);

  const onViewItems = () => {
    const trimmed = text.trim();
    setShowMatchAlert(false);
    if (!trimmed) return;
    router.push(`/?q=${encodeURIComponent(trimmed)}`);
  };

  const doCreate = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    try {
      const imageCloudinary: CloudinaryRef[] = [];
      for (const file of files) {
        const result = (await uploadToCloudinary(file, {
          folder: "wishlist",
          tags: ["wishlist"],
        })) as unknown;
        imageCloudinary.push(toCloudinaryRef(result));
      }

      await createWishlist({
        text: trimmed,
        imageCloudinary:
          imageCloudinary.length > 0 ? imageCloudinary : undefined,
      });
      setText("");
      setFiles([]);
      setShowMatchAlert(false);
      toast.success(t("draftCard.success"));
    } catch (error) {
      toast.error(t("draftCard.failed", { error: (error as Error).message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    if (matchCount > 0) {
      setShowMatchAlert(true);
      return;
    }

    await doCreate();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t("draftCard.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={inputId}>{t("draftCard.label")}</Label>
              <Input
                ref={inputRef}
                id={inputId}
                placeholder={t("draftCard.placeholder")}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("draftCard.photoLabel")}</Label>
              <FileUpload
                maxFiles={5}
                accept="image/*"
                value={files}
                onValueChange={setFiles}
                multiple
                maxSize={MAX_IMAGE_SIZE_BYTES}
                onFileReject={(file, message) => {
                  toast.error(`${message} (${file.name})`);
                }}
              >
                <FileUploadDropzone className="h-32 bg-gray-50/50 border-dashed transition-colors hover:bg-gray-50/80 hover:border-primary/20">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
                    <UploadCloudIcon className="size-8 text-muted-foreground/50" />
                    <div className="flex flex-col items-center">
                      <span className="font-semibold text-foreground">
                        {t("draftCard.clickToUpload")}
                      </span>
                      <span>{t("draftCard.dragAndDrop")}</span>
                      <span className="text-xs text-muted-foreground/75">
                        {t("draftCard.uploadLimit")}
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
            </div>

            {matchCount > 0 ? (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                <span>{t("draftCard.matchFound", { count: matchCount })}</span>
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isSubmitting || !text.trim()}
                className="flex-1"
              >
                {t("draftCard.addRequest")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || !text.trim()}
                onClick={onViewItems}
              >
                {t("draftCard.searchItems")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <AlertDialog open={showMatchAlert} onOpenChange={setShowMatchAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("alerts.similarTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("alerts.similarDesc", { count: matchCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onViewItems}>
              {t("alerts.viewItems")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={doCreate}>
              {t("alerts.postAnyway")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
