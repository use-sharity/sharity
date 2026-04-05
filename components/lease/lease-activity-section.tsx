"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  LeaseActivityTimeline,
  type LeaseActivityEvent,
} from "./lease-activity-timeline";

type LeaseActivitySectionProps = {
  events?: LeaseActivityEvent[];
};

/**
 * Collapsible activity timeline section for a lease.
 */
export function LeaseActivitySection(props: LeaseActivitySectionProps) {
  const { events } = props;
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("LeaseActivity");

  if (!events || events.length === 0) return null;

  return (
    <div className="border-t pt-2">
      <Button
        size="sm"
        variant="ghost"
        className="w-full justify-between h-8 px-2"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-xs font-medium">{t("timelineTitle")}</span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </Button>

      {expanded && (
        <div className="mt-2">
          <LeaseActivityTimeline events={events} />
        </div>
      )}
    </div>
  );
}
