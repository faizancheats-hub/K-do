import { describe, expect, it } from "vitest";
import type { AgentStep } from "../../src/types/agent";
import type { CompletionRequest, CompletionResponse } from "../../src/types/llm";
import type { LLMClient } from "../../src/services/llm/LLMClient";
import { AgentRunner } from "../../src/services/agent/AgentRunner";
import { PromptBuilder } from "../../src/utils/PromptBuilder";
import type { ToolRegistry } from "../../src/services/agent/ToolRegistry";

class FakeLLMClient implements LLMClient {
  readonly provider = "openai";
  private calls = 0;

  async complete(_request: CompletionRequest): Promise<CompletionResponse> {
    this.calls += 1;

    if (this.calls === 1) {
      return {
        text: "{\"steps\":[\"Inspect files\",\"Stage updates\"]}",
        choices: [
          {
            message: {
              role: "assistant",
              content: "{\"steps\":[\"Inspect files\",\"Stage updates\"]}"
            }
          }
        ]
      };
    }

    if (this.calls === 2) {
      return {
        text: "",
        choices: [
          {
            message: {
              role: "assistant",
              content: "",
              toolCalls: [
                {
                  id: "call_list",
                  name: "list_directory",
                  arguments: { path: "." }
                },
                {
                  id: "call_read",
                  name: "read_file",
                  arguments: { path: "package.json" }
                },
                {
                  id: "call_write",
                  name: "write_file",
                  arguments: {
                    path: "src/generated.ts",
                    content: "export const generated = true;\n",
                    summary: "Add generated file"
                  }
                }
              ]
            }
          }
        ]
      };
    }

    return {
      text: "Prepared staged changes.",
      choices: [
        {
          message: {
            role: "assistant",
            content: "Prepared staged changes."
          }
        }
      ]
    };
  }

  async *stream(): AsyncIterable<string> {
    return;
  }

  async embed(): Promise<number[][]> {
    return [];
  }

  async isAvailable() {
    return {
      available: true,
      provider: this.provider
    };
  }
}

describe("AgentRunner", () => {
  it("executes model tool calls and stages diffs", async () => {
    const llm = new FakeLLMClient();
    const toolCalls: string[] = [];
    const registry = {
      definitions: () => [
        { name: "list_directory", description: "", inputSchema: {} },
        { name: "read_file", description: "", inputSchema: {} },
        { name: "write_file", description: "", inputSchema: {} }
      ],
      searchCodebase: async () => [{ path: "package.json", excerpt: "{}" }],
      readFile: async (path: string) => (path === "package.json" ? "{\"name\":\"kodo\"}" : ""),
      execute: async (name: string, input: Record<string, unknown>) => {
        toolCalls.push(name);
        if (name === "list_directory") {
          return ["file:package.json", "dir:src"];
        }
        if (name === "read_file") {
          return "{\"name\":\"kodo\"}";
        }
        return {
          path: String(input.path),
          action: "update" as const,
          summary: String(input.summary),
          content: String(input.content)
        };
      }
    } as unknown as ToolRegistry;

    const runner = new AgentRunner(llm, registry, new PromptBuilder(), "claude-sonnet-4-5");
    const steps: AgentStep[] = [];

    const result = await runner.run("Add a generated file", (step) => {
      steps.push({ ...step });
    });

    expect(toolCalls).toEqual(["list_directory", "read_file", "write_file"]);
    expect(result.success).toBe(true);
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]?.path).toBe("src/generated.ts");
    expect(result.summary).toContain("Prepared");
    expect(steps.some((step) => step.toolName === "write_file" && step.status === "done")).toBe(true);
  });
});
