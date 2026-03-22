export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  stop?: string[];
  signal?: AbortSignal;
  tools?: ToolDefinition[];
  toolChoice?: "auto" | "none";
  metadata?: Record<string, unknown>;
}

export interface CompletionChoice {
  message: ChatMessage & {
    toolCalls?: ToolCall[];
  };
}

export interface CompletionResponse {
  text: string;
  choices: CompletionChoice[];
  usage?: TokenUsage;
  raw?: unknown;
}

export interface EmbeddingRequest {
  model: string;
  texts: string[];
  signal?: AbortSignal;
}

export interface ProviderHealth {
  available: boolean;
  provider: string;
  detail?: string;
}
