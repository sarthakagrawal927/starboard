import { SignInButton } from "@/components/sign-in-button";

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background dark:bg-[oklch(0.1_0_0)]">
      <main className="flex w-full max-w-4xl flex-col items-center gap-16 px-6 py-24">
        {/* Hero */}
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Starboard
          </h1>
          <p className="max-w-md text-lg text-muted-foreground sm:text-xl">
            Your GitHub stars, organized.
          </p>
          <div className="pt-4">
            <SignInButton />
          </div>
        </div>

        {/* Feature highlights */}
        <div className="grid w-full max-w-2xl gap-6 sm:grid-cols-3">
          <FeatureCard
            title="Filter"
            description="Filter by language, topics, and full-text search."
          />
          <FeatureCard
            title="Categorize"
            description="Smart auto-categories plus custom tags."
          />
          <FeatureCard
            title="Collect"
            description="Group repos into custom collections."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 text-card-foreground">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
