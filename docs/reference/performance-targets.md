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
