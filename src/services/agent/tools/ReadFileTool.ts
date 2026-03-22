import { CodebaseIndexer } from "../../indexer/CodebaseIndexer";
import type { AgentTool } from "../ToolRegistry";

export class ReadFileTool implements AgentTool<{ path: string }, string> {
  readonly definition = {
    name: "read_file",
    description: "Read a workspace file by relative path",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" }
      },
      required: ["path"]
    }
  };

  constructor(private readonly indexer: CodebaseIndexer) {}

  async execute(input: { path: string }): Promise<string> {
    return (await this.indexer.readWorkspaceFile(input.path)) ?? "";
  }
}
