import { defineConfig } from "@playwright/test";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 360, height: 800 },
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  globalSetup: "./e2e/globalSetup.ts",
  webServer: {
    command: `API_PROXY_TARGET=${apiUrl} npm run dev -- --host 127.0.0.1`,
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
