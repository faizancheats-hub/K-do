import * as vscode from "vscode";
import { normalizePath, relativeWorkspacePath } from "../../utils/FileUtils";

const DEFAULT_EXCLUDES = [
  /^\.git\//,
  /^node_modules\//,
  /^dist\//,
  /^out\//,
  /^build\//,
  /^coverage\//,
  /^\.next\//,
  /^\.turbo\//,
  /^storage\//
];

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".mp4",
  ".mov",
  ".mp3",
  ".exe",
  ".dll"
]);

export class FileWalker {
  async listWorkspaceFiles(): Promise<vscode.Uri[]> {
    const workspaceFiles = await vscode.workspace.findFiles("**/*");
    const ignorePatterns = await this.readIgnorePatterns();
    return workspaceFiles.filter((uri) => this.isAllowed(uri, ignorePatterns));
  }

  private isAllowed(uri: vscode.Uri, ignorePatterns: RegExp[]): boolean {
    const relative = normalizePath(relativeWorkspacePath(uri.fsPath));
    if (!relative || DEFAULT_EXCLUDES.some((pattern) => pattern.test(relative))) {
      return false;
    }

    const extension = relative.includes(".") ? `.${relative.split(".").pop()?.toLowerCase()}` : "";
    if (BINARY_EXTENSIONS.has(extension)) {
      return false;
    }

    return !ignorePatterns.some((pattern) => pattern.test(relative));
  }

  private async readIgnorePatterns(): Promise<RegExp[]> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!root) {
      return [];
    }

    const uris = [
      vscode.Uri.joinPath(root, ".kodoignore"),
      vscode.Uri.joinPath(root, ".gitignore")
    ];

    const patterns: RegExp[] = [];
    for (const uri of uris) {
      try {
        const data = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder().decode(data);
        for (const line of text.split(/\r?\n/).map((entry) => entry.trim())) {
          if (!line || line.startsWith("#")) {
            continue;
          }
          patterns.push(globToRegex(line));
        }
      } catch {
        // Ignore missing files.
      }
    }

    return patterns;
  }
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped.replace(/\/$/, "/.*")}$`);
}
