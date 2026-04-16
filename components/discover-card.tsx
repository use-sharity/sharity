"use client";

import { Doc } from "../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { type ItemCategory } from "@/lib/constants";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import {
	CloudinaryImage,
	isCloudinaryImageUrl,
} from "@/components/cloudinary-image";
import { cn } from "@/lib/utils";

interface DiscoverCardProps {
	item: Doc<"items"> & {
		imageUrls?: string[];
		category?: ItemCategory;
		location?: { lat: number; lng: number; address?: string; ward?: string };
	};
	imagePriority?: boolean;
	className?: string;
}

export function DiscoverCard({
	item,
	imagePriority = false,
	className,
}: DiscoverCardProps) {
	const t = useTranslations("ItemCard");
	const tCategories = useTranslations("Categories");
	const imageUrls = (item.imageUrls ?? []).filter(isCloudinaryImageUrl);
	const heroImage = imageUrls[0];

	return (
		<div
			className={cn(
				"relative w-full h-full overflow-hidden rounded-2xl bg-muted shadow-xl border border-border/40 select-none",
				className,
			)}
		>
			{heroImage ? (
				<CloudinaryImage
					src={heroImage}
					alt={item.name}
					fill
					sizes="(max-width: 768px) 100vw, 480px"
					className="object-cover pointer-events-none"
					priority={imagePriority}
				/>
			) : (
				<div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted to-muted/50">
					<span className="text-sm">No image</span>
				</div>
			)}

			<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-5 pt-16 text-white pointer-events-none">
				<div className="flex items-center gap-2 flex-wrap mb-2">
					{item.giveaway ? (
						<Badge className="bg-emerald-500/90 hover:bg-emerald-500 text-white border-transparent">
							{t("giveaway")}
						</Badge>
					) : null}
					{item.category && (
						<Badge variant="secondary" className="bg-white/20 text-white border-transparent backdrop-blur">
							{tCategories(item.category)}
						</Badge>
					)}
				</div>
				<h3 className="text-2xl font-semibold leading-tight line-clamp-2">
					{item.name}
				</h3>
				{item.description && (
					<p className="text-sm text-white/80 line-clamp-2 mt-1">
						{item.description}
					</p>
				)}
				{item.location?.ward && (
					<div className="inline-flex items-center gap-1 text-xs text-white/75 mt-2">
						<MapPin className="h-3 w-3" />
						{item.location.ward}
					</div>
				)}
			</div>
		</div>
	);
}
