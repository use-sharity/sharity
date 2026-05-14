"use client";

import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";
import { Clock3 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { useMemo, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ButtonSize = ComponentProps<typeof Button>["size"];

export type LeaseProposeWindowDialogProps = {
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
  fixedDate: Date;
  defaultWindowStartAt?: number;
  defaultPlace?: string;
  defaultDetails?: string;
  disabled?: boolean;
  onConfirm: (proposal: {
    windowStartAt: number;
    place?: string;
    note?: string;
  }) => Promise<unknown>;
  onBusyChange?: (busy: boolean) => void;
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function roundUpToFiveMinutes(value: number): number {
  return Math.ceil(value / FIVE_MINUTES_MS) * FIVE_MINUTES_MS;
}

function getEarliestWindowStartAt(): number {
  return roundUpToFiveMinutes(Date.now() + FIVE_MINUTES_MS);
}

function getInitialWindowStartAt(
  defaultWindowStartAt: number | undefined,
  fixedDate: Date,
): number {
  const initial = defaultWindowStartAt ?? fixedDate.getTime();
  return Math.max(initial, getEarliestWindowStartAt());
}

function toDateTimeInputValue(value: number): string {
  return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
}

function fromDateTimeInputValue(value: string): number | undefined {
  if (!value) return undefined;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

export function LeaseProposeWindowDialog(props: LeaseProposeWindowDialogProps) {
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
    fixedDate,
    defaultWindowStartAt,
    defaultPlace,
    defaultDetails,
    disabled,
    onConfirm,
    onBusyChange,
  } = props;

  const [open, setOpen] = useState(false);
  const [dateTime, setDateTime] = useState(() =>
    toDateTimeInputValue(
      getInitialWindowStartAt(defaultWindowStartAt, fixedDate),
    ),
  );
  const [place, setPlace] = useState(defaultPlace ?? "");
  const [details, setDetails] = useState(defaultDetails ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const t = useTranslations("LeaseProposeWindow");

  const windowStartAt = useMemo(() => {
    return fromDateTimeInputValue(dateTime);
  }, [dateTime]);
  const minDateTime = toDateTimeInputValue(getEarliestWindowStartAt());
  const isPastWindow =
    windowStartAt !== undefined && windowStartAt < Date.now() - 60_000;
  const meetingPreview =
    windowStartAt !== undefined
      ? t("windowPreview", {
          time: format(new Date(windowStartAt), "MMM d, HH:mm"),
        })
      : t("futureError");
  const trimmedDetails = details.trim();
  const trimmedPlace = place.trim();

  const setQuickOffset = (minutes: number) => {
    setDateTime(
      toDateTimeInputValue(roundUpToFiveMinutes(Date.now() + minutes * 60_000)),
    );
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) return;
    setDateTime(
      toDateTimeInputValue(
        getInitialWindowStartAt(defaultWindowStartAt, fixedDate),
      ),
    );
    setPlace(defaultPlace ?? "");
    setDetails(defaultDetails ?? "");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size={triggerSize}
          variant={triggerVariant}
          className={triggerClassName}
          disabled={Boolean(disabled)}
        >
          {TriggerIcon ? <TriggerIcon className="h-3.5 w-3.5 mr-1.5" /> : null}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? t("defaultDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="space-y-2">
            <Label htmlFor="meetup-date-time">{t("dateTimeLabel")}</Label>
            <Input
              id="meetup-date-time"
              type="datetime-local"
              value={dateTime}
              min={minDateTime}
              onChange={(event) => setDateTime(event.target.value)}
              className="h-10"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setQuickOffset(10)}
              >
                {t("quick.soon")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setQuickOffset(30)}
              >
                {t("quick.thirty")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setQuickOffset(60)}
              >
                {t("quick.hour")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setQuickOffset(24 * 60)}
              >
                {t("quick.tomorrow")}
              </Button>
            </div>
            <div
              className={cn(
                "flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950",
                isPastWindow &&
                  "border-destructive/30 bg-destructive/5 text-destructive",
              )}
            >
              <Clock3 className="h-3.5 w-3.5 shrink-0" />
              <span>{isPastWindow ? t("futureError") : meetingPreview}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meetup-place">{t("placeLabel")}</Label>
            <Input
              id="meetup-place"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              placeholder={t("placePlaceholder")}
              maxLength={160}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meetup-details">{t("detailsLabel")}</Label>
            <Textarea
              id="meetup-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder={t("detailsPlaceholder")}
              rows={4}
              maxLength={240}
            />
            <div className="text-xs text-muted-foreground">
              {t("detailsHint")}
            </div>
          </div>
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
            disabled={isSaving || !windowStartAt || isPastWindow}
            onClick={async () => {
              if (!windowStartAt) return;
              setIsSaving(true);
              onBusyChange?.(true);
              try {
                await onConfirm({
                  windowStartAt,
                  place: trimmedPlace || undefined,
                  note: trimmedDetails || undefined,
                });
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
