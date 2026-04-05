"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import { type LucideIcon, UploadCloudIcon } from "lucide-react";
import { useCloudinaryUpload } from "@imaxis/cloudinary-convex/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
} from "@/components/ui/file-upload";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { toCloudinaryRef, type CloudinaryRef } from "@/lib/cloudinary-ref";
import { toast } from "sonner";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/image-constants";

import type { MutationResult } from "./lease-claim-types";

type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ButtonSize = ComponentProps<typeof Button>["size"];

type NoteConfig = {
  id: string;
  label: string;
  placeholder: string;
  rows: number;
};

type PhotoConfig = {
  label: string;
  maxFiles: number;
  accept: string;
  folder: string;
};

type ActionPayload = {
  note?: string;
  photoCloudinary?: CloudinaryRef[];
};

type BaseDialogProps = {
  title: string;
  description?: string;
  triggerLabel: string;
  triggerIcon?: LucideIcon;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerClassName?: string;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  cancelLabel: string;
  noteConfig?: NoteConfig;
  disabled?: boolean;
  onConfirm: (payload: ActionPayload) => MutationResult;
  onBusyChange?: (busy: boolean) => void;
};

type DialogWithPhotos = BaseDialogProps & {
  photoConfig: PhotoConfig;
};

type DialogWithoutPhotos = BaseDialogProps & {
  photoConfig?: undefined;
};

type LeaseActionDialogProps = DialogWithPhotos | DialogWithoutPhotos;

/**
 * Shared dialog for lease actions with optional notes and photos.
 */
export function LeaseActionDialog(props: LeaseActionDialogProps) {
  const {
    title,
    description,
    triggerLabel,
    triggerIcon: TriggerIcon,
    triggerVariant,
    triggerSize,
    triggerClassName,
    confirmLabel,
    confirmVariant,
    cancelLabel,
    noteConfig,
    disabled,
    onConfirm,
    onBusyChange,
  } = props;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const isDisabled = Boolean(disabled);
  const hasPhotos = props.photoConfig !== undefined;
  const { upload: uploadToCloudinary } = useCloudinaryUpload(
    api.cloudinary.upload,
  );
  const t = useTranslations("LeaseAction");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size={triggerSize}
          variant={triggerVariant}
          className={triggerClassName}
          disabled={isDisabled}
        >
          {TriggerIcon ? <TriggerIcon className="h-3.5 w-3.5 mr-1.5" /> : null}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className={hasPhotos ? "max-w-lg" : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="space-y-4">
          {noteConfig ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={noteConfig.id}>{noteConfig.label}</Label>
              <Textarea
                id={noteConfig.id}
                placeholder={noteConfig.placeholder}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={noteConfig.rows}
              />
            </div>
          ) : null}
          {hasPhotos ? (
            <div className="flex flex-col gap-2">
              <Label>{props.photoConfig.label}</Label>
              <FileUpload
                maxFiles={props.photoConfig.maxFiles}
                accept={props.photoConfig.accept}
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
                        {t("clickToUpload")}
                      </span>
                      <span>{t("dragAndDrop")}</span>
                      <span className="text-xs text-muted-foreground/75">
                        {t("uploadLimit", {
                          count: props.photoConfig.maxFiles,
                        })}
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
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSaving}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            disabled={isSaving}
            onClick={async () => {
              setIsSaving(true);
              onBusyChange?.(true);
              try {
                let photoCloudinary: CloudinaryRef[] | undefined;
                if (hasPhotos && files.length > 0) {
                  const uploaded: CloudinaryRef[] = [];
                  for (const file of files) {
                    const result = (await uploadToCloudinary(file, {
                      folder: props.photoConfig.folder,
                      tags: ["leases"],
                    })) as unknown;
                    uploaded.push(toCloudinaryRef(result));
                  }
                  photoCloudinary = uploaded;
                }
                await onConfirm({
                  note: note || undefined,
                  photoCloudinary,
                });
                setFiles([]);
                setNote("");
                setOpen(false);
              } finally {
                setIsSaving(false);
                onBusyChange?.(false);
              }
            }}
          >
            {isSaving ? `${confirmLabel}...` : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
