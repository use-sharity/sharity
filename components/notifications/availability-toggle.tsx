"use client";

import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function AvailabilityToggle({ id }: { id: Id<"items"> }) {
  const isSubscribed = useQuery(api.notifications.getAvailabilitySubscription, {
    id,
  });
  const toggleSubscription = useMutation(
    api.notifications.subscribeAvailability,
  );

  const handleToggle = async () => {
    await toggleSubscription({ id });
  };

  if (isSubscribed === undefined) {
    return null; // Loading state
  }

  return (
    <Button
      variant={isSubscribed ? "secondary" : "outline"}
      className="h-10 gap-2"
      onClick={handleToggle}
    >
      {isSubscribed ? (
        <>
          <BellOff className="h-4 w-4" />
          Unsubscribe
        </>
      ) : (
        <>
          <Bell className="h-4 w-4" />
          Notify when available
        </>
      )}
    </Button>
  );
}
