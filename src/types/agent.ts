export type AgentStepStatus = "pending" | "running" | "done" | "error";
export type FileChangeAction = "create" | "update" | "delete";

export interface AgentPlan {
  steps: string[];
  rationale?: string;
}

export interface AgentStep {
  id: string;
  label: string;
  toolName?: string;
  input?: Record<string, unknown>;
  output?: string;
  status: AgentStepStatus;
  error?: string;
}

export interface DiffFile {
  id: string;
  path: string;
  action: FileChangeAction;
  summary: string;
  originalContent: string;
  proposedContent: string;
}

export interface ProposedFileChange {
  path: string;
  action: FileChangeAction;
  summary: string;
  content: string;
}

export interface AgentResult {
  success: boolean;
  summary: string;
  plan: AgentPlan;
  steps: AgentStep[];
  diffs: DiffFile[];
  error?: string;
}
