import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    // юнит-тесты сверяют цифры демо-компании: дата заморожена, как в демо
    env: { JALAQY_DEMO: "1", JALAQY_API_URL: "", FIREBASE_PROJECT_ID: "" },
  },
});
