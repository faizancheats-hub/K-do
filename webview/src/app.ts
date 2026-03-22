import { buildDiffLines, escapeHtml, renderMarkdownInto } from "./renderers";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

type ComposerMode = "auto" | "chat" | "agent";
type ToolsMode = "all" | "read_only" | "none";

type AgentStepMsg = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error" | string;
  toolName?: string;
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
};

type DiffItem = {
  id: string;
  path: string;
  action: string;
  summary: string;
  originalContent: string;
  proposedContent: string;
};

type PanelContext = {
  activeFile: string | null;
  indexedFiles: number;
  indexedChunks: number;
  attachedFiles: string[];
  workspaceFiles: string[];
  model: string;
  provider: string;
};

type ExtToWebMsg =
  | { type: "stream_start"; messageId: string; role: "assistant" }
  | { type: "stream_token"; messageId: string; token: string }
  | { type: "stream_replace"; messageId: string; content: string }
  | { type: "stream_done"; messageId: string }
  | { type: "stream_error"; messageId: string; error: string }
  | { type: "agent_step"; step: AgentStepMsg }
  | { type: "diff_ready"; files: DiffItem[]; summary: string }
  | { type: "context_info"; context: PanelContext }
  | { type: "attachments_picked"; paths: string[] }
  | { type: "chat_reset" };

type StreamingNode = {
  body: HTMLDivElement;
  text: Text;
  cursor: HTMLSpanElement;
  raw: string;
};

type StepFeed = {
  root: HTMLDivElement;
  list: HTMLDivElement;
  rows: Map<string, HTMLDivElement>;
};

type MentionState = {
  start: number;
  end: number;
  options: string[];
  index: number;
} | null;

const vscode = acquireVsCodeApi();
const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing app root");
}

root.innerHTML = `
  <div class="layout">
    <header class="topbar">
      <div class="brand"><span class="brand-badge">コ</span><span class="brand-wordmark">Kōdo</span></div>
      <div class="topbar-actions">
        <button id="history-button" class="icon-button" type="button" title="History">◷</button>
        <button id="settings-button" class="icon-button" type="button" title="Settings">⚙</button>
        <button id="new-chat-button" class="icon-button icon-button-primary" type="button" title="New Chat">+</button>
      </div>
    </header>
    <main class="thread-shell"><section id="messages" class="messages" aria-live="polite"></section></main>
    <section class="status-bar"><span id="status-primary"></span><span id="status-secondary">Idle</span></section>
    <footer class="input-zone">
      <div class="mode-row" role="group" aria-label="Mode">
        <button type="button" class="mode-pill is-active" data-mode="auto">Auto</button>
        <button type="button" class="mode-pill" data-mode="chat">Chat</button>
        <button type="button" class="mode-pill" data-mode="agent">Agent</button>
      </div>
      <div id="attachment-row" class="attachment-row is-hidden"></div>
      <div class="composer-shell">
        <textarea id="input" rows="1" placeholder="Ask Kōdo or describe a change…"></textarea>
        <div id="mention-menu" class="mention-menu is-hidden"></div>
      </div>
      <div id="agent-indicator" class="agent-indicator is-hidden"><span class="status-dot"></span><span id="agent-indicator-text"></span></div>
      <div class="input-actions">
        <div class="left-actions">
          <label class="select-pill"><select id="model-select"></select></label>
          <label class="select-pill">
            <select id="tools-select">
              <option value="all">Tools: All</option>
              <option value="read_only">Tools: Read Only</option>
              <option value="none">Tools: None</option>
            </select>
          </label>
        </div>
        <div class="right-actions">
          <button id="mention-button" class="small-button" type="button">@</button>
          <button id="attach-button" class="small-button" type="button">⊕</button>
          <button id="primary-action" class="send-button" type="button">Send ↵</button>
        </div>
      </div>
    </footer>
  </div>
`;

