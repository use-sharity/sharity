import { chromium, devices } from "@playwright/test";
import { readFileSync } from "fs";
const storageState = JSON.parse(
	readFileSync("playwright/.auth/user-a.json", "utf8"),
);
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], storageState });
const page = await ctx.newPage();
await page.goto("http://localhost:3001/en?v=slim", {
	waitUntil: "networkidle",
});
await page.evaluate(() =>
	localStorage.setItem("sharity.onboarding.v1.seen", "true"),
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
// Find what's at position (30,30)
const el = await page.evaluate(() => {
	const e = document.elementFromPoint(30, 30);
	let cur = e;
	const chain = [];
	while (cur && chain.length < 6) {
		chain.push(
			`${cur.tagName}.${cur.className?.toString().slice(0, 60) ?? ""}`,
		);
		cur = cur.parentElement;
	}
	return chain.join(" > ");
});
console.log("at (30,30):", el);
await browser.close();
