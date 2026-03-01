"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Connecting to GitHub…",
  "Fetching your starred repos…",
  "Processing repository data…",
  "Almost there…",
];

export function SyncAnimation() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in
    const t0 = setTimeout(() => setVisible(true), 50);
    // Cycle through step messages
    const t1 = setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, 2200);
    return () => {
      clearTimeout(t0);
      clearInterval(t1);
    };
  }, []);

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-8 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {/* Animated star orbit */}
      <div className="relative flex size-24 items-center justify-center">
        {/* Center star */}
        <svg
          viewBox="0 0 24 24"
          className="size-10 animate-pulse fill-primary/80"
          aria-hidden="true"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>

        {/* Orbiting dots */}
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="absolute size-2 rounded-full bg-primary/60"
            style={{
              animation: `orbit 2.4s linear infinite`,
              animationDelay: `${(i / 5) * -2.4}s`,
            }}
          />
        ))}
      </div>

      {/* Step text */}
      <div className="text-center">
        <p
          key={step}
          className="text-base font-medium text-foreground"
          style={{ animation: "fadeSlideIn 0.4s ease both" }}
        >
          {STEPS[step]}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          This only takes a moment
        </p>
      </div>

      {/* Bouncing dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-primary/60"
            style={{
              animation: "bounce 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(44px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(44px) rotate(-360deg); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50%       { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export function SyncProgressBar() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
      <div
        className="h-full bg-primary"
        style={{ animation: "indeterminate 1.6s ease-in-out infinite" }}
      />
      <style>{`
        @keyframes indeterminate {
          0%   { transform: translateX(-100%) scaleX(0.3); }
          50%  { transform: translateX(0%)    scaleX(0.7); }
          100% { transform: translateX(100%)  scaleX(0.3); }
        }
      `}</style>
    </div>
  );
}
