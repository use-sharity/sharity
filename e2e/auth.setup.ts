import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

const USER_A_STATE = "playwright/.auth/user-a.json";
const USER_B_STATE = "playwright/.auth/user-b.json";

/**
 * Create a Clerk sign-in token via the Backend API.
 * Returns the raw ticket (JWT) to use with __clerk_ticket param.
 */
async function createSignInTicket(userId: string): Promise<string> {
	const secretKey = process.env.CLERK_SECRET_KEY;
	if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set");

	const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${secretKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ user_id: userId }),
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Failed to create sign-in token: ${res.status} ${body}`);
	}

	const data = await res.json();
	return data.token as string;
}

function loginAndSaveState(userId: string, statePath: string, label: string) {
	setup(`authenticate ${label}`, async ({ page, context, baseURL }) => {
		await setupClerkTestingToken({ page });

		// Create sign-in ticket and navigate to OUR app with it
		const ticket = await createSignInTicket(userId);
		await page.goto(`${baseURL}/?__clerk_ticket=${ticket}`);

		// Wait for Clerk to process the ticket and show logged-in state
		await page.waitForSelector(".cl-userButtonTrigger", {
			timeout: 30_000,
		});

		// Save session cookies + localStorage
		await context.storageState({ path: statePath });
		console.log(`Saved auth state for ${label} → ${statePath}`);
	});
}

const USER_A_ID = process.env.E2E_USER_A_ID!;
const USER_B_ID = process.env.E2E_USER_B_ID!;

loginAndSaveState(USER_A_ID, USER_A_STATE, "USER_A");
loginAndSaveState(USER_B_ID, USER_B_STATE, "USER_B");