const messagesEl = getEl<HTMLDivElement>("messages");
const statusPrimaryEl = getEl<HTMLSpanElement>("status-primary");
const statusSecondaryEl = getEl<HTMLSpanElement>("status-secondary");
const attachmentRowEl = getEl<HTMLDivElement>("attachment-row");
const inputEl = getEl<HTMLTextAreaElement>("input");
const mentionMenuEl = getEl<HTMLDivElement>("mention-menu");
const agentIndicatorEl = getEl<HTMLDivElement>("agent-indicator");
const agentIndicatorTextEl = getEl<HTMLSpanElement>("agent-indicator-text");
const modelSelectEl = getEl<HTMLSelectElement>("model-select");
const toolsSelectEl = getEl<HTMLSelectElement>("tools-select");
const primaryActionEl = getEl<HTMLButtonElement>("primary-action");
const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".mode-pill"));

const streamingNodes = new Map<string, StreamingNode>();
let currentContext: PanelContext = {
  activeFile: null,
  indexedFiles: 0,
  indexedChunks: 0,
  attachedFiles: [],
  workspaceFiles: [],
  model: "gpt-4o-mini",
  provider: "openai"
};
let currentMode: ComposerMode = "auto";
let toolsMode: ToolsMode = "all";
let attachedFiles: string[] = [];
let isStreaming = false;
let tokenEstimate = 0;
let currentFeed: StepFeed | null = null;
let diffBatchEl: HTMLDivElement | null = null;
let mentionState: MentionState = null;

bindEvents();
renderAttachments();
renderStatus();
populateModels();
autoGrowTextarea();

function bindEvents(): void {
  getEl<HTMLButtonElement>("new-chat-button").addEventListener("click", () => vscode.postMessage({ type: "new_chat" }));
  getEl<HTMLButtonElement>("history-button").addEventListener("click", () => vscode.postMessage({ type: "open_history" }));
  getEl<HTMLButtonElement>("settings-button").addEventListener("click", () => vscode.postMessage({ type: "open_settings" }));
  getEl<HTMLButtonElement>("mention-button").addEventListener("click", () => insertAtCursor("@"));
  getEl<HTMLButtonElement>("attach-button").addEventListener("click", () => vscode.postMessage({ type: "pick_attachments" }));
  primaryActionEl.addEventListener("click", () => isStreaming ? vscode.postMessage({ type: "cancel_stream" }) : sendMessage());
  modeButtons.forEach((button) => button.addEventListener("click", () => {
    currentMode = button.dataset.mode as ComposerMode;
    modeButtons.forEach((candidate) => candidate.classList.toggle("is-active", candidate === button));
  }));
  modelSelectEl.addEventListener("change", () => {
    currentContext.model = modelSelectEl.value;
    renderStatus();
    vscode.postMessage({ type: "set_model", value: modelSelectEl.value });
  });
  toolsSelectEl.addEventListener("change", () => {
    toolsMode = toolsSelectEl.value as ToolsMode;
  });
  attachmentRowEl.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-remove]");
    if (!button) {
      return;
    }
    attachedFiles = attachedFiles.filter((file) => file !== button.dataset.remove);
    renderAttachments();
  });
  inputEl.addEventListener("input", () => {
    autoGrowTextarea();
    updateMentionMenu();
  });
  inputEl.addEventListener("click", () => updateMentionMenu());
  inputEl.addEventListener("keyup", () => updateMentionMenu());
  inputEl.addEventListener("keydown", (event) => onInputKeydown(event));
  window.addEventListener("message", (event) => handleMessage(event.data as ExtToWebMsg));
}

function sendMessage(): void {
  const content = inputEl.value.trim();
  if (!content) {
    return;
  }

  renderUserMessage(content);
  currentFeed = null;
  diffBatchEl = null;
  tokenEstimate = 0;
  renderStatus();
  vscode.postMessage({ type: "send_message", content, attachments: attachedFiles, mode: currentMode });
  attachedFiles = [];
  renderAttachments();
  inputEl.value = "";
  autoGrowTextarea();
  hideMentionMenu();
}

