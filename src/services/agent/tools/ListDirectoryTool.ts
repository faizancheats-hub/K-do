import * as path from "node:path";
import * as vscode from "vscode";
import type { AgentTool } from "../ToolRegistry";

export class ListDirectoryTool implements AgentTool<{ path?: string }, string[]> {
  readonly definition = {
    name: "list_directory",
    description: "List files and folders relative to the workspace root",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" }
      }
    }
  };

  async execute(input: { path?: string }): Promise<string[]> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
      return [];
    }
    const target = input.path && input.path !== "." ? path.join(root, input.path) : root;
    const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(target));
    return entries.map(([name, type]) => `${type === vscode.FileType.Directory ? "dir" : "file"}:${name}`);
  }
}
