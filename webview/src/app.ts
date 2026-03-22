declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

type ExtToWebMsg =
  | { type: "stream_start"; messageId: string; role: "assistant" }
  | { type: "stream_token"; messageId: string; token: string }
  | { type: "stream_done"; messageId: string }
  | { type: "stream_error"; messageId: string; error: string }
  | { type: "agent_step"; step: { id: string; label: string; status: string; output?: string } }
  | { type: "diff_ready"; files: Array<{ id: string; path: string; action: string; summary: string }>; summary: string }
  | { type: "context_info"; context: { activeFile: string | null; indexedFiles: number; indexedChunks: number; attachedFiles: string[] } }
  | { type: "chat_reset" };

const vscode = acquireVsCodeApi();
const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing app root");
}

root.innerHTML = `
  <div class="layout">
    <header class="toolbar">
      <div>
        <h1>Kodo</h1>
        <p id="context-badge">Workspace context unavailable</p>
      </div>
      <div class="toolbar-actions">
        <button id="new-chat" type="button">New Chat</button>
        <button id="export-chat" type="button">Export</button>
        <button id="stop-stream" type="button">Stop</button>
      </div>
    </header>
    <main class="panel">
      <section id="messages" class="messages"></section>
      <aside class="sidebar">
        <section>
          <h2>Agent</h2>
          <ol id="agent-steps" class="agent-steps"></ol>
        </section>
        <section>
          <h2>Diffs</h2>
          <div id="diff-summary" class="diff-summary">No staged diffs</div>
          <div class="diff-actions">
            <button id="accept-all" type="button">Accept All</button>
            <button id="reject-all" type="button">Reject All</button>
          </div>
          <ul id="diff-list" class="diff-list"></ul>
        </section>
      </aside>
    </main>
    <footer class="composer">
      <textarea id="input" rows="5" placeholder="Ask Kodo or use /agent, /fix, /explain, /refactor, /test, /docs"></textarea>
      <button id="send" type="button">Send</button>
    </footer>
  </div>
`;

const messagesEl = getEl("messages");
const agentStepsEl = getEl("agent-steps");
const diffListEl = getEl("diff-list");
const diffSummaryEl = getEl("diff-summary");
const contextBadgeEl = getEl("context-badge");
const inputEl = document.querySelector<HTMLTextAreaElement>("#input");

if (!inputEl) {
  throw new Error("Missing input");
}
const composerInput = inputEl;

const messageNodes = new Map<string, HTMLDivElement>();

document.querySelector("#send")?.addEventListener("click", () => sendMessage());
document.querySelector("#new-chat")?.addEventListener("click", () => vscode.postMessage({ type: "new_chat" }));
document.querySelector("#export-chat")?.addEventListener("click", () => vscode.postMessage({ type: "export_chat" }));
document.querySelector("#stop-stream")?.addEventListener("click", () => vscode.postMessage({ type: "cancel_stream" }));
document.querySelector("#accept-all")?.addEventListener("click", () => vscode.postMessage({ type: "accept_all_diffs" }));
document.querySelector("#reject-all")?.addEventListener("click", () => vscode.postMessage({ type: "reject_all_diffs" }));

inputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

window.addEventListener("message", (event) => {
  const message = event.data as ExtToWebMsg;
  handleMessage(message);
});

function sendMessage(): void {
  const content = composerInput.value.trim();
  if (!content) {
    return;
  }
  renderStaticMessage("user", content);
  vscode.postMessage({ type: "send_message", content, attachments: [] });
  composerInput.value = "";
}

function handleMessage(message: ExtToWebMsg): void {
  switch (message.type) {
    case "stream_start":
      createStreamingMessage(message.messageId, message.role);
      break;
    case "stream_token":
      appendStreamingToken(message.messageId, message.token);
      break;
    case "stream_done":
      finalizeStreamingMessage(message.messageId);
      break;
    case "stream_error":
      appendStreamingToken(message.messageId, `\n\nError: ${message.error}`);
      finalizeStreamingMessage(message.messageId);
      break;
    case "agent_step":
      renderAgentStep(message.step);
      break;
    case "diff_ready":
      renderDiffs(message.files, message.summary);
      break;
    case "context_info":
      contextBadgeEl.textContent = [
        message.context.activeFile ? `Active: ${message.context.activeFile}` : "No active file",
        `Indexed: ${message.context.indexedFiles} files / ${message.context.indexedChunks} chunks`,
        message.context.attachedFiles.length ? `Attached: ${message.context.attachedFiles.join(", ")}` : ""
      ].filter(Boolean).join(" | ");
      break;
    case "chat_reset":
      messagesEl.innerHTML = "";
      messageNodes.clear();
      break;
  }
}

