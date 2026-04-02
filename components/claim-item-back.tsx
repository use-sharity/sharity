"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";

import type { Doc } from "../convex/_generated/dataModel";
import { useItemCalendar } from "@/hooks/use-item-calendar";
import { ItemCalendar } from "@/components/item-calendar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useItemCard } from "./item-card";
import { AvailabilityToggle } from "./notifications/availability-toggle";
import { LeaseClaimCard } from "./lease/lease-claim-card";
import { LeaseProposeIntradayDialog } from "./lease/lease-propose-intraday-dialog";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useClaimItem } from "@/hooks/use-claim-item";

interface ClaimItemBackProps {
	item: Doc<"items">;
	viewerRole?: "borrower" | "owner";
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(day: Date): Date {
	const d = new Date(day);
	d.setHours(0, 0, 0, 0);
	return d;
}

function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function formatIntradayRangeLabel(range: {
	startAt: number;
	endAt: number;
}): string {
	const startHour = new Date(range.startAt).getHours();
	const endHour = new Date(range.endAt).getHours();
	return `${pad2(startHour)}:00–${pad2(endHour)}:00`;
}

function hasOverlap(
	a: { startDate: number; endDate: number },
	b: { startDate: number; endDate: number },
): boolean {
	return a.startDate < b.endDate && a.endDate > b.startDate;
}

function startOfLocalDayAt(at: number): number {
	const d = new Date(at);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

function toDisabledDayRange(range: { startDate: number; endDate: number }): {
	from: Date;
	to: Date;
} | null {
	const startDay = startOfLocalDayAt(range.startDate);
	const endDay = startOfLocalDayAt(range.endDate);
	const isAligned = range.startDate === startDay && range.endDate === endDay;
	const isAtLeastOneDay = range.endDate - range.startDate >= ONE_DAY_MS;
	if (!isAligned || !isAtLeastOneDay) return null;

	const endInclusive = Math.max(range.startDate, range.endDate - 1);
	return { from: new Date(range.startDate), to: new Date(endInclusive) };
}

function GiveawayBorrowerClaimItemBack({ item }: { item: Doc<"items"> }) {
	const { flipToFront } = useItemCard();
	const {
		isAuthenticated,
		isAuthLoading,
		isSubmitting,
		requestItem,
		availability,
	} = useClaimItem(item._id);
	const t = useTranslations("ClaimItemBack");

	const [pickupDay, setPickupDay] = useState<Date | undefined>(undefined);

	const disabledDayRanges = useMemo(() => {
		return (availability ?? [])
			.map(toDisabledDayRange)
			.filter((v): v is { from: Date; to: Date } => v !== null);
	}, [availability]);

	const requestDisabled =
		!pickupDay || isSubmitting || isAuthLoading || !isAuthenticated;

	return (
		<>
			<CardHeader className="space-y-1">
				<CardTitle className="text-base">{t("requestToReceive")}</CardTitle>
				{!isAuthenticated ? (
					<div className="text-sm text-muted-foreground">
						{isAuthLoading ? t("connecting") : t("signInToRequest")}
					</div>
				) : (
					<div className="text-xs text-muted-foreground">
						{t("giveawayDesc")}
					</div>
				)}
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex justify-center w-full max-w-full">
					<Calendar
						mode="single"
						selected={pickupDay}
						onSelect={setPickupDay}
						disabled={[
							{ before: startOfLocalDay(new Date()) },
							...disabledDayRanges,
						]}
						numberOfMonths={2}
					/>
				</div>
			</CardContent>
			<CardFooter className="mt-auto border-t gap-2 justify-between">
				<AvailabilityToggle id={item._id} />
				<div className="flex gap-2">
					<Button variant="ghost" size="sm" onClick={flipToFront}>
						{t("back")}
					</Button>
					<Link href={`/item/${item._id}`} className="hidden sm:block">
						<Button variant="outline" size="sm">
							{t("details")}
						</Button>
					</Link>
					<Button
						size="sm"
						disabled={requestDisabled}
						onClick={async () => {
							if (!pickupDay) return;
							const startDate = startOfLocalDay(pickupDay);
							const endDate = new Date(startDate.getTime() + ONE_DAY_MS);
							await requestItem(startDate, endDate, () =>
								setPickupDay(undefined),
							);
						}}
					>
						{isSubmitting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							t("request")
						)}
					</Button>
				</div>
			</CardFooter>
		</>
	);
}

function BorrowerClaimItemBack({ item }: { item: Doc<"items"> }) {
	if (item.giveaway) {
		return <GiveawayBorrowerClaimItemBack item={item} />;
	}
	return <LoanBorrowerClaimItemBack item={item} />;
}

function LoanBorrowerClaimItemBack({ item }: { item: Doc<"items"> }) {
	const { flipToFront } = useItemCard();
	const t = useTranslations("ClaimItemBack");

	const calendar = useItemCalendar({
		mode: "borrower",
		itemId: item._id,
		months: "responsive",
		showMyRequestModifiers: true,
	});

	const [intradayRange, setIntradayRange] = useState<{
		startAt: number;
		endAt: number;
	} | null>(null);
	const [intradayDialogOpen, setIntradayDialogOpen] = useState(false);
	const [intradayFixedDate, setIntradayFixedDate] = useState<Date | null>(null);
	const [isIntradayBusy, setIsIntradayBusy] = useState(false);

	const selectionKey =
		calendar.date?.from && calendar.date?.to
			? `${calendar.date.from.getTime()}-${calendar.date.to.getTime()}`
			: null;
	const lastSelectionKeyRef = useRef<string | null>(null);

	useEffect(() => {
		if (selectionKey === lastSelectionKeyRef.current) return;
		lastSelectionKeyRef.current = selectionKey;
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setIntradayRange(null);
		setIntradayDialogOpen(false);
		setIntradayFixedDate(null);

		if (calendar.date?.from && calendar.date?.to) {
			if (isSameDay(calendar.date.from, calendar.date.to)) {
				setIntradayFixedDate(calendar.date.from);
			}
		}
	}, [calendar.date, selectionKey]);

	const isIntradayRequired = Boolean(
		calendar.date?.from &&
			calendar.date?.to &&
			isSameDay(calendar.date.from, calendar.date.to),
	);

	const requestDisabled =
		!calendar.date?.from ||
		!calendar.date?.to ||
		calendar.isSubmitting ||
		isIntradayBusy ||
		calendar.isAuthLoading ||
		!calendar.isAuthenticated;

	const primaryClaim = useMemo(() => {
		const list = calendar.myRequests ?? [];
		const activeApproved = list
			.filter(
				(c) =>
					c.status === "approved" &&
					!c.returnedAt &&
					!c.expiredAt &&
					!c.missingAt,
			)
			.sort((a, b) => a.startDate - b.startDate);
		if (activeApproved[0]) return activeApproved[0];

		const pending = list
			.filter((c) => c.status === "pending")
			.sort((a, b) => a.startDate - b.startDate);
		return pending[0];
	}, [calendar.myRequests]);

	const markPickedUp = useMutation(api.items.markPickedUp);
	const markReturned = useMutation(api.items.markReturned);

	const onClaim = () => {
		if (isIntradayRequired) {
			if (!intradayRange) {
				setIntradayDialogOpen(true);
				return;
			}
			calendar.requestItemAt(intradayRange.startAt, intradayRange.endAt, () => {
				setIntradayRange(null);
				setIntradayDialogOpen(false);
				setIntradayFixedDate(null);
				calendar.setDate(undefined);
			});
			return;
		}
		if (!calendar.date?.from || !calendar.date?.to) return;
		calendar.requestItem(calendar.date.from, calendar.date.to, () => {
			setIntradayRange(null);
			setIntradayDialogOpen(false);
			setIntradayFixedDate(null);
			calendar.setDate(undefined);
		});
	};

	if (primaryClaim) {
		return (
			<>
				<LeaseClaimCard
					itemId={item._id}
					claim={primaryClaim}
					viewerRole="borrower"
					layout="embedded"
					isGiveaway={Boolean(item.giveaway)}
					itemDeposit={item.deposit}
					cancelClaim={async ({ claimId }) =>
						await calendar.cancelRequest(claimId)
					}
					markPickedUp={markPickedUp}
					markReturned={markReturned}
				/>
				<CardFooter className="mt-auto border-t gap-2 justify-end">
					<Button variant="ghost" size="sm" onClick={flipToFront}>
						{t("back")}
					</Button>
					<Link href={`/item/${item._id}`}>
						<Button variant="outline" size="sm">
							{t("openDetails")}
						</Button>
					</Link>
				</CardFooter>
			</>
		);
	}

	return (
		<>
			<CardHeader className="space-y-1">
				<CardTitle className="text-base">{t("requestToBorrow")}</CardTitle>
				{!calendar.isAuthenticated ? (
					<div className="text-sm text-muted-foreground">
						{calendar.isAuthLoading ? t("connecting") : t("signInToRequest")}
					</div>
				) : null}
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex justify-center w-full max-w-full">
					<ItemCalendar {...calendar.calendarProps} />
				</div>
				{intradayFixedDate ? (
					<div className="mt-3">
						<LeaseProposeIntradayDialog
							title={t("intraday.title")}
							description={t("intraday.description")}
							triggerLabel={
								intradayRange
									? t("intraday.changeHours", {
											range: formatIntradayRangeLabel(intradayRange),
										})
									: t("intraday.selectHours")
							}
							triggerVariant="outline"
							triggerSize="sm"
							triggerClassName="w-full h-8"
							confirmLabel={t("intraday.save")}
							cancelLabel={t("intraday.cancel")}
							fixedDate={intradayFixedDate}
							disabled={calendar.isSubmitting || isIntradayBusy}
							open={intradayDialogOpen}
							onOpenChange={setIntradayDialogOpen}
							onBusyChange={setIsIntradayBusy}
							onConfirm={async (startAt, endAt) => {
								const now = Date.now();
								const HOUR_MS = 60 * 60 * 1000;
								const currentHourStart = Math.floor(now / HOUR_MS) * HOUR_MS;
								// Mirror backend: intraday window is valid as long as
								// it hasn't fully passed yet (end must be in the future)
								// and the start hour is not earlier than the current hour.
								if (endAt <= now) {
									toast.error(t("intraday.errors.futureStart"));
									throw new Error(t("intraday.errors.futureStart"));
								}
								if (startAt < currentHourStart) {
									toast.error(t("intraday.errors.futureStart"));
									throw new Error(t("intraday.errors.futureStart"));
								}
								if (endAt <= startAt) {
									toast.error(t("intraday.errors.endAfterStart"));
									throw new Error(t("intraday.errors.endAfterStart"));
								}

								const overlaps = (calendar.availability ?? []).some((r) =>
									hasOverlap(
										{ startDate: startAt, endDate: endAt },
										{ startDate: r.startDate, endDate: r.endDate },
									),
								);
								if (overlaps) {
									toast.error(t("intraday.errors.notAvailable"));
									throw new Error(t("intraday.errors.notAvailable"));
								}

								setIntradayRange({ startAt, endAt });
								setIntradayDialogOpen(false);
							}}
						/>
					</div>
				) : null}
			</CardContent>
			<CardFooter className="mt-auto border-t gap-2 justify-between">
				<AvailabilityToggle id={item._id} />
				<div className="flex gap-2">
					<Button variant="ghost" size="sm" onClick={flipToFront}>
						{t("back")}
					</Button>
					<Link href={`/item/${item._id}`} className="hidden sm:block">
						<Button variant="outline" size="sm">
							{t("details")}
						</Button>
					</Link>
					<Button size="sm" onClick={onClaim} disabled={requestDisabled}>
						{calendar.isSubmitting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							t("request")
						)}
					</Button>
				</div>
			</CardFooter>
		</>
	);
}

