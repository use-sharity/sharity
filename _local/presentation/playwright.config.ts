import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "verify-slides.ts",
  use: {
    browserName: "chromium",
    viewport: { width: 1920, height: 1080 },
  },
});
