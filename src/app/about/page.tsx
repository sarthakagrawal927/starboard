import Link from "next/link";

export const metadata = {
  title: "About — Starboard",
  description:
    "Starboard organizes your GitHub stars: hybrid lexical + semantic search, automated radar of momentum/maintenance/release signals, and bulk tagging.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-xs text-muted-foreground hover:underline">
        ← Starboard
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">About</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Starboard turns your GitHub stars into a usable library — searchable,
        taggable, and continuously refreshed with maintenance signals.
      </p>

      <section className="mt-8 space-y-2 text-sm leading-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          What it does
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Hybrid search.</strong> Lexical (FTS5 over name / description /
            topics) blended with semantic similarity over 768-dim embeddings —
            reciprocal-rank fusion.
          </li>
          <li>
            <strong>Radar.</strong> Auto-classifies stars into release /
            maintenance / momentum lanes. Flags archived repos and ones that
            haven&apos;t shipped in 6 or 12 months.
          </li>
          <li>
            <strong>Stack builder.</strong> Curate themed bundles of starred
            repos for sharing or revisiting.
          </li>
          <li>
            <strong>Tags + lists.</strong> Bulk-organize across hundreds of
            stars with auto-suggested tags from each repo&apos;s metadata.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-2 text-sm leading-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          What it isn&apos;t
        </h2>
        <p>
          A starring service. Star and unstar through GitHub normally —
          Starboard syncs the data and adds the layer above it.
        </p>
      </section>
    </main>
  );
}
