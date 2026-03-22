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
