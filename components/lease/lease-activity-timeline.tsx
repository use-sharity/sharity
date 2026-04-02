"use client";

import { format } from "date-fns";
import type { Doc } from "@/convex/_generated/dataModel";
import { UserLink } from "@/components/user-link";
import { cn } from "@/lib/utils";
import { CloudinaryImage } from "@/components/cloudinary-image";
import { useTranslations } from "next-intl";

export type LeaseActivityEvent = Doc<"lease_activity"> & {
	photoUrls?: string[];
};

function Actor({ actorId }: { actorId: string }) {
	if (actorId === "system") {
		return <span>System</span>;
	}
	return <UserLink userId={actorId} size="sm" showAvatar={false} />;
}

function FormatEventTitle({ event }: { event: LeaseActivityEvent }) {
	const t = useTranslations("LeaseActivity.eventTitles");
	switch (event.type) {
		case "lease_requested":
			return t("requested");
		case "lease_approved":
			return t("approved");
		case "lease_rejected":
			return t("rejected");
		case "lease_expired":
			return t("expired");
		case "lease_missing":
			return t("missing");
		case "lease_pickup_proposed":
			return t("pickup_proposed");
		case "lease_pickup_approved":
			return t("pickup_approved");
		case "lease_return_proposed":
			return t("return_proposed");
		case "lease_return_approved":
			return t("return_approved");
		case "lease_picked_up":
			return t("picked_up");
		case "lease_returned":
			return t("returned");
		case "lease_deposit_sent":
			return t("deposit_sent");
		case "lease_deposit_received":
			return t("deposit_received");
		case "lease_deposit_declined":
			return t("deposit_declined");
		default:
			return t("default");
	}
}

// Displays lease activity events with optional photo previews.
export function LeaseActivityTimeline({
	events,
	className,
}: {
	events: LeaseActivityEvent[] | undefined;
	className?: string;
}) {
	const t = useTranslations("LeaseActivity");
	if (events === undefined) {
		return (
			<div className={cn("text-sm text-muted-foreground", className)}>
				{t("loading")}
			</div>
		);
	}

	if (events.length === 0) {
		return (
			<div className={cn("text-sm text-muted-foreground", className)}>
				{t("empty")}
			</div>
		);
	}

	return (
		<div className={cn("space-y-3", className)}>
			{events.map((event) => {
				const photoUrls = event.photoUrls ?? [];
				return (
					<div key={event._id} className="flex gap-3">
						<div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-muted-foreground" />
						<div className="min-w-0">
							<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
								<span className="text-sm font-medium">
									<FormatEventTitle event={event} />
								</span>
								<span className="text-xs text-muted-foreground">
									{format(new Date(event.createdAt), "MMM d, yyyy p")}
								</span>
								<span className="text-xs text-muted-foreground flex items-center gap-1">
									{t("by")} <Actor actorId={event.actorId} />
								</span>
							</div>

							{event.note && (
								<div className="text-xs text-muted-foreground break-all">
									{event.note}
								</div>
							)}

							{(event.type === "lease_pickup_proposed" ||
								event.type === "lease_pickup_approved" ||
								event.type === "lease_return_proposed" ||
								event.type === "lease_return_approved") &&
								typeof event.windowStartAt === "number" &&
								typeof event.windowEndAt === "number" && (
									<div className="text-xs text-muted-foreground">
										{t("window", {
											start: format(new Date(event.windowStartAt), "MMM d p"),
											end: format(new Date(event.windowEndAt), "p"),
										})}
									</div>
								)}

							{photoUrls.length > 0 && (
								<div className="mt-2 flex flex-wrap gap-2">
									{photoUrls.map((url) => (
										<a
											key={url}
											href={url}
											target="_blank"
											rel="noopener noreferrer"
											className="block"
										>
											<CloudinaryImage
												src={url}
												alt="Lease photo"
												width={64}
												height={64}
												sizes="64px"
												className="h-16 w-16 rounded-md border object-cover"
											/>
										</a>
									))}
								</div>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
