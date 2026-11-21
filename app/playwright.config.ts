import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3108", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: [
    { command: "node e2e/supabase-server.mjs", url: "http://127.0.0.1:54329/health", reuseExistingServer: false },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3108",
      url: "http://127.0.0.1:3108/login",
      env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329", NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
