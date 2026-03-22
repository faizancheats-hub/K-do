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
