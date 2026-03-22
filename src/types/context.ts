export interface ContextChunk {
  id: string;
  path: string;
  languageId: string;
  content: string;
  startLine: number;
  endLine: number;
  tokens: number;
  keywords: string[];
  vector?: number[];
}

export interface RetrievalOptions {
  topK: number;
  maxTokens: number;
  activeFilePath?: string;
  recentPaths?: string[];
  openPaths?: string[];
}

export interface RetrievalResult extends ContextChunk {
  score: number;
  denseScore: number;
  sparseScore: number;
}

export interface ContextSummary {
  activeFile: string | null;
  selectedLines: string | null;
  attachedFiles: string[];
  indexedFiles: number;
  indexedChunks: number;
}
