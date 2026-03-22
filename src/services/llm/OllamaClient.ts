import type { CompletionRequest, CompletionResponse, ProviderHealth } from "../../types/llm";
import type { LLMClient } from "./LLMClient";
import { fallbackEmbeddings } from "./LLMClient";
import { streamJsonLines } from "../streaming/StreamingClient";

interface OllamaStreamPayload {
  message?: { content?: string };
}

export class OllamaClient implements LLMClient {
  readonly provider = "ollama";

  constructor(private readonly baseUrl: string) {}

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens
        }
      }),
      signal: request.signal
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const payload = (await response.json()) as { message?: { content?: string } };
    const text = payload.message?.content ?? "";
    return {
      text,
      choices: [{ message: { role: "assistant", content: text } }],
      raw: payload
    };
  }

  async *stream(request: CompletionRequest): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens
        }
      }),
      signal: request.signal
    });

    for await (const token of streamJsonLines<OllamaStreamPayload>(response, (payload) => payload.message?.content)) {
      yield token;
    }
  }

  async embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          input: texts
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as { embeddings?: number[][] };
      return payload.embeddings ?? fallbackEmbeddings(texts);
    } catch {
      return fallbackEmbeddings(texts);
    }
  }

  async isAvailable(): Promise<ProviderHealth> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return {
        available: response.ok,
        provider: this.provider,
        detail: response.ok ? "Ollama reachable" : await response.text()
      };
    } catch (error) {
      return {
        available: false,
        provider: this.provider,
        detail: String(error)
      };
    }
  }
}
