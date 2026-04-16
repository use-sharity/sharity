"use client";

import { useEffect, useState } from "react";
import {
	AnimatePresence,
	type PanInfo,
	animate,
	motion,
	useMotionValue,
	useTransform,
} from "framer-motion";
import Link from "next/link";
import { Heart, Info, RefreshCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Doc } from "../convex/_generated/dataModel";
import { type ItemCategory } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { DiscoverCard } from "@/components/discover-card";
import { ItemCardContext } from "@/components/item-card";
import { ClaimItemBack } from "@/components/claim-item-back";

type Item = Doc<"items"> & {
	imageUrls?: string[];
	category?: ItemCategory;
	location?: { lat: number; lng: number; address?: string; ward?: string };
};

const SWIPE_THRESHOLD = 110;
const FLY_DISTANCE = 600;

export function DiscoverDeck({ items }: { items: Item[] }) {
	const [index, setIndex] = useState(0);
	const [fosterItem, setFosterItem] = useState<Item | null>(null);

	const x = useMotionValue(0);
	const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
	const fosterOpacity = useTransform(x, [40, 140], [0, 1]);
	const skipOpacity = useTransform(x, [-140, -40], [1, 0]);

	const current = items[index];
	const next = items[index + 1];

	useEffect(() => {
		x.set(0);
	}, [index, x]);

	const flyOff = (direction: 1 | -1, onDone: () => void) => {
		const controls = animate(x, direction * FLY_DISTANCE, {
			duration: 0.22,
			ease: "easeOut",
		});
		controls.then(onDone);
	};

	const handleFoster = () => {
		if (!current) return;
		const itemToFoster = current;
		flyOff(1, () => {
			setFosterItem(itemToFoster);
			setIndex((i) => i + 1);
		});
	};

	const handleSkip = () => {
		if (!current) return;
		flyOff(-1, () => setIndex((i) => i + 1));
	};

	const onDragEnd = (_e: unknown, info: PanInfo) => {
		if (info.offset.x > SWIPE_THRESHOLD) {
			handleFoster();
		} else if (info.offset.x < -SWIPE_THRESHOLD) {
			handleSkip();
		}
	};

	if (!current) {
		return <EmptyState onReset={() => setIndex(0)} hasItems={items.length > 0} />;
	}

	return (
		<div className="flex flex-col items-center w-full">
			<div className="relative w-full max-w-md mx-auto" style={{ height: 560 }}>
				{/* Peek of next card */}
				{next && (
					<div
						key={`peek-${next._id}`}
						className="absolute inset-0 origin-top scale-[0.94] translate-y-3 opacity-90 pointer-events-none"
						aria-hidden
					>
						<DiscoverCard item={next} />
					</div>
				)}

				{/* Top draggable card */}
				<AnimatePresence initial={false}>
					<motion.div
						key={`top-${current._id}`}
						className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
						style={{ x, rotate }}
						drag="x"
						dragConstraints={{ left: 0, right: 0 }}
						dragElastic={0.65}
						onDragEnd={onDragEnd}
						initial={{ scale: 0.96, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ duration: 0.18 }}
					>
						<DiscoverCard item={current} imagePriority />

						<motion.div
							className="absolute top-8 left-6 px-3 py-1.5 rounded-md border-4 border-emerald-400 text-emerald-400 font-extrabold text-xl tracking-widest pointer-events-none -rotate-12 bg-black/30 backdrop-blur"
							style={{ opacity: fosterOpacity }}
						>
							FOSTER
						</motion.div>
						<motion.div
							className="absolute top-8 right-6 px-3 py-1.5 rounded-md border-4 border-rose-400 text-rose-400 font-extrabold text-xl tracking-widest pointer-events-none rotate-12 bg-black/30 backdrop-blur"
							style={{ opacity: skipOpacity }}
						>
							SKIP
						</motion.div>
					</motion.div>
				</AnimatePresence>
			</div>

			{/* Action row */}
			<div className="flex items-center justify-center gap-5 mt-6">
				<Button
					variant="outline"
					size="icon"
					className="h-14 w-14 rounded-full border-rose-200 text-rose-500 hover:bg-rose-50 shadow-sm"
					onClick={handleSkip}
					aria-label="Skip"
				>
					<X className="h-6 w-6" />
				</Button>
				<Link href={`/item/${current._id}`} aria-label="Open details">
					<Button
						variant="outline"
						size="icon"
						className="h-12 w-12 rounded-full text-blue-500 border-blue-200 hover:bg-blue-50 shadow-sm"
					>
						<Info className="h-5 w-5" />
					</Button>
				</Link>
				<Button
					variant="outline"
					size="icon"
					className="h-14 w-14 rounded-full border-emerald-200 text-emerald-500 hover:bg-emerald-50 shadow-sm"
					onClick={handleFoster}
					aria-label="Request to Foster"
				>
					<Heart className="h-6 w-6" />
				</Button>
			</div>

			{/* Foster sheet — reuses the existing ClaimItemBack flow */}
			<Sheet
				open={!!fosterItem}
				onOpenChange={(o) => !o && setFosterItem(null)}
			>
				<SheetContent
					side="bottom"
					className="h-[92vh] overflow-y-auto p-0 sm:max-w-lg sm:mx-auto sm:rounded-t-2xl"
				>
					<SheetHeader>
						<SheetTitle>{fosterItem?.name ?? ""}</SheetTitle>
					</SheetHeader>
					{fosterItem && (
						<ItemCardContext.Provider
							value={{
								isFlipped: true,
								toggleFlip: () => setFosterItem(null),
								flipToFront: () => setFosterItem(null),
								flipToBack: () => {},
							}}
						>
							<Card className="border-0 shadow-none rounded-none">
								<ClaimItemBack item={fosterItem} />
							</Card>
						</ItemCardContext.Provider>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}

function EmptyState({
	onReset,
	hasItems,
}: {
	onReset: () => void;
	hasItems: boolean;
}) {
	const t = useTranslations("ItemList");
	return (
		<div className="flex flex-col items-center justify-center text-center py-16 gap-4 px-6">
			<div className="text-5xl">🎉</div>
			<h2 className="text-xl font-semibold">You&apos;re all caught up</h2>
			<p className="text-sm text-muted-foreground max-w-xs">
				{hasItems
					? "No more items to discover right now. Start over to look again."
					: t("loading")}
			</p>
			{hasItems && (
				<Button variant="outline" onClick={onReset}>
					<RefreshCcw className="h-4 w-4 mr-2" />
					Start over
				</Button>
			)}
		</div>
	);
}
