import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command: "PORT=3100 pnpm dev",
    env: {
      NEXT_PUBLIC_LUMI_CHAT_PROXY_PATH: "off",
      NEXT_PUBLIC_LUMI_UPLOAD_PROXY_PATH: "off",
    },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
});