function OwnerClaimItemBack({ item }: { item: Doc<"items"> }) {
	const { flipToFront } = useItemCard();
	const claims = useQuery(api.items.getClaims, { id: item._id });
	const t = useTranslations("ClaimItemBack");

	const primaryClaim = useMemo(() => {
		const list = claims ?? [];
		const pending = list
			.filter((c) => c.status === "pending")
			.sort((a, b) => a.startDate - b.startDate);
		if (pending[0]) return pending[0];

		const activeApproved = list
			.filter(
				(c) =>
					c.status === "approved" &&
					!c.returnedAt &&
					!c.expiredAt &&
					!c.missingAt,
			)
			.sort((a, b) => a.startDate - b.startDate);
		return activeApproved[0];
	}, [claims]);

	const approveClaim = useMutation(api.items.approveClaim);
	const rejectClaim = useMutation(api.items.rejectClaim);
	const markPickedUp = useMutation(api.items.markPickedUp);
	const markReturned = useMutation(api.items.markReturned);
	const markExpired = useMutation(api.items.markExpired);
	const markMissing = useMutation(api.items.markMissing);

	if (primaryClaim) {
		return (
			<>
				<LeaseClaimCard
					itemId={item._id}
					claim={primaryClaim}
					viewerRole="owner"
					layout="embedded"
					isGiveaway={Boolean(item.giveaway)}
					itemDeposit={item.deposit}
					approveClaim={approveClaim}
					rejectClaim={rejectClaim}
					markPickedUp={markPickedUp}
					markReturned={markReturned}
					markExpired={markExpired}
					markMissing={markMissing}
				/>
				<CardFooter className="mt-auto border-t gap-2 justify-end">
					<Button variant="ghost" size="sm" onClick={flipToFront}>
						{t("back")}
					</Button>
					<Link href={`/item/${item._id}`}>
						<Button variant="outline" size="sm">
							{t("openDetails")}
						</Button>
					</Link>
				</CardFooter>
			</>
		);
	}

	return (
		<>
			<CardHeader className="space-y-1">
				<CardTitle className="text-base">{t("noActiveRequests")}</CardTitle>
				<div className="text-sm text-muted-foreground">
					{claims === undefined ? t("connecting") : t("nothingToApprove")}
				</div>
			</CardHeader>
			<CardFooter className="mt-auto border-t gap-2 justify-end">
				<Button variant="ghost" size="sm" onClick={flipToFront}>
					{t("back")}
				</Button>
				<Link href={`/item/${item._id}`}>
					<Button variant="outline" size="sm">
						{t("openDetails")}
					</Button>
				</Link>
			</CardFooter>
		</>
	);
}

export function ClaimItemBack({ item, viewerRole }: ClaimItemBackProps) {
	if (viewerRole === "owner") {
		return <OwnerClaimItemBack item={item} />;
	}
	return <BorrowerClaimItemBack item={item} />;
}
