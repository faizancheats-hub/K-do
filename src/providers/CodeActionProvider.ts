import * as vscode from "vscode";

export class AICodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection): vscode.CodeAction[] {
    if (range.isEmpty) {
      return [];
    }

    const selectedText = document.getText(range).slice(0, 6000);
    return [
      this.buildAction("Explain with Kodo", `/explain\n\n${selectedText}`, vscode.CodeActionKind.QuickFix),
      this.buildAction("Fix with Kodo", `/fix\n\n${selectedText}`, vscode.CodeActionKind.QuickFix),
      this.buildAction("Refactor with Kodo", `/refactor\n\n${selectedText}`, vscode.CodeActionKind.RefactorRewrite)
    ];
  }

  private buildAction(title: string, prompt: string, kind: vscode.CodeActionKind): vscode.CodeAction {
    const action = new vscode.CodeAction(title, kind);
    action.command = {
      command: "kodo.openChatWithPrompt",
      title,
      arguments: [prompt]
    };
    return action;
  }
}
