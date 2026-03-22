import * as vscode from "vscode";
import { ConfigService } from "../config/ConfigService";
import { CodebaseIndexer } from "../services/indexer/CodebaseIndexer";
import { LLMClientFactory } from "../services/llm/LLMClientFactory";
import { AgentRunner } from "../services/agent/AgentRunner";
import { ToolRegistry } from "../services/agent/ToolRegistry";
import { PromptBuilder } from "../utils/PromptBuilder";
import type { ExtToWebMsg } from "../types/messages";
import { DiffController } from "./DiffController";

export class AgentController {
  private readonly promptBuilder = new PromptBuilder();
  private readonly toolRegistry: ToolRegistry;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly config: ConfigService,
    private readonly clientFactory: LLMClientFactory,
    private readonly indexer: CodebaseIndexer,
    private readonly diffController: DiffController
  ) {
    this.toolRegistry = new ToolRegistry(indexer);
  }

  async runTask(task: string, post: (message: ExtToWebMsg) => void): Promise<void> {
    const client = await this.clientFactory.create();
    const runner = new AgentRunner(client, this.toolRegistry, this.promptBuilder, this.config.config.model);
    const result = await runner.run(task, (step) => {
      this.diffController.syncAgentStep(step);
      post({ type: "agent_step", step });
    }).finally(() => {
      this.diffController.clearActiveWrites();
    });
    this.diffController.stage(result.diffs);
    if (result.diffs.length) {
      await this.diffController.preview();
    }
    post({
      type: "diff_ready",
      files: result.diffs,
      summary: this.diffSummary(result.summary)
    });
  }

  async acceptDiff(fileId: string): Promise<{ files: ReturnType<DiffController["list"]>; summary: string }> {
    await this.diffController.accept(fileId);
    return this.currentDiffState("Accepted staged file.");
  }

  async rejectDiff(fileId: string): Promise<{ files: ReturnType<DiffController["list"]>; summary: string }> {
    await this.diffController.reject(fileId);
    return this.currentDiffState("Rejected staged file.");
  }

  async acceptAllDiffs(): Promise<{ files: ReturnType<DiffController["list"]>; summary: string }> {
    await this.diffController.acceptAll();
    vscode.window.setStatusBarMessage("Kodo: applied all staged diffs", 2000);
    return this.currentDiffState("Applied all staged diffs.");
  }

  rejectAllDiffs(): { files: ReturnType<DiffController["list"]>; summary: string } {
    this.diffController.rejectAll();
    vscode.window.setStatusBarMessage("Kodo: discarded staged diffs", 2000);
    return this.currentDiffState("Discarded all staged diffs.");
  }

  private currentDiffState(lastAction: string): { files: ReturnType<DiffController["list"]>; summary: string } {
    const files = this.diffController.list();
    return {
      files,
      summary: this.diffSummary(lastAction, files.length)
    };
  }

  private diffSummary(prefix: string, pendingCount = this.diffController.list().length): string {
    if (pendingCount === 0) {
      return prefix === "No staged diffs." ? prefix : `${prefix} No staged diffs remaining.`;
    }
    if (!prefix || prefix === "No staged diffs.") {
      return `${pendingCount} staged ${pendingCount === 1 ? "change" : "changes"} ready to review.`;
    }
    return `${prefix} ${pendingCount} staged ${pendingCount === 1 ? "change" : "changes"} remaining.`;
  }
}
