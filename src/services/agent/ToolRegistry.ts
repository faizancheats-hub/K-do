import * as vscode from "vscode";
import type { ToolDefinition } from "../../types/llm";
import { CodebaseIndexer } from "../indexer/CodebaseIndexer";
import { CreateFileTool } from "./tools/CreateFileTool";
import { DeleteFileTool } from "./tools/DeleteFileTool";
import { ListDirectoryTool } from "./tools/ListDirectoryTool";
import { ReadFileTool } from "./tools/ReadFileTool";
import { RunTerminalTool } from "./tools/RunTerminalTool";
import { SearchCodebaseTool } from "./tools/SearchCodebaseTool";
import { WriteFileTool } from "./tools/WriteFileTool";

export interface AgentTool<TInput = Record<string, unknown>, TOutput = unknown> {
  readonly definition: ToolDefinition;
  execute(input: TInput): Promise<TOutput>;
}

export class ToolRegistry {
  private readonly readFileTool: ReadFileTool;
  private readonly writeFileTool: WriteFileTool;
  private readonly createFileTool: CreateFileTool;
  private readonly deleteFileTool: DeleteFileTool;
  private readonly searchCodebaseTool: SearchCodebaseTool;
  private readonly listDirectoryTool: ListDirectoryTool;
  private readonly runTerminalTool: RunTerminalTool;
  private readonly tools: Map<string, AgentTool>;

  constructor(indexer: CodebaseIndexer) {
    this.readFileTool = new ReadFileTool(indexer);
    this.writeFileTool = new WriteFileTool();
    this.createFileTool = new CreateFileTool();
    this.deleteFileTool = new DeleteFileTool(indexer);
    this.searchCodebaseTool = new SearchCodebaseTool(indexer);
    this.listDirectoryTool = new ListDirectoryTool();
    this.runTerminalTool = new RunTerminalTool();

    this.tools = new Map(
      [
        this.readFileTool,
        this.writeFileTool,
        this.createFileTool,
        this.deleteFileTool,
        this.searchCodebaseTool,
        this.listDirectoryTool,
        this.runTerminalTool
      ].map((tool) => [tool.definition.name, tool as AgentTool])
    );
  }

  definitions(): ToolDefinition[] {
    return [...this.tools.values()].map((tool) => tool.definition);
  }

  async execute(name: string, input: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.execute(input);
  }

  async readFile(path: string): Promise<string> {
    return this.readFileTool.execute({ path });
  }

  async searchCodebase(query: string, topK = 6): Promise<Array<{ path: string; excerpt: string }>> {
    return this.searchCodebaseTool.execute({ query, topK });
  }

  async listDirectory(path = "."): Promise<string[]> {
    return this.listDirectoryTool.execute({ path });
  }

  async confirmDelete(path: string): Promise<boolean> {
    const action = await vscode.window.showWarningMessage(
      `Delete ${path}?`,
      { modal: true },
      "Delete"
    );
    return action === "Delete";
  }
}
