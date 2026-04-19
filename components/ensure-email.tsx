"use client";

import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";

const SESSION_KEY = "emailEnsured";

/**
 * Backfills the user's email in Convex if it was missed by the Clerk webhook.
 * Renders nothing. Guards:
 *  1. Only fires when getMyProfile shows email is missing (zero extra DB reads otherwise).
 *  2. sessionStorage flag prevents re-fire across SPA navigation within a session.
 */
export function EnsureEmail() {
  const { isSignedIn } = useAuth();
  const profile = useQuery(api.users.getMyProfile, isSignedIn ? {} : "skip");
  const ensureEmail = useMutation(api.users.ensureEmail);

  useEffect(() => {
    if (!isSignedIn) return;
    if (profile === undefined) return; // still loading
    if (profile?.email) return; // email already on file
    if (sessionStorage.getItem(SESSION_KEY)) return; // already ran this session

    ensureEmail().then(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
    });
  }, [isSignedIn, profile, ensureEmail]);

  return null;
}
