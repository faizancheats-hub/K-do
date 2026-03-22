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
