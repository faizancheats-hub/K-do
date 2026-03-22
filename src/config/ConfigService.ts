import * as vscode from "vscode";
import { DEFAULT_CONFIG } from "./defaults";
import type { KodoConfig } from "./schema";
import type { ProviderName } from "./schema";

export class ConfigService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  get config(): KodoConfig {
    const cfg = vscode.workspace.getConfiguration("kodo");
    return {
      provider: cfg.get<ProviderName>("provider", DEFAULT_CONFIG.provider),
      model: cfg.get<string>("model", DEFAULT_CONFIG.model),
      inlineModel: cfg.get<string>("inlineModel", DEFAULT_CONFIG.inlineModel),
      embeddingModel: cfg.get<string>("embeddingModel", DEFAULT_CONFIG.embeddingModel),
      baseUrl: cfg.get<string>("baseUrl", DEFAULT_CONFIG.baseUrl),
      inlineEnabled: cfg.get<boolean>("inlineEnabled", DEFAULT_CONFIG.inlineEnabled),
      inlineDebounceMs: cfg.get<number>("inlineDebounceMs", DEFAULT_CONFIG.inlineDebounceMs),
      maxTokensInline: cfg.get<number>("maxTokensInline", DEFAULT_CONFIG.maxTokensInline),
      maxTokensChat: cfg.get<number>("maxTokensChat", DEFAULT_CONFIG.maxTokensChat),
      contextChunks: cfg.get<number>("contextChunks", DEFAULT_CONFIG.contextChunks),
      telemetryEnabled: cfg.get<boolean>("telemetryEnabled", DEFAULT_CONFIG.telemetryEnabled)
    };
  }

  async getApiKey(provider = this.config.provider): Promise<string | undefined> {
    const secret = await this.context.secrets.get(this.secretKey(provider));
    if (secret) {
      return secret;
    }

    const envKey = provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
    return process.env[envKey] || process.env.KODO_API_KEY;
  }

  async setApiKey(provider: ProviderName, value: string): Promise<void> {
    await this.context.secrets.store(this.secretKey(provider), value.trim());
  }

  async resetApiKey(provider = this.config.provider): Promise<void> {
    await this.context.secrets.delete(this.secretKey(provider));
  }

  getBaseUrl(provider = this.config.provider): string {
    if (this.config.baseUrl) {
      return this.config.baseUrl.trim().replace(/\/+$/, "");
    }

    switch (provider) {
      case "anthropic":
        return "https://api.anthropic.com";
      case "ollama":
        return "http://localhost:11434";
      case "lmstudio":
        return "http://localhost:1234";
      case "openai":
      default:
        return "https://api.openai.com";
    }
  }

  getWorkspaceStoragePath(): string {
    return this.context.storageUri?.fsPath ?? this.context.globalStorageUri.fsPath;
  }

  private secretKey(provider: ProviderName): string {
    return `kodo.apiKey.${provider}`;
  }
}
