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
    const result = await runner.run(task, (step) => post({ type: "agent_step", step }));
    this.diffController.stage(result.diffs);
    if (result.diffs.length) {
      await this.diffController.preview();
    }
    post({
      type: "diff_ready",
      files: result.diffs,
      summary: result.summary
    });
  }

  async acceptDiff(fileId: string): Promise<void> {
    await this.diffController.accept(fileId);
  }

  async rejectDiff(fileId: string): Promise<void> {
    await this.diffController.reject(fileId);
  }

  async acceptAllDiffs(): Promise<void> {
    await this.diffController.acceptAll();
    vscode.window.setStatusBarMessage("Kodo: applied all staged diffs", 2000);
  }

  rejectAllDiffs(): void {
    this.diffController.rejectAll();
    vscode.window.setStatusBarMessage("Kodo: discarded staged diffs", 2000);
  }
}
