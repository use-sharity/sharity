"use client";

import {
  animate,
  motion,
  type PanInfo,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "framer-motion";
import { RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { DiscoverCard } from "@/components/discover-card";
import { ItemCardContext } from "@/components/item-card-context";
import { BorrowerRequestPanel } from "@/components/lease/borrower-request-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type ItemCategory } from "@/lib/constants";
import { Doc } from "../convex/_generated/dataModel";

type Item = Doc<"items"> & {
  imageUrls?: string[];
  category?: ItemCategory;
  location?: { lat: number; lng: number; address?: string; ward?: string };
};

const SWIPE_DISTANCE_THRESHOLD = 110;
const SWIPE_VELOCITY_THRESHOLD = 500;
const FLY_DISTANCE = 600;
const TAP_MAX_MOVEMENT_PX = 16;
const STACK_DEPTH = 2;

export function DiscoverDeck({ items }: { items: Item[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [fosterItem, setFosterItem] = useState<Item | null>(null);
  // Ids of cards whose exit animation is still playing. They remain mounted
  // so the card's React subtree (and its motion value) survives through the
  // animation — no AnimatePresence, no popLayout, no "exit evaluated after
  // unmount" race. See framer-motion#2416.
  const [exitingIds, setExitingIds] = useState<string[]>([]);

  const handleDismiss = useCallback(
    (itemId: string, direction: 1 | -1) => {
      setExitingIds((prev) =>
        prev.includes(itemId) ? prev : [...prev, itemId],
      );
      setIndex((i) => i + 1);
      if (direction === 1) {
        const item = items.find((it) => it._id === itemId);
        if (item) setFosterItem(item);
      }
    },
    [items],
  );

  const handleExitComplete = useCallback((itemId: string) => {
    setExitingIds((prev) => prev.filter((id) => id !== itemId));
  }, []);

  const handleTap = useCallback(
    (itemId: string) => {
      router.push(`/item/${itemId}`);
    },
    [router],
  );

  const current = items[index];

  if (!current && exitingIds.length === 0) {
    return (
      <EmptyState onReset={() => setIndex(0)} hasItems={items.length > 0} />
    );
  }

  const stack = items.slice(index, index + STACK_DEPTH);
  // Cards still playing their exit animation. These sit on top of the stack
  // via zIndex. Rendered in insertion order so a newer exit paints over an
  // older one (rare: only happens on a burst of rapid swipes).
  const exitingItems = exitingIds
    .map((id) => items.find((it) => it._id === id))
    .filter((it): it is Item => !!it);

  const rendered = new Set<string>();
  const slots: Array<{ item: Item; isExiting: boolean; stackPos: number }> = [];
  for (const item of exitingItems) {
    if (rendered.has(item._id)) continue;
    rendered.add(item._id);
    slots.push({ item, isExiting: true, stackPos: 0 });
  }
  stack.forEach((item, stackPos) => {
    if (rendered.has(item._id)) return;
    rendered.add(item._id);
    slots.push({ item, isExiting: false, stackPos });
  });

  return (
    <div
      className="flex flex-col items-center w-full"
      data-testid="discover-deck-root"
      data-index={index}
      data-current-id={current?._id}
      data-total={items.length}
    >
      <div
        className="relative w-full max-w-md mx-auto"
        style={{
          height:
            "min(560px, calc(100svh - 250px - env(safe-area-inset-top) - env(safe-area-inset-bottom)))",
        }}
      >
        {slots.map(({ item, isExiting, stackPos }) => (
          <SwipeCard
            key={item._id}
            item={item}
            stackPos={stackPos}
            isExiting={isExiting}
            onDismiss={handleDismiss}
            onExitComplete={handleExitComplete}
            onTap={handleTap}
          />
        ))}
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
                <BorrowerRequestPanel item={fosterItem} fullWidth />
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
  isExiting: boolean;
  onDismiss: (itemId: string, direction: 1 | -1) => void;
  onExitComplete: (itemId: string) => void;
  onTap: (itemId: string) => void;
}

function SwipeCard({
  item,
  stackPos,
  isExiting,
  onDismiss,
  onExitComplete,
  onTap,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  // rotate is a standalone motion value (not a useTransform) so we can
  // drive it imperatively on exit — giving the card a velocity-scaled spin
  // that continues while it flies out. During drag it's kept in sync with
  // x via useMotionValueEvent below.
  const rotate = useMotionValue(0);
  const fosterOpacity = useTransform(x, [40, 140], [0, 1]);
  const skipOpacity = useTransform(x, [-140, -40], [1, 0]);

  const isTop = stackPos === 0 && !isExiting;

  // Direction is latched in onDragEnd from info.offset.x. Do NOT re-read
  // x.get() — framer-motion snaps the motion value toward the drag
  // constraints as soon as drag ends, so the sign can invert by the time
  // an effect runs.
  const exitDirectionRef = useRef<1 | -1>(1);

  // Imperative exit animation. Started synchronously from onDragEnd so it
  // preempts framer-motion's internal dragElastic snap-back animation (which
  // otherwise fires in the same tick and starts pulling x toward 0 before
  // our effect would commit). Kept alive via ref so unmount can stop it.
  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;
  const exitAnimRef = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => {
    return () => {
      exitAnimRef.current?.stop();
      exitAnimRef.current = null;
    };
  }, []);

  // Native pointerdown/pointerup for tap detection — framer's onTap is
  // unreliable when drag lives on the same element.
  const justDraggedRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<HTMLDivElement | null>(null);
  const isTopRef = useRef(false);
  const isExitingRef = useRef(false);
  const onTapRef = useRef(onTap);
  const itemIdRef = useRef(item._id);
  isTopRef.current = isTop;
  isExitingRef.current = isExiting;
  onTapRef.current = onTap;
  itemIdRef.current = item._id;

  // During drag, mirror x → rotate (±18° at the drag boundaries). When an
  // exit animation is in flight we hand control to the imperative animate()
  // call so the card can spin with release-velocity while flying out.
  useMotionValueEvent(x, "change", (v) => {
    if (exitAnimRef.current) return;
    rotate.set(Math.max(-18, Math.min(18, v / 11)));
  });

  useEffect(() => {
    const el = dragRef.current;
    if (!el) return;
    const onDown = (e: PointerEvent) => {
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
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
    if (Math.abs(info.offset.x) < Math.abs(info.offset.y)) return;
    const distanceHit = Math.abs(info.offset.x) > SWIPE_DISTANCE_THRESHOLD;
    const velocityHit =
      Math.abs(info.velocity.x) > SWIPE_VELOCITY_THRESHOLD &&
      Math.abs(info.offset.x) > 30;
    if (!distanceHit && !velocityHit) return;
    const direction: 1 | -1 = info.offset.x > 0 ? 1 : -1;
    exitDirectionRef.current = direction;
    // Start the exit animation in the same tick as drag-end, BEFORE
    // framer-motion's internal dragElastic snap-back gets to pull x
    // toward 0. animate() on the same motion value supersedes any
    // concurrent animation, so whichever order they initialise in,
    // ours wins the motion value.
    exitAnimRef.current?.stop();
    const controls = animate(x, direction * FLY_DISTANCE, {
      type: "spring",
      stiffness: 180,
      damping: 22,
      mass: 0.8,
    });
    exitAnimRef.current = controls;
    // Velocity-scaled spin during exit. The card keeps rotating while it
    // flies out — faster flick = more spin. Clamped so extreme flicks
    // don't produce cartoonish cartwheels. `velocity` seeds the spring's
    // initial angular velocity so it feels continuous from the gesture.
    const vx = info.velocity.x;
    const rotateTarget = Math.max(-35, Math.min(35, vx / 40 + direction * 18));
    animate(rotate, rotateTarget, {
      type: "spring",
      stiffness: 120,
      damping: 18,
      mass: 0.6,
      velocity: vx / 12,
    });
    const itemId = item._id;
    controls.then(() => {
      if (exitAnimRef.current !== controls) return;
      exitAnimRef.current = null;
      onExitCompleteRef.current(itemId);
    });
    onDismiss(item._id, direction);
  };

  return (
    <motion.div
      ref={dragRef}
      data-testid={isTop ? "discover-top-card" : undefined}
      data-stack-pos={stackPos}
      data-item-id={item._id}
      data-exiting={isExiting ? "true" : undefined}
      className="absolute inset-0 cursor-grab active:cursor-grabbing touch-pan-y"
      style={{
        // The top card (and any exiting card — which keeps its captured x
        // while the imperative animation plays) rides its motion value.
        // Under-card stays pinned at 0.
        x: stackPos === 0 ? x : 0,
        rotate: stackPos === 0 ? rotate : 0,
        // Pivot at bottom edge so the card rotates as if hinged from
        // the hand, not spinning around its center. This is the single
        // biggest tactile difference vs Tinder/Hinge.
        originY: 1,
        // Exiting cards paint above the promoted under-card.
        zIndex: isExiting ? 100 : STACK_DEPTH - stackPos,
        pointerEvents: isTop ? "auto" : "none",
      }}
      drag={isTop ? "x" : false}
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.65}
      // Snap-back spring when the drag is under-threshold. Default is
      // critically damped (sluggish); this gives a single satisfying
      // bounce then settles. Does NOT affect our imperative exit
      // animation (dragMomentum={false} kills inertia entirely).
      dragTransition={{ bounceStiffness: 300, bounceDamping: 25 }}
      // Kill framer's post-release momentum/snap-back. Without this,
      // framer-motion fires its own spring toward dragConstraints right
      // after onDragEnd runs, which races with our imperative animate()
      // on the same motion value — sometimes the snap-back wins and the
      // card yanks toward 0 before flying off, or flies in the wrong
      // direction entirely. With momentum off, x stays exactly where the
      // finger released it until our animate() takes over.
      dragMomentum={false}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
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
