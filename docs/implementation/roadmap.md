# 7. DEVELOPMENT ROADMAP

## Phase 1 — MVP: Core Chat + Basic Inline (Weeks 1–3)

GOAL    Working extension on marketplace: chat sidebar + basic inline completions + OpenAI integration

### Week 1: Extension Scaffold & Chat UI

- Scaffold extension with yo code (TypeScript, esbuild, ES2022 target)
- Implement ConfigService: API key (SecretStorage), model selection, endpoint URL
- Build OpenAIClient with basic chat completion (non-streaming)
- Create WebviewViewProvider with minimal HTML chat UI
- Implement postMessage bridge (send/receive messages)
- Register kodo.chat view in package.json contributes
### Week 2: Inline Completions

- Implement InlineCompletionItemProvider (registered for all files)
- Build PromptBuilder v1: prefix/suffix FIM format
- Add debounce (300ms) to prevent excessive API calls
- Implement CompletionCache (LRU, 100 entries) for prefix dedup
- Register CodeActionProvider for /fix and /explain on selection
### Week 3: Command Registration & Basic Polish

- Register all Command Palette commands in package.json
- Implement OllamaClient with OpenAI-compat adapter
- Add Output Channel logging with log levels
- Write unit tests for PromptBuilder and ConfigService
- Package VSIX and validate on VS Code 1.85+ stable
### Phase 1 Deliverables & Acceptance Criteria

- Chat panel opens in sidebar and sends/receives messages
- Inline ghost text appears within 2s on idle cursor
- API key configuration via settings UI works
- Ollama local mode works with llama3.1 model
- Zero crash extension tests pass
## Phase 2 — Streaming System (Weeks 4–5)

GOAL    Token-by-token streaming in both chat panel and inline completions. Cancel/retry support.

- Implement StreamingClient with SSE reader and AbortController
- Add TokenBuffer for smooth 32-token batch rendering
- Update ChatViewProvider to handle stream_token / stream_done messages
- Update webview to progressively render tokens (DOM append, not full re-render)
- Add Stop button in chat UI with cancellation propagation
- Implement Retry: store last request, regenerate on user request
- Stream inline completions: accumulate tokens, update InlineCompletionItem progressively
- Add timeout handling: 30s TTFT timeout, 5s between-token timeout
- Integration tests for streaming with mock SSE server
## Phase 3 — Context & Codebase Engine (Weeks 6–9)

GOAL    Full codebase indexing, semantic search, and context-aware completions and chat.

- Integrate tree-sitter WASM: grammars for TS, JS, Python, Go, Rust, Java
- Build ChunkingEngine with AST-based function/class boundary detection
- Implement FileWalker with .gitignore parsing (ignore library)
- Build EmbeddingService with batch processing and retry
- Implement VectorStore: in-memory HNSW for <10K files; SQLite-vss for larger
- Build RetrievalEngine: cosine similarity + BM25 hybrid, recency + open-file boosts
- Integrate CodebaseIndexer into activate(): background indexing with progress notification
- Add @file and #symbol mention parsing in chat input
- Implement incremental re-indexing on onDidChangeTextDocument
- Update PromptBuilder to inject retrieved chunks into context
- Add "Indexing..." status bar item with progress
- Benchmark: index 50K-file repo in <5 minutes on M2 MacBook Pro
## Phase 4 — Multi-File Editing Agent (Weeks 10–14)

GOAL    Full agentic workflow: plan → tool execution → diff preview → apply/reject

- Implement ToolRegistry with all 8 agent tools
- Build AgentRunner: ReAct loop with max 10 iterations, timeout 120s
- Implement PlanParser: extract JSON plan from LLM response
- Build DiffController: compute diffs, stage as WorkspaceEdit, show preview
- Implement vscode.diff integration for per-file diff preview
- Add agent progress panel in webview: step list with status icons
- Implement Accept All / Review Each / Reject All UI
- Add RunTerminalTool with mandatory user approval gate
- Build agent conversation memory: multi-turn correction support
- Integration tests: generate feature, refactor project, add tests end-to-end
## Phase 5 — Optimization & Production Hardening (Weeks 15–20)

GOAL    Ship-quality: performance, stability, telemetry, marketplace listing.

- Profile and optimize: target <200ms TTFT for inline on cached prompts
- Add RequestDeduplicator: coalesce identical in-flight requests
- Implement EmbeddingCache: persist to disk, invalidate on file change
- Add graceful degradation for large repos: partial indexing + priority queue
- Implement LRU memory management: cap extension heap at 512MB
- Add telemetry (opt-in): completion acceptance rate, p50/p95 latency
- Full E2E test suite on 3 sample repos (small/medium/large)
- Security audit: API key handling, webview CSP, no secret logging
- Marketplace listing: README, demo GIF, badges
- Write CHANGELOG.md and v1.0.0 release notes
