const UNSUPPORTED_TOOL_MARKUP =
  /<\/?(list_files|read_file|open_file|search_files|grep_search|glob_search|find_files|list_directory|run_terminal)\b[^>]*>/i;

export function containsUnsupportedToolMarkup(value: string): boolean {
  return UNSUPPORTED_TOOL_MARKUP.test(value);
}

export function rewriteUnsupportedToolMarkupResponse(value: string, workspaceFilePaths: string[]): string {
  if (!containsUnsupportedToolMarkup(value)) {
    return value;
  }

  const visibleFiles = workspaceFilePaths.slice(0, 40);
  const remaining = Math.max(0, workspaceFilePaths.length - visibleFiles.length);

  return [
    "I can't execute XML-style tool calls inside chat, so I won't pretend I ran commands without real output.",
    visibleFiles.length ? "Workspace files I can already see from Kodo's indexed context:" : "I don't have a workspace file inventory available yet.",
    ...visibleFiles.map((filePath) => `- ${filePath}`),
    remaining ? `- ...and ${remaining} more files` : "",
    "If you want me to inspect a specific file, mention it with @relative/path."
  ].filter(Boolean).join("\n");
}
