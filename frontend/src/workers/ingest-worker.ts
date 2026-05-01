import type { WorkerEnvelope, WorkerNotification } from "../core/worker-messages";

const scope = self as unknown as {
  postMessage(message: WorkerNotification): void;
  onmessage: ((event: MessageEvent<WorkerEnvelope>) => void) | null;
};

scope.onmessage = (event: MessageEvent<WorkerEnvelope>) => {
  const message = event.data;

  if (message.type === "ping") {
    scope.postMessage({ id: message.id, type: "pong", payload: { worker: "ingest" } });
    return;
  }

  scope.postMessage({
    id: message.id,
    type: "error",
    error: `Unsupported ingest worker message: ${message.type}`,
  });
};
