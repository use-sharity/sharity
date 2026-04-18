import { expect, test } from "@playwright/test";

test("swipe-left advances one card at a time, not a cascade", async ({
	page,
}) => {
	const consoleLogs: string[] = [];
	page.on("console", (msg) => {
		consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
	});

	await page.goto("/");

	// Dismiss the SharePrompt onboarding modal that covers the deck on first
	// visits. The close button is the top-right X inside the dialog.
	const dismissModal = async () => {
		const closeButton = page.getByRole("button", { name: /close|×/i }).first();
		if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
			await closeButton.click();
			await page.waitForTimeout(300);
		}
	};
	await dismissModal();
	// Fallback: press Escape a few times to close any lingering dialogs.
	for (let i = 0; i < 3; i++) {
		await page.keyboard.press("Escape").catch(() => {});
		await page.waitForTimeout(150);
	}

	// Mobile default view is "discover". Wait for the top card to appear.
	const topCardLocator = page.locator('[data-testid="discover-top-card"]');
	await expect(topCardLocator).toBeVisible({ timeout: 15_000 });

	const readState = async () => {
		return page.evaluate(() => {
			const root = document.querySelector(
				"[data-testid=discover-deck-root]",
			) as HTMLElement | null;
			return {
				index: root?.dataset.index,
				currentId: root?.dataset.currentId,
				total: root?.dataset.total,
				isFlying: root?.dataset.isFlying,
			};
		});
	};

	const before = await readState();
	console.log("BEFORE swipe:", JSON.stringify(before));

	// Wait for Convex query to stabilize (total changes as query settles).
	await page.waitForTimeout(1500);

	// Attach diagnostic listeners so we see what events actually reach the
	// deck element. This tells us definitively whether our synthetic input
	// reaches framer-motion's drag handler.
	await page.evaluate(() => {
		for (const type of [
			"pointerdown",
			"pointermove",
			"pointerup",
			"touchstart",
			"touchmove",
			"touchend",
			"mousedown",
			"mousemove",
			"mouseup",
		]) {
			window.addEventListener(
				type,
				(e) => {
					const ev = e as PointerEvent;
					console.log(
						`[win] ${type} type=${ev.pointerType ?? "?"} at`,
						ev.clientX ?? "?",
						ev.clientY ?? "?",
						"target=",
						(ev.target as HTMLElement)?.tagName,
					);
				},
				{ capture: true },
			);
		}
	});

	const box = await topCardLocator.boundingBox();
	if (!box) throw new Error("no bounding box for top card");
	console.log("top card box:", box);

	const startX = box.x + box.width * 0.75;
	const startY = box.y + box.height / 2;
	const endX = box.x + box.width * 0.05;
	const endY = startY;

	// CDP touch events for Chromium — genuine touch input pipeline.
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [{ x: startX, y: startY, id: 0 }],
	});
	await page.waitForTimeout(30);
	const steps = 20;
	for (let i = 1; i <= steps; i++) {
		const t = i / steps;
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [
				{
					x: startX + (endX - startX) * t,
					y: startY + (endY - startY) * t,
					id: 0,
				},
			],
		});
		await page.waitForTimeout(10);
	}
	const midState = await readState();
	console.log("MID swipe (before release):", JSON.stringify(midState));
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchEnd",
		touchPoints: [],
	});

	// Wait for fly-off + remount (animation is 220ms + rAF re-enable).
	await page.waitForTimeout(800);

	const after = await readState();
	console.log("AFTER swipe 1:", JSON.stringify(after));

	const beforeIdx = Number(before.index);
	const afterIdx = Number(after.index);
	console.log(`INDEX delta swipe 1: ${beforeIdx} → ${afterIdx}`);
	expect(afterIdx - beforeIdx, "swipe 1 advances by 1").toBe(1);

	// Now simulate rapid successive swipes — the cascade scenario. Each one
	// should advance by exactly 1, not skip to the end.
	const doSwipeLeft = async (betweenDelayMs: number) => {
		// Re-query fresh to avoid any Playwright locator caching.
		const cardEl = page.locator('[data-testid="discover-top-card"]');
		await cardEl.waitFor({ state: "visible", timeout: 3000 });
		const freshBox = await cardEl.boundingBox();
		if (!freshBox) throw new Error("card vanished");
		const sx = freshBox.x + freshBox.width * 0.75;
		const sy = freshBox.y + freshBox.height / 2;
		const ex = freshBox.x + freshBox.width * 0.05;
		console.log(`  swipe box: ${JSON.stringify(freshBox)}`);
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ x: sx, y: sy, id: 0 }],
		});
		for (let i = 1; i <= 15; i++) {
			const t = i / 15;
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [{ x: sx + (ex - sx) * t, y: sy, id: 0 }],
			});
			await page.waitForTimeout(8);
		}
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
		await page.waitForTimeout(betweenDelayMs);
	};

	for (let i = 0; i < 5; i++) {
		const pre = await readState();
		const logsBefore = consoleLogs.length;
		const transform = await page.evaluate(() => {
			const el = document.querySelector(
				"[data-testid=discover-top-card]",
			) as HTMLElement | null;
			return el?.style.transform ?? "none";
		});
		console.log(`  pre-swipe transform: ${transform}`);
		await doSwipeLeft(400); // above animation duration (220+rAF)
		const post = await readState();
		const delta = Number(post.index) - Number(pre.index);
		console.log(
			`cascade swipe ${i + 2}: index ${pre.index} → ${post.index} (Δ=${delta}) isFlying=${post.isFlying}`,
		);
		for (const l of consoleLogs.slice(logsBefore)) {
			if (l.includes("[deck]")) console.log(`  ${l}`);
		}
		expect(delta, `cascade swipe ${i + 2} advances by 1`).toBe(1);
	}

	// Architectural cascade guard — a SINGLE touch-down / move / up gesture
	// must dismiss exactly one card. This is the definitive regression test
	// for the old shared-useMotionValue traps (1/2/4): in the broken code a
	// single swipe would cascade through the whole deck because the post-
	// exit state leaked into the newly promoted card's motion value. In the
	// popLayout + per-card-motion-value architecture, a gesture is bound to
	// one DOM element — it can't reach any other card once the top starts
	// exiting.
	const preSingle = await readState();
	const singleGestureBox = await topCardLocator.boundingBox();
	if (!singleGestureBox) throw new Error("no card for single-gesture test");
	{
		const sx = singleGestureBox.x + singleGestureBox.width * 0.75;
		const sy = singleGestureBox.y + singleGestureBox.height / 2;
		const ex = singleGestureBox.x + singleGestureBox.width * 0.05;
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ x: sx, y: sy, id: 0 }],
		});
		// Move well past the threshold and keep moving — a broken deck would
		// interpret the extended motion as multiple dismissals.
		for (let i = 1; i <= 40; i++) {
			const t = i / 40;
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [{ x: sx + (ex - sx) * t, y: sy, id: 0 }],
			});
			await page.waitForTimeout(6);
		}
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
	}
	await page.waitForTimeout(1000);
	const postSingle = await readState();
	const singleDelta = Number(postSingle.index) - Number(preSingle.index);
	console.log(
		`single long gesture: index ${preSingle.index} → ${postSingle.index} (Δ=${singleDelta})`,
	);
	expect(
		singleDelta,
		"a single touch gesture must advance by exactly 1 card",
	).toBe(1);

	// Rapid-but-discrete burst — 5 separate touch sessions fired with tiny
	// gaps. Unlike the old architecture which had to throttle these due to
	// shared state, the new deck intentionally allows the user to fast-flick
	// through items. Δ should equal the number of completed gestures. We
	// only assert it's within [3, 5] — the lower bound rules out the old
	// cascade-blocking throttle regressing, the upper bound rules out a new
	// cascade where one gesture triggers multiple dismissals.
	const preRapid = await readState();
	const doRapidSwipe = async () => {
		const freshBox = await topCardLocator.boundingBox();
		if (!freshBox) return;
		const sx = freshBox.x + freshBox.width * 0.75;
		const sy = freshBox.y + freshBox.height / 2;
		const ex = freshBox.x + freshBox.width * 0.05;
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ x: sx, y: sy, id: 0 }],
		});
		for (let i = 1; i <= 6; i++) {
			const t = i / 6;
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [{ x: sx + (ex - sx) * t, y: sy, id: 0 }],
			});
			await page.waitForTimeout(2);
		}
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchEnd",
			touchPoints: [],
		});
	};
	for (let i = 0; i < 5; i++) {
		await doRapidSwipe();
		await page.waitForTimeout(80);
	}
	await page.waitForTimeout(1000);
	const postRapid = await readState();
	const rapidDelta = Number(postRapid.index) - Number(preRapid.index);
	console.log(
		`rapid 5-gesture burst: index ${preRapid.index} → ${postRapid.index} (Δ=${rapidDelta})`,
	);
	expect(
		rapidDelta,
		"rapid burst should advance between 3 and 5 cards (one per gesture)",
	).toBeGreaterThanOrEqual(3);
	expect(
		rapidDelta,
		"rapid burst must not cascade beyond one card per gesture",
	).toBeLessThanOrEqual(5);

	await page.screenshot({
		path: "playwright-report/after-cascade-test.png",
	});

	// Dump console logs from the app for visibility.
	console.log("---- APP CONSOLE ----");
	for (const l of consoleLogs) console.log(" ", l);
});

