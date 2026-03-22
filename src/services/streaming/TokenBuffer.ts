export class TokenBuffer {
  private buffer = "";

  constructor(private readonly threshold = 32) {}

  push(token: string): string | undefined {
    this.buffer += token;
    if (this.buffer.length >= this.threshold) {
      const chunk = this.buffer;
      this.buffer = "";
      return chunk;
    }
    return undefined;
  }

  flush(): string | undefined {
    if (!this.buffer) {
      return undefined;
    }
    const chunk = this.buffer;
    this.buffer = "";
    return chunk;
  }
}
