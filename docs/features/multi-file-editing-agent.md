## 3.4 Multi-File Editing Agent

### Agent Architecture

The agent uses a Plan → Tool Call Loop → Apply pattern. It is a ReAct-style agent with access to file system tools. All edits are staged as diffs before being applied to the workspace.

### Agent Tools / Capabilities

| Tool Name | API Used | Description |
| --- | --- | --- |
| read_file | vscode.workspace.openTextDocument | Read full content of any workspace file by path |
| write_file | vscode.workspace.applyEdit | Write/overwrite file content via WorkspaceEdit |
| create_file | vscode.workspace.applyEdit | Create new file at given path with content |
| delete_file | vscode.workspace.applyEdit | Delete file with user confirmation prompt |
| search_codebase | Context Engine (embedding) | Semantic search returning top-5 relevant file chunks |
| list_directory | vscode.workspace.findFiles | List files matching a glob pattern |
| run_terminal | vscode.window.createTerminal | Execute shell commands (with explicit user approval gate) |
| show_diff | vscode.diff (DiffEditorCommand) | Show side-by-side diff of proposed vs current file |

### Agent Execution Flow

User: "Add rate limiting middleware to all Express routes"

1. PLAN (LLM generates JSON plan)

```text
{ "steps": [
"Search codebase for Express router definitions",
"Identify all route files",
"Create middleware/rateLimiter.ts",
"Inject middleware import + use() into each route file"
]}
```

2. EXECUTE (tool call loop)

→ search_codebase("express router") → [routes/api.ts, routes/auth.ts]

→ read_file("routes/api.ts") → content

→ create_file("middleware/rateLimiter.ts") → writes file

→ write_file("routes/api.ts") → patches import + app.use()

3. STAGE & REVIEW

→ show_diff for each modified file

→ User sees: [Accept All] [Review Each] [Reject All]

4. APPLY

→ vscode.workspace.applyEdit(workspaceEdit)
