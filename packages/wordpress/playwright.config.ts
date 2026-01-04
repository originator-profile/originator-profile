import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "e2e/setup.ts",
  globalTeardown: "e2e/teardown.ts",
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html"], process.env.CI ? ["dot"] : ["line"]],
  retries: process.env.CI ? 2 : 0,
  webServer: {
    command: "docker compose --env-file .env.development up",
    url: "http://localhost:9000",
    reuseExistingServer: true, // CI環境では https://github.com/originator-profile/originator-profile/blob/e8e5b4f0f473833b352649527a88fb7692b908da/.github/actions/wordpress_setup/action.yml#L6-L11
  },
  use: {
    baseURL: "http://localhost:9000/",
    storageState: "tmp/playwright-session.json",
    trace: process.env.CI ? "on-first-retry" : "on",
    video: process.env.CI ? "on-first-retry" : "on",
  },
});
