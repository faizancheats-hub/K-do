# 12. EXTENSION MANIFEST (package.json) — KEY SECTIONS

```text
{
"name": "kodo",
"displayName": "Kōdo — The Way of Clean Code",
"version": "1.0.0",
"engines": { "vscode": "^1.85.0" },
"activationEvents": ["onStartupFinished"],
"contributes": {
"views": {
"explorer": [{
"id": "kodo.chat",
"name": "AI Chat",
"type": "webview"
}]
},
"commands": [
{ "command": "kodo.askAI",          "title": "Ask AI" },
{ "command": "kodo.fixSelected",    "title": "AI: Fix This" },
{ "command": "kodo.explainSelected","title": "AI: Explain This" },
{ "command": "kodo.refactorProject","title": "AI: Refactor Project" },
{ "command": "kodo.generateFeature","title": "AI: Generate Feature" },
{ "command": "kodo.rebuildIndex",   "title": "AI: Rebuild Codebase Index" },
{ "command": "kodo.clearChat",      "title": "AI: Clear Chat History" }
```

],

```text
"configuration": {
"title": "Kōdo",
"properties": {
"kodo.provider":         { "type": "string",  "enum": ["openai","anthropic","ollama","lmstudio"], "default": "openai" },
"kodo.model":            { "type": "string",  "default": "gpt-4o" },
"kodo.baseUrl":          { "type": "string",  "default": "" },
"kodo.inlineEnabled":    { "type": "boolean", "default": true },
"kodo.inlineDebounceMs": { "type": "number",  "default": 300 },
"kodo.maxTokensInline":  { "type": "number",  "default": 256 },
"kodo.maxTokensChat":    { "type": "number",  "default": 4096 },
"kodo.contextChunks":    { "type": "number",  "default": 10 },
"kodo.telemetryEnabled": { "type": "boolean", "default": false }
}
},
"keybindings": [
{ "command": "kodo.askAI",       "key": "ctrl+shift+a",   "mac": "cmd+shift+a" },
{ "command": "kodo.fixSelected", "key": "ctrl+shift+f",   "mac": "cmd+shift+f", "when": "editorHasSelection" }
```

]

```text
}
}
```
