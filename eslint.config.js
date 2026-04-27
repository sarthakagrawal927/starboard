import config from "@saas-maker/eslint-config/next";

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
];