# 11. SECURITY & PRIVACY

## 11.1 API Key Management

- Store API keys exclusively in vscode.ExtensionContext.secrets (OS keychain backed)
- NEVER log API keys to Output Channel or telemetry
- NEVER include API keys in bug reports or diagnostics
- Provide key rotation command: kodo.resetApiKey
## 11.2 Data Transmission

- User code is sent to LLM APIs. Always surface this clearly in onboarding UI
- Provide local-only mode (Ollama) where zero data leaves the machine
- Respect .kodoignore file: never index or send marked files
- Default exclusions: .env, *.pem, *.key, *secret*, *password*, *credential*
## 11.3 Webview Security

```text
// ChatViewProvider.ts — Strict CSP
const csp = [
```

`default-src 'none'`,

`script-src 'nonce-${nonce}'`,

`style-src ${webview.cspSource} 'unsafe-inline'`,

`font-src ${webview.cspSource}`,

`img-src ${webview.cspSource} data:`,

].join('; ');

```text
// No eval(), no external scripts, nonce-gated inline scripts only
```

## 11.4 Agent Safety

- RunTerminalTool ALWAYS requires explicit user confirmation modal
- DeleteFileTool requires confirmation + shows file path clearly
- Agent cannot access files outside workspace root
- Max agent iterations: 10 (prevents infinite loops)
- Total agent timeout: 120 seconds (prevents runaway API spend)
