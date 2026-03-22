Kōdo  —  VS Code AI Extension

Product Requirements Document

Production-Level Architecture & Engineering Specification  |  Kōdo for VS Code

“The way of clean code.”

| Version | 1.0.0 — Initial PRD |
| --- | --- |
| Status | Production Specification |
| Document Type | Full System Architecture PRD |
| Audience | Engineering, Architecture, Product |
| Date | March 2026 |

# 1. EXECUTIVE SUMMARY

This document defines the complete product requirements, system architecture, and engineering build plan for a production-grade AI-powered coding assistant delivered as a VS Code Extension. The product — internally codenamed Kōdo — aims to deliver an experience comparable to Cursor IDE without forking the VS Code codebase.

Kōdo (Japanese: コード = code, 道 = the way / path) is built on a single philosophy: AI assistance should feel like a natural extension of the developer craft — precise, minimal, and deeply context-aware.

The extension operates entirely through official VS Code Extension APIs, making it distributable via the VS Code Marketplace. It integrates with OpenAI-compatible APIs and local LLM runtimes (Ollama, LM Studio) to deliver real-time code generation, intelligent refactoring, context-aware chat, and autonomous multi-file editing.

### Strategic Goals

- Match 90% of Cursor's core UX within the extension model constraints
- Zero dependency on VS Code forks — pure Extension API surface
- Support both cloud (OpenAI/Anthropic) and offline-first (Ollama) LLM backends
- Achieve sub-200ms TTFT (Time To First Token) for inline completions
- Support repositories up to 500K lines of code via smart chunking and embedding
- Ship MVP in 8 weeks; full v1.0 in 20 weeks
⚠  CRITICAL CONSTRAINT    VS Code Extension APIs do NOT allow direct DOM manipulation of the editor surface. Ghost text, inline edits, and decorations must use InlineCompletionItemProvider, DecorationTypes, and CodeActionProvider — never direct DOM injection.

# 2. PRODUCT OVERVIEW

## 2.1 Problem Statement

Cursor delivers a transformative AI coding experience but requires developers to abandon VS Code — losing their extensions, keybindings, and muscle memory. Copilot is limited to single-line suggestions with no agentic capability. There is no solution that combines:

- Full agentic multi-file editing inside standard VS Code
- Streaming, context-aware chat with codebase understanding
- Local LLM support for air-gapped and privacy-conscious environments
- Open architecture for custom LLM providers
## 2.2 Target Users

| Persona | Pain Point | Value Delivered |
| --- | --- | --- |
| Senior Engineers | Repetitive boilerplate, documentation gaps | Inline generation, multi-file refactor, agent workflows |
| Mid-level Devs | Unfamiliar codebases, architectural decisions | Codebase Q&A, architecture explain, contextual chat |
| DevOps / SREs | Config generation, IaC authoring | YAML/Terraform generation with repo context |
| Enterprise Teams | Data privacy, no cloud LLM allowed | Local Ollama integration, air-gapped mode |

## 2.3 Key Differentiators vs. Copilot & Cursor

| Feature | Kōdo | Copilot | Cursor |
| --- | --- | --- | --- |
| Ghost Text / Inline | Yes | Yes | Yes |
| Multi-file Agent Editing | Yes | No | Yes |
| Codebase Embeddings | Yes | Partial | Yes |
| Local LLM Support | Yes | No | No |
| Streaming Token-by-Token | Yes | Yes | Yes |
| No VS Code Fork Required | Yes | Yes | No |
| Diff Preview Before Apply | Yes | No | Yes |

# 3. CORE FEATURES — DEEP SPECIFICATION

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

## 3.2 AI Chat Panel

### Overview

A full-featured sidebar chat panel built as a VS Code WebviewViewProvider. The panel supports conversational AI interactions with full awareness of the active file, selected text, open editors, and indexed codebase.

### UI Components

- Message thread with user/assistant bubbles and timestamps
- Streaming message rendering — tokens appear word-by-word
- Code blocks with syntax highlighting (Prism.js in webview)
- Copy-to-clipboard, Apply-to-Editor, Insert-at-Cursor action buttons per code block
- Context badge showing: active file, selected lines, attached files
- Conversation history (persistent per workspace via ExtensionContext.workspaceState)
- New chat / clear / export to markdown buttons
- @-mention syntax for referencing files: @src/utils/parser.ts
- #-mention for symbols: #UserAuthService
### Built-in Slash Commands

