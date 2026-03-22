import { languageIdFromPath } from "../../utils/LanguageUtils";
import { TokenCounter } from "../../utils/TokenCounter";
import type { ContextChunk } from "../../types/context";

const BOUNDARY_PATTERNS = [
  /^\s*export\s+/,
  /^\s*(async\s+)?function\s+/,
  /^\s*class\s+/,
  /^\s*interface\s+/,
  /^\s*type\s+/,
  /^\s*const\s+[A-Z][A-Za-z0-9_]*\s*=/,
  /^\s*def\s+/,
  /^\s*func\s+/,
  /^\s*pub\s+fn\s+/
];

export class ChunkingEngine {
  constructor(private readonly counter = new TokenCounter()) {}

  chunkFile(filePath: string, content: string, languageId = languageIdFromPath(filePath)): ContextChunk[] {
    const lines = content.split(/\r?\n/);
    const chunks: ContextChunk[] = [];
    let startLine = 1;
    let buffer: string[] = [];

    const flush = (endLine: number) => {
      if (!buffer.length) {
        return;
      }
      const chunkContent = buffer.join("\n").trimEnd();
      if (!chunkContent) {
        buffer = [];
        return;
      }

      chunks.push({
        id: `${filePath}:${startLine}-${endLine}`,
        path: filePath,
        languageId,
        content: chunkContent,
        startLine,
        endLine,
        tokens: this.counter.estimate(chunkContent),
        keywords: extractKeywords(chunkContent)
      });
      buffer = [];
      startLine = endLine + 1;
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const nextLineNumber = index + 1;
      const shouldSplit =
        buffer.length > 0 &&
        (BOUNDARY_PATTERNS.some((pattern) => pattern.test(line)) || this.counter.estimate(buffer.join("\n")) > 320);

      if (shouldSplit) {
        flush(nextLineNumber - 1);
      }

      buffer.push(line);

      if (buffer.length >= 80) {
        flush(nextLineNumber);
      }
    }

    flush(lines.length);
    return chunks.length ? chunks : [
      {
        id: `${filePath}:1-${lines.length || 1}`,
        path: filePath,
        languageId,
        content,
        startLine: 1,
        endLine: Math.max(lines.length, 1),
        tokens: this.counter.estimate(content),
        keywords: extractKeywords(content)
      }
    ];
  }
}

function extractKeywords(content: string): string[] {
  const words = content.match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) ?? [];
  const frequency = new Map<string, number>();

  for (const word of words) {
    const normalized = word.toLowerCase();
    frequency.set(normalized, (frequency.get(normalized) ?? 0) + 1);
  }

  return [...frequency.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([word]) => word);
}
