import { httpRouter } from "convex/server";
import { Webhook } from "standardwebhooks";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { resend } from "./resendClient";

const http = httpRouter();

http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) =>
    resend.handleResendEventWebhook(ctx, req),
  ),
});

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("CLERK_WEBHOOK_SECRET is not set");
    }

    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());

    const wh = new Webhook(webhookSecret);
    let payload: ClerkWebhookPayload;
    try {
      payload = wh.verify(body, headers) as ClerkWebhookPayload;
    } catch {
      return new Response("Invalid webhook signature", { status: 400 });
    }

    if (payload.type === "user.created" || payload.type === "user.updated") {
      const { id, email_addresses, first_name, last_name } = payload.data;
      const primaryEmail = email_addresses.find(
        (e) => e.id === payload.data.primary_email_address_id,
      );
      const email = primaryEmail?.email_address ?? null;
      const name = [first_name, last_name].filter(Boolean).join(" ") || null;

      await ctx.runMutation(internal.users.upsertFromWebhook, {
        clerkId: id,
        email,
        name,
      });

      if (payload.type === "user.created" && email) {
        await ctx.runAction(internal.emailSend.sendWelcome, {
          clerkId: id,
          email,
          name: name ?? "there",
        });
      }
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;

// Clerk webhook payload types
interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

interface ClerkWebhookData {
  id: string;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string;
  first_name: string | null;
  last_name: string | null;
}

interface ClerkWebhookPayload {
  type: "user.created" | "user.updated" | string;
  data: ClerkWebhookData;
}
