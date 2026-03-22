import { CodebaseIndexer } from "../../indexer/CodebaseIndexer";
import type { ProposedFileChange } from "../../../types/agent";
import type { AgentTool } from "../ToolRegistry";

export class DeleteFileTool implements AgentTool<{ path: string; summary?: string }, ProposedFileChange> {
  readonly definition = {
    name: "delete_file",
    description: "Stage a file deletion payload",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        summary: { type: "string" }
      },
      required: ["path"]
    }
  };

  constructor(private readonly indexer: CodebaseIndexer) {}

  async execute(input: { path: string; summary?: string }): Promise<ProposedFileChange> {
    const existing = await this.indexer.readWorkspaceFile(input.path);
    return {
      path: input.path,
      action: "delete",
      summary: input.summary ?? `Delete file (${existing ? "exists" : "missing"})`,
      content: ""
    };
  }
}
