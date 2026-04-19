import { execSync } from "child_process";
import { expect, test } from "@playwright/test";

// Journey timeline tests run as USER_B (borrower perspective).
// Seed creates 11 items owned by USER_A with claims from USER_B at each lifecycle stage.
// Tests navigate directly to /en/item/{id} to verify the stepper and timeline.

// Scenario definitions: key matches the shortKey from seed, completedSteps = green dots
const SCENARIOS = [
  { key: "requested", label: "Requested", completedSteps: 1, hasError: false },
  { key: "approved", label: "Approved", completedSteps: 2, hasError: false },
  {
    key: "pickup_proposed",
    label: "Pickup Proposed",
    completedSteps: 3,
    hasError: false,
  },
  {
    key: "pickup_confirmed",
    label: "Pickup Confirmed",
    completedSteps: 4,
    hasError: false,
  },
  {
    key: "picked_up",
    label: "Picked Up",
    completedSteps: 5,
    hasError: false,
  },
  {
    key: "return_proposed",
    label: "Return Proposed",
    completedSteps: 6,
    hasError: false,
  },
  {
    key: "return_confirmed",
    label: "Return Confirmed",
    completedSteps: 7,
    hasError: false,
  },
  { key: "returned", label: "Returned", completedSteps: 8, hasError: false },
  { key: "rejected", label: "Rejected", completedSteps: 1, hasError: true },
  { key: "expired", label: "Expired", completedSteps: 2, hasError: true },
  { key: "missing", label: "Missing", completedSteps: 5, hasError: true },
] as const;

let itemIds: Record<string, string> = {};

test.describe("Journey Timeline", () => {
  test.use({ storageState: "playwright/.auth/user-a.json" });

  test.beforeAll(async () => {
    // Seed test data and parse item IDs from output
    const output = execSync("npx convex run seed:setupJourneyTestScenarios", {
      cwd: process.cwd(),
      timeout: 30_000,
      encoding: "utf-8",
    });

    // Convex CLI outputs valid JSON — parse directly
    const parsed = JSON.parse(output);
    itemIds = parsed.itemIds;

    if (Object.keys(itemIds).length === 0) {
      throw new Error(
        `Failed to parse itemIds from seed output. Raw output:\n${output}`,
      );
    }
  });

  for (const scenario of SCENARIOS) {
    test(`shows '${scenario.label}' state correctly`, async ({ page }) => {
      const id = itemIds[scenario.key];
      if (!id) {
        throw new Error(
          `No itemId for scenario '${scenario.key}'. Available keys: ${Object.keys(itemIds).join(", ")}`,
        );
      }

      // Navigate directly to item detail page
      await page.goto(`/en/item/${id}`);

      // Terminal/error claims are hidden by default — click "Show Inactive" first
      if (scenario.hasError || scenario.completedSteps === 8) {
        const toggle = page.getByText("Show Inactive");
        await toggle.click({ timeout: 10_000 });
      }

      // Wait for the claim card to render
      const card = page.locator('[data-testid="claim-card"]').first();
      await expect(card).toBeVisible({ timeout: 15_000 });

      // Verify completed steps (green checkmark dots)
      const completedDots = card.locator(".rounded-full.bg-emerald-500");
      await expect(completedDots).toHaveCount(scenario.completedSteps, {
        timeout: 5_000,
      });

      if (scenario.hasError) {
        // Terminal states should show error dot(s)
        const errorDots = card.locator(".rounded-full.bg-destructive");
        const errorCount = await errorDots.count();
        expect(errorCount).toBeGreaterThanOrEqual(1);
      }

      if (!scenario.hasError && scenario.completedSteps < 8) {
        // Non-terminal incomplete states should have a current step
        const currentDots = card.locator(".animate-ping");
        const currentCount = await currentDots.count();
        expect(currentCount).toBeGreaterThanOrEqual(1);
      }
    });
  }

  test("journey timeline expands and shows events", async ({ page }) => {
    const id = itemIds["picked_up"];
    if (!id) throw new Error("No itemId for picked_up scenario");

    await page.goto(`/en/item/${id}`);

    const card = page.locator('[data-testid="claim-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Expand the journey timeline
    const toggle = card.getByText("Journey timeline");
    await expect(toggle).toBeVisible();
    await toggle.click();

    // Verify key events are shown in the timeline
    await expect(card.getByText("Requested").first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(card.getByText("Approved").first()).toBeVisible();
    await expect(card.getByText("Picked up").first()).toBeVisible();
  });

  test("rejected timeline shows terminal error", async ({ page }) => {
    const id = itemIds["rejected"];
    if (!id) throw new Error("No itemId for rejected scenario");

    await page.goto(`/en/item/${id}`);

    // Rejected claims are hidden by default
    const inactiveToggle = page.getByText("Show Inactive");
    await inactiveToggle.click({ timeout: 10_000 });

    const card = page.locator('[data-testid="claim-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Expand timeline
    const toggle = card.getByText("Journey timeline");
    await expect(toggle).toBeVisible();
    await toggle.click();

    // Should show "Rejected" event in the timeline
    await expect(card.getByText("Rejected").first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