function handleMessage(message: ExtToWebMsg): void {
  switch (message.type) {
    case "stream_start":
      isStreaming = true;
      tokenEstimate = 0;
      updatePrimaryAction();
      ensureStreamingMessage(message.messageId);
      renderStatus();
      break;
    case "stream_token":
      appendStreamToken(message.messageId, message.token);
      break;
    case "stream_replace":
      replaceStreamToken(message.messageId, message.content);
      break;
    case "stream_done":
      isStreaming = false;
      finalizeStream(message.messageId);
      updatePrimaryAction();
      renderStatus();
      break;
    case "stream_error":
      isStreaming = false;
      appendStreamToken(message.messageId, `\n\nError: ${message.error}`);
      finalizeStream(message.messageId);
      updatePrimaryAction();
      renderStatus();
      break;
    case "agent_step":
      renderStep(message.step);
      break;
    case "diff_ready":
      renderDiffBatch(message.files, message.summary);
      break;
    case "context_info":
      currentContext = message.context;
      populateModels();
      renderStatus();
      updateMentionMenu();
      break;
    case "attachments_picked":
      attachedFiles = dedupe([...attachedFiles, ...message.paths]);
      renderAttachments();
      break;
    case "chat_reset":
      messagesEl.innerHTML = "";
      streamingNodes.clear();
      currentFeed = null;
      diffBatchEl = null;
      attachedFiles = [];
      renderAttachments();
      renderStatus();
      break;
  }
}

function ensureStreamingMessage(id: string): StreamingNode {
  const existing = streamingNodes.get(id);
  if (existing) {
    return existing;
  }
  const body = appendAssistantBlock();
  body.classList.add("assistant-stream");
  const text = document.createTextNode("");
  const cursor = document.createElement("span");
  cursor.className = "stream-cursor";
  cursor.textContent = "▋";
  body.append(text, cursor);
  const node = { body, text, cursor, raw: "" };
  streamingNodes.set(id, node);
  return node;
}

function appendStreamToken(id: string, token: string): void {
  const node = ensureStreamingMessage(id);
  node.raw += token;
  node.text.appendData(token);
  tokenEstimate = estimateTokens(node.raw);
  renderStatus();
  scrollToBottom();
}

function replaceStreamToken(id: string, content: string): void {
  const node = ensureStreamingMessage(id);
  if (content.startsWith(node.raw)) {
    node.text.appendData(content.slice(node.raw.length));
  } else {
    node.text.data = content;
  }
  node.raw = content;
  tokenEstimate = estimateTokens(node.raw);
  renderStatus();
  scrollToBottom();
}

function finalizeStream(id: string): void {
  const node = streamingNodes.get(id);
  if (!node) {
    return;
  }
  node.cursor.remove();
  node.body.classList.remove("assistant-stream");
  renderMarkdownInto(node.body, node.raw);
  streamingNodes.delete(id);
  scrollToBottom();
}

function renderUserMessage(content: string): void {
  const row = document.createElement("div");
  row.className = "message user fade-in";
  const bubble = document.createElement("div");
  bubble.className = "user-bubble";
  bubble.textContent = content;
  row.append(bubble);
  messagesEl.append(row);
  scrollToBottom();
}

function renderStep(step: AgentStepMsg): void {
  if (step.id === "search" && step.status === "running") {
    currentFeed = createFeed();
  }
  if (!currentFeed) {
    currentFeed = createFeed();
  }

  let row = currentFeed.rows.get(step.id);
  if (!row) {
    row = document.createElement("div");
    row.className = "agent-step-row";
    row.innerHTML = `<span class="agent-step-icon"></span><span class="agent-step-tool"></span><span class="agent-step-detail"></span><span class="agent-step-time"></span>`;
    currentFeed.rows.set(step.id, row);
    currentFeed.list.append(row);
  }

  row.querySelector<HTMLElement>(".agent-step-icon")!.className = `agent-step-icon${step.status === "done" ? " is-done" : step.status === "error" ? " is-error" : step.status === "running" ? " is-running" : ""}`;
  row.querySelector<HTMLElement>(".agent-step-icon")!.textContent = step.status === "done" ? "✓" : step.status === "error" ? "✗" : step.status === "running" ? "⟳" : "•";
  row.querySelector<HTMLElement>(".agent-step-tool")!.textContent = stepName(step);
  const detail = stepDetail(step);
  row.querySelector<HTMLElement>(".agent-step-detail")!.textContent = shortenMiddle(detail, 72);
  row.querySelector<HTMLElement>(".agent-step-detail")!.title = detail;
  row.querySelector<HTMLElement>(".agent-step-time")!.textContent = step.status === "running" ? "running..." : step.error ? "error" : "done";

  renderStatus();
  scrollToBottom();
}

