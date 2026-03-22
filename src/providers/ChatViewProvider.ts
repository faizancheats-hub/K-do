import * as vscode from "vscode";
import { AgentController } from "../controllers/AgentController";
import { ChatController } from "../controllers/ChatController";
import { CodebaseIndexer } from "../services/indexer/CodebaseIndexer";
import type { ExtToWebMsg, WebToExtMsg } from "../types/messages";
import { isWebToExtMessage } from "../types/messages";

export class ChatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private readonly pendingPrompts: string[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly chatController: ChatController,
    private readonly agentController: AgentController,
    private readonly indexer: CodebaseIndexer
  ) {}

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

    void this.post({
      type: "context_info",
      context: this.indexer.getSummary()
    });

    while (this.pendingPrompts.length) {
      const prompt = this.pendingPrompts.shift();
      if (prompt) {
        await this.handleMessage({ type: "send_message", content: prompt, attachments: [] });
      }
    }
  }

  async sendPrompt(content: string): Promise<void> {
    if (!this.view) {
      this.pendingPrompts.push(content);
      return;
    }
    await this.handleMessage({ type: "send_message", content, attachments: [] });
  }

  async resetChat(): Promise<void> {
    await this.chatController.clearHistory();
    await this.post({ type: "chat_reset" });
  }

  private async handleMessage(message: WebToExtMsg): Promise<void> {
    switch (message.type) {
      case "send_message":
        if (message.content.trim().startsWith("/agent")) {
          await this.agentController.runTask(message.content.replace(/^\/agent/, "").trim(), (payload) => this.post(payload));
        } else {
          await this.chatController.sendMessage(message.content, message.attachments, (payload) => this.post(payload));
        }
        break;
      case "cancel_stream":
        this.chatController.cancelActiveStream();
        break;
      case "accept_diff":
        await this.agentController.acceptDiff(message.fileId);
        break;
      case "reject_diff":
        await this.agentController.rejectDiff(message.fileId);
        break;
      case "accept_all_diffs":
        await this.agentController.acceptAllDiffs();
        break;
      case "reject_all_diffs":
        this.agentController.rejectAllDiffs();
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
    }
  }

  private async post(message: ExtToWebMsg): Promise<void> {
    await this.view?.webview.postMessage(message);
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
