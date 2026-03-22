import * as path from "node:path";
import * as vscode from "vscode";

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function relativeWorkspacePath(filePath: string): string {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return normalizePath(filePath);
  }
  return normalizePath(path.relative(root, filePath));
}

export function workspaceUriFromRelative(filePath: string): vscode.Uri | undefined {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return undefined;
  }
  return vscode.Uri.file(path.join(root, filePath));
}

export function selectionToString(editor: vscode.TextEditor | undefined): string | null {
  if (!editor || editor.selection.isEmpty) {
    return null;
  }
  return editor.document.getText(editor.selection);
}
