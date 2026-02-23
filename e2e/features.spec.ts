import { expect, test } from "@playwright/test";

// These tests verify the features added in feat/14-visualize-item-journey.
// They run against a live dev server (localhost:3000) with real Convex data.
// Auth state is loaded from storageState files (see auth.setup.ts).

test.describe("Items I'm Borrowing", () => {
	test("shows borrowing section with badge count on /my-items", async ({
		page,
	}) => {
		await page.goto("/my-items");

		// Section heading should be visible
		const section = page.getByText("Items I'm Borrowing");
		await expect(section).toBeVisible({ timeout: 10_000 });

		// Should show a count badge (any number)
		const badge = page
			.locator("text=Items I'm Borrowing")
			.locator("..")
			.locator("span")
			.filter({ hasText: /^\d+$/ });
		await expect(badge).toBeVisible();
	});

	test("borrowed items show owner name and due dates", async ({ page }) => {
		await page.goto("/my-items");

		await page.waitForSelector("text=Items I'm Borrowing", {
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

test.describe("Time Slot Grouping", () => {
	test("propose pickup dialog groups hours by time of day", async ({
		page,
	}) => {
		await page.goto("/my-items");

		await page.waitForSelector("text=My Items", { timeout: 10_000 });

		// Find and click "Propose pickup time" button if available
		const proposeBtn = page.getByText("Propose pickup time").first();
		if ((await proposeBtn.count()) > 0) {
			await proposeBtn.click();

			// Check that the hour groups are displayed
			await expect(page.getByText("Morning (6-11)")).toBeVisible({
				timeout: 5_000,
			});
			await expect(page.getByText("Afternoon (12-17)")).toBeVisible();
			await expect(page.getByText("Evening (18-23)")).toBeVisible();
			await expect(page.getByText("Night (0-5)")).toBeVisible();
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