function renderDiffBatch(files: DiffItem[], summary: string): void {
  if (!files.length && !diffBatchEl) {
    return;
  }

  if (!diffBatchEl) {
    diffBatchEl = document.createElement("div");
    diffBatchEl.className = "message assistant fade-in";
    diffBatchEl.innerHTML = `<div class="assistant-avatar">コ</div><div class="assistant-content"><div class="diff-batch-summary"></div><div class="diff-card-list"></div><div class="checkpoint-bar"><span class="checkpoint-line"></span><span class="checkpoint-text">Restore checkpoint</span><button type="button" class="checkpoint-button">↩</button><span class="checkpoint-line"></span></div><div class="diff-batch-status"></div></div>`;
    diffBatchEl.querySelector<HTMLButtonElement>(".checkpoint-button")?.addEventListener("click", () => {
      vscode.postMessage({ type: "reject_all_diffs" });
    });
    messagesEl.append(diffBatchEl);
  }

  diffBatchEl.querySelector<HTMLElement>(".diff-batch-summary")!.textContent = summary;
  const list = diffBatchEl.querySelector<HTMLDivElement>(".diff-card-list")!;
  const status = diffBatchEl.querySelector<HTMLElement>(".diff-batch-status")!;
  const footer = diffBatchEl.querySelector<HTMLElement>(".checkpoint-bar")!;
  list.innerHTML = "";
  status.textContent = "";

  if (!files.length) {
    footer.classList.add("is-hidden");
    status.textContent = summary;
    return;
  }

  footer.classList.remove("is-hidden");
  files.forEach((file) => list.append(renderDiffCard(file)));
  scrollToBottom();
}

function renderDiffCard(file: DiffItem): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "file-card";
  const lines = buildDiffLines(file.action, file.originalContent, file.proposedContent);
  const badgeClass = file.action === "delete" ? "is-delete" : file.action === "create" ? "is-create" : "is-write";
  const badgeLabel = file.action === "delete" ? "Delete" : file.action === "create" ? "Create" : "Write";
  card.innerHTML = `<div class="file-card-header"><span class="file-badge ${badgeClass}">${badgeLabel}</span><code class="file-name">${escapeHtml(file.path)}</code></div><div class="file-card-summary"></div><div class="file-card-label">${file.action === "delete" ? "Removed content:" : "New file content:"}</div><div class="file-code"></div><div class="file-card-actions"><button type="button" class="card-action" data-action="accept">Accept</button><button type="button" class="card-action" data-action="reject">Reject</button></div>`;
  card.querySelector<HTMLElement>(".file-card-summary")!.textContent = file.summary;
  const code = card.querySelector<HTMLDivElement>(".file-code")!;
  lines.forEach((line) => {
    const row = document.createElement("div");
    row.className = `diff-line ${line.type}`;
    row.textContent = line.text;
    code.append(row);
  });
  card.querySelector<HTMLButtonElement>("[data-action='accept']")?.addEventListener("click", () => vscode.postMessage({ type: "accept_diff", fileId: file.id }));
  card.querySelector<HTMLButtonElement>("[data-action='reject']")?.addEventListener("click", () => vscode.postMessage({ type: "reject_diff", fileId: file.id }));
  return card;
}

function createFeed(): StepFeed {
  const row = document.createElement("div");
  row.className = "message assistant fade-in";
  row.innerHTML = `<div class="assistant-avatar">コ</div><div class="assistant-content"><div class="agent-feed"></div></div>`;
  messagesEl.append(row);
  scrollToBottom();
  return { root: row, list: row.querySelector<HTMLDivElement>(".agent-feed")!, rows: new Map<string, HTMLDivElement>() };
}

