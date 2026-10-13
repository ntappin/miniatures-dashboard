import { defineConfig } from "vite";

// Served from https://ntappin.github.io/miniatures-dashboard/
export default defineConfig({
  base: "/miniatures-dashboard/",
  test: { include: ["tests/**/*.test.ts"] },
} as never);
