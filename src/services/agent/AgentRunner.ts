import type { AgentResult, AgentStep, DiffFile, ProposedFileChange } from "../../types/agent";
import type { LLMClient } from "../llm/LLMClient";
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

    const readStep = addStep({
      id: "read",
      label: "Read target files",
      toolName: "read_file",
      status: "running"
    });

    const files = await Promise.all(
      relevant.slice(0, 6).map(async (item) => ({
        path: item.path,
        content: await this.toolRegistry.readFile(item.path)
      }))
    );

    readStep.status = "done";
    readStep.output = files.map((file) => file.path).join(", ") || "No files loaded";
    onStep(readStep);

    const draftStep = addStep({
      id: "draft",
      label: "Draft file changes",
      status: "running"
    });

    const draftResponse = await this.llm.complete({
      model: this.model,
      messages: this.promptBuilder.buildAgentEditPrompt(task, plan, files),
      maxTokens: 2400,
      temperature: 0.2
    });

    const draft = parseDraftChanges(draftResponse.text);
    const diffs: DiffFile[] = [];

    for (const change of draft.changes) {
      const originalContent = (await this.toolRegistry.readFile(change.path).catch(() => "")) ?? "";
      diffs.push({
        id: change.path,
        path: change.path,
        action: change.action,
        summary: change.summary,
        originalContent,
        proposedContent: change.action === "delete" ? "" : change.content
      });
    }

    draftStep.status = "done";
    draftStep.output = diffs.map((diff) => `${diff.action}:${diff.path}`).join(", ") || "No changes proposed";
    onStep(draftStep);

    return {
      success: true,
      summary: draft.summary || "Agent prepared staged changes.",
      plan,
      steps,
      diffs
    };
  }
}

function parseDraftChanges(input: string): { summary: string; changes: ProposedFileChange[] } {
  const json = tryParseJson(input);
  if (json && Array.isArray(json.changes)) {
    return {
      summary: typeof json.summary === "string" ? json.summary : "Agent prepared changes.",
      changes: json.changes.map((change) => ({
        path: String(change.path),
        action: normalizeAction(change.action),
        summary: String(change.summary ?? "Proposed change"),
        content: String(change.content ?? "")
      }))
    };
  }

  return {
    summary: "Model did not return structured changes.",
    changes: []
  };
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

function normalizeAction(value: unknown): ProposedFileChange["action"] {
  return value === "create" || value === "delete" ? value : "update";
}
