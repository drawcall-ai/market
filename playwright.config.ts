import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
  },
  webServer: [
    {
      command: "pnpm dev:api",
      port: 8787,
      reuseExistingServer: true,
    },
    {
      command: "pnpm dev:web",
      port: 5173,
      reuseExistingServer: true,
    },
  ],
});
