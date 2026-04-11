import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
