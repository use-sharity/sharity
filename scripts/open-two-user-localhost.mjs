#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const baseUrl = process.env.BASE_URL ?? "http://localhost:3002";
const leftState = path.join(repoRoot, "playwright/.auth/user-a.json");
const rightState = path.join(repoRoot, "playwright/.auth/user-b.json");
const harnessPath = path.join(
  repoRoot,
  ".codex/manual-review/latest-manual-harness.json",
);
const shouldCloseStaleChrome = process.env.CLOSE_STALE_CHROME !== "0";

function closeStaleChromeForTesting() {
  if (!shouldCloseStaleChrome || process.platform !== "darwin") return;

  try {
    execFileSync("osascript", [
      "-e",
      'tell application "Google Chrome for Testing" to quit',
    ]);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700);
  } catch {
    // Chrome for Testing may not be running yet.
  }

  try {
    execFileSync("pkill", ["-f", "Google Chrome for Testing"], {
      stdio: "ignore",
    });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700);
  } catch {
    // No stale process left.
  }
}

function readHarness() {
  try {
    return JSON.parse(fs.readFileSync(harnessPath, "utf8"));
  } catch {
    return null;
  }
}

function localizeUrl(value) {
  if (!value) return `${baseUrl}/en`;
  try {
    const url = new URL(value);
    return `${baseUrl}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value.startsWith("/") ? `${baseUrl}${value}` : value;
  }
}

function readScreenBounds() {
  if (process.platform !== "darwin") {
    return { left: 0, top: 0, right: 1600, bottom: 1000 };
  }

  try {
    const output = execFileSync(
      "osascript",
      [
        "-l",
        "JavaScript",
        "-e",
        [
          'ObjC.import("AppKit")',
          "const screen = $.NSScreen.mainScreen",
          "const visible = screen.visibleFrame",
          "const frame = screen.frame",
          "[visible.origin.x, frame.size.height - (visible.origin.y + visible.size.height), visible.origin.x + visible.size.width, frame.size.height - visible.origin.y].join(\", \")",
        ].join("; "),
      ],
      { encoding: "utf8" },
    ).trim();
    const [left, top, right, bottom] = output
      .split(",")
      .map((value) => Number(value.trim()));
    if ([left, top, right, bottom].every(Number.isFinite)) {
      return { left, top, right, bottom };
    }
  } catch {
    // Fall back to a conservative laptop-sized layout below.
  }

  return { left: 0, top: 0, right: 1728, bottom: 1000 };
}

const harness = readHarness();
const leftUrl = localizeUrl(process.env.LEFT_URL ?? harness?.itemUrl);
const rightUrl = localizeUrl(process.env.RIGHT_URL ?? harness?.itemUrl);

const desktopBounds = readScreenBounds();
const screenLeft = desktopBounds.left;
const screenRight = Number(process.env.SCREEN_RIGHT ?? desktopBounds.right);
const screenWidth = Number(
  process.env.SCREEN_WIDTH ?? screenRight - screenLeft,
);
const windowTop = Number(process.env.WINDOW_TOP ?? desktopBounds.top);
const defaultWindowBottom = Math.min(desktopBounds.bottom, windowTop + 1000);
const windowBottom = Number(
  process.env.WINDOW_BOTTOM ?? defaultWindowBottom,
);
const windowWidth = Math.floor(screenWidth / 2);
const windowHeight = windowBottom - windowTop;
const shouldTileWindows = process.env.TILE_WINDOWS !== "0";

const profileRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "sharity-two-user-"),
);

async function openWindow({ label, storageState, url, x }) {
  if (!fs.existsSync(storageState)) {
    throw new Error(`Missing auth state for ${label}: ${storageState}`);
  }

  const browser = await chromium.launch({
    headless: false,
    args: [
      `--window-position=${x},0`,
      `--window-size=${windowWidth},${windowHeight}`,
    ],
  });
  const context = await browser.newContext({
    storageState,
    viewport: null,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.bringToFront();
  console.log(`${label}: ${url}`);
  return { browser, page };
}

async function setWindowBounds({ page }, bounds) {
  const session = await page.context().newCDPSession(page);
  const { windowId } = await session.send("Browser.getWindowForTarget");
  await session.send("Browser.setWindowBounds", {
    windowId,
    bounds: {
      left: bounds.left,
      top: bounds.top,
      width: bounds.right - bounds.left,
      height: bounds.bottom - bounds.top,
      windowState: "normal",
    },
  });
}

async function tileChromeWindows(windows) {
  if (!shouldTileWindows) return;

  const splitX = screenLeft + windowWidth;

  try {
    await setWindowBounds(windows[0], {
      left: screenLeft,
      top: windowTop,
      right: splitX,
      bottom: windowBottom,
    });
    await setWindowBounds(windows[1], {
      left: splitX,
      top: windowTop,
      right: screenRight,
      bottom: windowBottom,
    });
    console.log(
      `TILED: Chrome windows arranged in desktop bounds ${screenLeft},${windowTop},${screenRight},${windowBottom}`,
    );
  } catch (error) {
    console.warn(
      `WARN: Could not tile Chrome windows automatically: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const windows = [];

try {
  closeStaleChromeForTesting();

  windows.push(
    await openWindow({
      label: "USER_A left",
      storageState: leftState,
      url: leftUrl,
      x: screenLeft,
    }),
  );
  windows.push(
    await openWindow({
      label: "USER_B right",
      storageState: rightState,
      url: rightUrl,
      x: screenLeft + windowWidth,
    }),
  );
  await tileChromeWindows(windows);
  console.log("READY: two localhost windows are open");
  console.log("Press Ctrl+C in this terminal to close them.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

async function closeAll() {
  await Promise.allSettled(windows.map(({ browser }) => browser.close()));
  fs.rmSync(profileRoot, { recursive: true, force: true });
}

process.on("SIGINT", async () => {
  await closeAll();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await closeAll();
  process.exit(0);
});

process.stdin.resume();
