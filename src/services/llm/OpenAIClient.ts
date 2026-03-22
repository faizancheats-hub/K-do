import type { ChatMessage, CompletionRequest, CompletionResponse, ProviderHealth, ToolDefinition } from "../../types/llm";
import type { LLMClient } from "./LLMClient";
import { fallbackEmbeddings } from "./LLMClient";
import { streamSse } from "../streaming/StreamingClient";

interface OpenAIMessage {
  role: string;
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

interface OpenAICompletionPayload {
  choices: Array<{
    message: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface OpenAISsePayload {
  choices: Array<{
    delta?: {
      content?: string;
    };
  }>;
}

export class OpenAIClient implements LLMClient {
  readonly provider: string = "openai";

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string
  ) {}

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.toBody(request, false)),
      signal: request.signal
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const payload = (await response.json()) as OpenAICompletionPayload;
    const message = payload.choices[0]?.message;
    const content = message?.content ?? "";
    return {
      text: content,
      choices: [
        {
          message: {
            role: "assistant",
            content,
            toolCalls: message?.tool_calls?.map((call) => ({
              id: call.id,
              name: call.function.name,
              arguments: JSON.parse(call.function.arguments || "{}")
            }))
          }
        }
      ],
      usage: payload.usage
        ? {
            promptTokens: payload.usage.prompt_tokens,
            completionTokens: payload.usage.completion_tokens,
            totalTokens: payload.usage.total_tokens
          }
        : undefined,
      raw: payload
    };
  }

  async *stream(request: CompletionRequest): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.toBody(request, true)),
      signal: request.signal
    });

    for await (const token of streamSse<OpenAISsePayload>(response, (payload) => payload.choices[0]?.delta?.content)) {
      yield token;
    }
  }

  async embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]> {
    if (!this.apiKey) {
      return fallbackEmbeddings(texts);
    }

    const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model,
        input: texts
      }),
      signal
    });

    if (!response.ok) {
      return fallbackEmbeddings(texts);
    }

    const payload = (await response.json()) as { data: Array<{ embedding: number[] }> };
    return payload.data.map((item) => item.embedding);
  }

  async isAvailable(): Promise<ProviderHealth> {
    return {
      available: Boolean(this.apiKey),
      provider: this.provider,
      detail: this.apiKey ? "API key available" : "Missing API key"
    };
  }

  protected toBody(request: CompletionRequest, stream: boolean): Record<string, unknown> {
    return {
      model: request.model,
      messages: request.messages.map((message) => this.toMessage(message)),
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stop: request.stop,
      stream,
      tools: request.tools?.map((tool) => this.toTool(tool)),
      tool_choice: request.tools?.length ? request.toolChoice ?? "auto" : undefined
    };
  }

  protected headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
    };
  }

  private toMessage(message: ChatMessage): OpenAIMessage {
    return {
      role: message.role,
      content: message.content,
      tool_call_id: message.toolCallId,
      name: message.name,
      tool_calls: message.toolCalls?.map((toolCall) => ({
        id: toolCall.id,
        type: "function",
        function: {
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.arguments)
        }
      }))
    };
  }

  private toTool(tool: ToolDefinition): Record<string, unknown> {
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    };
  }
}
