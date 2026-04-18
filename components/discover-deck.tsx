"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	AnimatePresence,
	type PanInfo,
	motion,
	useMotionValue,
	useTransform,
} from "framer-motion";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
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

const SWIPE_DISTANCE_THRESHOLD = 110;
const SWIPE_VELOCITY_THRESHOLD = 500;
const FLY_DISTANCE = 600;
// Pointer movement above this counts as a swipe intent, not a tap. Framer's
// internal drag threshold is ~3px which is too permissive — a short flick
// under it never fires onDragStart, so justDraggedRef stays false and onTap
// navigates to /item/:id. Isis reported this on 2026-04-18.
// Value tuned for touch: iOS fingers commonly jitter 8-12px during a tap
// (finger roll + contact area), so 8px was silently swallowing real taps on
// device. 16px keeps the 30px flick regression suppressed while letting a
// normal tap through. See e2e/discover-swipe.spec.ts.
const TAP_MAX_MOVEMENT_PX = 16;
// Only two cards in the DOM at once: the top one the user interacts with,
// and the "already-there" card directly beneath it. The under-card is at
// the EXACT same visual state as top — same scale, same y, same opacity.
// It's only hidden by z-index. When the top flies off, the under-card
// doesn't animate anywhere — it's revealed in place. This is the Tinder
// feel; a promote-from-peek spring always reads as a second animation
// running concurrently with the flyOff and that reads as flicker.
const STACK_DEPTH = 2;

