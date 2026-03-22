# Decision Log

## Accepted

- Use generated Markdown plus curated status docs rather than hand-maintaining a single monolithic PRD transcription.
- Keep the extension implementation in TypeScript with esbuild and a lightweight browser webview bundle.
- Use an in-memory retrieval baseline first so the codebase-aware features are functional immediately.
- Stage all agent changes as diffs before apply to stay aligned with the PRD safety model.

## Deferred

- Tree-sitter WASM integration
- SQLite-vss or durable vector persistence
- Full Svelte webview migration
- Proxy backend
