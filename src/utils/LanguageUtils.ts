import * as path from "node:path";

const EXTENSION_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".js": "javascript",
  ".jsx": "javascriptreact",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".json": "json",
  ".md": "markdown",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "toml",
  ".sh": "shellscript"
};

export function languageIdFromPath(filePath: string): string {
  return EXTENSION_MAP[path.extname(filePath).toLowerCase()] ?? "plaintext";
}

export function codeFenceLanguage(languageId: string): string {
  if (!languageId || languageId === "plaintext") {
    return "text";
  }
  return languageId;
}
