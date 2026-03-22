import * as vscode from "vscode";

export class KodoHoverProvider implements vscode.HoverProvider {
  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(position);
    if (!range) {
      return undefined;
    }

    const symbol = document.getText(range);
    const prompt = encodeURIComponent(JSON.stringify([`/explain\n\nExplain the symbol \`${symbol}\` in context.`]));
    const markdown = new vscode.MarkdownString(`[Explain with Kodo](command:kodo.openChatWithPrompt?${prompt})`);
    markdown.isTrusted = true;
    return new vscode.Hover(markdown, range);
  }
}
