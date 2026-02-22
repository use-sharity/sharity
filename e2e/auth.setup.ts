import { test as setup } from "@playwright/test";

const USER_A_STATE = "playwright/.auth/user-a.json";
const USER_B_STATE = "playwright/.auth/user-b.json";

async function loginAndSaveState(statePath: string, label: string) {
	setup(`authenticate ${label}`, async ({ page, context }) => {
		await page.goto("/");

		// Wait for user to manually log in via Clerk
		console.log(`\n--- Log in as ${label} in the browser window ---`);
		console.log("Then click 'Resume' in the Playwright Inspector.\n");

		// Pause lets you log in manually, then resume
		await page.pause();

		// Verify we're logged in by checking for a user-specific element
		await page.waitForSelector(
			'[data-testid="user-button"], .cl-userButtonTrigger',
			{
				timeout: 30_000,
			},
		);

		// Save signed-in state
		await context.storageState({ path: statePath });
		console.log(`Saved auth state for ${label} to ${statePath}`);
	});
}

loginAndSaveState(USER_A_STATE, "USER_A");
loginAndSaveState(USER_B_STATE, "USER_B");