// Regression for Isis' report 2026-04-18: a short left-flick near the card
// edge was opening /item/:id instead of dismissing. Root cause was framer's
// onTap firing because drag never engaged (movement < framer's ~3px drag
// threshold) OR engaged but distance was below our dismiss threshold and
// onTap still fired on pointerup.
test("short flick near card edge does not navigate to item page", async ({
	page,
}) => {
	await page.goto("/");

	const dismissModal = async () => {
		const closeButton = page.getByRole("button", { name: /close|×/i }).first();
		if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
			await closeButton.click();
			await page.waitForTimeout(300);
		}
	};
	await dismissModal();
	for (let i = 0; i < 3; i++) {
		await page.keyboard.press("Escape").catch(() => {});
		await page.waitForTimeout(150);
	}

	const topCardLocator = page.locator('[data-testid="discover-top-card"]');
	await expect(topCardLocator).toBeVisible({ timeout: 15_000 });
	await page.waitForTimeout(1500);

	const startUrl = page.url();
	const box = await topCardLocator.boundingBox();
	if (!box) throw new Error("no bounding box for top card");

	const cdp = await page.context().newCDPSession(page);

	// Simulate a short flick near the left edge of the card — movement is
	// ~30px horizontal, well below the 110px dismiss threshold but above
	// framer's 3px drag threshold. Historically this fell through to onTap.
	const sx = box.x + 40; // near left edge (but inside card)
	const sy = box.y + box.height / 2;
	const ex = box.x + 10;
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [{ x: sx, y: sy, id: 0 }],
	});
	for (let i = 1; i <= 10; i++) {
		const t = i / 10;
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [{ x: sx + (ex - sx) * t, y: sy, id: 0 }],
		});
		await page.waitForTimeout(10);
	}
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchEnd",
		touchPoints: [],
	});
	await page.waitForTimeout(800);

	expect(page.url(), "short flick must not navigate to item detail page").toBe(
		startUrl,
	);
});