function appendAssistantBlock(): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "message assistant fade-in";
  row.innerHTML = `<div class="assistant-avatar">コ</div><div class="assistant-content"></div>`;
  messagesEl.append(row);
  scrollToBottom();
  return row.querySelector<HTMLDivElement>(".assistant-content")!;
}

function renderAttachments(): void {
  attachmentRowEl.innerHTML = "";
  if (!attachedFiles.length) {
    attachmentRowEl.classList.add("is-hidden");
    return;
  }

  attachmentRowEl.classList.remove("is-hidden");
  attachedFiles.forEach((file) => {
    const chip = document.createElement("span");
    chip.className = "attachment-chip";
    chip.innerHTML = `<code title="${escapeHtml(file)}">${escapeHtml(shortenMiddle(file, 46))}</code><button type="button" class="attachment-remove" data-remove="${escapeHtml(file)}">×</button>`;
    attachmentRowEl.append(chip);
  });
}

function renderStatus(): void {
  const activeFile = currentContext.activeFile ?? "No active file";
  statusPrimaryEl.textContent = `${activeFile} | ${currentContext.indexedFiles} files indexed | ${currentContext.model}`;

  const running = latestRunningRow();
  if (running) {
    statusSecondaryEl.textContent = `● ${running.label}`;
    statusSecondaryEl.classList.add("is-running");
    agentIndicatorEl.classList.remove("is-hidden");
    agentIndicatorTextEl.textContent = `${running.label} — ${running.verb}`;
    return;
  }

  statusSecondaryEl.classList.remove("is-running");
  statusSecondaryEl.textContent = isStreaming ? `${formatNumber(tokenEstimate)} tokens` : currentContext.provider;
  agentIndicatorEl.classList.add("is-hidden");
}

function latestRunningRow(): { label: string; verb: string } | null {
  if (!currentFeed) {
    return null;
  }

  const rows = Array.from(currentFeed.rows.values());
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].querySelector(".agent-step-icon.is-running")) {
      const tool = rows[index].querySelector<HTMLElement>(".agent-step-tool")?.textContent ?? "Running agent loop";
      return { label: humanizeTool(tool), verb: toolVerb(tool) };
    }
  }

  return null;
}

function populateModels(): void {
  const models = dedupe([currentContext.model, "gpt-4o", "gpt-4o-mini", "o3", "claude-sonnet-4-5", "opus"]);
  modelSelectEl.innerHTML = "";
  models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    option.selected = model === currentContext.model;
    modelSelectEl.append(option);
  });
  toolsSelectEl.value = toolsMode;
}

function updatePrimaryAction(): void {
  if (isStreaming) {
    primaryActionEl.className = "send-button stop-button";
    primaryActionEl.textContent = "■ Stop";
    return;
  }
  primaryActionEl.className = "send-button";
  primaryActionEl.textContent = "Send ↵";
}

function onInputKeydown(event: KeyboardEvent): void {
  if (mentionState) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      mentionState.index = (mentionState.index + 1) % mentionState.options.length;
      renderMentionMenu();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      mentionState.index = (mentionState.index - 1 + mentionState.options.length) % mentionState.options.length;
      renderMentionMenu();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      applyMention(mentionState.options[mentionState.index]);
      return;
    }
    if (event.key === "Escape") {
      hideMentionMenu();
      return;
    }
  }

  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (!isStreaming) {
      sendMessage();
    }
  }
}

