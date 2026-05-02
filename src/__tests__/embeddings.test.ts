import { describe, expect,it } from "vitest";

import { buildRepoEmbeddingText, textHash } from "@/lib/embeddings";

describe("buildRepoEmbeddingText", () => {
  it("includes all repo fields separated by pipes", () => {
    const text = buildRepoEmbeddingText({
      full_name: "facebook/react",
      description: "A JavaScript library for building UIs",
      language: "JavaScript",
      topics: ["react", "frontend", "ui"],
    });
    expect(text).toBe(
      "facebook react | A JavaScript library for building UIs | JavaScript | react, frontend, ui"
    );
  });

  it("handles null description and language", () => {
    const text = buildRepoEmbeddingText({
      full_name: "user/repo",
      description: null,
      language: null,
      topics: [],
    });
    expect(text).toBe("user repo");
  });

  it("parses JSON string topics", () => {
    const text = buildRepoEmbeddingText({
      full_name: "user/repo",
      description: "desc",
      language: null,
      topics: '["a","b"]',
    });
    expect(text).toBe("user repo | desc | a, b");
  });

  it("includes AI metadata when available", () => {
    const text = buildRepoEmbeddingText({
      full_name: "promptfoo/promptfoo",
      description: "Test your prompts",
      language: "TypeScript",
      topics: ["evals"],
      ai: {
        summary: "LLM evaluation framework.",
        category: "ai-evals",
        subcategories: ["prompt testing"],
        use_cases: ["evaluate prompts"],
        keywords: ["evals", "promptfoo", "llm testing"],
      },
    });

    expect(text).toContain("LLM evaluation framework.");
    expect(text).toContain("ai-evals");
    expect(text).toContain("prompt testing");
    expect(text).toContain("llm testing");
  });
});

describe("textHash", () => {
  it("returns consistent hash for same input", () => {
    const h1 = textHash("hello world");
    const h2 = textHash("hello world");
    expect(h1).toBe(h2);
  });

  it("returns different hash for different input", () => {
    const h1 = textHash("hello");
    const h2 = textHash("world");
    expect(h1).not.toBe(h2);
  });
});
