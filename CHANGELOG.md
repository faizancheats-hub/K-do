# Changelog

## 1.0.10

- Fixed stale codebase indexing by removing deleted and renamed files from the live workspace index
- Added a native Kodo Changes tree view with grouped staged diffs, live write indicators, and bulk actions
- Rebuilt the webview with a Claude/Cursor-style layout, inline agent step feed, inline file write cards, richer status bar, attachments, and file mentions

## 1.0.9

- Show all live agent phases in the step feed, including planning and execution rows in addition to tool calls
- Improved step labeling so non-tool agent phases render clearly while running and after completion

## 1.0.8

- Reworked the webview into a cleaner VS Code-native layout with a simpler top bar and pinned composer
- Replaced the static agent block with a live compact tool progress feed and working-file indicator
- Switched assistant streaming to incremental token appends with a blinking cursor until completion
- Collapsed staged changes into a badge-driven expandable diff panel

## 1.0.7

- Added explicit composer mode selection with `Auto`, `Chat`, and `Agent`
- Wired mode override through the webview message schema and request routing

## 1.0.6

- Broadened agent intent routing so requests like `create anime streaming website` go to the agent
- Added routing coverage for website/app/dashboard style build prompts

## 1.0.5

- Redesigned the sidebar UI to a minimal VS Code-native layout with neutral colors
- Hid bulk diff actions when no staged changes exist
- Fixed stale Accept/Reject buttons by pushing updated diff state back to the webview after each action

## 1.0.4

- Auto-route imperative create/add/build/edit requests to the agent instead of plain chat
- Require tool usage for mutating agent tasks until staged changes exist
- Added intent-routing tests so normal questions stay in chat mode

## 1.0.3

- Replaced the agent's fake JSON-diff flow with a real OpenAI-compatible tool-calling loop
- Preserved assistant `tool_calls` across turns so OpenAI-compatible proxies can continue function execution correctly
- Added test coverage for staged diff generation from model-driven tool calls

## 1.0.2

- Prevented chat from inventing unsupported XML-style tool calls like `<list_files>`
- Added workspace file inventory to chat context so repo-structure questions are grounded in real files
- Added end-of-stream correction when a model still emits pseudo-tool markup

## 1.0.1

- Moved Kodo into its own Activity Bar sidebar container
- Updated chat-triggering commands to reveal the Kodo sidebar before sending prompts

## 1.0.0

- Initial repository bootstrap from PRD
- Added Markdown documentation generator and structured docs layout
- Added functional VS Code extension scaffold for chat, inline completions, indexing, and agent diff staging
