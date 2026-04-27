import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline/eval required by Next.js
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://avatars.githubusercontent.com https://github.com",
      "connect-src 'self' https://api.github.com https://*.turso.io",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  // Force-bundle libsql for the Worker target — opennext otherwise lazy-chunks
  // it as an external module and fails at runtime in workerd.
  transpilePackages: ["@libsql/client"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
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
