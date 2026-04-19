import { test } from "@playwright/test";

// Record a slowed-down single swipe with video capture so we can extract
// per-frame stills and inspect the edge flicker on the newly promoted top
// card.
test.use({
	video: {
		mode: "on",
		size: { width: 393, height: 851 },
	},
	launchOptions: {
		args: ["--force-device-scale-factor=2"],
	},
});

test("capture flicker video", async ({ page }) => {
	await page.goto("/");

	const closeBtn = page.getByRole("button", { name: /close|×/i }).first();
	if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
		await closeBtn.click();
		await page.waitForTimeout(300);
	}
	for (let i = 0; i < 3; i++) {
		await page.keyboard.press("Escape").catch(() => {});
		await page.waitForTimeout(100);
	}

	const topCard = page.locator('[data-testid="discover-top-card"]');
	await topCard.waitFor({ state: "visible", timeout: 15_000 });
	await page.waitForTimeout(2000); // let Convex query settle

	const box = await topCard.boundingBox();
	if (!box) throw new Error("no box");

	const sx = box.x + box.width * 0.75;
	const sy = box.y + box.height / 2;
	const ex = box.x + box.width * 0.05;

	const cdp = await page.context().newCDPSession(page);

	// Hold a beat so we have "before" frames.
	await page.waitForTimeout(600);

	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [{ x: sx, y: sy, id: 0 }],
	});
	const steps = 15;
	for (let i = 1; i <= steps; i++) {
		const t = i / steps;
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [{ x: sx + (ex - sx) * t, y: sy, id: 0 }],
		});
		await page.waitForTimeout(12);
	}
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchEnd",
		touchPoints: [],
	});

	// Capture the full transition + settle period. flyOff is 220ms, promote
	// animation is 180ms. Hold for 1.5s to see the flicker clearly.
	await page.waitForTimeout(1500);
});
