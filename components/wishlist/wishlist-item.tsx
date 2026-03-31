"use client";

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useCloudinaryUpload } from "@imaxis/cloudinary-convex/react";
import { toCloudinaryRef, type CloudinaryRef } from "@/lib/cloudinary-ref";
import { useMutation } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
	ArrowBigUp,
	CheckCircle2,
	ImageIcon,
	Pencil,
	UploadCloudIcon,
	X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CloudinaryImage } from "@/components/cloudinary-image";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/image-constants";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { enUS, vi } from "date-fns/locale";

interface WishlistItemProps {
	item: Doc<"wishlist"> & {
		matchCount: number;
		isLiked: boolean;
		images: (
			| { source: "cloudinary"; publicId: string; url: string }
			| { source: "storage"; storageId: string; url: string }
		)[];
		isOwner: boolean;
	};
	compact?: boolean;
}

export function WishlistItem({ item, compact }: WishlistItemProps) {
	const toggleVote = useMutation(api.wishlist.toggleVote);
	const updateWishlist = useMutation(api.wishlist.update);
	const { upload: uploadToCloudinary } = useCloudinaryUpload(
		api.cloudinary.upload,
	);
	const query = encodeURIComponent(item.text.trim());
	const cloudImages = item.images.filter(
		(
			img,
		): img is Extract<(typeof item.images)[number], { source: "cloudinary" }> =>
			img.source === "cloudinary",
	);
	const t = useTranslations("Wishlist");
	const locale = useLocale();
	const dateLocale = locale === "vi" ? vi : enUS;

	const [isEditOpen, setIsEditOpen] = useState(false);
	const [editText, setEditText] = useState(item.text);
	const [editFiles, setEditFiles] = useState<File[]>([]);
	const [existingImages, setExistingImages] = useState(
		item.images.filter(
			(
				img,
			): img is Extract<
				(typeof item.images)[number],
				{ source: "cloudinary" }
			> => img.source === "cloudinary",
		),
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [previewImage, setPreviewImage] = useState<string | null>(null);

	const imageKey = (img: { source: "cloudinary"; publicId: string }): string =>
		img.publicId;

	const handleVote = async () => {
		try {
			await toggleVote({ id: item._id });
		} catch {
			toast.error(t("item.failedVote"));
		}
	};

	const handleEditOpen = () => {
		setEditText(item.text);
		setExistingImages(
			item.images.filter(
				(
					img,
				): img is Extract<
					(typeof item.images)[number],
					{ source: "cloudinary" }
				> => img.source === "cloudinary",
			),
		);
		setEditFiles([]);
		setIsEditOpen(true);
	};

	const handleEditSave = async () => {
		const trimmed = editText.trim();
		if (!trimmed) return;

		setIsSubmitting(true);
		try {
			// Upload new files to Cloudinary
			const newCloudinary: CloudinaryRef[] = [];
			for (const file of editFiles) {
				const result = (await uploadToCloudinary(file, {
					folder: "wishlist",
					tags: ["wishlist"],
				})) as unknown;
				newCloudinary.push(toCloudinaryRef(result));
			}

			const existingCloudinary = existingImages.map((img) => ({
				publicId: img.publicId,
				secureUrl: img.url,
			}));

			const imageCloudinary = [...existingCloudinary, ...newCloudinary];

			await updateWishlist({
				id: item._id,
				text: trimmed,
				imageCloudinary:
					imageCloudinary.length > 0 ? imageCloudinary : undefined,
			});

			setIsEditOpen(false);
			toast.success(t("item.updated"));
		} catch (error) {
			toast.error(t("item.failedUpdate", { error: (error as Error).message }));
		} finally {
			setIsSubmitting(false);
		}
	};

	const removeExistingImage = (imageId: string) => {
		setExistingImages((prev) =>
			prev.filter((img) => imageKey(img) !== imageId),
		);
	};

	return (
		<>
			<Card className="w-full gap-0 py-2 overflow-hidden">
				<div className="flex items-center gap-2 sm:gap-3 px-4">
					{/* Image thumbnail */}
					{cloudImages.length > 0 && (
						<button
							type="button"
							onClick={() => setPreviewImage(cloudImages[0].url)}
							className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-gray-100 hover:opacity-80 transition-opacity"
						>
							<CloudinaryImage
								src={cloudImages[0].url}
								alt=""
								fill
								sizes="40px"
								className="object-cover"
							/>
							{cloudImages.length > 1 && (
								<span className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] px-1 rounded-tl">
									+{cloudImages.length - 1}
								</span>
							)}
						</button>
					)}
					<div className="min-w-0 flex-1">
						<div className="truncate text-sm font-medium">{item.text}</div>
					</div>
					<div className="flex items-center gap-1 shrink-0">
						{item.matchCount > 0 && (
							<Link
								href={`/?q=${query}`}
								className="hidden sm:inline-flex items-center gap-1 rounded-md border bg-green-50 px-2 py-1 text-xs text-green-700 transition-colors hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<CheckCircle2 className="h-3.5 w-3.5" />
								<span className="whitespace-nowrap">
									{t("item.matches", { count: item.matchCount })}
								</span>
							</Link>
						)}
						{item.isOwner && (
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								onClick={handleEditOpen}
							>
								<Pencil className="h-4 w-4" />
							</Button>
						)}
						<Button
							variant={item.isLiked ? "secondary" : "ghost"}
							size="sm"
							className={`h-8 gap-1 px-2 ${
								item.isLiked
									? "bg-orange-100 hover:bg-orange-200 text-orange-700"
									: ""
							}`}
							onClick={handleVote}
						>
							<ArrowBigUp
								className={`h-4 w-4 ${item.isLiked ? "fill-orange-700" : ""}`}
							/>
							<span className="text-xs">{item.votes.length}</span>
						</Button>
						{!compact && (
							<span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">
								{formatDistanceToNow(item.createdAt, {
									addSuffix: true,
									locale: dateLocale,
								})}
							</span>
						)}
					</div>
				</div>
			</Card>

			{/* Edit Dialog */}
			<Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{t("item.editTitle")}</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label>{t("draftCard.label")}</Label>
							<Input
								value={editText}
								onChange={(e) => setEditText(e.target.value)}
								disabled={isSubmitting}
							/>
						</div>

						{/* Existing images */}
						{existingImages.length > 0 && (
							<div className="space-y-2">
								<Label>{t("item.currentPhotos")}</Label>
								<div className="flex flex-wrap gap-2">
									{existingImages.map((img) => (
										<div
											key={imageKey(img)}
											className="group relative h-16 w-16 rounded-md overflow-hidden border"
										>
											<CloudinaryImage
												src={img.url}
												alt=""
												fill
												sizes="64px"
												className="object-cover"
											/>
											<button
												type="button"
												onClick={() => removeExistingImage(imageKey(img))}
												className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all"
											>
												<X className="h-3 w-3" />
											</button>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Add new images */}
						<div className="space-y-2">
							<Label>{t("item.addMorePhotos")}</Label>
							<FileUpload
								maxFiles={5 - existingImages.length}
								accept="image/*"
								value={editFiles}
								onValueChange={setEditFiles}
								multiple
								maxSize={MAX_IMAGE_SIZE_BYTES}
								onFileReject={(file, message) => {
									toast.error(`${message} (${file.name})`);
								}}
							>
								<FileUploadDropzone className="h-24 bg-gray-50/50 border-dashed">
									<div className="flex flex-col items-center gap-1 text-muted-foreground text-xs">
										<UploadCloudIcon className="size-6 text-muted-foreground/50" />
										<span>{t("draftCard.clickToUpload")}</span>
									</div>
								</FileUploadDropzone>
								<FileUploadList>
									{editFiles.map((file, i) => (
										<FileUploadItem key={i} value={file}>
											<FileUploadItemPreview />
											<FileUploadItemMetadata />
											<FileUploadItemDelete />
										</FileUploadItem>
									))}
								</FileUploadList>
							</FileUpload>
						</div>

						<div className="flex gap-2 justify-end">
							<Button
								variant="outline"
								onClick={() => setIsEditOpen(false)}
								disabled={isSubmitting}
							>
								{t("item.cancel")}
							</Button>
							<Button
								onClick={handleEditSave}
								disabled={isSubmitting || !editText.trim()}
							>
								{isSubmitting ? t("item.saving") : t("item.save")}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Image Preview Dialog */}
			<AlertDialog
				open={!!previewImage}
				onOpenChange={() => setPreviewImage(null)}
			>
				<AlertDialogContent className="max-w-2xl">
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							<ImageIcon className="h-4 w-4" />
							{item.text}
						</AlertDialogTitle>
					</AlertDialogHeader>
					<div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
						{cloudImages.map((img) => (
							<div
								key={imageKey(img)}
								className="relative aspect-square rounded-md overflow-hidden border"
							>
								<CloudinaryImage
									src={img.url}
									alt=""
									fill
									sizes="(max-width: 768px) 50vw, 300px"
									className="object-cover"
								/>
							</div>
						))}
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("item.close")}</AlertDialogCancel>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
