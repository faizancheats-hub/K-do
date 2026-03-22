import * as vscode from "vscode";

export function collectActiveDiagnostics(): Array<{ message: string; severity: string }> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return [];
  }

  return vscode.languages.getDiagnostics(editor.document.uri).map((diagnostic) => ({
    message: diagnostic.message,
    severity: vscode.DiagnosticSeverity[diagnostic.severity]
  }));
}
