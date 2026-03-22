import type { CompletionRequest, CompletionResponse, ProviderHealth } from "../../types/llm";
import type { LLMClient } from "./LLMClient";
import { fallbackEmbeddings } from "./LLMClient";
import { streamSse } from "../streaming/StreamingClient";

interface AnthropicMessagePayload {
  content?: Array<{
    type: string;
    text?: string;
  }>;
}

interface AnthropicSsePayload {
  type?: string;
  delta?: {
    text?: string;
  };
}

export class AnthropicClient implements LLMClient {
  readonly provider = "anthropic";

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string
  ) {}

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.toBody(request, false)),
      signal: request.signal
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const payload = (await response.json()) as AnthropicMessagePayload;
    const text = payload.content?.map((part) => part.text ?? "").join("") ?? "";
    return {
      text,
      choices: [{ message: { role: "assistant", content: text } }],
      raw: payload
    };
  }

  async *stream(request: CompletionRequest): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.toBody(request, true)),
      signal: request.signal
    });

    for await (const token of streamSse<AnthropicSsePayload>(response, (payload) => payload.delta?.text)) {
      yield token;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    return fallbackEmbeddings(texts);
  }

  async isAvailable(): Promise<ProviderHealth> {
    return {
      available: Boolean(this.apiKey),
      provider: this.provider,
      detail: this.apiKey ? "API key available" : "Missing API key"
    };
  }

  private headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      ...(this.apiKey ? { "x-api-key": this.apiKey } : {})
    };
  }

  private toBody(request: CompletionRequest, stream: boolean): Record<string, unknown> {
    const system = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");

    const messages = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content
      }));

    return {
      model: request.model,
      system,
      messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream
    };
  }
}
