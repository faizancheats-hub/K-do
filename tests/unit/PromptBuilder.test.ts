import { describe, expect, it } from "vitest";
import { PromptBuilder } from "../../src/utils/PromptBuilder";

describe("PromptBuilder", () => {
  it("includes retrieved context in chat prompts", () => {
    const builder = new PromptBuilder();
    const request = builder.buildChatRequest(
      {
        task: "Explain auth flow",
        activeFile: "src/auth.ts",
        retrieved: [
          {
            id: "a",
            path: "src/auth.ts",
            languageId: "typescript",
            content: "export async function signIn() {}",
            startLine: 1,
            endLine: 1,
            tokens: 6,
            keywords: ["signin"]
          }
        ]
      },
      "gpt-4o-mini",
      1000
    );

    expect(request.messages.at(-1)?.content).toContain("src/auth.ts");
    expect(request.messages.at(-1)?.content).toContain("signIn");
  });
});
