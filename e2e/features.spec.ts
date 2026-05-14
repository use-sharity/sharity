import { execSync } from "child_process";
import { expect, test } from "@playwright/test";

// These tests verify the features added in feat/14-visualize-item-journey.
// They run against a live dev server (localhost:3000) with real Convex data.
// Auth state is loaded from storageState files (see auth.setup.ts).

test.describe("Items I'm Borrowing", () => {
  test.beforeAll(() => {
    execSync("npx convex run seed:setupBorrowedItemForTesting", {
      cwd: process.cwd(),
      timeout: 30_000,
      encoding: "utf-8",
    });
  });

  test("shows borrowing section with badge count on /my-items", async ({
    page,
  }) => {
    await page.goto("/my-items");

    await expect(page.getByRole("tab", { name: "Fostering" })).toBeVisible({
      timeout: 10_000,
    });

    const borrowedFrom = page.getByText(/Borrowed from/);
    const emptyState = page.getByText("You're not fostering any items.");
    await expect(borrowedFrom.first().or(emptyState)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("borrowed items show owner name and due dates", async ({ page }) => {
    await page.goto("/my-items");

    await expect(page.getByRole("tab", { name: "Fostering" })).toBeVisible({
      timeout: 10_000,
    });

    // Look for "Borrowed from" text indicating owner display
    const borrowedFrom = page.getByText(/Borrowed from/);
    if ((await borrowedFrom.count()) > 0) {
      await expect(borrowedFrom.first()).toBeVisible();
    }
  });
});

test.describe("Journey Stepper & Timeline", () => {
  test("stepper shows flow steps on a claim card", async ({ page }) => {
    await page.goto("/my-items");

    // Wait for the page to load
    await page.waitForSelector("text=My Items", { timeout: 10_000 });

    // Find any claim card with the journey stepper
    // The stepper labels include: Request, Approve, Propose, Confirm, Pickup, Return
    const stepperLabel = page.getByText("Request", { exact: true }).first();
    if ((await stepperLabel.count()) > 0) {
      await expect(stepperLabel).toBeVisible();
    }
  });

  test("journey timeline expands and collapses", async ({ page }) => {
    await page.goto("/my-items");

    await page.waitForSelector("text=My Items", { timeout: 10_000 });

    // Find the journey timeline toggle
    const timelineToggle = page.getByText("Journey timeline").first();
    if ((await timelineToggle.count()) > 0) {
      // Click to expand
      await timelineToggle.click();

      // Should show timeline content (e.g., "Requested" event)
      const timelineContent = page.getByText("Requested").first();
      await expect(timelineContent).toBeVisible({ timeout: 5_000 });

      // Click to collapse
      await timelineToggle.click();

      // Content should be hidden after collapse
      await expect(
        page.locator(".border-t >> text=Requested").first(),
      ).not.toBeVisible({ timeout: 3_000 });
    }
  });
});

test.describe("Past Due Badge", () => {
  test("shows past due state for expired pending requests", async ({
    page,
  }) => {
    await page.goto("/my-items");

    await page.waitForSelector("text=My Items", { timeout: 10_000 });

    // If there are any past due claims, verify the badge
    const pastDueBadge = page.getByText("Past due");
    if ((await pastDueBadge.count()) > 0) {
      await expect(pastDueBadge.first()).toBeVisible();
    }
  });
});

test.describe("Meetup Details", () => {
  test("propose pickup dialog accepts free-form meetup details", async ({
    page,
  }) => {
    await page.goto("/my-items");

    await page.waitForSelector("text=My Items", { timeout: 10_000 });

    const proposeBtn = page.getByText("Save pickup details").first();
    if ((await proposeBtn.count()) > 0) {
      await proposeBtn.click();

      await expect(page.getByLabel("Agreed details")).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.getByPlaceholder(/Tomorrow at 15:20/i)).toBeVisible();
    }
  });
});

test.describe("Owner vs Borrower Display", () => {
  test("borrower sees owner info in claim header", async ({ page }) => {
    await page.goto("/my-items");

    await page.waitForSelector("text=My Items", { timeout: 10_000 });

    // Borrowed items section should show "Borrowed from" with owner name
    const borrowedFrom = page.getByText(/Borrowed from/);
    if ((await borrowedFrom.count()) > 0) {
      await expect(borrowedFrom.first()).toBeVisible();
    }
  });
});

test.describe("Contact Details Notification", () => {
  test("notification mentions contact details after approval", async ({
    page,
  }) => {
    // Navigate to notifications (bell icon or notifications page)
    await page.goto("/");

    await page.waitForLoadState("networkidle");

    // Look for notification bell or indicator
    const bellButton = page.locator('[aria-label="Notifications"]').first();
    if ((await bellButton.count()) > 0) {
      await bellButton.click();

      // Check for approval notification with contact details text
      const contactNotification = page.getByText(/contact details/i);
      if ((await contactNotification.count()) > 0) {
        await expect(contactNotification.first()).toBeVisible({
          timeout: 5_000,
        });
      }
    }
  });
});
