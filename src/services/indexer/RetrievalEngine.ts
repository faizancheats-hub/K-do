import type { RetrievalOptions, RetrievalResult } from "../../types/context";
import { ContextTrimmer } from "../../utils/ContextTrimmer";
import { VectorStore } from "./VectorStore";

export class RetrievalEngine {
  private readonly trimmer = new ContextTrimmer();

  constructor(private readonly vectorStore: VectorStore) {}

  retrieve(queryVector: number[], query: string, options: RetrievalOptions): RetrievalResult[] {
    const dense = this.vectorStore.search(queryVector, options.topK * 2);
    const sparse = this.vectorStore.keywordSearch(query, options.topK * 2);
    const fused = new Map<string, RetrievalResult>();

    dense.forEach((result, index) => {
      fused.set(result.id, {
        ...result,
        score: (fused.get(result.id)?.score ?? 0) + 1 / (60 + index + 1)
      });
    });

    sparse.forEach((result, index) => {
      fused.set(result.id, {
        ...result,
        score: (fused.get(result.id)?.score ?? 0) + 1 / (60 + index + 1)
      });
    });

    const boosted = [...fused.values()].map((result) => ({
      ...result,
      score:
        result.score +
        (options.activeFilePath && result.path === options.activeFilePath ? 0.3 : 0) +
        ((options.openPaths ?? []).includes(result.path) ? 0.25 : 0) +
        ((options.recentPaths ?? []).includes(result.path) ? 0.15 : 0)
    }));

    const sorted = boosted.sort((left, right) => right.score - left.score);
    return this.trimmer.trimToBudget(sorted, options.maxTokens) as RetrievalResult[];
  }
}
