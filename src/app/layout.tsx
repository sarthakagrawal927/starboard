import "./globals.css";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import { SaaSMakerFeedback } from "@/components/saasmaker-feedback";
import { SaasMakerAnalytics } from "@/components/SaasMakerAnalytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Starboard",
  description: "Your GitHub stars, organized.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: "globalThis.__name=globalThis.__name||function(t){return t};",
          }}
        />
        <Providers>
          {children}
          <SaaSMakerFeedback />
          <SaasMakerAnalytics />
        </Providers>
      </body>
    </html>
  );
}
