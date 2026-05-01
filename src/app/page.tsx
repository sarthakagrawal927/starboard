import { redirect } from "next/navigation";

import { SaaSMakerChangelog, SaaSMakerTestimonials } from "@/components/saasmaker-feedback";
import { SignInButton } from "@/components/sign-in-button";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/discover");
  return (
    <div className="flex min-h-svh flex-col items-center bg-background dark:bg-[oklch(0.1_0_0)]">
      <main className="flex w-full max-w-4xl flex-col items-center gap-16 px-6 py-24">
        {/* Hero */}
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Starboard
          </h1>
          <p className="max-w-md text-lg text-muted-foreground sm:text-xl">
            Discover and organize high-quality open-source repositories.
          </p>
          <div className="pt-4">
            <SignInButton />
          </div>
        </div>

        {/* Feature highlights */}
        <div className="grid w-full max-w-2xl gap-6 sm:grid-cols-3">
          <FeatureCard
            title="Filter"
            description="Search popular and community-starred repositories."
          />
          <FeatureCard
            title="Discover"
            description="Find similar repos with semantic search and embeddings."
          />
          <FeatureCard
            title="Organize"
            description="Save repos to your library, lists, and tags."
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
