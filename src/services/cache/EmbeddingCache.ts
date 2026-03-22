export class EmbeddingCache {
  private readonly entries = new Map<string, number[]>();

  get(key: string): number[] | undefined {
    return this.entries.get(key);
  }

  set(key: string, value: number[]): void {
    this.entries.set(key, value);
  }

  clear(): void {
    this.entries.clear();
  }
}
