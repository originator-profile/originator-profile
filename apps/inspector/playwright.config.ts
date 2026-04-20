import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    url: "http://localhost:8080",
    command: "astro --root=dev dev",
    reuseExistingServer: !process.env.CI,
  },
  globalSetup: "e2e/global-setup.ts",
  globalTeardown: "e2e/global-teardown.ts",
  projects: [
    {
      name: "ja",
      testDir: "e2e",
      testIgnore: "**/en/**",
    },
    {
      name: "en",
      testDir: "e2e/en",
    },
  ],
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html"], process.env.CI ? ["dot"] : ["line"]],
  retries: process.env.CI ? 2 : 0,
  use: {
    trace: process.env.CI ? "on-first-retry" : "on",
    video: process.env.CI ? "on-first-retry" : "on",
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 50,
      threshold: 0.05,
    },
  },
});
