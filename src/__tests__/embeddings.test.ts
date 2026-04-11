import { describe, it, expect } from "vitest";
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
