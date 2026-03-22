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
