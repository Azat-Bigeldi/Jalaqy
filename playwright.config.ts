import { defineConfig, devices } from "@playwright/test";

// Одна подпись сессии для сервера и для loginAs в тестах
process.env.SESSION_SECRET ??= "jalaqy-e2e-secret";

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  // мок-данные общие для сервера: тесты, которые их меняют, идут по одному
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL, locale: "ru-RU", timezoneId: "Asia/Almaty", screenshot: "only-on-failure" },
  projects: [
    {
      name: "mobile-390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    env: {
      JALAQY_E2E: "1",
      SESSION_SECRET: process.env.SESSION_SECRET,
      JALAQY_DATA_DIR: ".e2e-data",
      // e2e идут на моке, даже если в .env.local есть ключи Firebase
      FIREBASE_PROJECT_ID: "",
    },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