| Command | Trigger | Behavior |
| --- | --- | --- |
| /fix | Selected code or active file | Detects errors/issues and returns corrected version with explanation |
| /optimize | Selected code | Rewrites for performance with Big-O analysis of before/after |
| /explain | Selected code | Step-by-step plain-English explanation with complexity notes |
| /refactor | File or selection | Suggests structural improvements, extracts functions, applies patterns |
| /test | Function or class | Generates unit tests in the project's existing test framework |
| /docs | File or selection | Generates JSDoc/docstring/TSDoc based on detected language |
| /ask | Free-form | General codebase question with full context retrieval |
| /agent | Natural language task | Activates multi-file editing agent pipeline (Plan → Execute → Diff) |

## 3.3 Codebase Awareness & Context Engine

### Architecture Overview

The context engine is the most critical differentiator. It transforms raw file I/O into a semantic graph that the LLM can query efficiently. The engine runs as a background service activated on workspace open.

### Indexing Pipeline

- File Discovery: Walk workspace using vscode.workspace.findFiles with .gitignore-aware filtering
- Language Detection: Map file extensions to language IDs
- Chunking: Split files into semantic chunks (function/class boundaries via Tree-sitter)
- Embedding Generation: Send chunks to embedding API (text-embedding-3-small or local)
- Vector Storage: Store embeddings in SQLite with sqlite-vss or in-memory HNSW index
- Incremental Updates: Watch files via vscode.workspace.onDidChangeTextDocument for live re-indexing
### Retrieval Strategy

- Cosine similarity search against current prompt embedding
- Keyword BM25 fallback for exact symbol/identifier search
- Recency boost: recently modified files get +0.15 score bonus
- Open editor boost: currently open tabs get +0.25 score bonus
- Dependency graph traversal: imports of current file are always included
- Final context budget: top-K chunks ranked by composite score, trimmed to 8K tokens
### Supported Index Sizes

- Small repos (<10K files): full in-memory HNSW, instant retrieval
- Medium repos (10K–100K files): SQLite-vss with LRU cache, <50ms retrieval
- Large repos (>100K files): chunked indexing with priority queue, background rebuild
## 3.4 Multi-File Editing Agent

### Agent Architecture

The agent uses a Plan → Tool Call Loop → Apply pattern. It is a ReAct-style agent with access to file system tools. All edits are staged as diffs before being applied to the workspace.

### Agent Tools / Capabilities

| Tool Name | API Used | Description |
| --- | --- | --- |
| read_file | vscode.workspace.openTextDocument | Read full content of any workspace file by path |
| write_file | vscode.workspace.applyEdit | Write/overwrite file content via WorkspaceEdit |
| create_file | vscode.workspace.applyEdit | Create new file at given path with content |
| delete_file | vscode.workspace.applyEdit | Delete file with user confirmation prompt |
| search_codebase | Context Engine (embedding) | Semantic search returning top-5 relevant file chunks |
| list_directory | vscode.workspace.findFiles | List files matching a glob pattern |
| run_terminal | vscode.window.createTerminal | Execute shell commands (with explicit user approval gate) |
| show_diff | vscode.diff (DiffEditorCommand) | Show side-by-side diff of proposed vs current file |

### Agent Execution Flow

User: "Add rate limiting middleware to all Express routes"

1. PLAN (LLM generates JSON plan)

```text
{ "steps": [
"Search codebase for Express router definitions",
"Identify all route files",
"Create middleware/rateLimiter.ts",
"Inject middleware import + use() into each route file"
]}
```

2. EXECUTE (tool call loop)

→ search_codebase("express router") → [routes/api.ts, routes/auth.ts]

→ read_file("routes/api.ts") → content

→ create_file("middleware/rateLimiter.ts") → writes file

→ write_file("routes/api.ts") → patches import + app.use()

3. STAGE & REVIEW

→ show_diff for each modified file

→ User sees: [Accept All] [Review Each] [Reject All]

4. APPLY

→ vscode.workspace.applyEdit(workspaceEdit)

## 3.5 Streaming System

### Token Streaming Architecture

All LLM responses stream token-by-token using Server-Sent Events (SSE) from OpenAI-compatible APIs, or chunked Transfer-Encoding for Ollama. The extension maintains a ReadableStream pipeline from API → Extension Host → Webview.

### Stream Pipeline

LLM API (SSE/chunked HTTP)

```text
↓
```

