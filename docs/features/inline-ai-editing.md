## 3.1 Inline AI Editing (Ghost Text Engine)

### Overview

The ghost text system provides real-time, multi-line code suggestions rendered as faded "ghost" text directly in the editor. Built on vscode.InlineCompletionItemProvider, it streams tokens from the LLM and progressively renders them as the response arrives.

### Functional Requirements

- Trigger automatically on cursor idle (configurable debounce: default 300ms)
- Trigger on explicit shortcut (default: Alt+\ or Tab in insert mode)
- Accept full suggestion: Tab key
- Accept word-by-word: Ctrl+Right (partial accept)
- Reject suggestion: Escape key
- Cycle through alternatives: Alt+] / Alt+[
- Support all language IDs including plaintext, markdown, YAML, Dockerfile
- Render streaming tokens — append to ghost text without re-rendering full block
- Cancel in-flight completion when user types during streaming
### Context Window for Inline Completions

- Prefix: 60 lines above cursor (trimmed to fit context budget)
- Suffix: 20 lines below cursor (fill-in-the-middle / FIM)
- File path and language ID always injected in system prompt
- Recently visited files added as secondary context (up to 2000 tokens)
- Imported symbols from current file extracted and listed in context
### Technical Implementation

```text
// providers/InlineCompletionProvider.ts
export class KodoInlineProvider
implements vscode.InlineCompletionItemProvider {
```

private debounceTimer: NodeJS.Timeout | null = null;

private activeController: AbortController | null = null;

```text
async provideInlineCompletionItems(
```

document: vscode.TextDocument,

position: vscode.Position,

context: vscode.InlineCompletionContext,

token: vscode.CancellationToken

```text
): Promise<vscode.InlineCompletionList> {
// Cancel prior in-flight request
```

this.activeController?.abort();

this.activeController = new AbortController();

```text
const prompt = this.buildFIMPrompt(document, position);
const items: vscode.InlineCompletionItem[] = [];
// Streamed completion accumulates tokens
let accumulated = "";
for await (const token of streamCompletion(prompt, this.activeController.signal)) {
```

accumulated += token;

```text
// Update ghost text in-place as tokens arrive
}
```

items.push(new vscode.InlineCompletionItem(accumulated));

return new vscode.InlineCompletionList(items);

```text
}
}
```
