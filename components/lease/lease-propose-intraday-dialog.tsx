"use client";

import type { ComponentProps } from "react";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { format } from "date-fns";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ButtonSize = ComponentProps<typeof Button>["size"];

export type LeaseProposeIntradayDialogProps = {
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
  defaultStartHour?: number;
  defaultEndHour?: number;
  disabled?: boolean;
  onConfirm: (startAt: number, endAt: number) => Promise<unknown>;
  onBusyChange?: (busy: boolean) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatHourLabel(hour: number): string {
  return `${pad2(hour)}:00`;
}

/** Hour groups for better UX */
/** Hour groups for better UX */
const getHourGroups = (t: (key: string) => string) =>
  [
    { label: t("groups.morning"), hours: [6, 7, 8, 9, 10, 11] },
    { label: t("groups.afternoon"), hours: [12, 13, 14, 15, 16, 17] },
    { label: t("groups.evening"), hours: [18, 19, 20, 21, 22, 23] },
    { label: t("groups.night"), hours: [0, 1, 2, 3, 4, 5] },
  ] as const;

/**
 * Dialog that lets user pick start and end hour on a fixed date (no minutes).
 */
export function LeaseProposeIntradayDialog(
  props: LeaseProposeIntradayDialogProps,
) {
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
    defaultStartHour,
    defaultEndHour,
    disabled,
    onConfirm,
    onBusyChange,
    open: controlledOpen,
    onOpenChange,
    showTrigger = true,
  } = props;
  const t = useTranslations("LeaseProposeIntraday");
  const HOUR_GROUPS = useMemo(() => getHourGroups(t), [t]);

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [startHourValue, setStartHourValue] = useState<string>(
    defaultStartHour !== undefined ? String(defaultStartHour) : "18",
  );
  const [endHourValue, setEndHourValue] = useState<string>(
    defaultEndHour !== undefined ? String(defaultEndHour) : "20",
  );
  const [isSaving, setIsSaving] = useState(false);

  const startHour = Number(startHourValue);
  const endHour = Number(endHourValue);

  const dateLabel = useMemo(
    () => format(fixedDate, "MMM d, yyyy"),
    [fixedDate],
  );

  const startAt = useMemo(() => {
    const d = new Date(fixedDate);
    d.setHours(startHour, 0, 0, 0);
    return d.getTime();
  }, [fixedDate, startHour]);

  const endAt = useMemo(() => {
    const d = new Date(fixedDate);
    d.setHours(endHour, 0, 0, 0);
    // If end hour is less than start hour, it means the window crosses midnight
    // Only allow this if endHour is 0 (midnight) - otherwise it's not intraday
    if (endHour < startHour && endHour === 0) {
      d.setDate(d.getDate() + 1);
    }
    return d.getTime();
  }, [fixedDate, endHour, startHour]);

  // Valid if:
  // 1. End hour is after start hour (normal case), OR
  // 2. End hour is 0 and start hour is > 0 (crosses midnight, still intraday)
  // Invalid if start and end are the same, or if end < start but end !== 0
  const isValid = endHour > startHour || (endHour === 0 && startHour > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button
            size={triggerSize}
            variant={triggerVariant}
            className={triggerClassName}
            disabled={Boolean(disabled)}
          >
            {TriggerIcon ? (
              <TriggerIcon className="h-3.5 w-3.5 mr-1.5" />
            ) : null}
            {triggerLabel}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? t("defaultDescription", { date: dateLabel })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("startHour")}</Label>
            <Select value={startHourValue} onValueChange={setStartHourValue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectStartHour")} />
              </SelectTrigger>
              <SelectContent>
                {HOUR_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.hours.map((hour) => (
                      <SelectItem key={hour} value={String(hour)}>
                        {formatHourLabel(hour)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("endHour")}</Label>
            <Select value={endHourValue} onValueChange={setEndHourValue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectEndHour")} />
              </SelectTrigger>
              <SelectContent>
                {HOUR_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.hours.map((hour) => (
                      <SelectItem key={hour} value={String(hour)}>
                        {formatHourLabel(hour)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {!isValid ? (
              <div className="text-xs text-destructive">
                {endHour === startHour
                  ? t("errors.sameHour")
                  : t("errors.multiDay")}
              </div>
            ) : null}
          </div>

          <div className="text-xs text-muted-foreground">
            {t("proposed", {
              date: dateLabel,
              start: formatHourLabel(startHour),
              end:
                endHour <= startHour
                  ? `${format(new Date(fixedDate.getTime() + 24 * 60 * 60 * 1000), "MMM d")} ${formatHourLabel(endHour)}`
                  : formatHourLabel(endHour),
            })}
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
            disabled={isSaving || !isValid}
            onClick={async () => {
              if (!isValid) return;
              setIsSaving(true);
              onBusyChange?.(true);
              try {
                await onConfirm(startAt, endAt);
                setOpen(false);
              } finally {
                setIsSaving(false);
                onBusyChange?.(false);
              }
            }}
          >
            {isSaving ? t("saving", { label: confirmLabel }) : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
