import { chromium, devices } from "@playwright/test";
import { readFileSync } from "fs";

const storageState = JSON.parse(
	readFileSync("playwright/.auth/user-a.json", "utf8"),
);
const iPhone = devices["iPhone 13"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...iPhone, storageState });
const page = await ctx.newPage();

await page.goto("http://localhost:3001/en", { waitUntil: "networkidle" });
// dismiss onboarding if present
await page.evaluate(() =>
	localStorage.setItem("sharity.onboarding.v1.seen", "true"),
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);

// Default on mobile = discover/swipe
await page.screenshot({ path: "/tmp/sharity-swipe.png", fullPage: false });

// Switch to list
await page.getByRole("button", { name: "List" }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: "/tmp/sharity-list.png", fullPage: false });

// Switch to map
await page.getByRole("button", { name: "Map" }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/sharity-map.png", fullPage: false });

await browser.close();
console.log("done");
