import * as vscode from "vscode";
import { ConfigService } from "./config/ConfigService";
import { AgentController } from "./controllers/AgentController";
import { ChatController } from "./controllers/ChatController";
import { DiffController } from "./controllers/DiffController";
import { InlineController } from "./controllers/InlineController";
import { CodebaseIndexer } from "./services/indexer/CodebaseIndexer";
import { LLMClientFactory } from "./services/llm/LLMClientFactory";
import { AICodeActionProvider } from "./providers/CodeActionProvider";
import { ChatViewProvider } from "./providers/ChatViewProvider";
import { KodoHoverProvider } from "./providers/HoverProvider";
import { KodoInlineProvider } from "./providers/InlineCompletionProvider";
import { ChangesTreeProvider } from "./providers/ChangesTreeProvider";

let indexer: CodebaseIndexer | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = new ConfigService(context);
  const llmFactory = new LLMClientFactory(config);
  const diffController = new DiffController(context);
  indexer = new CodebaseIndexer(context, config, llmFactory);
  const chatController = new ChatController(context, config, llmFactory, indexer);
  const agentController = new AgentController(context, config, llmFactory, indexer, diffController);
  const inlineController = new InlineController(config, llmFactory, indexer);
  const chatViewProvider = new ChatViewProvider(context.extensionUri, chatController, agentController, indexer, diffController, config);
  const changesTreeProvider = new ChangesTreeProvider(diffController);
  const changesTreeView = vscode.window.createTreeView("kodo.changes", { treeDataProvider: changesTreeProvider });
  const updateChangesBadge = (): void => {
    const count = changesTreeProvider.getPendingCount();
    changesTreeView.badge = count ? { value: count, tooltip: `${count} staged ${count === 1 ? "change" : "changes"}` } : undefined;
    changesTreeView.description = count ? `${count} changes` : "";
  };
  const revealSidebar = async (): Promise<void> => {
    await vscode.commands.executeCommand("workbench.view.extension.kodo");
  };

  context.subscriptions.push(
    diffController.onDidChange(() => updateChangesBadge())
  );
  updateChangesBadge();

  context.subscriptions.push(
    indexer,
    chatViewProvider,
    changesTreeView,
    vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, new KodoInlineProvider(inlineController)),
    vscode.languages.registerCodeActionsProvider({ pattern: "**" }, new AICodeActionProvider()),
    vscode.languages.registerHoverProvider({ pattern: "**" }, new KodoHoverProvider()),
    vscode.window.registerWebviewViewProvider("kodo.chat", chatViewProvider),
    vscode.commands.registerCommand("kodo.openChangeDiff", async (fileId?: string) => {
      await diffController.preview(typeof fileId === "string" ? fileId : undefined);
    }),
    vscode.commands.registerCommand("kodo.acceptAllChanges", async () => {
      await diffController.acceptAll();
      vscode.window.setStatusBarMessage("Kodo: applied all staged diffs", 2000);
    }),
    vscode.commands.registerCommand("kodo.rejectAllChanges", () => {
      diffController.rejectAll();
      vscode.window.setStatusBarMessage("Kodo: discarded staged diffs", 2000);
    }),
    vscode.commands.registerCommand("kodo.clearAllChanges", () => {
      diffController.rejectAll();
      vscode.window.setStatusBarMessage("Kodo: cleared staged diffs", 2000);
    }),
    vscode.commands.registerCommand("kodo.askAI", async () => {
      const value = await vscode.window.showInputBox({
        prompt: "Ask Kodo",
        placeHolder: "How can I help with this codebase?"
      });
      if (value) {
        await revealSidebar();
        await chatViewProvider.sendPrompt(value);
      }
    }),
    vscode.commands.registerCommand("kodo.fixSelected", async () => {
      const selection = vscode.window.activeTextEditor?.document.getText(vscode.window.activeTextEditor.selection);
      if (selection) {
        await revealSidebar();
        await chatViewProvider.sendPrompt(`/fix\n\n${selection}`);
      }
    }),
    vscode.commands.registerCommand("kodo.explainSelected", async () => {
      const selection = vscode.window.activeTextEditor?.document.getText(vscode.window.activeTextEditor.selection);
      if (selection) {
        await revealSidebar();
        await chatViewProvider.sendPrompt(`/explain\n\n${selection}`);
      }
    }),
    vscode.commands.registerCommand("kodo.refactorProject", async () => {
      const task = await vscode.window.showInputBox({
        prompt: "Describe the refactor task",
        placeHolder: "Refactor the auth flow to use a shared middleware"
      });
      if (task) {
        await revealSidebar();
        await chatViewProvider.sendPrompt(`/agent ${task}`);
      }
    }),
    vscode.commands.registerCommand("kodo.generateFeature", async () => {
      const task = await vscode.window.showInputBox({
        prompt: "Describe the feature to generate",
        placeHolder: "Add rate limiting middleware to the API routes"
      });
      if (task) {
        await revealSidebar();
        await chatViewProvider.sendPrompt(`/agent ${task}`);
      }
    }),
    vscode.commands.registerCommand("kodo.rebuildIndex", async () => {
      await indexer?.rebuildIndex();
      vscode.window.setStatusBarMessage("Kodo: index rebuilt", 2000);
    }),
    vscode.commands.registerCommand("kodo.clearChat", async () => {
      await chatViewProvider.resetChat();
    }),
    vscode.commands.registerCommand("kodo.openChatWithPrompt", async (prompt: string) => {
      await revealSidebar();
      await chatViewProvider.sendPrompt(prompt);
    }),
    vscode.commands.registerCommand("kodo.setApiKey", async () => {
      const provider = config.config.provider;
      const value = await vscode.window.showInputBox({
        prompt: `Enter API key for ${provider}`,
        ignoreFocusOut: true,
        password: true
      });
      if (value) {
        await config.setApiKey(provider, value);
        vscode.window.showInformationMessage(`Kodo API key stored for ${provider}.`);
      }
    }),
    vscode.commands.registerCommand("kodo.resetApiKey", async () => {
      await config.resetApiKey();
      vscode.window.showInformationMessage("Kodo API key cleared.");
    })
  );

  void indexer.startBackgroundIndex();
}

export function deactivate(): void {
  indexer?.dispose();
}
