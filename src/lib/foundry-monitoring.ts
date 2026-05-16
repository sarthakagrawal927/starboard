"use client";

import { initPostHog, track } from "@saas-maker/posthog-client";

type AuthFailureStage = "signin" | "signup" | "callback" | "session" | "unknown";
const PROJECT_SLUG = "starboard";

function route() {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

function messageFrom(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

export function captureAuthFailure(options: {
  provider?: string;
  stage?: AuthFailureStage;
  reason?: string;
  source?: string;
}) {
  track("foundry_auth_failure", {
    project_slug: PROJECT_SLUG,
    route: route(),
    provider: options.provider,
    stage: options.stage ?? "unknown",
    reason: options.reason,
    source: options.source,
  });
}

export function capturePageCrash(error: unknown, source: "window_error" | "unhandled_rejection") {
  track("foundry_page_crash", {
    project_slug: PROJECT_SLUG,
    route: route(),
    source,
    message: messageFrom(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

export function installBrowserMonitoring() {
  if (typeof window === "undefined") return () => {};
  initPostHog();

  const onError = (event: ErrorEvent) => capturePageCrash(event.error ?? event.message, "window_error");
  const onUnhandledRejection = (event: PromiseRejectionEvent) => capturePageCrash(event.reason, "unhandled_rejection");

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}
