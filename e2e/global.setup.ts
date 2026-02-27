import { clerkSetup } from "@clerk/testing/playwright";
import { type FullConfig } from "@playwright/test";

export default async function globalSetup(_: FullConfig) {
	await clerkSetup({ dotenv: true });
}
