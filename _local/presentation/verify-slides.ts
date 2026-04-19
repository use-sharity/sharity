import { test, expect } from "@playwright/test";
import path from "path";

const HTML_PATH = path.resolve(__dirname, "onboarding-with-claude-code.html");
const SCREENSHOT_DIR = path.resolve(__dirname, "screenshots");
const TOTAL_SLIDES = 10;

test("logo stays at identical pixel position across all slides", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`file://${HTML_PATH}`);

  // Wait for Reveal.js to be ready
  await page.waitForFunction(() => {
    const r = (window as any).Reveal;
    return r && r.isReady && r.isReady();
  });

  const logoPositions: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = [];

  for (let i = 0; i < TOTAL_SLIDES; i++) {
    // Navigate to slide
    await page.evaluate((idx) => {
      (window as any).Reveal.slide(idx);
    }, i);

    // Small wait for transition
    await page.waitForTimeout(600);

    // Screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `slide-${i + 1}.png`),
      fullPage: false,
    });

    // Get logo bounding box
    const logo = page.locator(".fixed-branding");
    const box = await logo.boundingBox();
    expect(box, `Logo not found on slide ${i + 1}`).not.toBeNull();
    logoPositions.push(box!);

    console.log(
      `Slide ${i + 1}: logo at (${box!.x}, ${box!.y}) size ${box!.width}x${box!.height}`,
    );
  }

  // Assert all positions are identical (±0 tolerance)
  const reference = logoPositions[0];
  for (let i = 1; i < logoPositions.length; i++) {
    expect(logoPositions[i].x, `Slide ${i + 1} logo X differs`).toBe(
      reference.x,
    );
    expect(logoPositions[i].y, `Slide ${i + 1} logo Y differs`).toBe(
      reference.y,
    );
    expect(logoPositions[i].width, `Slide ${i + 1} logo width differs`).toBe(
      reference.width,
    );
    expect(logoPositions[i].height, `Slide ${i + 1} logo height differs`).toBe(
      reference.height,
    );
  }

  console.log(
    `\n✓ PASS: Logo position identical across all ${TOTAL_SLIDES} slides`,
  );
  console.log(
    `  Position: (${reference.x}, ${reference.y}) — ${reference.width}x${reference.height}`,
  );
});

test("logo is visually bright enough (contrast check)", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`file://${HTML_PATH}`);

  await page.waitForFunction(() => {
    const r = (window as any).Reveal;
    return r && r.isReady && r.isReady();
  });

  // Sample pixel color at the center of the logo on slide 1
  const logo = page.locator(".fixed-branding");
  const box = await logo.boundingBox();
  expect(box).not.toBeNull();

  // Sample a pixel at the center of one of the four squares (top-left quadrant of logo)
  const sampleX = Math.round(box!.x + box!.width * 0.25);
  const sampleY = Math.round(box!.y + box!.height * 0.25);

  const pixelColor = await page.evaluate(
    ({ x, y }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      // Use html2canvas-like approach: draw from screen
      // Instead, we check computed style/opacity of the logo
      const logo = document.querySelector(".fixed-branding") as HTMLElement;
      const computedOpacity = parseFloat(window.getComputedStyle(logo).opacity);
      return { computedOpacity };
    },
    { x: sampleX, y: sampleY },
  );

  console.log(`Logo computed opacity: ${pixelColor.computedOpacity}`);

  // The logo must have opacity >= 0.5 to be clearly visible on dark bg
  expect(
    pixelColor.computedOpacity,
    `Logo opacity ${pixelColor.computedOpacity} is too low — must be >= 0.5 for visibility`,
  ).toBeGreaterThanOrEqual(0.5);

  // Also verify the inline SVG has bright fills (not dark colors that blend with bg)
  const svgContent = await logo.evaluate((el) => el.outerHTML);
  console.log(`Logo SVG source: inline`);

  // Extract fill colors
  const fillMatches = svgContent.match(/fill="(#[0-9a-fA-F]{6})"/g) || [];
  const fills = fillMatches.map((m: string) => m.match(/#[0-9a-fA-F]{6}/)![0]);
  console.log(`SVG fill colors: ${fills.join(", ")}`);

  // Check that fill colors are bright (luminance > 150 on 0-255 scale)
  for (const fill of fills) {
    const r = parseInt(fill.slice(1, 3), 16);
    const g = parseInt(fill.slice(3, 5), 16);
    const b = parseInt(fill.slice(5, 7), 16);
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    console.log(
      `  ${fill}: RGB(${r},${g},${b}) luminance=${luminance.toFixed(0)}`,
    );
    expect(
      luminance,
      `Fill color ${fill} is too dark (luminance ${luminance.toFixed(0)} < 150). Logo won't be visible on #142e28 background.`,
    ).toBeGreaterThanOrEqual(150);
  }

  console.log("\n✓ PASS: Logo contrast is sufficient");
});
