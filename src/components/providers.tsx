"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { PostHogProvider } from "@saas-maker/posthog-client";
import { useEffect } from "react";

import { installBrowserMonitoring } from "@/lib/foundry-monitoring";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    return installBrowserMonitoring();
  }, []);

  return (
    <PostHogProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <SessionProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
        </SessionProvider>
      </ThemeProvider>
    </PostHogProvider>
  );
}