services/StreamingClient.ts

```text
├── AbortController (cancellation)
├── TokenBuffer (32-token batch window)
└── AsyncIterator<string>
↓
```

Extension Host (Node.js)

```text
├── InlineCompletionProvider — accumulates to ghost text
└── ChatController — posts tokens to Webview
↓
```

Webview (postMessage bridge)

```text
├── type: "stream_token" → append to DOM
├── type: "stream_done"  → finalize & enable actions
└── type: "stream_error" → show retry UI
```

### Stream Control Requirements

- Cancel: User presses Escape or clicks Stop button — AbortController.abort() propagated
- Retry: Last request stored in memory, regenerate button replays with same context
- Pause/Resume: Not supported (stateless HTTP streams) — cancel + retry instead
- Error handling: Network timeout after 30s TTFT, 5s between-token timeout
- Backpressure: Buffer up to 512 tokens if webview renders slowly
# 4. TECHNICAL ARCHITECTURE

## 4.1 Extension Activation & Lifecycle

```text
// extension.ts — Main entry point
export async function activate(ctx: vscode.ExtensionContext) {
// 1. Bootstrap services (order-sensitive)
const config     = new ConfigService(ctx);
const llmClient  = LLMClientFactory.create(config);
const indexer    = new CodebaseIndexer(ctx, config);
const chatCtrl   = new ChatController(ctx, llmClient, indexer);
const agentCtrl  = new AgentController(ctx, llmClient, indexer);
// 2. Register providers
```

ctx.subscriptions.push(

vscode.languages.registerInlineCompletionItemProvider(

```text
{ pattern: "**" }, // all files
```

new KodoInlineProvider(llmClient, indexer)

),

vscode.languages.registerCodeActionsProvider(

```text
{ pattern: "**" },
```

new AICodeActionProvider(chatCtrl)

),

vscode.window.registerWebviewViewProvider(

```text
"kodo.chat",
```

new ChatViewProvider(ctx, chatCtrl)

),

);

```text
// 3. Register commands
```

registerCommands(ctx, chatCtrl, agentCtrl, indexer);

```text
// 4. Start background indexing (non-blocking)
```

indexer.startBackgroundIndex();

```text
}
```

## 4.2 VS Code API Surface — Complete Mapping

| VS Code API | Used For | Implementation Notes |
| --- | --- | --- |
| InlineCompletionItemProvider | Ghost text suggestions | Registered for pattern "**". Returns InlineCompletionList with streamed content |
| CodeActionProvider | Right-click AI actions | Provides QuickFix and Refactor code actions on selection |
| WebviewViewProvider | Chat sidebar panel | SvelteKit or vanilla TS webview. postMessage bridge for streaming |
| workspace.applyEdit | Multi-file edits | WorkspaceEdit object batch-applied atomically. Supports undo |
| workspace.openTextDocument | File reading | Agent reads file content; cached per session |
| workspace.findFiles | Repo file listing | Glob-based with .gitignore respected via GlobPattern |
| window.createTextEditorDecorationType | AI-edited line highlights | Green highlight on applied lines for 3s post-edit |
| commands.executeCommand("vscode.diff") | Diff preview | Opens native diff editor for proposed vs current file |
| window.showInformationMessage | Accept/reject prompts | Modal with [Accept] [Reject] [Review] buttons |
| workspace.onDidChangeTextDocument | Live re-indexing | Debounced 2s, re-chunks and re-embeds changed file |
| languages.registerHoverProvider | AI hover explanations | Hover over symbol triggers AI explanation in hover widget |
| ExtensionContext.globalState | Settings, API key storage | Encrypted API keys via SecretStorage; settings in globalState |
| ExtensionContext.workspaceState | Chat history, index cache | Per-workspace persistent store, purged on clear-cache command |

