type EventCallback<TPayload = unknown> = (payload: TPayload) => void;

export class EventBus {
  private readonly listeners = new Map<string, Set<EventCallback>>();

  on<TPayload>(eventName: string, callback: EventCallback<TPayload>): () => void {
    const listeners = this.listeners.get(eventName) ?? new Set<EventCallback>();
    listeners.add(callback as EventCallback);
    this.listeners.set(eventName, listeners);

    return () => {
      listeners.delete(callback as EventCallback);
      if (listeners.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  emit<TPayload>(eventName: string, payload: TPayload): void {
    const listeners = this.listeners.get(eventName);
    if (!listeners) {
      return;
    }

    for (const callback of listeners) {
      callback(payload);
    }
  }
}