function createStreamingMessage(id: string, role: string): void {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;
  wrapper.dataset.messageId = id;
  const body = document.createElement("div");
  body.className = "bubble";
  body.dataset.raw = "";
  wrapper.append(body);
  messagesEl.append(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  messageNodes.set(id, body);
}

function appendStreamingToken(id: string, token: string): void {
  const body = messageNodes.get(id);
  if (!body) {
    return;
  }
  body.dataset.raw = `${body.dataset.raw ?? ""}${token}`;
  body.textContent = body.dataset.raw;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function finalizeStreamingMessage(id: string): void {
  const body = messageNodes.get(id);
  if (!body) {
    return;
  }
  const raw = body.dataset.raw ?? body.textContent ?? "";
  body.innerHTML = "";
  renderRichContent(body, raw);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderStaticMessage(role: "user" | "assistant", content: string): void {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;
  const body = document.createElement("div");
  body.className = "bubble";
  renderRichContent(body, content);
  wrapper.append(body);
  messagesEl.append(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderRichContent(container: HTMLElement, content: string): void {
  const regex = /```([a-z0-9_-]*)\n([\s\S]*?)```/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content))) {
    if (match.index > cursor) {
      renderParagraphs(container, content.slice(cursor, match.index));
    }

    const wrapper = document.createElement("div");
    wrapper.className = "code-wrapper";

    const toolbar = document.createElement("div");
    toolbar.className = "code-toolbar";
    toolbar.innerHTML = `<span>${match[1] || "code"}</span>`;

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => navigator.clipboard.writeText(match?.[2] ?? ""));

    const insertBtn = document.createElement("button");
    insertBtn.type = "button";
    insertBtn.textContent = "Insert";
    insertBtn.addEventListener("click", () => vscode.postMessage({ type: "insert_code", code: match?.[2] ?? "", lang: match?.[1] ?? "text" }));

    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => vscode.postMessage({ type: "apply_code", code: match?.[2] ?? "", lang: match?.[1] ?? "text" }));

    toolbar.append(copyBtn, insertBtn, applyBtn);
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = match[2];
    pre.append(code);
    wrapper.append(toolbar, pre);
    container.append(wrapper);
    cursor = regex.lastIndex;
  }

  if (cursor < content.length) {
    renderParagraphs(container, content.slice(cursor));
  }
}

function renderParagraphs(container: HTMLElement, value: string): void {
  value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const p = document.createElement("p");
      p.textContent = part;
      container.append(p);
    });
}

function renderAgentStep(step: { id: string; label: string; status: string; output?: string }): void {
  let item = agentStepsEl.querySelector<HTMLLIElement>(`li[data-step="${step.id}"]`);
  if (!item) {
    item = document.createElement("li");
    item.dataset.step = step.id;
    agentStepsEl.append(item);
  }
  item.textContent = `${statusSymbol(step.status)} ${step.label}${step.output ? ` - ${step.output}` : ""}`;
}

function renderDiffs(files: Array<{ id: string; path: string; action: string; summary: string }>, summary: string): void {
  diffSummaryEl.textContent = summary;
  diffListEl.innerHTML = "";

  for (const file of files) {
    const item = document.createElement("li");
    item.className = "diff-item";

    const meta = document.createElement("div");
    meta.innerHTML = `<strong>${file.path}</strong><span>${file.action}</span><p>${file.summary}</p>`;

    const actions = document.createElement("div");
    actions.className = "diff-actions";

    const accept = document.createElement("button");
    accept.type = "button";
    accept.textContent = "Accept";
    accept.addEventListener("click", () => vscode.postMessage({ type: "accept_diff", fileId: file.id }));

    const reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "Reject";
    reject.addEventListener("click", () => vscode.postMessage({ type: "reject_diff", fileId: file.id }));

    actions.append(accept, reject);
    item.append(meta, actions);
    diffListEl.append(item);
  }
}

function statusSymbol(status: string): string {
  switch (status) {
    case "done":
      return "✅";
    case "error":
      return "✖";
    case "running":
      return "…";
    default:
      return "⬜";
  }
}

function getEl(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element;
}
