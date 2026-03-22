import { describe, expect, it } from "vitest";
import { RetrievalEngine } from "../../src/services/indexer/RetrievalEngine";
import { VectorStore } from "../../src/services/indexer/VectorStore";

describe("RetrievalEngine", () => {
  it("returns boosted retrieval results", () => {
    const store = new VectorStore();
    store.upsert(
      "src/example.ts",
      [
        {
          id: "src/example.ts:1-3",
          path: "src/example.ts",
          languageId: "typescript",
          content: "export const authMiddleware = () => true;",
          startLine: 1,
          endLine: 1,
          tokens: 8,
          keywords: ["authmiddleware", "middleware", "auth"]
        }
      ],
      [[1, 0, 0]]
    );

    const engine = new RetrievalEngine(store);
    const results = engine.retrieve([1, 0, 0], "auth middleware", {
      topK: 3,
      maxTokens: 200,
      activeFilePath: "src/example.ts",
      openPaths: ["src/example.ts"],
      recentPaths: []
    });

    expect(results[0]?.path).toBe("src/example.ts");
  });
});
