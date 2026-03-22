import * as vscode from "vscode";
import { InlineController } from "../controllers/InlineController";

export class KodoInlineProvider implements vscode.InlineCompletionItemProvider {
  constructor(private readonly controller: InlineController) {}

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList> {
    const completion = await this.controller.provide(document, position, token);
    if (!completion.trim()) {
      return new vscode.InlineCompletionList([]);
    }
    return new vscode.InlineCompletionList([
      new vscode.InlineCompletionItem(completion, new vscode.Range(position, position))
    ]);
  }
}
