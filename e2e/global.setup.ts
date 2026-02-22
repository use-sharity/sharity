import { clerkSetup } from "@clerk/testing/playwright";
import { fullConfig } from "playwright/test";

export default async function globalSetup(config: fullConfig) {
	await clerkSetup({ rootDir: config.rootDir });
}
