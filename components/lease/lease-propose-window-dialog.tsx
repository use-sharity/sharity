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
  defaultHour?: number;
  disabled?: boolean;
  onConfirm: (windowStartAt: number) => Promise<unknown>;
  onBusyChange?: (busy: boolean) => void;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatHourWindowLabel(hour: number): string {
  const start = `${pad2(hour)}:00`;
  const endHour = (hour + 1) % 24;
  const end = `${pad2(endHour)}:00`;
  return `${start}–${end}`;
}

/** Hour groups for better UX */
/** Hour groups for better UX */
const getHourGroups = (t: (key: string) => string) => [
  { label: t("groups.morning"), hours: [6, 7, 8, 9, 10, 11] },
  { label: t("groups.afternoon"), hours: [12, 13, 14, 15, 16, 17] },
  { label: t("groups.evening"), hours: [18, 19, 20, 21, 22, 23] },
  { label: t("groups.night"), hours: [0, 1, 2, 3, 4, 5] },
];

/**
 * Dialog that lets user pick a 1-hour window on a fixed date.
 */
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
    defaultHour,
    disabled,
    onConfirm,
    onBusyChange,
  } = props;

  const [open, setOpen] = useState(false);
  const [hourValue, setHourValue] = useState<string>(
    defaultHour !== undefined ? String(defaultHour) : "18",
  );
  const [isSaving, setIsSaving] = useState(false);
  const t = useTranslations("LeaseProposeWindow");
  const hourGroups = useMemo(() => getHourGroups(t), [t]);

  const hour = Number(hourValue);
  const dateLabel = useMemo(
    () => format(fixedDate, "MMM d, yyyy"),
    [fixedDate],
  );
  const windowLabel = useMemo(() => formatHourWindowLabel(hour), [hour]);

  const windowStartAt = useMemo(() => {
    // Use local date components to match what the user sees on the calendar
    // This ensures "today" at hour 23 creates a timestamp for today 23:00 local,
    // not yesterday 23:00 UTC
    const d = new Date(fixedDate);
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    // Create a date in local timezone with the selected hour, then get timestamp
    const localDate = new Date(year, month, day, hour, 0, 0, 0);
    return localDate.getTime();
  }, [fixedDate, hour]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            {description ?? t("defaultDescription", { date: dateLabel })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>{t("hourWindow")}</Label>
          <Select value={hourValue} onValueChange={setHourValue}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectHour")} />
            </SelectTrigger>
            <SelectContent>
              {hourGroups.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.hours.map((hour) => (
                    <SelectItem key={hour} value={String(hour)}>
                      {formatHourWindowLabel(hour)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">
            {t("proposed", { date: dateLabel, window: windowLabel })}
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
            disabled={isSaving}
            onClick={async () => {
              setIsSaving(true);
              onBusyChange?.(true);
              try {
                await onConfirm(windowStartAt);
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
