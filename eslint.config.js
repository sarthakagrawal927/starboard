import config from "@saas-maker/eslint-config/next";

// Disable @saas-maker/fallow/audit until plugin is updated for ESLint 10
// (uses context.getFilename() which was removed in ESLint 10).
export default [
  {
    ignores: [
      ".cf-pages-bundle",
      ".open-next",
      ".wrangler",
      ".next",
      "out",
      "dist",
      "build",
      "node_modules",
    ],
  },
  ...config,
  {
    rules: {
      "@saas-maker/fallow/audit": "off",
    },
  },
];