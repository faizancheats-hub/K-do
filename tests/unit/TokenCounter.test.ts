import { describe, expect, it } from "vitest";
import { TokenCounter } from "../../src/utils/TokenCounter";

describe("TokenCounter", () => {
  it("estimates a positive token count", () => {
    const counter = new TokenCounter();
    expect(counter.estimate("const value = 42;")).toBeGreaterThan(0);
  });

  it("returns zero for empty text", () => {
    const counter = new TokenCounter();
    expect(counter.estimate("   ")).toBe(0);
  });
});
