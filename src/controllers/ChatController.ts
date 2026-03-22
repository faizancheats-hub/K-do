import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { ConfigService } from "../config/ConfigService";
import type { ExtToWebMsg } from "../types/messages";
import type { ChatMessage } from "../types/llm";
import { CodebaseIndexer } from "../services/indexer/CodebaseIndexer";
import { LLMClientFactory } from "../services/llm/LLMClientFactory";
import { PromptBuilder } from "../utils/PromptBuilder";
import { relativeWorkspacePath, selectionToString } from "../utils/FileUtils";

export class ChatController {
  private readonly promptBuilder = new PromptBuilder();
  private activeAbort?: AbortController;
  private readonly historyKey = "kodo.chat.history";

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly config: ConfigService,
    private readonly clientFactory: LLMClientFactory,
    private readonly indexer: CodebaseIndexer
  ) {}

  async sendMessage(content: string, attachments: string[], post: (message: ExtToWebMsg) => void): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const activeFile = editor ? relativeWorkspacePath(editor.document.uri.fsPath) : undefined;
    const selected = selectionToString(editor);
    const messageId = randomUUID();
    const history = this.getHistory();
    const resolvedAttachments = await this.indexer.readAttachments(unique([...attachments, ...extractMentions(content)]));
    const retrieved = await this.indexer.search(content, activeFile, 4000);

    this.cancelActiveStream();
    this.activeAbort = new AbortController();

    const request = this.promptBuilder.buildChatRequest(
      {
        task: rewriteSlashCommand(content, selected),
        activeFile,
        selection: selected,
        attachments: resolvedAttachments,
        retrieved,
        history,
        maxContextTokens: 6000
      },
      this.config.config.model,
      this.config.config.maxTokensChat,
      this.activeAbort.signal
    );

    this.pushHistory({ role: "user", content });
    post({ type: "stream_start", messageId, role: "assistant" });

    const client = await this.clientFactory.create();
    let assistant = "";

    try {
      for await (const token of client.stream(request)) {
        assistant += token;
        post({ type: "stream_token", messageId, token });
      }

      if (!assistant.trim()) {
        assistant = (await client.complete(request)).text;
        if (assistant) {
          post({ type: "stream_token", messageId, token: assistant });
        }
      }

      this.pushHistory({ role: "assistant", content: assistant });
      post({ type: "stream_done", messageId });
      post({
        type: "context_info",
        context: {
          ...this.indexer.getSummary(),
          attachedFiles: resolvedAttachments.map((file) => file.path)
        }
      });
    } catch (error) {
      post({
        type: "stream_error",
        messageId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  cancelActiveStream(): void {
    this.activeAbort?.abort();
    this.activeAbort = undefined;
  }

  async insertCode(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    await editor.edit((builder) => {
      builder.insert(editor.selection.active, code);
    });
  }

  async applyCode(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    await editor.edit((builder) => {
      if (editor.selection.isEmpty) {
        builder.insert(editor.selection.active, code);
      } else {
        builder.replace(editor.selection, code);
      }
    });
  }

  async exportHistory(): Promise<void> {
    const markdown = this.getHistory()
      .map((message) => `## ${message.role}\n\n${message.content}`)
      .join("\n\n");
    const document = await vscode.workspace.openTextDocument({
      language: "markdown",
      content: `# Kodo Chat Export\n\n${markdown}`
    });
    await vscode.window.showTextDocument(document, { preview: false });
  }

  async clearHistory(): Promise<void> {
    await this.context.workspaceState.update(this.historyKey, []);
  }

  getHistory(): ChatMessage[] {
    return this.context.workspaceState.get<ChatMessage[]>(this.historyKey, []);
  }

  private pushHistory(message: ChatMessage): void {
    const history = [...this.getHistory(), message].slice(-40);
    void this.context.workspaceState.update(this.historyKey, history);
  }
}

function extractMentions(content: string): string[] {
  return [...content.matchAll(/@([A-Za-z0-9_./-]+)/g)].map((match) => match[1]);
}

function rewriteSlashCommand(content: string, selection: string | null): string {
  const trimmed = content.trim();
  const commands: Record<string, string> = {
    "/fix": "Fix the selected code or active context.",
    "/optimize": "Optimize the selected code with clear reasoning.",
    "/explain": "Explain the selected code in plain English.",
    "/refactor": "Refactor the selected code while preserving behavior.",
    "/test": "Generate tests that match the project conventions.",
    "/docs": "Write documentation comments for the selected code.",
    "/ask": ""
  };

  for (const [command, prefix] of Object.entries(commands)) {
    if (trimmed.startsWith(command)) {
      const remainder = trimmed.slice(command.length).trim();
      return [prefix, remainder, selection ? `Selected code:\n${selection}` : ""].filter(Boolean).join("\n\n");
    }
  }

  return selection ? `${content}\n\nSelected code:\n${selection}` : content;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
