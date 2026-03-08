import { SignInButton } from "@/components/sign-in-button";
import { SaaSMakerTestimonials, SaaSMakerChangelog } from "@/components/saasmaker-feedback";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/stars");
  return (
    <div className="flex min-h-svh flex-col items-center bg-background dark:bg-[oklch(0.1_0_0)]">
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
            title="Organize"
            description="Tag repos with custom colored labels."
          />
        </div>

        {/* Testimonials */}
        <div className="w-full max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">What people are saying</h2>
          <SaaSMakerTestimonials />
        </div>

        {/* Changelog */}
        <div className="w-full max-w-2xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Changelog</h2>
          <SaaSMakerChangelog />
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
