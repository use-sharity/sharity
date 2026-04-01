import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@/components/ui/carousel";
import { Doc } from "../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { type ItemCategory } from "@/lib/constants";
import { MapPin } from "lucide-react";
import {
	ReactNode,
	createContext,
	useContext,
	useState,
	useCallback,
	useRef,
	useEffect,
} from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
	CloudinaryImage,
	isCloudinaryImageUrl,
} from "@/components/cloudinary-image";

interface ItemCardContextType {
	isFlipped: boolean;
	toggleFlip: () => void;
	flipToFront: () => void;
	flipToBack: () => void;
}

const ItemCardContext = createContext<ItemCardContextType | undefined>(
	undefined,
);

export function useItemCard() {
	const context = useContext(ItemCardContext);
	if (!context) {
		throw new Error("useItemCard must be used within an ItemCard");
	}
	return context;
}

interface ItemCardProps {
	item: Doc<"items"> & {
		imageUrls?: string[];
		category?: ItemCategory;
		location?: { lat: number; lng: number; address?: string; ward?: string };
	};
	footer?: ReactNode;
	children?: ReactNode;
	rightHeader?: ReactNode;
	backContent?: ReactNode;
	density?: "default" | "compact";
	hideDescription?: boolean;
	descriptionLines?: 1 | 2 | 3;
	hideMetaRow?: boolean;
}

export function ItemCard({
	item,
	footer,
	children,
	rightHeader,
	backContent,
	density = "default",
	hideDescription = false,
	descriptionLines = 2,
	hideMetaRow = false,
}: ItemCardProps) {
	const t = useTranslations("ItemCard");
	const tCategories = useTranslations("Categories");
	const [isFlipped, setIsFlipped] = useState(false);
	const imageUrls = (item.imageUrls ?? []).filter(isCloudinaryImageUrl);

	const toggleFlip = useCallback(() => setIsFlipped((prev) => !prev), []);
	const flipToFront = useCallback(() => setIsFlipped(false), []);
	const flipToBack = useCallback(() => setIsFlipped(true), []);

	const [height, setHeight] = useState<number | undefined>(undefined);
	const frontRef = useRef<HTMLDivElement>(null);
	const backRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const updateHeight = () => {
			const frontHeight = frontRef.current?.scrollHeight;
			const backHeight = backRef.current?.scrollHeight;

			if (isFlipped) {
				setHeight(backHeight);
			} else {
				setHeight(frontHeight);
			}
		};

		updateHeight();

		const observer = new ResizeObserver(updateHeight);
		if (frontRef.current) observer.observe(frontRef.current);
		if (backRef.current) observer.observe(backRef.current);

		return () => observer.disconnect();
	}, [isFlipped]);

	return (
		<ItemCardContext.Provider
			value={{ isFlipped, toggleFlip, flipToFront, flipToBack }}
		>
			<div className="group/item-card relative w-full perspective-1000">
				<div
					className={cn(
						"relative w-full transition-all duration-500 transform-style-3d",
						isFlipped ? "rotate-y-180" : "",
					)}
					style={{ height: height ? `${height}px` : undefined }}
				>
					{/* Front Face */}
					<div className="relative w-full backface-hidden" ref={frontRef}>
						<Card className="gap-3 py-7">
							<CardHeader className="gap-3">
								{imageUrls.length > 0 && (
									<div
										className={cn(
											"w-full relative rounded-md overflow-hidden bg-gray-100 group",
											density === "compact" ? "aspect-4/3" : "aspect-video",
										)}
									>
										<Carousel className="w-full h-full">
											<CarouselContent>
												{imageUrls.map((url, index) => (
													<CarouselItem key={index}>
														<div
															className={cn(
																"w-full relative",
																density === "compact"
																	? "aspect-4/3"
																	: "aspect-video",
															)}
														>
															<CloudinaryImage
																src={url}
																alt={`${item.name} - Image ${index + 1}`}
																fill
																sizes="(max-width: 768px) 100vw, 672px"
																className="object-cover"
															/>
														</div>
													</CarouselItem>
												))}
											</CarouselContent>
											{imageUrls.length > 1 && (
												<>
													<CarouselPrevious className="left-2" />
													<CarouselNext className="right-2" />
												</>
											)}
										</Carousel>
									</div>
								)}
								<div className="flex justify-between items-start">
									<CardTitle>
										<Link
											href={`/item/${item._id}`}
											className="hover:underline"
										>
											{item.name}
										</Link>
									</CardTitle>
									{rightHeader}
								</div>
							</CardHeader>
							<CardContent>
								{children}
								{!hideMetaRow && (
									<div
										className={cn(
											"flex flex-wrap gap-2",
											density === "compact" ? "mb-1.5" : "mb-2",
										)}
									>
										{item.giveaway ? <Badge>{t("giveaway")}</Badge> : null}
										{item.category && (
											<Badge variant="secondary">
												{tCategories(item.category)}
											</Badge>
										)}
										{item.location && (
											<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
												<MapPin className="h-3 w-3" />
												{item.location.ward || t("locationAvailable")}
											</span>
										)}
									</div>
								)}
								{!hideDescription && item.description && (
									<p
										className={cn(
											"text-gray-600",
											density === "compact" && "text-sm",
											descriptionLines === 1 && "line-clamp-1",
											descriptionLines === 2 && "line-clamp-2",
											descriptionLines === 3 && "line-clamp-3",
										)}
									>
										{item.description}
									</p>
								)}
							</CardContent>
							{footer && <CardFooter>{footer}</CardFooter>}
						</Card>
					</div>

					{/* Back Face */}
					<div
						className="absolute top-0 left-0 w-full backface-hidden rotate-y-180"
						ref={backRef}
					>
						<Card className="flex flex-col">{backContent}</Card>
					</div>
				</div>
			</div>
		</ItemCardContext.Provider>
	);
}
