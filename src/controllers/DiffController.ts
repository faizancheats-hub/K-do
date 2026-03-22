import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import type { DiffFile } from "../types/agent";

export class DiffController {
  private readonly pending = new Map<string, DiffFile>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  stage(files: DiffFile[]): void {
    this.pending.clear();
    for (const file of files) {
      this.pending.set(file.id, file);
    }
  }

  list(): DiffFile[] {
    return [...this.pending.values()];
  }

  async preview(fileId?: string): Promise<void> {
    const diff = fileId ? this.pending.get(fileId) : this.pending.values().next().value;
    if (!diff) {
      return;
    }

    const { left, right } = await this.createPreviewUris(diff);
    await vscode.commands.executeCommand("vscode.diff", left, right, `Kodo Diff: ${diff.path}`);
  }

  async accept(fileId: string): Promise<void> {
    const diff = this.pending.get(fileId);
    if (!diff) {
      return;
    }
    await this.applyDiff(diff);
    this.pending.delete(fileId);
  }

  async reject(fileId: string): Promise<void> {
    this.pending.delete(fileId);
  }

  async acceptAll(): Promise<void> {
    for (const file of this.list()) {
      await this.applyDiff(file);
    }
    this.pending.clear();
  }

  rejectAll(): void {
    this.pending.clear();
  }

  private async applyDiff(diff: DiffFile): Promise<void> {
    const workspaceEdit = new vscode.WorkspaceEdit();
    const targetUri = this.resolveWorkspaceUri(diff.path);

    if (diff.action === "delete") {
      workspaceEdit.deleteFile(targetUri, { ignoreIfNotExists: true });
    } else if (diff.action === "create") {
      workspaceEdit.createFile(targetUri, { ignoreIfExists: true });
      workspaceEdit.insert(targetUri, new vscode.Position(0, 0), diff.proposedContent);
    } else {
      try {
        const document = await vscode.workspace.openTextDocument(targetUri);
        workspaceEdit.replace(targetUri, fullDocumentRange(document), diff.proposedContent);
      } catch {
        workspaceEdit.createFile(targetUri, { ignoreIfExists: true });
        workspaceEdit.insert(targetUri, new vscode.Position(0, 0), diff.proposedContent);
      }
    }

    await vscode.workspace.applyEdit(workspaceEdit);
  }

  private resolveWorkspaceUri(relativePath: string): vscode.Uri {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!root) {
      throw new Error("No workspace folder is open.");
    }
    return vscode.Uri.joinPath(root, relativePath);
  }

  private async createPreviewUris(diff: DiffFile): Promise<{ left: vscode.Uri; right: vscode.Uri }> {
    const directory = path.join(this.context.globalStorageUri.fsPath, "diff-preview");
    await fs.mkdir(directory, { recursive: true });

    const safeName = diff.path.replace(/[\\/]/g, "__");
    const leftPath = path.join(directory, `${safeName}.left.tmp`);
    const rightPath = path.join(directory, `${safeName}.right.tmp`);

    await fs.writeFile(leftPath, diff.originalContent, "utf8");
    await fs.writeFile(rightPath, diff.proposedContent, "utf8");

    return {
      left: vscode.Uri.file(leftPath),
      right: vscode.Uri.file(rightPath)
    };
  }
}

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
  if (document.lineCount === 0) {
    return new vscode.Range(0, 0, 0, 0);
  }
  const lastLine = document.lineAt(document.lineCount - 1);
  return new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
}
