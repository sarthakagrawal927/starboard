import Link from "next/link";

export const metadata = {
  title: "Terms — Starboard",
  description: "Use of Starboard is provided as-is. We only read your public GitHub stars.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm leading-7">
      <Link href="/" className="text-xs text-muted-foreground hover:underline">
        ← Starboard
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Terms</h1>
      <p className="mt-4 text-xs text-muted-foreground">Last updated: 2026-05-15.</p>

      <h2 className="mt-8 text-base font-semibold">What we use</h2>
      <p className="mt-2">
        Starboard reads your public GitHub stars and the public metadata
        of starred repos (name, description, stars, language, topics,
        archived flag, push date). Nothing private.
      </p>

      <h2 className="mt-8 text-base font-semibold">Be polite to GitHub</h2>
      <p className="mt-2">
        Embedded API calls run against your OAuth token&apos;s rate
        limit (5,000/hour). Heavy bulk refreshes may temporarily get
        throttled until your quota resets.
      </p>

      <h2 className="mt-8 text-base font-semibold">No warranty</h2>
      <p className="mt-2">
        Provided as-is. Embeddings, radar classifications, and
        recommendations are heuristic — sanity-check anything you
        action on.
      </p>
    </main>
  );
}
