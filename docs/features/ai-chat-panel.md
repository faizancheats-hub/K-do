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
