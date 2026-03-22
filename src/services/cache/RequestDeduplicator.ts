export class RequestDeduplicator<T> {
  private readonly inflight = new Map<string, Promise<T>>();

  async run(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      return existing;
    }

    const promise = factory().finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }
}
