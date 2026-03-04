import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Providers } from "@/components/providers";
import { SaaSMakerFeedback } from "@/components/saasmaker-feedback";

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
        <Providers>
          {children}
          <SaaSMakerFeedback />
        </Providers>
        <Script
          src="https://unpkg.com/@saas-maker/analytics-sdk@0.2.0/dist/index.global.js"
          data-project={process.env.NEXT_PUBLIC_SAASMAKER_API_KEY}
          data-api="https://api.sassmaker.com"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
