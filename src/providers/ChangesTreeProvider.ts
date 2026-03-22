import * as vscode from "vscode";
import { DiffController } from "../controllers/DiffController";
import type { DiffFile, FileChangeAction } from "../types/agent";

type GroupKey = "update" | "create" | "delete";
type ChangeNode = GroupNode | FileNode | EmptyNode;

interface PendingOrLiveFile {
  id: string;
  path: string;
  action: FileChangeAction;
  pending?: DiffFile;
  isWriting: boolean;
}

class GroupNode {
  constructor(readonly key: GroupKey) {}
}

class FileNode {
  constructor(readonly file: PendingOrLiveFile) {}
}

class EmptyNode {
  constructor(readonly key: GroupKey) {}
}

const GROUP_LABELS: Record<GroupKey, string> = {
  update: "Modified",
  create: "Created",
  delete: "Deleted"
};

export class ChangesTreeProvider implements vscode.TreeDataProvider<ChangeNode> {
  private readonly updates = new vscode.EventEmitter<ChangeNode | undefined | void>();
  readonly onDidChangeTreeData = this.updates.event;

  constructor(private readonly diffController: DiffController) {
    this.diffController.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this.updates.fire();
  }

  getPendingCount(): number {
    return this.diffController.list().length;
  }

  getTreeItem(element: ChangeNode): vscode.TreeItem {
    if (element instanceof GroupNode) {
      const item = new vscode.TreeItem(GROUP_LABELS[element.key], vscode.TreeItemCollapsibleState.Expanded);
      item.contextValue = `kodo.changeGroup.${element.key}`;
      return item;
    }

    if (element instanceof EmptyNode) {
      const item = new vscode.TreeItem("(none)", vscode.TreeItemCollapsibleState.None);
      item.contextValue = "kodo.changeEmpty";
      item.description = "";
      return item;
    }

    const item = new vscode.TreeItem(element.file.path, vscode.TreeItemCollapsibleState.None);
    const resourceUri = resolveWorkspaceUri(element.file.path);
    item.description = element.file.isWriting ? "writing" : actionTag(element.file.action, Boolean(element.file.pending));
    item.tooltip = `${GROUP_LABELS[groupForAction(element.file.action)]}: ${element.file.path}`;
    item.contextValue = element.file.pending ? "kodo.changeFile.pending" : "kodo.changeFile.live";
    item.command = element.file.pending
      ? { command: "kodo.openChangeDiff", title: "Open Diff", arguments: [element.file.id] }
      : resourceUri ? { command: "vscode.open", title: "Open File", arguments: [resourceUri] } : undefined;
    item.iconPath = element.file.isWriting
      ? new vscode.ThemeIcon("circle-filled", new vscode.ThemeColor("charts.green"))
      : iconForAction(element.file.action);
    item.resourceUri = resourceUri;
    return item;
  }

  getChildren(element?: ChangeNode): Thenable<ChangeNode[]> {
    if (!element) {
      return Promise.resolve([
        new GroupNode("update"),
        new GroupNode("create"),
        new GroupNode("delete")
      ]);
    }

    if (!(element instanceof GroupNode)) {
      return Promise.resolve([]);
    }

    const files = this.groupedFiles().get(element.key) ?? [];
    if (files.length === 0) {
      return Promise.resolve([new EmptyNode(element.key)]);
    }

    return Promise.resolve(
      files
        .sort((left, right) => left.path.localeCompare(right.path))
        .map((file) => new FileNode(file))
    );
  }

  private groupedFiles(): Map<GroupKey, PendingOrLiveFile[]> {
    const grouped = new Map<GroupKey, PendingOrLiveFile[]>([
      ["update", []],
      ["create", []],
      ["delete", []]
    ]);

    const pending = this.diffController.list();
    const liveWrites = this.diffController.listActiveWrites();
    const byPath = new Map<string, PendingOrLiveFile>();

    for (const diff of pending) {
      byPath.set(diff.path, {
        id: diff.id,
        path: diff.path,
        action: diff.action,
        pending: diff,
        isWriting: false
      });
    }

    for (const live of liveWrites) {
      const existing = byPath.get(live.path);
      if (existing) {
        existing.isWriting = true;
      } else {
        byPath.set(live.path, {
          id: live.path,
          path: live.path,
          action: live.action,
          isWriting: true
        });
      }
    }

    for (const file of byPath.values()) {
      grouped.get(groupForAction(file.action))?.push(file);
    }

    return grouped;
  }
}

function groupForAction(action: FileChangeAction): GroupKey {
  return action === "create" ? "create" : action === "delete" ? "delete" : "update";
}

function actionTag(action: FileChangeAction, pending: boolean): string {
  if (!pending) {
    return "live";
  }

  switch (action) {
    case "create":
      return "view";
    case "delete":
      return "diff";
    case "update":
    default:
      return "diff";
  }
}

function iconForAction(action: FileChangeAction): vscode.ThemeIcon {
  switch (action) {
    case "create":
      return new vscode.ThemeIcon("new-file");
    case "delete":
      return new vscode.ThemeIcon("trash");
    case "update":
    default:
      return new vscode.ThemeIcon("diff");
  }
}

function resolveWorkspaceUri(relativePath: string): vscode.Uri | undefined {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  return root ? vscode.Uri.joinPath(root, relativePath) : undefined;
}
