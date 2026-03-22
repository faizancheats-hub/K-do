import { describe, expect, it } from "vitest";
import { ChunkingEngine } from "../../src/services/indexer/ChunkingEngine";

describe("ChunkingEngine", () => {
  it("splits source files into semantic chunks", () => {
    const engine = new ChunkingEngine();
    const chunks = engine.chunkFile(
      "src/example.ts",
      [
        "export function alpha() {",
        "  return 1;",
        "}",
        "",
        "export function beta() {",
        "  return 2;",
        "}"
      ].join("\n"),
      "typescript"
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].path).toBe("src/example.ts");
  });
});
