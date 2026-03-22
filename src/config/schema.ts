export type ProviderName = "openai" | "anthropic" | "ollama" | "lmstudio";

export interface KodoConfig {
  provider: ProviderName;
  model: string;
  inlineModel: string;
  embeddingModel: string;
  baseUrl: string;
  inlineEnabled: boolean;
  inlineDebounceMs: number;
  maxTokensInline: number;
  maxTokensChat: number;
  contextChunks: number;
  telemetryEnabled: boolean;
}