export function DiscoverDeck({ items }: { items: Item[] }) {
	const router = useRouter();
	const [index, setIndex] = useState(0);
	const [fosterItem, setFosterItem] = useState<Item | null>(null);

	const current = items[index];
	const visible = items.slice(index, index + STACK_DEPTH);

	const handleDismiss = useCallback(
		(itemId: string, direction: 1 | -1) => {
			// Advance the index immediately; AnimatePresence keeps the
			// exiting card mounted while its exit animation plays. The new
			// top (previously peek at stackPos=1) simultaneously animates
			// its layout props from peek-state to top-state via the shared
			// spring transition — that's the morph that used to require
			// layoutId gymnastics, now falls out of the architecture.
			setIndex((i) => i + 1);
			if (direction === 1) {
				const item = items.find((it) => it._id === itemId);
				if (item) setFosterItem(item);
			}
		},
		[items],
	);

	const handleTap = useCallback(
		(itemId: string) => {
			router.push(`/item/${itemId}`);
		},
		[router],
	);

	if (!current) {
		return (
			<EmptyState onReset={() => setIndex(0)} hasItems={items.length > 0} />
		);
	}

	return (
		<div
			className="flex flex-col items-center w-full"
			data-testid="discover-deck-root"
			data-index={index}
			data-current-id={current._id}
			data-total={items.length}
		>
			<div
				className="relative w-full max-w-md mx-auto"
				style={{
					// Fit between the sticky controls above and the mobile tab bar
					// below. `svh` (small viewport height) accounts for mobile
					// browser UI so the card doesn't duck under the bottom nav on
					// the first paint. Clamped so desktop keeps a sane max size.
					// Sub value matched to items-map.tsx so both views have the
					// same visual gap above the tab bar.
					height:
						"min(560px, calc(100svh - 250px - env(safe-area-inset-top) - env(safe-area-inset-bottom)))",
				}}
			>
				<AnimatePresence mode="popLayout" initial={false}>
					{visible.map((item, stackPos) => (
						<SwipeCard
							key={item._id}
							item={item}
							stackPos={stackPos}
							onDismiss={handleDismiss}
							onTap={handleTap}
						/>
					))}
				</AnimatePresence>
			</div>

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

interface SwipeCardProps {
	item: Item;
	stackPos: number;
	onDismiss: (itemId: string, direction: 1 | -1) => void;
	onTap: (itemId: string) => void;
}

function SwipeCard({ item, stackPos, onDismiss, onTap }: SwipeCardProps) {
	// Each card owns its own motion value — this is the architectural shift
	// that kills the "stale ±600" cascade (old Trap 4). A card that becomes
	// top is a freshly-mounted React subtree with a fresh motion value at 0;
	// no useLayoutEffect reset, no shared state to desynchronise.
	const x = useMotionValue(0);
	const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
	const fosterOpacity = useTransform(x, [40, 140], [0, 1]);
	const skipOpacity = useTransform(x, [-140, -40], [1, 0]);

	const isTop = stackPos === 0;
	const [isExiting, setIsExiting] = useState(false);

	// Tap detection runs off NATIVE pointerdown/pointerup listeners rather
	// than framer-motion's onTap. Reason: framer's onTap is unreliable when
	// drag is on the same element (user report 2026-04-18: "tap sometimes
	// fires, mostly doesn't"). Native pointer events are deterministic — we
	// measure movement between pointerdown and pointerup ourselves and decide.
	const justDraggedRef = useRef(false);
	const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
	const dragRef = useRef<HTMLDivElement | null>(null);
	// Captured at render time so the native listener (which closes over the
	// initial mount's values) can read the latest state via ref. React state
	// in the listener would be stale after re-renders.
	const isTopRef = useRef(false);
	const isExitingRef = useRef(false);
	const onTapRef = useRef(onTap);
	const itemIdRef = useRef(item._id);
	isTopRef.current = stackPos === 0;
	onTapRef.current = onTap;
	itemIdRef.current = item._id;

	useEffect(() => {
		const el = dragRef.current;
		if (!el) return;
		const onDown = (e: PointerEvent) => {
			pointerStartRef.current = { x: e.clientX, y: e.clientY };
		};
		const onUp = (e: PointerEvent) => {
			const start = pointerStartRef.current;
			pointerStartRef.current = null;
			// Guard order matches priority: not top / exiting / drag just
			// happened → not a tap. These bail before the movement check.
			if (!isTopRef.current || isExitingRef.current) return;
			if (justDraggedRef.current) return;
			if (!start) return;
			const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
			if (moved > TAP_MAX_MOVEMENT_PX) return;
			onTapRef.current(itemIdRef.current);
		};
		const onCancel = () => {
			pointerStartRef.current = null;
		};
		el.addEventListener("pointerdown", onDown);
		// Bubble phase — framer-motion's drag listeners run in capture phase,
		// so onDragEnd has already set justDraggedRef synchronously by the
		// time this fires. (Reset via setTimeout in onDragEnd happens after
		// the current event dispatch completes, so it doesn't race us.)
		el.addEventListener("pointerup", onUp);
		el.addEventListener("pointercancel", onCancel);
		return () => {
			el.removeEventListener("pointerdown", onDown);
			el.removeEventListener("pointerup", onUp);
			el.removeEventListener("pointercancel", onCancel);
		};
	}, []);

	const onDragStart = () => {
		justDraggedRef.current = true;
	};

	const onDragEnd = (_e: unknown, info: PanInfo) => {
		setTimeout(() => {
			justDraggedRef.current = false;
		}, 0);
		if (isExiting) return;
		// Diagonal guard — require horizontal dominance.
		if (Math.abs(info.offset.x) < Math.abs(info.offset.y)) return;
		const distanceHit = Math.abs(info.offset.x) > SWIPE_DISTANCE_THRESHOLD;
		const velocityHit =
			Math.abs(info.velocity.x) > SWIPE_VELOCITY_THRESHOLD &&
			Math.abs(info.offset.x) > 30;
		if (!distanceHit && !velocityHit) return;
		const direction: 1 | -1 = info.offset.x > 0 ? 1 : -1;
		setIsExiting(true);
		// Fire dismiss synchronously — parent advances the index, this card
		// transitions to AnimatePresence's exit phase (popLayout removes it
		// from layout flow, the peek promotes via spring layout animation).
		onDismiss(item._id, direction);
	};

	// Keep exit ref in sync so the native pointerup listener sees the latest
	// value without re-binding the effect.
	isExitingRef.current = isExiting;

	const exitDirection = useRef<1 | -1>(1);
	if (isExiting) {
		// Record direction from current x position so the exit variant flies
		// the correct way. This read happens during render, which is fine —
		// we only branch on isExiting which is a stable state during exit.
		exitDirection.current = x.get() >= 0 ? 1 : -1;
	}

	return (
		<motion.div
			ref={dragRef}
			data-testid={isTop && !isExiting ? "discover-top-card" : undefined}
			data-stack-pos={stackPos}
			data-item-id={item._id}
			className="absolute inset-0 cursor-grab active:cursor-grabbing touch-pan-y"
			style={{
				x: isTop ? x : 0,
				rotate: isTop ? rotate : 0,
				zIndex: STACK_DEPTH - stackPos,
				pointerEvents: isTop && !isExiting ? "auto" : "none",
			}}
			drag={isTop && !isExiting ? "x" : false}
			dragDirectionLock
			dragConstraints={{ left: 0, right: 0 }}
			dragElastic={0.65}
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			// No animate/transition props on the stack-position changes —
			// the under-card is already mounted at the same transform as
			// the top. When the top exits, this card is simply revealed by
			// z-index; there is nothing to interpolate. Removing the
			// promote animation removes the "flicker" the user was seeing:
			// previously the peek at opacity 0.94 / scale 0.94 sprung up
			// to 1/1 at the same time the top flew off, and the two
			// concurrent animations read as jitter.
			exit={{
				x: exitDirection.current * FLY_DISTANCE,
				opacity: 0,
				rotate: exitDirection.current * 18,
				transition: {
					type: "spring",
					stiffness: 180,
					damping: 22,
					mass: 0.8,
				},
			}}
		>
			<DiscoverCard item={item} imagePriority={isTop} />

			{isTop && (
				<>
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
				</>
			)}
		</motion.div>
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
