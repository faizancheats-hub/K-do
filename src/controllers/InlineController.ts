import * as crypto from "node:crypto";
import * as vscode from "vscode";
import { ConfigService } from "../config/ConfigService";
import { CompletionCache } from "../services/cache/CompletionCache";
import { RequestDeduplicator } from "../services/cache/RequestDeduplicator";
import { CodebaseIndexer } from "../services/indexer/CodebaseIndexer";
import { LLMClientFactory } from "../services/llm/LLMClientFactory";
import { PromptBuilder } from "../utils/PromptBuilder";
import { relativeWorkspacePath } from "../utils/FileUtils";

export class InlineController {
  private readonly promptBuilder = new PromptBuilder();
  private readonly completionCache = new CompletionCache(100);
  private readonly deduplicator = new RequestDeduplicator<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly clientFactory: LLMClientFactory,
    private readonly indexer: CodebaseIndexer
  ) {}

  async provide(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<string> {
    if (!this.config.config.inlineEnabled) {
      return "";
    }

    const prefix = this.getPrefix(document, position);
    const suffix = this.getSuffix(document, position);
    const key = hash([document.uri.fsPath, String(position.line), prefix.slice(-500), suffix.slice(0, 200)].join("|"));
    const cached = this.completionCache.get(key);
    if (cached) {
      return cached;
    }

    return this.deduplicator.run(key, async () => {
      const activeFile = relativeWorkspacePath(document.uri.fsPath);
      const retrieved = await this.indexer.search(
        `${document.lineAt(position.line).text}\n${prefix.slice(-300)}`,
        activeFile,
        2000
      );

      const abortController = new AbortController();
      token.onCancellationRequested(() => abortController.abort());

      const request = this.promptBuilder.buildInlineRequest(
        {
          task: "Complete the code at the cursor.",
          activeFile,
          languageId: document.languageId,
          prefix,
          suffix,
          retrieved
        },
        this.config.config.inlineModel,
        this.config.config.maxTokensInline,
        abortController.signal
      );

      const client = await this.clientFactory.create();
      let completion = "";
      const deadline = Date.now() + 1200;

      try {
        for await (const piece of client.stream(request)) {
          completion += piece;
          if (Date.now() > deadline && completion.trim()) {
            abortController.abort();
            break;
          }
        }
      } catch {
        // Fall back to non-streaming request below.
      }

      if (!completion.trim()) {
        completion = (await client.complete(request)).text;
      }

      const normalized = normalizeInlineCompletion(completion, prefix);
      this.completionCache.set(key, normalized);
      return normalized;
    });
  }

  private getPrefix(document: vscode.TextDocument, position: vscode.Position): string {
    const startLine = Math.max(0, position.line - 60);
    return document.getText(new vscode.Range(startLine, 0, position.line, position.character));
  }

  private getSuffix(document: vscode.TextDocument, position: vscode.Position): string {
    const endLine = Math.min(document.lineCount - 1, position.line + 20);
    const endChar = document.lineAt(endLine).range.end.character;
    return document.getText(new vscode.Range(position.line, position.character, endLine, endChar));
  }
}

function normalizeInlineCompletion(value: string, prefix: string): string {
  const cleaned = value
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```$/i, "")
    .trimEnd();

  const lastLine = prefix.split(/\r?\n/).pop() ?? "";
  if (cleaned.startsWith(lastLine)) {
    return cleaned.slice(lastLine.length);
  }
  return cleaned;
}

function hash(value: string): string {
  return crypto.createHash("sha1").update(value).digest("hex");
}
