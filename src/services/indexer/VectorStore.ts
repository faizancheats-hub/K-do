import type { ContextChunk, RetrievalResult } from "../../types/context";

interface StoredChunk {
  chunk: ContextChunk;
  vector: number[];
}

export class VectorStore {
  private readonly byPath = new Map<string, StoredChunk[]>();

  upsert(path: string, chunks: ContextChunk[], vectors: number[][]): void {
    this.byPath.set(
      path,
      chunks.map((chunk, index) => ({
        chunk: { ...chunk, vector: vectors[index] },
        vector: vectors[index]
      }))
    );
  }

  remove(path: string): void {
    this.byPath.delete(path);
  }

  clear(): void {
    this.byPath.clear();
  }

  countFiles(): number {
    return this.byPath.size;
  }

  countChunks(): number {
    return [...this.byPath.values()].reduce((sum, chunks) => sum + chunks.length, 0);
  }

  paths(): string[] {
    return [...this.byPath.keys()].sort((left, right) => left.localeCompare(right));
  }

  allChunks(): ContextChunk[] {
    return [...this.byPath.values()].flatMap((items) => items.map((item) => item.chunk));
  }

  search(queryVector: number[], topK: number): RetrievalResult[] {
    return [...this.byPath.values()]
      .flatMap((items) =>
        items.map(({ chunk, vector }) => ({
          ...chunk,
          score: cosineSimilarity(queryVector, vector),
          denseScore: cosineSimilarity(queryVector, vector),
          sparseScore: 0
        }))
      )
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);
  }

  keywordSearch(query: string, topK: number): RetrievalResult[] {
    const tokens = tokenize(query);
    return this.allChunks()
      .map((chunk) => {
        const sparseScore = scoreKeywords(tokens, chunk.keywords, chunk.content);
        return {
          ...chunk,
          score: sparseScore,
          denseScore: 0,
          sparseScore
        };
      })
      .filter((chunk) => chunk.sparseScore > 0)
      .sort((left, right) => right.sparseScore - left.sparseScore)
      .slice(0, topK);
  }
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length) {
    return 0;
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  return dot / ((Math.sqrt(leftNorm) * Math.sqrt(rightNorm)) || 1);
}

function tokenize(value: string): string[] {
  return (value.toLowerCase().match(/[a-z_][a-z0-9_]+/g) ?? []).slice(0, 40);
}

function scoreKeywords(tokens: string[], keywords: string[], content: string): number {
  const keywordSet = new Set(keywords);
  return tokens.reduce((score, token) => {
    if (keywordSet.has(token)) {
      return score + 2;
    }
    if (content.toLowerCase().includes(token)) {
      return score + 1;
    }
    return score;
  }, 0);
}
