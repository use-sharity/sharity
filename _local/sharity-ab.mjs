import { chromium, devices } from "@playwright/test";
import { readFileSync } from "fs";

const storageState = JSON.parse(
	readFileSync("playwright/.auth/user-a.json", "utf8"),
);
const iPhone = devices["iPhone 13"];

const browser = await chromium.launch();

async function shoot(url, out) {
	const ctx = await browser.newContext({ ...iPhone, storageState });
	const page = await ctx.newPage();
	await page.goto(url, { waitUntil: "networkidle" });
	await page.evaluate(() =>
		localStorage.setItem("sharity.onboarding.v1.seen", "true"),
	);
	await page.reload({ waitUntil: "networkidle" });
	await page.waitForTimeout(600);
	await page.getByRole("button", { name: "List" }).click();
	await page.waitForTimeout(300);
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(200);
	await page.screenshot({ path: `/tmp/ab-${out}-list.png` });
	await page.getByRole("button", { name: "Map" }).click();
	await page.waitForTimeout(1200);
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(200);
	await page.screenshot({ path: `/tmp/ab-${out}-map.png` });
	await page.getByRole("button", { name: "Discover (swipe)" }).click();
	await page.waitForTimeout(300);
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(50);
	await page.screenshot({ path: `/tmp/ab-${out}-swipe.png` });
	await ctx.close();
}

await shoot("http://localhost:3001/en", "v1");
await shoot("http://localhost:3001/en?v=slim", "v2");
await browser.close();
console.log("done");
