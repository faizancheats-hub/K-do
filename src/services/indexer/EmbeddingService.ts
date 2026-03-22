import { createHash } from "node:crypto";
import { ConfigService } from "../../config/ConfigService";
import { EmbeddingCache } from "../cache/EmbeddingCache";
import { LLMClientFactory } from "../llm/LLMClientFactory";
import { fallbackEmbedding } from "../llm/LLMClient";

export class EmbeddingService {
  constructor(
    private readonly config: ConfigService,
    private readonly clientFactory: LLMClientFactory,
    private readonly cache = new EmbeddingCache()
  ) {}

  async embedTexts(texts: string[], signal?: AbortSignal): Promise<number[][]> {
    const model = this.config.config.embeddingModel;
    const results: number[][] = [];
    const missingIndices: number[] = [];
    const missingTexts: string[] = [];

    texts.forEach((text, index) => {
      const key = cacheKey(model, text);
      const cached = this.cache.get(key);
      if (cached) {
        results[index] = cached;
      } else {
        missingIndices.push(index);
        missingTexts.push(text);
      }
    });

    if (missingTexts.length) {
      let embeddings: number[][];
      try {
        const client = await this.clientFactory.create();
        embeddings = await client.embed(missingTexts, model, signal);
      } catch {
        embeddings = missingTexts.map((text) => fallbackEmbedding(text));
      }

      missingTexts.forEach((text, position) => {
        const embedding = embeddings[position] ?? fallbackEmbedding(text);
        const targetIndex = missingIndices[position];
        this.cache.set(cacheKey(model, text), embedding);
        results[targetIndex] = embedding;
      });
    }

    return results.map((item, index) => item ?? fallbackEmbedding(texts[index]));
  }

  clear(): void {
    this.cache.clear();
  }
}

function cacheKey(model: string, text: string): string {
  return `${model}:${createHash("sha1").update(text).digest("hex")}`;
}
