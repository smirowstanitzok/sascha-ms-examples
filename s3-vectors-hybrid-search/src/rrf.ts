// src/rrf.ts
// Custom Reciprocal Rank Fusion, in case you want to query full-text
// and vectors separately and weight them differently.
export interface RankedList {
  keys: string[];
  weight?: number;
}

export function reciprocalRankFusion(lists: RankedList[], k = 60): { key: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    const weight = list.weight ?? 1;
    list.keys.forEach((key, index) => {
      const rank = index + 1;
      scores.set(key, (scores.get(key) ?? 0) + weight / (k + rank));
    });
  }
  return [...scores.entries()]
    .map(([key, score]) => ({ key, score }))
    .sort((a, b) => b.score - a.score);
}
