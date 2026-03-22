import { z } from "zod";
import type { ContextSummary } from "./context";
import type { AgentStep, DiffFile } from "./agent";

export type ComposerMode = "auto" | "chat" | "agent";

export type ExtToWebMsg =
  | { type: "stream_start"; messageId: string; role: "assistant" }
  | { type: "stream_token"; messageId: string; token: string }
  | { type: "stream_replace"; messageId: string; content: string }
  | { type: "stream_done"; messageId: string }
  | { type: "stream_error"; messageId: string; error: string }
  | { type: "agent_step"; step: AgentStep }
  | { type: "diff_ready"; files: DiffFile[]; summary: string }
  | { type: "context_info"; context: ContextSummary }
  | { type: "attachments_picked"; paths: string[] }
  | { type: "chat_reset" };

export type WebToExtMsg =
  | { type: "send_message"; content: string; attachments: string[]; mode: ComposerMode }
  | { type: "cancel_stream" }
  | { type: "accept_diff"; fileId: string }
  | { type: "reject_diff"; fileId: string }
  | { type: "accept_all_diffs" }
  | { type: "reject_all_diffs" }
  | { type: "insert_code"; code: string; lang: string }
  | { type: "apply_code"; code: string; lang: string }
  | { type: "new_chat" }
  | { type: "export_chat" }
  | { type: "open_history" }
  | { type: "open_settings" }
  | { type: "pick_attachments" }
  | { type: "set_model"; value: string };

const sendMessageSchema = z.object({
  type: z.literal("send_message"),
  content: z.string(),
  attachments: z.array(z.string()).default([]),
  mode: z.enum(["auto", "chat", "agent"]).default("auto")
});

export const webToExtMessageSchema = z.union([
  sendMessageSchema,
  z.object({ type: z.literal("cancel_stream") }),
  z.object({ type: z.literal("accept_diff"), fileId: z.string() }),
  z.object({ type: z.literal("reject_diff"), fileId: z.string() }),
  z.object({ type: z.literal("accept_all_diffs") }),
  z.object({ type: z.literal("reject_all_diffs") }),
  z.object({ type: z.literal("insert_code"), code: z.string(), lang: z.string() }),
  z.object({ type: z.literal("apply_code"), code: z.string(), lang: z.string() }),
  z.object({ type: z.literal("new_chat") }),
  z.object({ type: z.literal("export_chat") }),
  z.object({ type: z.literal("open_history") }),
  z.object({ type: z.literal("open_settings") }),
  z.object({ type: z.literal("pick_attachments") }),
  z.object({ type: z.literal("set_model"), value: z.string() })
]);

export function isWebToExtMessage(value: unknown): value is WebToExtMsg {
  return webToExtMessageSchema.safeParse(value).success;
}

export type { ContextSummary, AgentStep, DiffFile };