## 4.3 Architecture Diagram — Component View

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         VS CODE EXTENSION HOST (Node.js)            │
│                                                                     │
│  ┌──────────────────┐   ┌─────────────────┐   ┌─────────────────┐  │
│  │  extension.ts    │   │  ConfigService  │   │  SecretStorage  │  │
│  │  (activate/      │──▶│  (user prefs,   │   │  (API keys)     │  │
│  │   deactivate)    │   │   model select) │   └─────────────────┘  │
│  └────────┬─────────┘   └─────────────────┘                        │
│           │                                                         │
│     ┌─────▼──────────────────────────────────────────────────────┐ │
│     │                    PROVIDER LAYER                          │ │
│     │  ┌─────────────────────┐  ┌──────────────────────────────┐ │ │
│     │  │ InlineCompletion    │  │ CodeActionProvider           │ │ │
│     │  │ Provider            │  │ (QuickFix / Refactor)        │ │ │
│     │  └──────────┬──────────┘  └──────────────┬───────────────┘ │ │
│     │             │                             │                 │ │
│     │  ┌──────────▼─────────────────────────────▼──────────────┐ │ │
│     │  │                  CONTROLLER LAYER                     │ │ │
│     │  │  ChatController   AgentController   HoverController   │ │ │
│     │  └──────────┬────────────────┬──────────────────────────┘ │ │
│     └─────────────│────────────────│──────────────────────────── ┘ │
│                   │                │                               │
│     ┌─────────────▼────────────────▼──────────────────────────┐    │
│     │                    SERVICE LAYER                        │    │
│     │  ┌────────────┐  ┌───────────────┐  ┌────────────────┐ │    │
│     │  │LLMClient   │  │CodebaseIndexer│  │StreamingClient │ │    │
│     │  │(OpenAI/    │  │(Tree-sitter + │  │(SSE + Abort)   │ │    │
│     │  │ Ollama)    │  │ Embeddings +  │  └────────────────┘ │    │
│     │  └─────┬──────┘  │ SQLite-vss)   │                     │    │
│     │        │         └───────┬───────┘                     │    │
│     └────────│─────────────────│─────────────────────────────┘    │
│              │                 │                                   │
└──────────────│─────────────────│───────────────────────────────────┘
│                 │
┌───────────▼───┐   ┌─────────▼────────────┐
│  LLM APIs     │   │  WEBVIEW (Chat UI)   │
│  OpenAI       │   │  HTML/CSS/JS         │
│  Anthropic    │   │  postMessage bridge  │
│  Ollama       │   │  Streaming renderer  │
│  LM Studio    │   └──────────────────────┘
└───────────────┘
```

## 4.4 Webview Architecture (Chat Panel)

### Webview Security Model

- Content Security Policy enforced: no external scripts, no eval()
- All assets bundled and served as vscode-resource:// URIs
- Communication exclusively via acquireVsCodeApi().postMessage()
- State persistence via VS Code's webview state API between panel hide/show
### Message Protocol

```text
// Extension → Webview message types
type ExtToWebMsg =
| { type: "stream_start";  messageId: string }
| { type: "stream_token";  messageId: string; token: string }
| { type: "stream_done";   messageId: string; usage: TokenUsage }
| { type: "stream_error";  messageId: string; error: string }
| { type: "agent_step";    step: AgentStep }
| { type: "diff_ready";    files: DiffFile[] }
| { type: "context_info";  context: ContextSummary };
// Webview → Extension message types
type WebToExtMsg =
| { type: "send_message";   content: string; attachments: Attachment[] }
| { type: "cancel_stream" }
| { type: "accept_diff";    fileId: string }
| { type: "reject_diff";    fileId: string }
| { type: "insert_code";    code: string; lang: string }
| { type: "apply_code";     code: string; lang: string };
```

# 5. AI INTEGRATION LAYER

## 5.1 LLM Provider Abstraction

All LLM calls route through a unified LLMClient interface. This decouples provider-specific logic from business logic and allows hot-swapping of backends.

```text
// services/LLMClient.ts
export interface LLMClient {
```

complete(req: CompletionRequest): Promise<CompletionResponse>;

stream(req: CompletionRequest): AsyncIterable<string>;

embed(texts: string[]): Promise<number[][]>;

isAvailable(): Promise<boolean>;

```text
}
export interface CompletionRequest {
```

model:       string;

messages:    ChatMessage[];

maxTokens:   number;

temperature: number;

stop?:       string[];

signal?:     AbortSignal;  // cancellation

```text
}
// Implementations
export class OpenAIClient    implements LLMClient { ... }
export class AnthropicClient implements LLMClient { ... }
export class OllamaClient    implements LLMClient { ... }
export class LMStudioClient  implements LLMClient { ... }
```

## 5.2 Prompt Engineering System

### System Prompt Architecture

Every request uses a layered system prompt assembled at call time from composable blocks. This ensures context is always relevant and never stale.

```text
// utils/PromptBuilder.ts
export class PromptBuilder {
build(req: PromptRequest): ChatMessage[] {
```

return [

this.systemBlock(),           // role + behavior guidelines

this.repoContextBlock(req),   // repo structure summary

this.retrievedChunksBlock(req),// top-K semantic results

this.openFilesBlock(req),      // currently open tabs

this.selectionBlock(req),      // selected code if any

this.conversationHistory(req), // prior messages (trimmed)

this.userMessageBlock(req),    // current user message

].filter(Boolean) as ChatMessage[];

```text
}
private systemBlock(): ChatMessage {
```

return { role: "system", content: `

You are Kōdo, a senior software engineer.

Philosophy: the way of clean code.

Be precise. Be minimal. Act before explaining.

You have deep knowledge of the current codebase.

Always prefer minimal, targeted edits over large rewrites.

When modifying code, output ONLY the changed code block.

Use <file path="..."> tags when outputting multi-file edits.

`};

```text
}
}
```

### Context Budget Management

- Total context budget: model-dependent (GPT-4o: 128K, Sonnet 3.5: 200K, Llama 3.1: 128K)
- Allocation: System (2K) + Repo structure (1K) + Retrieved chunks (8K) + Open files (6K) + History (4K) + Selection (2K) + Response (16K)
- Overflow strategy: trim history first, then reduce retrieved chunks, never truncate system
- Token counting: tiktoken (cl100k_base) for OpenAI; character/4 heuristic for others
## 5.3 Embedding Strategy

### Model Selection

| Model | Dimensions | Mode | Notes |
| --- | --- | --- | --- |
| text-embedding-3-small | 1536 | Cloud | Default; $0.02/1M tokens |
| text-embedding-3-large | 3072 | Cloud | Higher quality; $0.13/1M tokens |
| nomic-embed-text (Ollama) | 768 | Local | Privacy mode; ~50ms/chunk |
| mxbai-embed-large (Ollama) | 1024 | Local | Best local quality option |

## 5.4 Chunking Strategy

### Semantic Chunking via Tree-sitter

- Parse AST using tree-sitter WASM bindings (available in Node.js extension host)
- Chunk at function/method boundaries — never split a function across chunks
- Class definitions: header + method summaries in one chunk, each method separately
- Max chunk size: 512 tokens (hard limit); min chunk size: 50 tokens
- Overlap: 50-token overlap between adjacent chunks for context continuity
- Fallback for unsupported languages: line-count chunking (100 lines/chunk)
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
# 9. TECHNOLOGY STACK — JUSTIFIED CHOICES

| Layer | Technology | Alternative | Justification |
| --- | --- | --- | --- |
| Extension Language | TypeScript 5.x | JavaScript | Type safety critical for large codebase; VS Code APIs are TypeScript-native |
| Build Tool | esbuild | webpack, rollup | 10-100x faster builds than webpack; produces minimal bundles; excellent TS support |
| Webview UI | Svelte 5 | React, Vue | Smallest runtime bundle (~5KB); reactive state without VDOM overhead; ideal for real-time token streaming |
| AST Parsing | tree-sitter (WASM) | Babel, @typescript-eslint | Language-agnostic; works for 40+ languages; WASM runs in Node.js extension host |
| Vector Store | SQLite-vss | Chroma, Qdrant, Pinecone | Zero external dependencies; embeds in extension; 1M vector support; no server process |
| Token Counting | tiktoken (WASM) | Manual heuristics | Exact token counts essential for budget management; official OpenAI tokenizer |
| HTTP Client | node-fetch / undici | axios | Native fetch in Node.js 18+; undici for streaming with AbortController; no extra deps |
| Testing | Vitest | Jest, Mocha | Fastest test runner; native ESM; compatible with esbuild output; great TS support |
| Syntax Highlight (webview) | Prism.js | highlight.js, Shiki | Tiny size; runtime highlighting; good for 100+ languages in webview context |
| Validation | Zod | io-ts, yup | Best-in-class TypeScript inference; used for API response and message validation |
| Optional Backend | Fastify (Node.js) | Express, Hono | Offload embedding/indexing from extension host; Fastify is 3x faster than Express |

## 9.1 Optional Proxy Backend Architecture

For enterprise deployments or large repos, an optional sidecar proxy server can be run locally or on a team server. This offloads heavy computation from the extension host.

```text
┌─────────────────────────────────────────────────────┐
│  VS Code Extension (lightweight client mode)        │
│  Extension Host → HTTP → localhost:3838             │
└─────────────────────────────┬───────────────────────┘
│
┌─────────────────────────────▼───────────────────────┐
│  Kōdo Proxy Server (Fastify)                  │
│  ├── POST /complete    → stream to OpenAI/Ollama    │
│  ├── POST /embed       → batch embedding service    │
│  ├── POST /search      → vector similarity search   │
│  ├── GET  /index/status → indexing progress         │
│  └── WebSocket /stream  → bidirectional streaming   │
└─────────────────────────────────────────────────────┘
```

Runs as: npx kodo-server --port 3838

Or Docker: docker run -p 3838:3838 kodo/server

# 10. PERFORMANCE TARGETS & SLAs

| Metric | Target (Cloud) | Target (Local) | Measurement Method |
| --- | --- | --- | --- |
| Inline TTFT (Time To First Token) | < 400ms (p50) | < 200ms (p50) | Extension telemetry |
| Chat TTFT | < 800ms (p50) | < 300ms (p50) | Extension telemetry |
| Context Retrieval Latency | < 50ms (p95) | < 50ms (p95) | Service-level timing |
| Initial Index (10K files) | < 3 min | < 5 min | Background timer |
| Incremental Re-index (1 file) | < 2s | < 2s | onDidChange handler |
| Extension Activation Time | < 500ms | < 500ms | VS Code activation event |
| Extension Heap Memory | < 512MB | < 512MB | process.memoryUsage() |
| Agent Plan→Execute (simple) | < 30s | < 45s | Agent controller timer |
| Inline Acceptance Rate (target) | > 25% | > 20% | Telemetry events |

## 10.1 Package Size Budget

- Extension VSIX target: < 15MB (excluding optional WASM grammars)
- Webview bundle: < 200KB gzipped (Svelte + Prism.js)
- tree-sitter WASM grammars: ~500KB each, lazy-loaded; top 5 bundled (~2.5MB)
- SQLite-vss WASM: ~800KB
- tiktoken WASM: ~1.2MB
# 11. SECURITY & PRIVACY

## 11.1 API Key Management

- Store API keys exclusively in vscode.ExtensionContext.secrets (OS keychain backed)
- NEVER log API keys to Output Channel or telemetry
- NEVER include API keys in bug reports or diagnostics
- Provide key rotation command: kodo.resetApiKey
## 11.2 Data Transmission

- User code is sent to LLM APIs. Always surface this clearly in onboarding UI
- Provide local-only mode (Ollama) where zero data leaves the machine
- Respect .kodoignore file: never index or send marked files
- Default exclusions: .env, *.pem, *.key, *secret*, *password*, *credential*
## 11.3 Webview Security

```text
// ChatViewProvider.ts — Strict CSP
const csp = [
```

`default-src 'none'`,

`script-src 'nonce-${nonce}'`,

`style-src ${webview.cspSource} 'unsafe-inline'`,

`font-src ${webview.cspSource}`,

`img-src ${webview.cspSource} data:`,

].join('; ');

```text
// No eval(), no external scripts, nonce-gated inline scripts only
```

## 11.4 Agent Safety

- RunTerminalTool ALWAYS requires explicit user confirmation modal
- DeleteFileTool requires confirmation + shows file path clearly
- Agent cannot access files outside workspace root
- Max agent iterations: 10 (prevents infinite loops)
- Total agent timeout: 120 seconds (prevents runaway API spend)
# 12. EXTENSION MANIFEST (package.json) — KEY SECTIONS

```text
{
"name": "kodo",
"displayName": "Kōdo — The Way of Clean Code",
"version": "1.0.0",
"engines": { "vscode": "^1.85.0" },
"activationEvents": ["onStartupFinished"],
"contributes": {
"views": {
"explorer": [{
"id": "kodo.chat",
"name": "AI Chat",
"type": "webview"
}]
},
"commands": [
{ "command": "kodo.askAI",          "title": "Ask AI" },
{ "command": "kodo.fixSelected",    "title": "AI: Fix This" },
{ "command": "kodo.explainSelected","title": "AI: Explain This" },
{ "command": "kodo.refactorProject","title": "AI: Refactor Project" },
{ "command": "kodo.generateFeature","title": "AI: Generate Feature" },
{ "command": "kodo.rebuildIndex",   "title": "AI: Rebuild Codebase Index" },
{ "command": "kodo.clearChat",      "title": "AI: Clear Chat History" }
```

],

```text
"configuration": {
"title": "Kōdo",
"properties": {
"kodo.provider":         { "type": "string",  "enum": ["openai","anthropic","ollama","lmstudio"], "default": "openai" },
"kodo.model":            { "type": "string",  "default": "gpt-4o" },
"kodo.baseUrl":          { "type": "string",  "default": "" },
"kodo.inlineEnabled":    { "type": "boolean", "default": true },
"kodo.inlineDebounceMs": { "type": "number",  "default": 300 },
"kodo.maxTokensInline":  { "type": "number",  "default": 256 },
"kodo.maxTokensChat":    { "type": "number",  "default": 4096 },
"kodo.contextChunks":    { "type": "number",  "default": 10 },
"kodo.telemetryEnabled": { "type": "boolean", "default": false }
}
},
"keybindings": [
{ "command": "kodo.askAI",       "key": "ctrl+shift+a",   "mac": "cmd+shift+a" },
{ "command": "kodo.fixSelected", "key": "ctrl+shift+f",   "mac": "cmd+shift+f", "when": "editorHasSelection" }
```

]

```text
}
}
```

# 13. CRITICAL CODE SNIPPETS

## 13.1 Streaming Completion Implementation

```text
// services/streaming/StreamingClient.ts
export async function* streamCompletion(
```

req: CompletionRequest,

signal: AbortSignal

```text
): AsyncIterableIterator<string> {
const response = await fetch(`${req.baseUrl}/v1/chat/completions`, {
```

method: "POST",

```text
headers: {
"Content-Type": "application/json",
"Authorization": `Bearer ${req.apiKey}`,
},
body: JSON.stringify({
```

model: req.model,

messages: req.messages,

max_tokens: req.maxTokens,

stream: true,

```text
}),
```

signal,

```text
});
if (!response.ok) {
```

throw new LLMApiError(response.status, await response.text());

```text
}
const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";
while (true) {
const { done, value } = await reader.read();
if (done) break;
```

buffer += decoder.decode(value, { stream: true });

```text
const lines = buffer.split("\n");
```

buffer = lines.pop() ?? "";

```text
for (const line of lines) {
if (!line.startsWith("data: ")) continue;
const data = line.slice(6).trim();
if (data === "[DONE]") return;
try {
const parsed = JSON.parse(data);
const token = parsed.choices[0]?.delta?.content ?? "";
if (token) yield token;
} catch { /* skip malformed SSE line */ }
}
}
}
```

## 13.2 Hybrid Retrieval Engine

```text
// services/indexer/RetrievalEngine.ts
export class RetrievalEngine {
async retrieve(
```

query: string,

options: RetrievalOptions

```text
): Promise<ContextChunk[]> {
// 1. Dense retrieval (cosine similarity)
const queryEmbed = await this.embedder.embed([query]);
const denseResults = await this.vectorStore.search(
```

queryEmbed[0], options.topK * 2

);

```text
// 2. Sparse retrieval (BM25 keyword)
const sparseResults = await this.bm25Index.search(
```

query, options.topK * 2

);

```text
// 3. Score fusion (Reciprocal Rank Fusion)
const fusedScores = this.rrfFuse(denseResults, sparseResults);
// 4. Apply boosts
const boosted = fusedScores.map(r => ({
```

...r,

score: r.score

+ (this.isRecentlyModified(r.path)  ? 0.15 : 0)

+ (this.isCurrentlyOpen(r.path)     ? 0.25 : 0)

+ (this.isDirectDependency(r.path)  ? 0.30 : 0),

```text
}));
// 5. Trim to token budget
```

return this.trimToTokenBudget(boosted, options.maxTokens);

```text
}
private rrfFuse(dense: ScoredChunk[], sparse: ScoredChunk[]): ScoredChunk[] {
const scores = new Map<string, number>();
const k = 60; // RRF constant
dense.forEach((r, i)  => scores.set(r.id, (scores.get(r.id)??0) + 1/(k+i+1)));
sparse.forEach((r, i) => scores.set(r.id, (scores.get(r.id)??0) + 1/(k+i+1)));
```

return [...scores.entries()]

```text
.sort(([,a],[,b]) => b - a)
.map(([id, score]) => ({ ...this.chunkById(id), score }));
}
}
```

## 13.3 Agent Runner (ReAct Loop)

```text
// services/agent/AgentRunner.ts
export class AgentRunner {
async run(
```

task: string,

```text
onStep: (step: AgentStep) => void
): Promise<AgentResult> {
const messages: ChatMessage[] = [
```

this.systemPrompt(),

```text
{ role: "user", content: task }
```

];

```text
let iteration = 0;
const MAX_ITER = 10;
while (iteration++ < MAX_ITER) {
const response = await this.llm.complete({
```

model: "gpt-4o",

messages,

tools: this.toolRegistry.toOpenAITools(),

tool_choice: "auto",

maxTokens: 4096,

```text
});
const assistantMsg = response.choices[0].message;
```

messages.push(assistantMsg);

```text
// Terminal: no tool calls → agent is done
if (!assistantMsg.tool_calls?.length) {
```

return { success: true, summary: assistantMsg.content };

```text
}
// Execute all tool calls in this step
for (const tc of assistantMsg.tool_calls) {
const step: AgentStep = {
```

toolName: tc.function.name,

input: JSON.parse(tc.function.arguments),

status: "running",

```text
};
```

onStep(step);

```text
try {
const result = await this.toolRegistry.execute(tc);
```

step.status = "done";

step.output = result;

messages.push({ role: "tool", tool_call_id: tc.id, content: result });

```text
} catch (e) {
```

step.status = "error";

step.error = String(e);

messages.push({ role: "tool", tool_call_id: tc.id,

content: `ERROR: ${e}` });

```text
}
```

onStep(step); // update UI with final status

```text
}
}
```

return { success: false, error: "Max iterations reached" };

```text
}
}
```

# 14. SUCCESS METRICS & KPIs

| Metric | 30-Day Target | 90-Day Target | Measurement |
| --- | --- | --- | --- |
| Marketplace Installs | 500 | 5,000 | VS Code Marketplace analytics |
| Weekly Active Users | 200 | 2,000 | Opt-in telemetry |
| Inline Acceptance Rate | > 20% | > 28% | accept/shown events |
| p50 Inline TTFT (cloud) | < 600ms | < 350ms | Telemetry timing |
| Chat Sessions / Active User | > 3/week | > 6/week | Session start events |
| Agent Task Success Rate | > 60% | > 75% | Agent complete vs error |
| Marketplace Rating | > 4.0 ⭐ | > 4.5 ⭐ | Marketplace reviews |
| GitHub Stars | > 100 | > 1,000 | GitHub repository |

# APPENDIX A: DECISION LOG

### A1: Why not fork VS Code?

Forking VS Code requires maintaining a private branch against a rapidly-evolving codebase (Microsoft commits ~1,000 times/month). This creates perpetual merge debt, breaks extension compatibility, requires custom update infrastructure, and cannot be published to the official VS Code Marketplace. For a startup with limited engineering resources, the extension model is the only viable path to initial distribution.

### A2: Why Svelte for the webview UI?

The webview is a sandboxed iframe with strict CSP and no access to Node.js. Bundle size directly impacts panel open time. React adds ~45KB gzipped; Svelte adds ~5KB. For a panel that must open quickly and stream tokens smoothly, Svelte's compile-time reactivity without a virtual DOM is the optimal choice.

### A3: Why SQLite-vss over a proper vector database?

A VS Code extension cannot run a separate server process reliably on all platforms. Chroma, Qdrant, and Pinecone require network I/O. SQLite-vss is an embedded WASM extension to SQLite — it runs in-process, requires zero installation, and supports HNSW approximate nearest neighbor search with <50ms latency on 100K vectors. For a developer tool, local-first is always the right default.

# APPENDIX B: GLOSSARY

| Term | Definition |
| --- | --- |
| TTFT | Time To First Token — latency from request send to first token received from LLM |
| FIM | Fill-in-the-Middle — prompting strategy where model fills in content between a prefix and suffix |
| ReAct | Reason+Act — agentic prompting pattern where LLM alternates between reasoning and tool execution |
| HNSW | Hierarchical Navigable Small World — approximate nearest neighbor graph algorithm for vector search |
| BM25 | Best Match 25 — probabilistic keyword ranking function used in search engines |
| RRF | Reciprocal Rank Fusion — algorithm for combining ranked lists from multiple retrieval methods |
| SSE | Server-Sent Events — HTTP protocol for server-to-client token streaming |
| WorkspaceEdit | VS Code API object representing a batch of file system changes, atomically applicable with undo support |
| CSP | Content Security Policy — browser security header restricting what resources a webview can load |
