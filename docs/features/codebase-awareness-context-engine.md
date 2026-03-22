## 3.3 Codebase Awareness & Context Engine

### Architecture Overview

The context engine is the most critical differentiator. It transforms raw file I/O into a semantic graph that the LLM can query efficiently. The engine runs as a background service activated on workspace open.

### Indexing Pipeline

- File Discovery: Walk workspace using vscode.workspace.findFiles with .gitignore-aware filtering
- Language Detection: Map file extensions to language IDs
- Chunking: Split files into semantic chunks (function/class boundaries via Tree-sitter)
- Embedding Generation: Send chunks to embedding API (text-embedding-3-small or local)
- Vector Storage: Store embeddings in SQLite with sqlite-vss or in-memory HNSW index
- Incremental Updates: Watch files via vscode.workspace.onDidChangeTextDocument for live re-indexing
### Retrieval Strategy

- Cosine similarity search against current prompt embedding
- Keyword BM25 fallback for exact symbol/identifier search
- Recency boost: recently modified files get +0.15 score bonus
- Open editor boost: currently open tabs get +0.25 score bonus
- Dependency graph traversal: imports of current file are always included
- Final context budget: top-K chunks ranked by composite score, trimmed to 8K tokens
### Supported Index Sizes

- Small repos (<10K files): full in-memory HNSW, instant retrieval
- Medium repos (10K–100K files): SQLite-vss with LRU cache, <50ms retrieval
- Large repos (>100K files): chunked indexing with priority queue, background rebuild