// Positive counterpart to the flick test: a clean touch tap in the center of
// the card MUST navigate to the item detail page. Guards against the tap
// threshold creeping too tight (e.g. 2026-04-18 real-iPhone report: the tap
// guard introduced for the short-flick fix was suppressing legitimate taps
// because iOS finger jitter routinely exceeds 8px).
// Parameterized across the three A/B header variants. Tap logic in
// discover-deck.tsx is variant-agnostic (same code path regardless of ?v),
// but we run all three URLs to guarantee no regression if variant-specific
// chrome (hidden header, tighter tab bar) ever shifts the deck's box in a
// way that would confuse touch coordinates.
const VARIANTS = [
	{ name: "v1 (default)", url: "/" },
	{ name: "v2 (slim — no header/hero on mobile)", url: "/?v=slim" },
	{
		name: "v3 (slim3 — header kept, hero hidden, tighter tab bar)",
		url: "/?v=slim3",
	},
] as const;

for (const variant of VARIANTS) {
	test(`clean tap on top card navigates to item detail page — ${variant.name}`, async ({
		page,
	}) => {
		await page.goto(variant.url);

		const dismissModal = async () => {
			const closeButton = page
				.getByRole("button", { name: /close|×/i })
				.first();
			if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
				await closeButton.click();
				await page.waitForTimeout(300);
			}
		};
		await dismissModal();
		for (let i = 0; i < 3; i++) {
			await page.keyboard.press("Escape").catch(() => {});
			await page.waitForTimeout(150);
		}

		const topCardLocator = page.locator('[data-testid="discover-top-card"]');
		await expect(topCardLocator).toBeVisible({ timeout: 15_000 });
		await page.waitForTimeout(1500);

		const startUrl = page.url();
		const box = await topCardLocator.boundingBox();
		if (!box) throw new Error("no bounding box for top card");

		// Use playwright's locator.tap() — synthesizes a proper touch tap (touch
		// events + pointer events + click). CDP Input.dispatchTouchEvent alone
		// doesn't synthesize pointer events that framer-motion's onTap listens for.
		await topCardLocator.tap();

		await page.waitForURL(/\/item\//, { timeout: 5_000 });
		expect(page.url(), "clean tap must navigate to item detail page").not.toBe(
			startUrl,
		);
		expect(page.url(), "navigation should land on /item/:id").toMatch(
			/\/item\//,
		);
	});
}

// List-view tap regression — Agent A 2026-04-18 fix: item-card image was a
// plain div with no link, only the title text was a <Link>. Verify tapping
// on the card navigates to /item/:id.
test("tap on list-view card navigates to item detail page", async ({
	page,
}) => {
	await page.goto("/");

	const closeButton = page.getByRole("button", { name: /close|×/i }).first();
	if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
		await closeButton.click();
		await page.waitForTimeout(300);
	}

	// Mobile default is discover mode — click the List toggle to switch.
	const listButton = page.getByRole("button", { name: /^list$/i });
	await expect(listButton).toBeVisible({ timeout: 10_000 });
	await listButton.click();
	await page.waitForTimeout(500);

	// Find the first item card — the image link is the primary tap target.
	const firstItemLink = page.locator('a[href*="/item/"]').first();
	await expect(firstItemLink).toBeVisible({ timeout: 15_000 });

	const startUrl = page.url();
	await firstItemLink.tap();
	await page.waitForURL(/\/item\//, { timeout: 5_000 });
	expect(page.url()).not.toBe(startUrl);
	expect(page.url()).toMatch(/\/item\//);
});
