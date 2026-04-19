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
await page.evaluate(() =>
	localStorage.setItem("sharity.onboarding.v1.seen", "true"),
);

// LIST view first (won't auto-scroll)
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.getByRole("button", { name: "List" }).click();
await page.waitForTimeout(400);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/sharity-list-top.png", fullPage: false });

// MAP
await page.getByRole("button", { name: "Map" }).click();
await page.waitForTimeout(1200);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/sharity-map-top.png", fullPage: false });

// SWIPE — capture the post-auto-scroll state (real user experience)
await page.getByRole("button", { name: "Discover (swipe)" }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: "/tmp/sharity-swipe-top.png", fullPage: false });

// SWIPE pre-scroll: reload in discover mode and capture immediately before rAF fires
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(50);
await page.screenshot({
	path: "/tmp/sharity-swipe-prescroll.png",
	fullPage: false,
});

await browser.close();
console.log("done");
