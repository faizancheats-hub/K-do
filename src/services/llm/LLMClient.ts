import type { CompletionRequest, CompletionResponse, ProviderHealth } from "../../types/llm";

export interface LLMClient {
  readonly provider: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(request: CompletionRequest): AsyncIterable<string>;
  embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]>;
  isAvailable(): Promise<ProviderHealth>;
}

export function fallbackEmbedding(text: string, dimensions = 64): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const normalized = text.toLowerCase();
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    vector[code % dimensions] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

export function fallbackEmbeddings(texts: string[], dimensions = 64): number[][] {
  return texts.map((text) => fallbackEmbedding(text, dimensions));
}
