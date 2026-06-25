import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 360_000,
  use: {
    screenshot: "on",
    video: "retain-on-failure",
  },
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
});
