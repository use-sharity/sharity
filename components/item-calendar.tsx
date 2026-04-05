"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export function ItemCalendar(props: React.ComponentProps<typeof Calendar>) {
  const { className, ...rest } = props;

  return (
    <Calendar
      className={cn("rounded-md border-0 mx-auto", className)}
      {...rest}
    />
  );
}
