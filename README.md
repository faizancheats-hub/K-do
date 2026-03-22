# Kodo

Kodo is a production-oriented VS Code extension scaffold based on the supplied PRD. This repository contains:

- A complete DOCX-to-Markdown documentation system generated from `Kodo_PRD.docx`
- A structured `.memory/` workspace for ongoing context and implementation state
- A functional TypeScript extension baseline for chat, inline completions, codebase awareness, and staged agent edits
- GitHub-ready project metadata, CI, build scripts, and tests

## Quick start

```powershell
npm.cmd install
npm.cmd run docs:generate
npm.cmd run build
npm.cmd run test
```

## Project layout

- `src/`: VS Code extension host source
- `webview/`: chat panel webview source and build output
- `docs/`: generated and curated Markdown documentation
- `.memory/`: implementation memory, decisions, and progress tracking
- `tests/`: unit coverage for core services
- `.github/`: CI workflow and GitHub-ready metadata

## Core capabilities

- Inline completions with debounced context-aware prompting
- Sidebar chat with streaming responses and workspace context
- Workspace indexing with semantic + lexical retrieval
- Agent workflow with staged diffs before apply
- Provider abstraction for OpenAI, Anthropic, Ollama, and LM Studio

## Documentation

Run `npm.cmd run docs:generate` after changing the PRD source. Generated files are written under `docs/`.

Implementation state and decision tracking live under `.memory/`.
