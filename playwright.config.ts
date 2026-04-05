import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

config({ path: ".env.local" });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  globalSetup: "./e2e/global.setup.ts",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "user-a",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user-a.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "user-b",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user-b.json",
      },
      dependencies: ["setup"],
    },
  ],
});
