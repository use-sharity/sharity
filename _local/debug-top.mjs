import { chromium, devices } from "@playwright/test";
import { readFileSync } from "fs";
const storageState = JSON.parse(
	readFileSync("playwright/.auth/user-a.json", "utf8"),
);
const iPhone = devices["iPhone 13"];
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...iPhone, storageState });
const page = await ctx.newPage();
await page.goto("http://localhost:3001/en?v=slim", {
	waitUntil: "networkidle",
});
await page.evaluate(() =>
	localStorage.setItem("sharity.onboarding.v1.seen", "true"),
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
// crop top 200px
await page.screenshot({
	path: "/tmp/debug-v2-top.png",
	clip: { x: 0, y: 0, width: 390, height: 200 },
});
const html = await page.evaluate(
	() =>
		document.querySelector("header")?.outerHTML?.slice(0, 400) ?? "NO HEADER",
);
console.log(html);
await browser.close();
