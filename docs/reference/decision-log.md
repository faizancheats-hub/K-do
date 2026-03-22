# APPENDIX A: DECISION LOG

### A1: Why not fork VS Code?

Forking VS Code requires maintaining a private branch against a rapidly-evolving codebase (Microsoft commits ~1,000 times/month). This creates perpetual merge debt, breaks extension compatibility, requires custom update infrastructure, and cannot be published to the official VS Code Marketplace. For a startup with limited engineering resources, the extension model is the only viable path to initial distribution.

### A2: Why Svelte for the webview UI?

The webview is a sandboxed iframe with strict CSP and no access to Node.js. Bundle size directly impacts panel open time. React adds ~45KB gzipped; Svelte adds ~5KB. For a panel that must open quickly and stream tokens smoothly, Svelte's compile-time reactivity without a virtual DOM is the optimal choice.

### A3: Why SQLite-vss over a proper vector database?

A VS Code extension cannot run a separate server process reliably on all platforms. Chroma, Qdrant, and Pinecone require network I/O. SQLite-vss is an embedded WASM extension to SQLite — it runs in-process, requires zero installation, and supports HNSW approximate nearest neighbor search with <50ms latency on 100K vectors. For a developer tool, local-first is always the right default.
