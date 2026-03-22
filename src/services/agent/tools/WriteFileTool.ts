import type { ProposedFileChange } from "../../../types/agent";
import type { AgentTool } from "../ToolRegistry";

export class WriteFileTool implements AgentTool<{ path: string; content: string; summary?: string }, ProposedFileChange> {
  readonly definition = {
    name: "write_file",
    description: "Stage an updated file content payload",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        summary: { type: "string" }
      },
      required: ["path", "content"]
    }
  };

  async execute(input: { path: string; content: string; summary?: string }): Promise<ProposedFileChange> {
    return {
      path: input.path,
      action: "update",
      summary: input.summary ?? "Update file",
      content: input.content
    };
  }
}
