import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";

export const FROM =
  process.env.RESEND_FROM_EMAIL ?? "Sharity <noreply@sharity-dalat.com>";

export const resend = new Resend(components.resend, { testMode: false });
