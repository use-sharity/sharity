"use client";

import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { useEffect, useRef } from "react";

interface IdentifyProperties {
  email?: string;
  name?: string;
  username?: string;
}

export function PostHogIdentify() {
  const { user, isLoaded, isSignedIn } = useUser();
  const lastIdentifiedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !user) {
      if (lastIdentifiedUserIdRef.current !== null) {
        posthog.reset();
        lastIdentifiedUserIdRef.current = null;
      }
      return;
    }

    if (lastIdentifiedUserIdRef.current === user.id) {
      return;
    }

    const fullName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const identifyProperties: IdentifyProperties = {
      email: user.primaryEmailAddress?.emailAddress,
      name: fullName || undefined,
      username: user.username ?? undefined,
    };

    posthog.identify(user.id, identifyProperties);
    lastIdentifiedUserIdRef.current = user.id;
  }, [isLoaded, isSignedIn, user]);

  return null;
}
