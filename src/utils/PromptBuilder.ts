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
  workspaceFilePaths?: string[];
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
    const workspaceFilePaths = context.workspaceFilePaths ?? [];
    const budget = context.maxContextTokens ?? 6000;
    const retrieved = this.trimmer.trimToBudget(context.retrieved ?? [], Math.floor(budget * 0.7));
    const attachmentBlocks = attachments.map((file) => `@${file.path}\n${file.content}`);

    const systemParts = [
      "You are Kodo, a precise AI coding assistant for VS Code.",
      "Give actionable answers grounded in the provided workspace context.",
      "If you propose code, prefer complete snippets that can be applied directly.",
      "Chat mode does not execute tools. Never claim you ran commands, listed files, opened files, or saw command output unless that content is explicitly included in the prompt.",
      "Never emit pseudo-tool markup or XML tags such as <list_files>, <read_file>, or similar tool-call syntax.",
      "If you need more context, ask the user to attach files or mention them with @relative/path.",
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
      ...attachmentBlocks,
      "",
      "Workspace file inventory:",
      ...(workspaceFilePaths.length ? workspaceFilePaths : ["(not available yet)"])
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

  buildAgentExecutionPrompt(task: string, plan: AgentPlan, relevantFiles: string[]): ChatMessage[] {
    return [
      {
        role: "system",
        content: [
          "You are Kodo's multi-file editing agent inside VS Code.",
          "You have access to function tools and should use them instead of pretending to inspect files.",
          "Use tools to discover files, read code, search the codebase, and stage edits.",
          "Do not emit XML or pseudo-tool markup such as <list_files> or <read_file>.",
          "Use create_file, write_file, and delete_file only to stage final diffs. Do not describe edits without calling those tools.",
          "When you have finished staging all needed changes, respond with a concise final summary and no tool calls."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Task: ${task}`,
          `Plan: ${plan.steps.join(" | ") || "Inspect files and prepare a staged diff."}`,
          "",
          "Relevant starting files:",
          ...(relevantFiles.length ? relevantFiles : ["(none yet)"])
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
