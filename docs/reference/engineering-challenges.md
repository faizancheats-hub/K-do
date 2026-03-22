# 8. ENGINEERING CHALLENGES — BRUTALLY REALISTIC

## 8.1 InlineCompletionItemProvider Streaming Limitation

SEVERITY    HIGH — This is the most painful VS Code API constraint

VS Code's InlineCompletionItemProvider is not designed for streaming. The API expects you to return a complete InlineCompletionList synchronously (or via a single Promise resolution). There is no callback to progressively update ghost text.

### Workaround Strategy

- Use a short-timeout approach: return a fast partial completion (first ~20 tokens) immediately, then trigger a re-request for the full completion
- Use VS Code's experimental streaming API if available (v1.90+ has partial support)
- Fallback: display completions as CodeLens or peek-style notifications for multi-line completions
- Monitor vscode.dev/api roadmap — streaming InlineCompletion is a tracked issue
## 8.2 Context Explosion & Token Budget Overflow

Large monorepos can generate 10M+ tokens of embedding context. Even with retrieval, relevant context for complex cross-cutting concerns can easily exceed 128K token limits.

### Mitigations

- Hard cap retrieved context at 8K tokens regardless of model limit
- Summarize files instead of including full content for non-critical context
- Ask model to request specific files via tool calls rather than pre-loading everything
- Implement re-ranking: use a small fast model (gpt-4o-mini) to re-rank chunks before including
## 8.3 Latency in Inline Completions

Cursor achieves <100ms TTFT because they control the editor and can pre-fetch speculatively. Extensions cannot intercept keystrokes before VS Code processes them. Minimum overhead is ~50ms per VS Code API round trip.

### Mitigations

- Speculative prefetching: start LLM request 200ms before debounce fires on fast typists
- Cache last 100 completions by (file, line prefix) hash
- Use smaller/faster models for inline (gpt-4o-mini vs gpt-4o for chat)
- Local model (Ollama) eliminates network latency — important selling point
- Accept realistic TTFT: 300–800ms for cloud, 200–500ms for local
## 8.4 VS Code Webview Isolation

Webviews run in a sandboxed iframe with no access to the DOM of the editor, no access to Node.js APIs directly, and all communication must go through the postMessage bridge which has no type safety by default.

### Mitigations

- Define strongly-typed message protocol (shared types in types/messages.ts)
- Use Zod for runtime validation of postMessage payloads
- Keep webview thin: push business logic to extension host where possible
## 8.5 Multi-File Edit Correctness

LLMs frequently produce malformed edits: wrong line numbers, incorrect indentation, partial function bodies, or edits that break downstream files not included in context.

### Mitigations

- Always show diff preview — never silently apply LLM edits
- Post-edit syntax validation using VS Code diagnostics API before presenting to user
- Include file dependency graph in agent context so changes to one file surface downstream impacts
- Implement undo group: wrap all agent edits in a named undo transaction
## 8.6 Extension Host Memory Constraints

The Extension Host is a single Node.js process shared across all extensions. Memory-hungry operations (embedding all files, HNSW index) can cause VS Code slowdown for all extensions.

### Mitigations

- Cap in-memory HNSW index at 50K vectors; evict LRU chunks
- Use streaming file reading — never load entire large files into memory at once
- Offload heavy computation (embedding batch jobs) to Worker threads via worker_threads
- Add memory pressure monitoring: pause indexing if heapUsed > 400MB
- Optional: proxy backend server to offload indexing entirely from extension host
## 8.7 Tree-sitter WASM in Extension Host

Tree-sitter grammars must be loaded as WASM files in the extension host. This has a cold-start cost (~200ms per grammar) and WASM memory cannot be easily garbage collected.

### Mitigations

- Lazy-load grammars on first file of each language type
- Keep grammar cache for session lifetime — only load once per language
- Pre-bundle the 10 most common language grammars; lazy fetch others from CDN
