import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    // Global snapshot policy — matches the shared visual-regression setup.
    // Individual specs may override `maxDiffPixelRatio` for very content-heavy
    // regions (see e.g. profile tab content).
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },
  use: {
    baseURL: "http://localhost:8080",
    headless: true,
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
