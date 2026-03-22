import { CodebaseIndexer } from "../../indexer/CodebaseIndexer";
import type { AgentTool } from "../ToolRegistry";

export class SearchCodebaseTool implements AgentTool<{ query: string; topK?: number }, Array<{ path: string; excerpt: string }>> {
  readonly definition = {
    name: "search_codebase",
    description: "Search the indexed workspace for relevant code chunks",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        topK: { type: "number" }
      },
      required: ["query"]
    }
  };

  constructor(private readonly indexer: CodebaseIndexer) {}

  async execute(input: { query: string; topK?: number }): Promise<Array<{ path: string; excerpt: string }>> {
    const results = await this.indexer.search(input.query, undefined, 3000);
    return results.slice(0, input.topK ?? 5).map((result) => ({
      path: result.path,
      excerpt: result.content.slice(0, 400)
    }));
  }
}
