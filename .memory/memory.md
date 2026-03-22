# Kodo Memory

## Project Snapshot

- Project: Kodo VS Code extension scaffold generated from `Kodo_PRD.docx`
- Current state: Buildable TypeScript extension baseline with chat, inline completion, indexing, agent diff staging, generated Markdown docs, CI, and tests
- Source PRD: [`Kodo_PRD.docx`](../Kodo_PRD.docx)
- Documentation index: [`docs/README.md`](../docs/README.md)

## Key Decisions

- The PRD was converted into both a full Markdown source file and split logical docs to keep traceability and navigation.
- The implementation favors a functional baseline over speculative placeholders: in-memory retrieval, heuristic chunking, staged diffs, and a lightweight webview are all real and buildable.
- Advanced production-hardening items from the PRD are tracked explicitly instead of being marked complete without code.
- Memory and state tracking live under `.memory/` only.

## Delivery Status

- ✅ DOCX PRD converted into `docs/prd/full-prd.md`
- ✅ PRD split into architecture, feature, implementation, and reference Markdown files
- ✅ `.memory/` workspace created for decisions, state, and progress tracking
- ✅ VS Code extension scaffold implemented with commands, providers, controllers, services, and webview
- ✅ LLM abstraction implemented for OpenAI, Anthropic, Ollama, and LM Studio
- ✅ Codebase indexing baseline implemented with chunking, embeddings, retrieval, and incremental reindex hooks
- ✅ Agent workflow implemented with planning, file reads, draft changes, diff staging, and apply/reject controls
- ✅ Build, test, CI, and GitHub-ready repository metadata added
- In Progress: Production-grade semantic chunking with Tree-sitter, persistent vector storage, and deeper marketplace polish
- In Progress: Higher-fidelity inline streaming UX within VS Code API limitations
- ⬜ Optional proxy backend architecture
- ⬜ Telemetry, KPI instrumentation, and release/demo assets

## Current Risks

- The repository delivers a working baseline, not full production parity with every late-phase PRD target.
- Retrieval uses a pragmatic in-memory vector store and hashed fallback embeddings when provider embeddings are unavailable.
- The webview implementation is lightweight and functional; it does not yet mirror the PRD's richer Svelte-specific UI plan.

## Next Useful Moves

- Replace heuristic chunking with Tree-sitter for stronger symbol boundaries.
- Persist embeddings/vector state to disk for larger repositories.
- Expand agent edit prompting into a fuller tool-call loop with stronger validation.
- Add marketplace assets, onboarding flows, and release packaging.
