"use client";

import * as React from "react";
import type { DateRange } from "react-day-picker";
import { useMutation, useQuery } from "convex/react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import type { ComponentProps } from "react";
import { useTranslations, useFormatter } from "next-intl";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";

interface OwnerUnavailabilityButtonProps {
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialStartDate?: Date;
  initialEndDate?: Date;
  dialogOnly?: boolean;
}

export function OwnerUnavailabilityButton(
  props: OwnerUnavailabilityButtonProps,
) {
  const t = useTranslations("OwnerUnavailability");
  const format = useFormatter();

  const className = props.className;
  const variant = props.variant ?? "outline";
  const size = props.size ?? "sm";

  const ranges = useQuery(api.items.getOwnerUnavailability);
  const addRange = useMutation(api.items.addOwnerUnavailabilityRange);
  const deleteRange = useMutation(api.items.deleteOwnerUnavailabilityRange);

  const isOnVacationNow = React.useMemo(() => {
    if (!ranges) return false;
    const now = Date.now();
    return ranges.some((r) => r.startDate <= now && now <= r.endDate);
  }, [ranges]);

  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = props.open ?? internalOpen;
  const setOpen = props.onOpenChange ?? setInternalOpen;

  const [date, setDate] = React.useState<DateRange | undefined>(undefined);
  const [note, setNote] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (props.initialStartDate && props.initialEndDate) {
      setDate({ from: props.initialStartDate, to: props.initialEndDate });
    }
  }, [props.initialStartDate, props.initialEndDate]);

  const canAdd = !!date?.from && !!date?.to && !isSaving;

  const onAdd = async () => {
    if (!date?.from || !date?.to) return;
    setIsSaving(true);
    try {
      await addRange({
        startDate: date.from.getTime(),
        endDate: date.to.getTime(),
        note: note.trim() ? note.trim() : undefined,
      });
      setDate(undefined);
      setNote("");
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async (id: Id<"owner_unavailability">) => {
    setIsSaving(true);
    try {
      await deleteRange({ id });
    } finally {
      setIsSaving(false);
    }
  };

  const formatRange = (startDate: number, endDate: number) => {
    return `${format.dateTime(new Date(startDate), {
      year: "numeric",
      month: "short",
      day: "numeric",
    })} – ${format.dateTime(new Date(endDate), {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}`;
  };

  const dialogContent = (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium">{t("yourRanges")}</div>
          {ranges === undefined ? (
            <div className="text-sm text-muted-foreground">{t("loading")}</div>
          ) : ranges.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("noRanges")}</div>
          ) : (
            <div className="space-y-2">
              {ranges.map((r) => (
                <div
                  key={r._id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm">
                      {formatRange(r.startDate, r.endDate)}
                    </div>
                    {r.note ? (
                      <div className="text-xs text-muted-foreground truncate">
                        {r.note}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={isSaving}
                    onClick={() =>
                      onDelete(r._id as Id<"owner_unavailability">)
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">{t("delete")}</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="text-sm font-medium">{t("addRange")}</div>
          <Calendar
            mode="range"
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
          />
          <Input
            placeholder={t("notePlaceholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end">
            <Button className="gap-2" disabled={!canAdd} onClick={onAdd}>
              <Plus className="h-4 w-4" />
              {isSaving ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  );

  if (props.dialogOnly) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn("gap-2", className)}
        >
          <CalendarDays className="h-4 w-4" />
          {t("button")}
          {isOnVacationNow ? (
            <Badge variant="secondary">{t("badgeOn")}</Badge>
          ) : null}
        </Button>
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
