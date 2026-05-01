import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["json", "text-summary"],
      exclude: [
        "node_modules",
        "dist",
        ".next",
        "coverage",
        "**/*.d.ts",
        "**/*.config.*",
        "**/test/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
