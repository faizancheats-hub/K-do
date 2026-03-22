import { ConfigService } from "../../config/ConfigService";
import type { LLMClient } from "./LLMClient";
import { AnthropicClient } from "./AnthropicClient";
import { LMStudioClient } from "./LMStudioClient";
import { OllamaClient } from "./OllamaClient";
import { OpenAIClient } from "./OpenAIClient";

export class LLMClientFactory {
  constructor(private readonly configService: ConfigService) {}

  async create(): Promise<LLMClient> {
    const config = this.configService.config;
    const apiKey = await this.configService.getApiKey(config.provider);
    const baseUrl = this.configService.getBaseUrl(config.provider);

    switch (config.provider) {
      case "anthropic":
        return new AnthropicClient(baseUrl, apiKey);
      case "ollama":
        return new OllamaClient(baseUrl);
      case "lmstudio":
        return new LMStudioClient(baseUrl, apiKey);
      case "openai":
      default:
        return new OpenAIClient(baseUrl, apiKey);
    }
  }
}
