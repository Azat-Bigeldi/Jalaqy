import type { NextConfig } from "next";

// Корень проекта задан явно: выше по дереву лежит чужой package-lock.json.
const root = import.meta.dirname;

const nextConfig: NextConfig = {
  // Лендинг в dev собирается в свою папку: его можно запустить рядом с приложением
  ...(process.env.JALAQY_SITE === "landing" && process.env.NODE_ENV !== "production"
    ? { distDir: ".next-landing" }
    : {}),
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingRoot: root,
  turbopack: {
    root,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
