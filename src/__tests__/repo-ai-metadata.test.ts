import { describe, expect, it } from "vitest";

import {
  buildRepoAiMetadataPrompt,
  buildRepoAiSourceText,
  inferRepoAiMetadata,
  normalizeRepoAiMetadata,
  repoAiSourceHash,
} from "@/lib/repo-ai-metadata";

const repo = {
  full_name: "promptfoo/promptfoo",
  description: "Test your prompts, agents, and RAGs",
  language: "TypeScript",
  topics: ["evals", "llm", "testing"],
};

describe("repo AI metadata helpers", () => {
  it("builds compact source text from repo metadata", () => {
    const text = buildRepoAiSourceText(repo);

    expect(text).toContain("name: promptfoo/promptfoo");
    expect(text).toContain("description: Test your prompts");
    expect(text).toContain("topics: evals, llm, testing");
  });

  it("hashes source text deterministically", () => {
    expect(repoAiSourceHash(repo)).toBe(repoAiSourceHash(repo));
  });

  it("builds a JSON-only classification prompt", () => {
    const prompt = buildRepoAiMetadataPrompt(repo);

    expect(prompt).toContain("Return only compact JSON");
    expect(prompt).toContain("ai-evals");
    expect(prompt).toContain("promptfoo/promptfoo");
  });

  it("normalizes model output to bounded metadata", () => {
    const normalized = normalizeRepoAiMetadata({
      summary: " A useful LLM eval platform. ",
      category: "ai-evals",
      subcategories: ["Prompt Testing", "Prompt Testing", "RAG!!!"],
      use_cases: ["Evaluate prompts", 123, "Compare models"],
      keywords: Array.from({ length: 20 }, (_, i) => `keyword-${i}`),
    });

    expect(normalized.summary).toBe("A useful LLM eval platform.");
    expect(normalized.category).toBe("ai-evals");
    expect(normalized.subcategories).toEqual(["prompt testing", "rag"]);
    expect(normalized.use_cases).toEqual(["evaluate prompts", "compare models"]);
    expect(normalized.keywords).toHaveLength(10);
  });

  it("falls back for invalid categories", () => {
    const normalized = normalizeRepoAiMetadata({ category: "magic" });

    expect(normalized.category).toBe("unknown");
  });

  it("infers eval taxonomy without a model call", () => {
    const metadata = inferRepoAiMetadata(repo);

    expect(metadata.category).toBe("ai-evals");
    expect(metadata.keywords).toContain("evals");
    expect(metadata.use_cases).toContain("evaluate prompts");
  });
});