function updateMentionMenu(): void {
  const cursor = inputEl.selectionStart ?? inputEl.value.length;
  const prefix = inputEl.value.slice(0, cursor);
  const match = prefix.match(/(?:^|\s)@([A-Za-z0-9._/-]*)$/);
  if (!match) {
    hideMentionMenu();
    return;
  }

  const query = match[1] ?? "";
  const options = currentContext.workspaceFiles.filter((file) => file.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  if (!options.length) {
    hideMentionMenu();
    return;
  }

  mentionState = {
    start: cursor - query.length - 1,
    end: cursor,
    options,
    index: mentionState && mentionState.options.join("|") === options.join("|") ? Math.min(mentionState.index, options.length - 1) : 0
  };
  renderMentionMenu();
}

function renderMentionMenu(): void {
  if (!mentionState) {
    hideMentionMenu();
    return;
  }

  mentionMenuEl.innerHTML = "";
  mentionMenuEl.classList.remove("is-hidden");
  mentionState.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mention-option${index === mentionState?.index ? " is-selected" : ""}`;
    button.innerHTML = `<code>${escapeHtml(shortenMiddle(option, 72))}</code>`;
    button.title = option;
    button.addEventListener("click", () => applyMention(option));
    mentionMenuEl.append(button);
  });
}

function applyMention(option: string): void {
  if (!mentionState) {
    return;
  }
  const before = inputEl.value.slice(0, mentionState.start);
  const after = inputEl.value.slice(mentionState.end);
  inputEl.value = `${before}@${option} ${after}`;
  const cursor = `${before}@${option} `.length;
  inputEl.focus();
  inputEl.setSelectionRange(cursor, cursor);
  autoGrowTextarea();
  hideMentionMenu();
}

function hideMentionMenu(): void {
  mentionState = null;
  mentionMenuEl.classList.add("is-hidden");
  mentionMenuEl.innerHTML = "";
}

function autoGrowTextarea(): void {
  const maxHeight = 18 * 6 + 18;
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, maxHeight)}px`;
}

function insertAtCursor(text: string): void {
  const start = inputEl.selectionStart ?? inputEl.value.length;
  const end = inputEl.selectionEnd ?? start;
  inputEl.value = `${inputEl.value.slice(0, start)}${text}${inputEl.value.slice(end)}`;
  inputEl.focus();
  inputEl.setSelectionRange(start + text.length, start + text.length);
  autoGrowTextarea();
  updateMentionMenu();
}

function stepName(step: AgentStepMsg): string {
  if (step.toolName) {
    return step.toolName === "search_codebase" ? "search_files" : step.toolName;
  }
  if (step.id === "plan") {
    return "build_plan";
  }
  if (step.id === "execute") {
    return "agent_loop";
  }
  return toSnakeCase(step.label || step.id || "agent_step");
}

function stepDetail(step: AgentStepMsg): string {
  const direct = pickString(step.input, ["path", "file", "target", "directory", "root"]);
  if (direct) {
    return direct;
  }
  const query = asString(step.input?.query);
  if (query) {
    return query;
  }
  const outputPath = pathFromOutput(step.output);
  if (outputPath) {
    return outputPath;
  }
  return step.output || humanizeTool(stepName(step));
}

function humanizeTool(tool: string): string {
  switch (tool) {
    case "search_files":
      return "Searching files";
    case "build_plan":
      return "Running edit plan";
    case "agent_loop":
      return "Running agent loop";
    default:
      return `Running ${tool.replace(/_/g, " ")}`;
  }
}

function toolVerb(tool: string): string {
  switch (tool) {
    case "write_file":
      return "writing...";
    case "create_file":
      return "creating...";
    case "delete_file":
      return "deleting...";
    case "read_file":
      return "reading...";
    case "search_files":
      return "searching...";
    case "build_plan":
      return "planning...";
    case "agent_loop":
      return "executing...";
    default:
      return "running...";
  }
}

function pathFromOutput(output: string | undefined): string | null {
  if (!output) {
    return null;
  }
  const match = output.match(/^(?:create|update|delete):(.+)$/i);
  return match ? match[1].trim() : null;
}

function pickString(input: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!input) {
    return null;
  }
  for (const key of keys) {
    const value = asString(input[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.round(value.length / 4));
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toSnakeCase(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "agent_step";
}

function shortenMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  const left = Math.ceil((maxLength - 1) / 2);
  const right = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, left)}…${value.slice(value.length - right)}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function scrollToBottom(): void {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function getEl<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}
