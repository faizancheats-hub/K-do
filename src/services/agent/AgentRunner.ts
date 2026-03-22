import type { AgentPlan, AgentResult, AgentStep, DiffFile, ProposedFileChange } from "../../types/agent";
import type { ChatMessage } from "../../types/llm";
import type { LLMClient } from "../llm/LLMClient";
import { isMutationTask } from "../../utils/IntentRouting";
import { PromptBuilder } from "../../utils/PromptBuilder";
import { PlanParser } from "./PlanParser";
import { ToolRegistry } from "./ToolRegistry";

export class AgentRunner {
  constructor(
    private readonly llm: LLMClient,
    private readonly toolRegistry: ToolRegistry,
    private readonly promptBuilder: PromptBuilder,
    private readonly model: string
  ) {}

  async run(task: string, onStep: (step: AgentStep) => void): Promise<AgentResult> {
    const steps: AgentStep[] = [];
    const stagedChanges = new Map<string, ProposedFileChange>();
    const addStep = (step: AgentStep) => {
      steps.push(step);
      onStep(step);
      return step;
    };

    const searchStep = addStep({
      id: "search",
      label: "Search relevant files",
      toolName: "search_codebase",
      input: { query: task },
      status: "running"
    });

    const relevant = await this.toolRegistry.searchCodebase(task, 6);
    searchStep.status = "done";
    searchStep.output = relevant.map((item) => item.path).join(", ") || "No strong file matches";
    onStep(searchStep);

    const planStep = addStep({
      id: "plan",
      label: "Build edit plan",
      status: "running"
    });

    const planResponse = await this.llm.complete({
      model: this.model,
      messages: this.promptBuilder.buildAgentPlanPrompt(
        task,
        relevant.map((item) => item.path)
      ),
      maxTokens: 800,
      temperature: 0.2
    });

    const plan = new PlanParser().parse(planResponse.text);
    planStep.status = "done";
    planStep.output = plan.steps.join(" -> ");
    onStep(planStep);

    const executeStep = addStep({
      id: "execute",
      label: "Run tool-calling agent loop",
      status: "running"
    });

    const execution = await this.runToolLoop(task, plan, relevant.map((item) => item.path), stagedChanges, addStep, onStep);
    const diffs = await this.buildDiffs(stagedChanges);

    executeStep.status = execution.success ? "done" : "error";
    executeStep.output = diffs.map((diff) => `${diff.action}:${diff.path}`).join(", ") || execution.summary;
    executeStep.error = execution.error;
    onStep(executeStep);

    return {
      success: execution.success,
      summary: execution.summary || "Agent prepared staged changes.",
      plan,
      steps,
      diffs,
      error: execution.error
    };
  }

  private async runToolLoop(
    task: string,
    plan: AgentPlan,
    relevantFiles: string[],
    stagedChanges: Map<string, ProposedFileChange>,
    addStep: (step: AgentStep) => AgentStep,
    onStep: (step: AgentStep) => void
  ): Promise<{ success: boolean; summary: string; error?: string }> {
    const messages: ChatMessage[] = this.promptBuilder.buildAgentExecutionPrompt(task, plan, relevantFiles);
    const maxIterations = 10;
    const requiresMutatingToolUse = isMutationTask(task);
    let summary = "";

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      const requireToolsThisTurn = requiresMutatingToolUse && stagedChanges.size === 0;
      const response = await this.llm.complete({
        model: this.model,
        messages,
        tools: this.toolRegistry.definitions(),
        toolChoice: requireToolsThisTurn ? "required" : "auto",
        maxTokens: 1600,
        temperature: 0.2
      });

      const assistantMessage = response.choices[0]?.message ?? {
        role: "assistant" as const,
        content: response.text,
        toolCalls: []
      };

      messages.push({
        role: "assistant",
        content: assistantMessage.content,
        toolCalls: assistantMessage.toolCalls
      });

      if (!assistantMessage.toolCalls?.length) {
        if (requireToolsThisTurn) {
          messages.push({
            role: "user",
            content: [
              "You must use the provided tools for this task.",
              "Do not answer with code blocks or implementation prose.",
              "Inspect files and stage concrete edits with create_file, write_file, or delete_file before finishing."
            ].join("\n")
          });
          continue;
        }

        summary = assistantMessage.content.trim() || summarizeStagedChanges(stagedChanges);
        return {
          success: true,
          summary: summary || "Agent finished without staging changes."
        };
      }

      for (const toolCall of assistantMessage.toolCalls) {
        const toolStep = addStep({
          id: `tool-${iteration}-${toolCall.id}`,
          label: `Run ${toolCall.name}`,
          toolName: toolCall.name,
          input: toolCall.arguments,
          status: "running"
        });

        try {
          const result = await this.toolRegistry.execute(toolCall.name, toolCall.arguments);
          const staged = asProposedFileChange(result);
          if (staged) {
            stagedChanges.set(staged.path, staged);
          }

          toolStep.status = "done";
          toolStep.output = summarizeToolResult(toolCall.name, result);
          onStep(toolStep);

          messages.push({
            role: "tool",
            toolCallId: toolCall.id,
            content: serializeToolResult(result)
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          toolStep.status = "error";
          toolStep.error = message;
          onStep(toolStep);

          messages.push({
            role: "tool",
            toolCallId: toolCall.id,
            content: `ERROR: ${message}`
          });
        }
      }
    }

    return {
      success: false,
      summary: summarizeStagedChanges(stagedChanges),
      error: "Max agent iterations reached before producing a final answer."
    };
  }

  private async buildDiffs(stagedChanges: Map<string, ProposedFileChange>): Promise<DiffFile[]> {
    const diffs: DiffFile[] = [];

    for (const change of stagedChanges.values()) {
      const originalContent = change.action === "create"
        ? ""
        : (await this.toolRegistry.readFile(change.path).catch(() => "")) ?? "";

      diffs.push({
        id: change.path,
        path: change.path,
        action: change.action,
        summary: change.summary,
        originalContent,
        proposedContent: change.action === "delete" ? "" : change.content
      });
    }

    return diffs;
  }
}

function tryParseJson(input: string): Record<string, unknown> | undefined {
  const match = input.match(/\{[\s\S]*\}/);
  if (!match) {
    return undefined;
  }
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function asProposedFileChange(result: unknown): ProposedFileChange | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  const change = result as Record<string, unknown>;
  if (typeof change.path !== "string" || typeof change.content !== "string") {
    return undefined;
  }

  return {
    path: change.path,
    action: normalizeAction(change.action),
    summary: typeof change.summary === "string" ? change.summary : "Proposed change",
    content: change.content
  };
}

function normalizeAction(value: unknown): ProposedFileChange["action"] {
  return value === "create" || value === "delete" ? value : "update";
}

function serializeToolResult(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  return JSON.stringify(result, null, 2);
}

function summarizeToolResult(toolName: string, result: unknown): string {
  if (typeof result === "string") {
    return truncate(result);
  }

  const staged = asProposedFileChange(result);
  if (staged) {
    return `${staged.action}:${staged.path}`;
  }

  if (Array.isArray(result)) {
    return `${toolName} returned ${result.length} item(s)`;
  }

  return truncate(JSON.stringify(result));
}

function summarizeStagedChanges(stagedChanges: Map<string, ProposedFileChange>): string {
  const items = [...stagedChanges.values()].map((change) => `${change.action}:${change.path}`);
  return items.length ? `Staged changes: ${items.join(", ")}` : "No staged changes.";
}

function truncate(value: string, maxLength = 140): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}
