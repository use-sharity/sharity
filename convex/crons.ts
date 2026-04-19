import { cronJobs } from "convex/server";
import { components, internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const crons = cronJobs();

crons.interval(
  "resolve_overdue_lease_proposals",
  { minutes: 5 },
  internal.items.resolveOverdueProposals,
);

// Daily digest at 09:00 UTC+7 (02:00 UTC) — Da Lat local morning
crons.daily(
  "daily_activity_digest",
  { hourUTC: 2, minuteUTC: 0 },
  internal.emailSend.sendDailyDigests,
);

// Weekly digest — Monday morning (same local time)
crons.weekly(
  "weekly_activity_digest",
  { dayOfWeek: "monday", hourUTC: 2, minuteUTC: 0 },
  internal.emailSend.sendWeeklyDigests,
);

crons.interval(
  "cleanup resend emails",
  { hours: 1 },
  internal.crons.cleanupResend,
);

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const cleanupResend = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, components.resend.lib.cleanupOldEmails, {
      olderThan: ONE_WEEK_MS,
    });
    await ctx.scheduler.runAfter(
      0,
      components.resend.lib.cleanupAbandonedEmails,
      { olderThan: 4 * ONE_WEEK_MS },
    );
  },
});

export default crons;
