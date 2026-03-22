# 5. AI INTEGRATION LAYER

## 5.1 LLM Provider Abstraction

All LLM calls route through a unified LLMClient interface. This decouples provider-specific logic from business logic and allows hot-swapping of backends.

```text
// services/LLMClient.ts
export interface LLMClient {
```

complete(req: CompletionRequest): Promise<CompletionResponse>;

stream(req: CompletionRequest): AsyncIterable<string>;

embed(texts: string[]): Promise<number[][]>;

isAvailable(): Promise<boolean>;

```text
}
export interface CompletionRequest {
```

model:       string;

messages:    ChatMessage[];

maxTokens:   number;

temperature: number;

stop?:       string[];

signal?:     AbortSignal;  // cancellation

```text
}
// Implementations
export class OpenAIClient    implements LLMClient { ... }
export class AnthropicClient implements LLMClient { ... }
export class OllamaClient    implements LLMClient { ... }
export class LMStudioClient  implements LLMClient { ... }
```

## 5.2 Prompt Engineering System

### System Prompt Architecture

Every request uses a layered system prompt assembled at call time from composable blocks. This ensures context is always relevant and never stale.

```text
// utils/PromptBuilder.ts
export class PromptBuilder {
build(req: PromptRequest): ChatMessage[] {
```

return [

this.systemBlock(),           // role + behavior guidelines

this.repoContextBlock(req),   // repo structure summary

this.retrievedChunksBlock(req),// top-K semantic results

this.openFilesBlock(req),      // currently open tabs

this.selectionBlock(req),      // selected code if any

this.conversationHistory(req), // prior messages (trimmed)

this.userMessageBlock(req),    // current user message

].filter(Boolean) as ChatMessage[];

```text
}
private systemBlock(): ChatMessage {
```

return { role: "system", content: `

You are Kōdo, a senior software engineer.

Philosophy: the way of clean code.

Be precise. Be minimal. Act before explaining.

You have deep knowledge of the current codebase.

Always prefer minimal, targeted edits over large rewrites.

When modifying code, output ONLY the changed code block.

Use <file path="..."> tags when outputting multi-file edits.

`};

```text
}
}
```

### Context Budget Management

- Total context budget: model-dependent (GPT-4o: 128K, Sonnet 3.5: 200K, Llama 3.1: 128K)
- Allocation: System (2K) + Repo structure (1K) + Retrieved chunks (8K) + Open files (6K) + History (4K) + Selection (2K) + Response (16K)
- Overflow strategy: trim history first, then reduce retrieved chunks, never truncate system
- Token counting: tiktoken (cl100k_base) for OpenAI; character/4 heuristic for others
## 5.3 Embedding Strategy

### Model Selection

| Model | Dimensions | Mode | Notes |
| --- | --- | --- | --- |
| text-embedding-3-small | 1536 | Cloud | Default; $0.02/1M tokens |
| text-embedding-3-large | 3072 | Cloud | Higher quality; $0.13/1M tokens |
| nomic-embed-text (Ollama) | 768 | Local | Privacy mode; ~50ms/chunk |
| mxbai-embed-large (Ollama) | 1024 | Local | Best local quality option |

## 5.4 Chunking Strategy

### Semantic Chunking via Tree-sitter

- Parse AST using tree-sitter WASM bindings (available in Node.js extension host)
- Chunk at function/method boundaries — never split a function across chunks
- Class definitions: header + method summaries in one chunk, each method separately
- Max chunk size: 512 tokens (hard limit); min chunk size: 50 tokens
- Overlap: 50-token overlap between adjacent chunks for context continuity
- Fallback for unsupported languages: line-count chunking (100 lines/chunk)
