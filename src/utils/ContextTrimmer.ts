import type { ContextChunk } from "../types/context";
import { TokenCounter } from "./TokenCounter";

export class ContextTrimmer {
  constructor(private readonly counter = new TokenCounter()) {}

  trimToBudget<T extends Pick<ContextChunk, "content">>(items: T[], budget: number): T[] {
    const result: T[] = [];
    let used = 0;

    for (const item of items) {
      const cost = this.counter.estimate(item.content);
      if (cost > budget && result.length === 0) {
        result.push({
          ...item,
          content: this.sliceToTokens(item.content, budget)
        });
        break;
      }
      if (used + cost > budget) {
        break;
      }
      result.push(item);
      used += cost;
    }

    return result;
  }

  sliceToTokens(text: string, budget: number): string {
    const maxChars = Math.max(120, budget * 4);
    return text.slice(0, maxChars);
  }
}
