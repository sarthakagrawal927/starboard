import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  // Force-bundle libsql for the Worker target — opennext otherwise lazy-chunks
  // it as an external module and fails at runtime in workerd.
  transpilePackages: ["@libsql/client"],
};

export default nextConfig;

// Wire opennext-cloudflare for `next dev` so the AI binding (and any others)
// are available in development the same way they are in deployed Workers.
// No-op when not running under Next dev / opennext.
if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare")
    .then((m) => m.initOpenNextCloudflareForDev?.())
    .catch(() => {
      /* package not installed in this context — fine */
    });
}
