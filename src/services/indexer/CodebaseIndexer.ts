import * as vscode from "vscode";
import { ConfigService } from "../../config/ConfigService";
import type { ContextChunk, ContextSummary, RetrievalResult } from "../../types/context";
import { debounce } from "../../utils/Debounce";
import { relativeWorkspacePath, selectionToString } from "../../utils/FileUtils";
import { Logger } from "../../utils/Logger";
import { ChunkingEngine } from "./ChunkingEngine";
import { EmbeddingService } from "./EmbeddingService";
import { FileWalker } from "./FileWalker";
import { RetrievalEngine } from "./RetrievalEngine";
import { VectorStore } from "./VectorStore";
import { LLMClientFactory } from "../llm/LLMClientFactory";

export class CodebaseIndexer implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly fileWalker = new FileWalker();
  private readonly chunking = new ChunkingEngine();
  private readonly vectorStore = new VectorStore();
  private readonly embeddingService: EmbeddingService;
  private readonly retrieval: RetrievalEngine;
  private readonly statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  private readonly recentFiles: string[] = [];
  private readonly debouncedReindex = debounce((uri: vscode.Uri) => {
    void this.indexFile(uri);
  }, 1500);

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly config: ConfigService,
    clientFactory: LLMClientFactory
  ) {
    this.embeddingService = new EmbeddingService(config, clientFactory);
    this.retrieval = new RetrievalEngine(this.vectorStore);
    this.statusBar.text = "Kodo: Index idle";
    this.statusBar.show();

    this.disposables.push(
      this.statusBar,
      vscode.workspace.onDidChangeTextDocument((event) => this.debouncedReindex(event.document.uri)),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.trackRecent(relativeWorkspacePath(editor.document.uri.fsPath));
        }
      })
    );
  }

  async startBackgroundIndex(): Promise<void> {
    await this.rebuildIndex(false);
  }

  async rebuildIndex(notify = true): Promise<void> {
    const files = await this.fileWalker.listWorkspaceFiles();
    this.vectorStore.clear();
    this.embeddingService.clear();

    if (notify) {
      vscode.window.setStatusBarMessage(`Kodo: indexing ${files.length} files...`, 3000);
    }

    this.statusBar.text = `Kodo: Indexing ${files.length} files`;
    for (let index = 0; index < files.length; index += 1) {
      await this.indexFile(files[index]);
      if (index % 10 === 0 || index === files.length - 1) {
        this.statusBar.text = `Kodo: Index ${index + 1}/${files.length}`;
      }
    }
    this.statusBar.text = `Kodo: Indexed ${this.vectorStore.countFiles()} files`;
  }

  async indexFile(uri: vscode.Uri): Promise<void> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.size > 512_000) {
        return;
      }

      const document = await vscode.workspace.openTextDocument(uri);
      if (document.isClosed && !document.getText()) {
        return;
      }

      const relativePath = relativeWorkspacePath(uri.fsPath);
      const chunks = this.chunking.chunkFile(relativePath, document.getText(), document.languageId);
      const vectors = await this.embeddingService.embedTexts(chunks.map((chunk) => chunk.content));
      this.vectorStore.upsert(relativePath, chunks, vectors);
      this.trackRecent(relativePath);
    } catch (error) {
      Logger.warn(`Failed to index ${uri.fsPath}: ${String(error)}`);
    }
  }

  async search(query: string, activeFilePath?: string, maxTokens = 4000): Promise<RetrievalResult[]> {
    const [queryVector] = await this.embeddingService.embedTexts([query]);
    const openPaths = vscode.window.visibleTextEditors.map((editor) => relativeWorkspacePath(editor.document.uri.fsPath));
    return this.retrieval.retrieve(queryVector, query, {
      topK: this.config.config.contextChunks,
      maxTokens,
      activeFilePath,
      openPaths,
      recentPaths: this.recentFiles
    });
  }

  async readWorkspaceFile(relativePath: string): Promise<string | undefined> {
    const uri = this.resolveUri(relativePath);
    if (!uri) {
      return undefined;
    }
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      return doc.getText();
    } catch {
      return undefined;
    }
  }

  async readAttachments(paths: string[]): Promise<Array<{ path: string; content: string }>> {
    const attachments: Array<{ path: string; content: string }> = [];
    for (const path of paths) {
      const content = await this.readWorkspaceFile(path);
      if (content !== undefined) {
        attachments.push({ path, content });
      }
    }
    return attachments;
  }

  getSummary(): ContextSummary {
    const editor = vscode.window.activeTextEditor;
    return {
      activeFile: editor ? relativeWorkspacePath(editor.document.uri.fsPath) : null,
      selectedLines: selectionToString(editor),
      attachedFiles: [],
      indexedFiles: this.vectorStore.countFiles(),
      indexedChunks: this.vectorStore.countChunks()
    };
  }

  getIndexedChunks(): ContextChunk[] {
    return this.vectorStore.allChunks();
  }

  dispose(): void {
    vscode.Disposable.from(...this.disposables).dispose();
  }

  private resolveUri(relativePath: string): vscode.Uri | undefined {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!root) {
      return undefined;
    }
    return vscode.Uri.joinPath(root, relativePath);
  }

  private trackRecent(path: string): void {
    const existing = this.recentFiles.indexOf(path);
    if (existing >= 0) {
      this.recentFiles.splice(existing, 1);
    }
    this.recentFiles.unshift(path);
    this.recentFiles.splice(20);
  }
}
