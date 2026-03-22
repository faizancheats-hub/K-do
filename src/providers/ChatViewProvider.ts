import * as vscode from "vscode";
import { ConfigService } from "../config/ConfigService";
import { AgentController } from "../controllers/AgentController";
import { ChatController } from "../controllers/ChatController";
import { DiffController } from "../controllers/DiffController";
import { CodebaseIndexer } from "../services/indexer/CodebaseIndexer";
import type { ExtToWebMsg, WebToExtMsg } from "../types/messages";
import { isWebToExtMessage } from "../types/messages";
import { relativeWorkspacePath } from "../utils/FileUtils";
import { normalizeAgentTask, shouldRouteToAgent } from "../utils/IntentRouting";

export class ChatViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view?: vscode.WebviewView;
  private readonly pendingPrompts: string[] = [];
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly chatController: ChatController,
    private readonly agentController: AgentController,
    private readonly indexer: CodebaseIndexer,
    private readonly diffController: DiffController,
    private readonly config: ConfigService
  ) {
    this.disposables.push(
      this.indexer.onDidUpdate(() => {
        void this.postContextInfo();
      }),
      this.diffController.onDidChange(() => {
        void this.postDiffState();
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("kodo.model") || event.affectsConfiguration("kodo.provider")) {
          void this.postContextInfo();
        }
      })
    );
  }

  async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "webview", "dist")
      ]
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (!isWebToExtMessage(message)) {
        return;
      }
      await this.handleMessage(message);
    });

    await this.postContextInfo();
    await this.postDiffState();

    while (this.pendingPrompts.length) {
      const prompt = this.pendingPrompts.shift();
      if (prompt) {
        await this.handleMessage({ type: "send_message", content: prompt, attachments: [], mode: "auto" });
      }
    }
  }

  async sendPrompt(content: string): Promise<void> {
    if (!this.view) {
      this.pendingPrompts.push(content);
      return;
    }
    await this.handleMessage({ type: "send_message", content, attachments: [], mode: "auto" });
  }

  async resetChat(): Promise<void> {
    await this.chatController.clearHistory();
    await this.post({ type: "chat_reset" });
  }

  private async handleMessage(message: WebToExtMsg): Promise<void> {
    switch (message.type) {
      case "send_message":
        if (message.mode === "agent") {
          await this.agentController.runTask(normalizeAgentTask(message.content), (payload) => this.post(payload));
        } else if (message.mode === "chat") {
          await this.chatController.sendMessage(message.content, message.attachments, (payload) => this.post(payload));
        } else if (shouldRouteToAgent(message.content)) {
          await this.agentController.runTask(normalizeAgentTask(message.content), (payload) => this.post(payload));
        } else {
          await this.chatController.sendMessage(message.content, message.attachments, (payload) => this.post(payload));
        }
        await this.postContextInfo(message.attachments);
        break;
      case "cancel_stream":
        this.chatController.cancelActiveStream();
        break;
      case "accept_diff":
        await this.post({
          type: "diff_ready",
          ...(await this.agentController.acceptDiff(message.fileId))
        });
        break;
      case "reject_diff":
        await this.post({
          type: "diff_ready",
          ...(await this.agentController.rejectDiff(message.fileId))
        });
        break;
      case "accept_all_diffs":
        await this.post({
          type: "diff_ready",
          ...(await this.agentController.acceptAllDiffs())
        });
        break;
      case "reject_all_diffs":
        await this.post({
          type: "diff_ready",
          ...this.agentController.rejectAllDiffs()
        });
        break;
      case "insert_code":
        await this.chatController.insertCode(message.code);
        break;
      case "apply_code":
        await this.chatController.applyCode(message.code);
        break;
      case "new_chat":
        await this.resetChat();
        break;
      case "export_chat":
        await this.chatController.exportHistory();
        break;
      case "open_history":
        await this.chatController.exportHistory();
        break;
      case "open_settings":
        await vscode.commands.executeCommand("workbench.action.openSettings", "kodo");
        break;
      case "pick_attachments":
        await this.pickAttachments();
        break;
      case "set_model":
        await this.config.setModel(message.value);
        await this.postContextInfo();
        break;
    }
  }

  private async post(message: ExtToWebMsg): Promise<void> {
    await this.view?.webview.postMessage(message);
  }

  dispose(): void {
    vscode.Disposable.from(...this.disposables).dispose();
  }

  private async postContextInfo(attachedFiles: string[] = []): Promise<void> {
    const summary = this.indexer.getSummary();
    await this.post({
      type: "context_info",
      context: {
        ...summary,
        attachedFiles,
        workspaceFiles: await this.indexer.getWorkspaceFilePaths(500),
        model: this.config.config.model,
        provider: this.config.config.provider
      }
    });
  }

  private async postDiffState(): Promise<void> {
    const files = this.diffController.list();
    await this.post({
      type: "diff_ready",
      files,
      summary: files.length
        ? `${files.length} staged ${files.length === 1 ? "change" : "changes"} ready to review.`
        : "No staged diffs."
    });
  }

  private async pickAttachments(): Promise<void> {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: true,
      defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
      openLabel: "Attach to Kodo"
    });

    if (!selected?.length) {
      return;
    }

    await this.post({
      type: "attachments_picked",
      paths: selected.map((uri) => relativeWorkspacePath(uri.fsPath))
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "webview", "dist", "app.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "webview", "dist", "styles.css"));
    const nonce = String(Date.now());

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>Kodo</title>
  </head>
  <body>
    <div id="app"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}
