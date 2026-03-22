# 6. PRODUCTION FOLDER STRUCTURE

kodo/                         # Extension root

```text
├── .vscode/
│   ├── launch.json                 # Debug configs (Extension + Extension Tests)
│   └── tasks.json                  # Build tasks (esbuild, tsc)
├── src/
│   ├── extension.ts                # activate() / deactivate() entry point
│   │
│   ├── providers/                  # VS Code API provider implementations
│   │   ├── InlineCompletionProvider.ts  # Ghost text / InlineCompletionItemProvider
│   │   ├── CodeActionProvider.ts        # Right-click AI actions
│   │   ├── HoverProvider.ts             # AI symbol explanations on hover
│   │   ├── ChatViewProvider.ts          # WebviewViewProvider for sidebar chat
│   │   └── DiagnosticProvider.ts        # AI-assisted error diagnostics
│   │
│   ├── controllers/                # Orchestration / business logic
│   │   ├── ChatController.ts            # Manages chat session, context, history
│   │   ├── AgentController.ts           # Multi-file agent Plan→Execute loop
│   │   ├── InlineController.ts          # Debounce, cancellation, completion mgmt
│   │   └── DiffController.ts            # Stage, display, apply/reject diffs
│   │
│   ├── services/                   # Pure service layer (no VS Code API deps)
│   │   ├── llm/
│   │   │   ├── LLMClient.ts             # Interface definition
│   │   │   ├── OpenAIClient.ts          # OpenAI + Azure OpenAI impl
│   │   │   ├── AnthropicClient.ts       # Claude API impl
│   │   │   ├── OllamaClient.ts          # Ollama local API impl
│   │   │   ├── LMStudioClient.ts        # LM Studio OpenAI-compat impl
│   │   │   └── LLMClientFactory.ts      # Creates client from config
│   │   │
│   │   ├── streaming/
│   │   │   ├── StreamingClient.ts       # SSE reader + AbortController
│   │   │   ├── TokenBuffer.ts           # Batching for smooth rendering
│   │   │   └── StreamEventEmitter.ts    # Events: token, done, error
│   │   │
│   │   ├── indexer/
│   │   │   ├── CodebaseIndexer.ts       # Orchestrates indexing pipeline
│   │   │   ├── FileWalker.ts            # .gitignore-aware file discovery
│   │   │   ├── ChunkingEngine.ts        # Tree-sitter semantic chunking
│   │   │   ├── EmbeddingService.ts      # Batch embedding with retry
│   │   │   ├── VectorStore.ts           # SQLite-vss / in-memory HNSW
│   │   │   └── RetrievalEngine.ts       # Hybrid BM25 + cosine retrieval
│   │   │
│   │   ├── agent/
│   │   │   ├── AgentRunner.ts           # ReAct loop executor
│   │   │   ├── ToolRegistry.ts          # Register + dispatch agent tools
│   │   │   ├── tools/
│   │   │   │   ├── ReadFileTool.ts
│   │   │   │   ├── WriteFileTool.ts
│   │   │   │   ├── CreateFileTool.ts
│   │   │   │   ├── DeleteFileTool.ts
│   │   │   │   ├── SearchCodebaseTool.ts
│   │   │   │   ├── ListDirectoryTool.ts
│   │   │   │   └── RunTerminalTool.ts
│   │   │   └── PlanParser.ts            # Parse LLM plan JSON → step list
│   │   │
│   │   └── cache/
│   │       ├── CompletionCache.ts       # LRU cache for inline completions
│   │       ├── EmbeddingCache.ts        # Persistent embedding cache
│   │       └── RequestDeduplicator.ts   # Prevent duplicate in-flight requests
│   │
│   ├── utils/
│   │   ├── PromptBuilder.ts             # Layered prompt assembly
│   │   ├── TokenCounter.ts              # tiktoken wrapper
│   │   ├── ContextTrimmer.ts            # Budget enforcement + trimming
│   │   ├── FileUtils.ts                 # Path helpers, MIME detection
│   │   ├── LanguageUtils.ts             # Language ID → parser mapping
│   │   ├── Debounce.ts                  # Typed debounce/throttle utilities
│   │   ├── Logger.ts                    # Structured logging → Output Channel
│   │   └── ErrorHandler.ts              # Centralized error classification
│   │
│   ├── config/
│   │   ├── ConfigService.ts             # Reads vscode.workspace.getConfiguration
│   │   ├── defaults.ts                  # Default config values
│   │   └── schema.ts                    # Config schema types
│   │
│   └── types/
│       ├── llm.ts                       # CompletionRequest, ChatMessage, etc.
│       ├── agent.ts                     # AgentStep, ToolCall, AgentPlan
│       ├── context.ts                   # ContextChunk, RetrievalResult
│       └── messages.ts                  # Webview message protocol types
│
├── webview/                        # Chat panel UI (compiled separately)
│   ├── src/
│   │   ├── App.svelte (or App.tsx)      # Root component
│   │   ├── components/
│   │   │   ├── ChatMessage.svelte        # Message bubble
│   │   │   ├── CodeBlock.svelte          # Syntax-highlighted code
│   │   │   ├── StreamingDots.svelte      # Typing indicator
│   │   │   ├── ContextBadge.svelte       # Shows active file + selection
│   │   │   ├── DiffViewer.svelte         # File diff display
│   │   │   └── AgentProgress.svelte      # Step-by-step agent status
│   │   ├── stores/                       # Svelte stores (state)
│   │   │   ├── messages.ts
│   │   │   └── agentState.ts
│   │   └── bridge.ts                     # acquireVsCodeApi() wrapper
│   └── dist/                        # Compiled webview output
│
├── tests/
│   ├── unit/
│   │   ├── PromptBuilder.test.ts
│   │   ├── ChunkingEngine.test.ts
│   │   ├── RetrievalEngine.test.ts
│   │   └── TokenCounter.test.ts
│   ├── integration/
│   │   ├── InlineCompletion.test.ts
│   │   ├── AgentRunner.test.ts
│   │   └── ChatController.test.ts
│   └── fixtures/                    # Test repo snapshots
│
├── media/                           # Icons, images for marketplace
├── package.json                     # Extension manifest (contributes, activationEvents)
├── tsconfig.json
├── esbuild.config.js                # Bundle for extension host + webview
├── .vscodeignore                    # Exclude from VSIX package
└── CHANGELOG.md
```
