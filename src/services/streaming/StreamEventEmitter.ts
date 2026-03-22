type Listener<T> = (payload: T) => void;

export class StreamEventEmitter<TEvents extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof TEvents, Set<Listener<unknown>>>();

  on<TKey extends keyof TEvents>(event: TKey, listener: Listener<TEvents[TKey]>): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as Listener<unknown>);
    this.listeners.set(event, set);
    return () => {
      set.delete(listener as Listener<unknown>);
    };
  }

  emit<TKey extends keyof TEvents>(event: TKey, payload: TEvents[TKey]): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }
    for (const listener of set) {
      listener(payload);
    }
  }
}
