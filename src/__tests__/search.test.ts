import { describe, expect,it } from "vitest";

import { cosineSimilarity } from "@/lib/embeddings";
import { rrfFuse } from "@/lib/search";

describe("rrfFuse", () => {
  it("returns empty for empty input", () => {
    expect(rrfFuse([])).toEqual([]);
    expect(rrfFuse([[], []])).toEqual([]);
  });

  it("preserves single list order", () => {
    expect(rrfFuse([[3, 1, 2]])).toEqual([3, 1, 2]);
  });

  it("ranks items appearing in multiple lists higher than singletons", () => {
    // 1 appears in both lists at top => should win.
    // 2 appears only in list A. 3 appears only in list B.
    const result = rrfFuse([
      [1, 2],
      [1, 3],
    ]);
    expect(result[0]).toBe(1);
    expect(result.slice(1).sort()).toEqual([2, 3]);
  });

  it("rewards higher rank (lower index)", () => {
    // 10 is rank 0 in list A, rank 0 in list B. 20 is rank 0 in list A, rank 5 in list B.
    const result = rrfFuse([
      [10, 20],
      [10, 99, 98, 97, 96, 20],
    ]);
    expect(result[0]).toBe(10);
    expect(result[1]).toBe(20);
  });

  it("respects custom k constant", () => {
    // With small k, top-of-list items get larger boost differential.
    const a = rrfFuse([[1, 2, 3]], 1);
    expect(a).toEqual([1, 2, 3]);
  });

  it("dedupes ids appearing multiple times", () => {
    const result = rrfFuse([
      [1, 2, 3],
      [1, 2, 3],
    ]);
    expect(new Set(result).size).toBe(result.length);
    expect(result.length).toBe(3);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = [0.5, 0.3, 0.8];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 6);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
  });

  it("is scale invariant", () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 6);
  });

  it("returns 0 for zero vectors without NaN", () => {
    const r = cosineSimilarity([0, 0], [1, 1]);
    expect(Number.isNaN(r)).toBe(false);
    expect(r).toBe(0);
  });
});
