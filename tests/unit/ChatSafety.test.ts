import { describe, expect, it } from "vitest";
import { containsUnsupportedToolMarkup, rewriteUnsupportedToolMarkupResponse } from "../../src/utils/ChatSafety";

describe("ChatSafety", () => {
  it("detects unsupported XML-style tool markup", () => {
    expect(containsUnsupportedToolMarkup("<list_files><path>.</path></list_files>")).toBe(true);
    expect(containsUnsupportedToolMarkup("Normal assistant response")).toBe(false);
  });

  it("rewrites pseudo tool calls into grounded workspace guidance", () => {
    const rewritten = rewriteUnsupportedToolMarkupResponse(
      "I will inspect now.\n<list_files>\n<path>.</path>\n</list_files>",
      ["src/extension.ts", "package.json"]
    );

    expect(rewritten).toContain("I can't execute XML-style tool calls inside chat");
    expect(rewritten).toContain("src/extension.ts");
    expect(rewritten).not.toContain("<list_files>");
  });
});
