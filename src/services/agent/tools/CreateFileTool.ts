import type { ProposedFileChange } from "../../../types/agent";
import type { AgentTool } from "../ToolRegistry";

export class CreateFileTool implements AgentTool<{ path: string; content: string; summary?: string }, ProposedFileChange> {
  readonly definition = {
    name: "create_file",
    description: "Stage a new file creation payload",
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
      action: "create",
      summary: input.summary ?? "Create file",
      content: input.content
    };
  }
}
