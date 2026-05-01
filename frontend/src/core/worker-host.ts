import type { WorkerEnvelope, WorkerName, WorkerNotification } from "./worker-messages";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeoutId: number;
};

type ManagedWorker = {
  worker: Worker;
  pending: Map<string, PendingRequest>;
};

type WorkerListener = (message: WorkerNotification, workerName: WorkerName) => void;

const workerFactories: Record<WorkerName, () => Worker> = {
  compute: () => new Worker(new URL("../workers/compute-worker.ts", import.meta.url), { type: "module" }),
  ingest: () => new Worker(new URL("../workers/ingest-worker.ts", import.meta.url), { type: "module" }),
  render: () => new Worker(new URL("../workers/render-worker.ts", import.meta.url), { type: "module" }),
};

export class WorkerHost {
  private readonly workers = new Map<WorkerName, ManagedWorker>();
  private readonly listeners = new Set<WorkerListener>();

  subscribe(listener: WorkerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  post<TResponse = unknown>(
    workerName: WorkerName,
    type: string,
    payload?: unknown,
    transfer: Transferable[] = [],
  ): Promise<TResponse> {
    const managed = this.getOrCreate(workerName);
    const id = crypto.randomUUID();

    const envelope: WorkerEnvelope = {
      id,
      type,
      payload,
    };

    return new Promise<TResponse>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        managed.pending.delete(id);
        reject(new Error(`Worker request timed out: ${workerName}:${type}`));
      }, 5000);

      managed.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutId,
      });

      managed.worker.postMessage(envelope, transfer);
    });
  }

  terminate(workerName: WorkerName): void {
    const managed = this.workers.get(workerName);
    if (!managed) {
      return;
    }

    for (const request of managed.pending.values()) {
      window.clearTimeout(request.timeoutId);
      request.reject(new Error(`Worker terminated: ${workerName}`));
    }

    managed.worker.terminate();
    this.workers.delete(workerName);
  }

  terminateAll(): void {
    for (const workerName of Array.from(this.workers.keys())) {
      this.terminate(workerName);
    }
  }

  private getOrCreate(workerName: WorkerName): ManagedWorker {
    const existing = this.workers.get(workerName);
    if (existing) {
      return existing;
    }

    const managed: ManagedWorker = {
      worker: workerFactories[workerName](),
      pending: new Map(),
    };

    managed.worker.addEventListener("message", (event: MessageEvent<WorkerNotification>) => {
      this.handleMessage(workerName, managed, event.data);
    });

    managed.worker.addEventListener("error", (event) => {
      for (const request of managed.pending.values()) {
        window.clearTimeout(request.timeoutId);
        request.reject(event.error ?? new Error(event.message));
      }
      managed.pending.clear();
    });

    this.workers.set(workerName, managed);
    return managed;
  }

  private handleMessage(
    workerName: WorkerName,
    managed: ManagedWorker,
    message: WorkerNotification,
  ): void {
    if (message.id) {
      const request = managed.pending.get(message.id);
      if (request) {
        window.clearTimeout(request.timeoutId);
        managed.pending.delete(message.id);

        if (message.error) {
          request.reject(new Error(message.error));
        } else {
          request.resolve(message.payload);
        }
        return;
      }
    }

    for (const listener of this.listeners) {
      listener(message, workerName);
    }
  }
}
