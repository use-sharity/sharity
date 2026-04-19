import { clerk } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

const USER_A_STATE = "playwright/.auth/user-a.json";
const USER_B_STATE = "playwright/.auth/user-b.json";

function loginAndSaveState(
  emailEnvVar: string,
  statePath: string,
  label: string,
) {
  setup(`authenticate ${label}`, async ({ page, context, baseURL }) => {
    const email = process.env[emailEnvVar];
    if (!email) throw new Error(`${emailEnvVar} is not set`);

    await page.goto(`${baseURL}/`);
    await clerk.signIn({
      page,
      emailAddress: email,
    });

    // Wait for Clerk to show logged-in state
    await page.waitForSelector(".cl-userButtonTrigger", {
      timeout: 30_000,
    });

    // Save session cookies + localStorage
    await context.storageState({ path: statePath });
    console.log(`Saved auth state for ${label} → ${statePath}`);
  });
}

loginAndSaveState("E2E_USER_A_EMAIL", USER_A_STATE, "USER_A");
loginAndSaveState("E2E_USER_B_EMAIL", USER_B_STATE, "USER_B");
