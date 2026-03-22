export type DiffPreviewLine = {
  type: "add" | "remove" | "context";
  text: string;
};

type MarkdownBlock =
  | { type: "paragraph"; content: string }
  | { type: "ordered"; items: string[] }
  | { type: "unordered"; items: string[] }
  | { type: "code"; info: string; content: string };

export function renderMarkdownInto(container: HTMLElement, content: string): void {
  container.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const blocks = parseBlocks(content);

  for (const block of blocks) {
    if (block.type === "code") {
      fragment.append(renderCodeBlock(block.info, block.content));
      continue;
    }

    if (block.type === "ordered") {
      const list = document.createElement("ol");
      list.className = "markdown-list";
      block.items.forEach((item) => {
        const li = document.createElement("li");
        li.innerHTML = renderInlineMarkdown(item);
        list.append(li);
      });
      fragment.append(list);
      continue;
    }

    if (block.type === "unordered") {
      const list = document.createElement("ul");
      list.className = "markdown-list";
      block.items.forEach((item) => {
        const li = document.createElement("li");
        li.innerHTML = renderInlineMarkdown(item);
        list.append(li);
      });
      fragment.append(list);
      continue;
    }

    const paragraph = document.createElement("p");
    paragraph.className = "markdown-paragraph";
    paragraph.innerHTML = renderInlineMarkdown(block.content);
    fragment.append(paragraph);
  }

  container.append(fragment);
}

export function buildDiffLines(
  action: string,
  originalContent: string,
  proposedContent: string
): DiffPreviewLine[] {
  if (action === "create") {
    return splitLines(proposedContent).slice(0, 160).map((line) => ({ type: "add", text: `+ ${line}` }));
  }

  if (action === "delete") {
    return splitLines(originalContent).slice(0, 160).map((line) => ({ type: "remove", text: `- ${line}` }));
  }

  const before = splitLines(originalContent);
  const after = splitLines(proposedContent);
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) {
    start += 1;
  }

  let beforeEnd = before.length - 1;
  let afterEnd = after.length - 1;
  while (beforeEnd >= start && afterEnd >= start && before[beforeEnd] === after[afterEnd]) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }

  const lines: DiffPreviewLine[] = [];
  before.slice(start, beforeEnd + 1).forEach((line) => lines.push({ type: "remove", text: `- ${line}` }));
  after.slice(start, afterEnd + 1).forEach((line) => lines.push({ type: "add", text: `+ ${line}` }));

  if (!lines.length) {
    lines.push({ type: "context", text: "  No textual changes detected" });
  }

  return lines.slice(0, 180);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function splitLines(value: string): string[] {
  if (!value) {
    return [];
  }
  return value.replace(/\r/g, "").split("\n");
}

function renderCodeBlock(info: string, content: string): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "code-block";

  if (info) {
    const header = document.createElement("div");
    header.className = "code-block-header";
    header.textContent = info;
    wrapper.append(header);
  }

  const pre = document.createElement("pre");
  pre.className = "code-block-body";
  const code = document.createElement("code");
  code.textContent = content;
  pre.append(code);
  wrapper.append(pre);
  return wrapper;
}

function parseBlocks(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = content.replace(/\r/g, "").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const info = line.slice(3).trim();
      index += 1;
      const body: string[] = [];
      while (index < lines.length && !lines[index].startsWith("```")) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", info, content: body.join("\n") });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ordered", items });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "unordered", items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith("```") &&
      !/^\d+\.\s+/.test(lines[index]) &&
      !/^[-*]\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: "paragraph", content: paragraph.join(" ") });
  }

  return blocks;
}

function renderInlineMarkdown(content: string): string {
  return escapeHtml(content)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
