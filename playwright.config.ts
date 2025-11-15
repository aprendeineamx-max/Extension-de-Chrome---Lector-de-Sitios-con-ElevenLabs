import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120000,
  expect: {
    timeout: 10000
  },
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    headless: false,
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  }
});
