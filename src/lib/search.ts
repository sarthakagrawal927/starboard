/**
 * Reciprocal Rank Fusion. Merges multiple ranked id lists into one ordering.
 * Items appearing in multiple lists, especially near the top, score higher.
 *
 *   score(id) = sum over each list i: 1 / (k + rank_i(id))
 *
 * `k=60` is the canonical default from the original RRF paper.
 */
export function rrfFuse(lists: number[][], k = 60): number[] {
  const scores = new Map<number, number>();
  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank++) {
      const id = list[rank];
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    }
  }
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}
