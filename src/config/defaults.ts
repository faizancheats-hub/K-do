export const DEFAULT_CONFIG = {
  provider: "openai",
  model: "gpt-4o-mini",
  inlineModel: "gpt-4o-mini",
  embeddingModel: "text-embedding-3-small",
  baseUrl: "",
  inlineEnabled: true,
  inlineDebounceMs: 300,
  maxTokensInline: 256,
  maxTokensChat: 4096,
  contextChunks: 10,
  telemetryEnabled: false
} as const;
