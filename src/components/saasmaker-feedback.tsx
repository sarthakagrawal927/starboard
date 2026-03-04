"use client";

import { FeedbackWidget } from "@saas-maker/feedback";
import "@saas-maker/feedback/dist/index.css";
import { TestimonialWall } from "@saas-maker/testimonials";
import "@saas-maker/testimonials/dist/index.css";
import { ChangelogTimeline } from "@saas-maker/changelog-widget";
import "@saas-maker/changelog-widget/dist/index.css";

const API_KEY = process.env.NEXT_PUBLIC_SAASMAKER_API_KEY ?? "";
const API_BASE = "https://api.sassmaker.com";

export function SaaSMakerFeedback() {
  if (!API_KEY) return null;
  return (
    <FeedbackWidget
      projectId={API_KEY}
      apiBaseUrl={API_BASE}
      position="bottom-right"
      theme="auto"
    />
  );
}

export function SaaSMakerTestimonials() {
  if (!API_KEY) return null;
  return (
    <TestimonialWall
      projectId={API_KEY}
      apiBaseUrl={API_BASE}
      theme="auto"
      layout="grid"
    />
  );
}

export function SaaSMakerChangelog() {
  if (!API_KEY) return null;
  return (
    <ChangelogTimeline
      projectId={API_KEY}
      apiBaseUrl={API_BASE}
      theme="auto"
    />
  );
}
