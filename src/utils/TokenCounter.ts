export class TokenCounter {
  estimate(text: string): number {
    const normalized = text.trim();
    if (!normalized) {
      return 0;
    }

    const words = normalized.split(/\s+/).length;
    const chars = normalized.length;
    return Math.max(words, Math.ceil(chars / 4));
  }

  estimateMany(texts: string[]): number {
    return texts.reduce((sum, text) => sum + this.estimate(text), 0);
  }
}
