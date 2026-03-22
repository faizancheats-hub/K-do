import type { AgentPlan } from "../types/agent";
import type { ChatMessage, CompletionRequest } from "../types/llm";
import type { ContextChunk } from "../types/context";
import { ContextTrimmer } from "./ContextTrimmer";
import { TokenCounter } from "./TokenCounter";

export interface PromptContext {
  task: string;
  activeFile?: string;
  languageId?: string;
  prefix?: string;
  suffix?: string;
  selection?: string | null;
  retrieved?: ContextChunk[];
  attachments?: Array<{ path: string; content: string }>;
  history?: ChatMessage[];
  maxContextTokens?: number;
}

export class PromptBuilder {
  private readonly counter = new TokenCounter();
  private readonly trimmer = new ContextTrimmer(this.counter);

  buildInlineRequest(context: PromptContext, model: string, maxTokens: number, signal?: AbortSignal): CompletionRequest {
    const retrieved = this.trimmer.trimToBudget(context.retrieved ?? [], 2000);
    const system = [
      "You are Kodo, an inline coding assistant inside VS Code.",
      "Return only the code that should be inserted at the cursor.",
      "Prefer continuing the current style and imports.",
      context.activeFile ? `Active file: ${context.activeFile}` : "",
      context.languageId ? `Language: ${context.languageId}` : ""
    ].filter(Boolean).join("\n");

    const user = [
      "Prefix:",
      context.prefix ?? "",
      "",
      "Suffix:",
      context.suffix ?? "",
      "",
      "Retrieved context:",
      ...retrieved.map((chunk) => `[${chunk.path}:${chunk.startLine}-${chunk.endLine}]\n${chunk.content}`)
    ].join("\n");

    return {
      model,
      maxTokens,
      temperature: 0.2,
      signal,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    };
  }

  buildChatRequest(context: PromptContext, model: string, maxTokens: number, signal?: AbortSignal): CompletionRequest {
    const attachments = context.attachments ?? [];
    const budget = context.maxContextTokens ?? 6000;
    const retrieved = this.trimmer.trimToBudget(context.retrieved ?? [], Math.floor(budget * 0.7));
    const attachmentBlocks = attachments.map((file) => `@${file.path}\n${file.content}`);

    const systemParts = [
      "You are Kodo, a precise AI coding assistant for VS Code.",
      "Give actionable answers grounded in the provided workspace context.",
      "If you propose code, prefer complete snippets that can be applied directly.",
      context.activeFile ? `Active file: ${context.activeFile}` : "",
      context.selection ? `Selected code:\n${context.selection}` : ""
    ].filter(Boolean);

    const userParts = [
      context.task,
      "",
      "Retrieved context:",
      ...retrieved.map((chunk) => `[${chunk.path}:${chunk.startLine}-${chunk.endLine}]\n${chunk.content}`),
      "",
      "Attached files:",
      ...attachmentBlocks
    ].filter(Boolean);

    return {
      model,
      maxTokens,
      temperature: 0.3,
      signal,
      messages: [
        { role: "system", content: systemParts.join("\n\n") },
        ...(context.history ?? []).slice(-12),
        { role: "user", content: userParts.join("\n") }
      ]
    };
  }

  buildAgentPlanPrompt(task: string, relevantFiles: string[]): ChatMessage[] {
    return [
      {
        role: "system",
        content: [
          "You are Kodo's planning model.",
          "Return valid JSON only.",
          'Schema: {"steps": string[], "rationale": string }'
        ].join("\n")
      },
      {
        role: "user",
        content: `Task: ${task}\nRelevant files:\n${relevantFiles.join("\n") || "(none)"}`
      }
    ];
  }

  buildAgentEditPrompt(task: string, plan: AgentPlan, files: Array<{ path: string; content: string }>): ChatMessage[] {
    const fileBlocks = files.map((file) => `FILE: ${file.path}\n${file.content}`);
    return [
      {
        role: "system",
        content: [
          "You are Kodo's multi-file editing engine.",
          "Return valid JSON only.",
          'Schema: {"changes":[{"path":string,"action":"create|update|delete","summary":string,"content":string}],"summary":string}',
          "For update and create, content must be the full final file content."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Task: ${task}`,
          `Plan: ${plan.steps.join(" | ")}`,
          "",
          ...fileBlocks
        ].join("\n")
      }
    ];
  }

  summarizeContext(chunks: ContextChunk[]): string {
    return chunks
      .map((chunk) => `${chunk.path}:${chunk.startLine}-${chunk.endLine} (${this.counter.estimate(chunk.content)} tokens)`)
      .join("\n");
  }
}
