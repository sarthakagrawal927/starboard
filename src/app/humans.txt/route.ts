export const dynamic = "force-static";

const BODY = `/* TEAM */
Maintainer: Sarthak Agrawal
GitHub: sarthakagrawal927

/* SITE */
Last updated: 2026-05-15
Software: Next.js, React, Drizzle ORM (libsql_vector_idx), Turso, Cloudflare Workers
`;

export function GET() {
  return new Response(BODY, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
