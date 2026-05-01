import type {
  RenderInitPayload,
  RenderResizePayload,
  RenderStatsPayload,
  WorkerEnvelope,
  WorkerNotification,
} from "../core/worker-messages";

type ScopeAdapter = {
  postMessage(message: WorkerNotification): void;
  onmessage: ((event: MessageEvent<WorkerEnvelope>) => void) | null;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
  setTimeout(handler: () => void, timeout?: number): number;
  clearTimeout(handle: number): void;
};

const scope = self as unknown as ScopeAdapter;

let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;
let frameHandle: number | null = null;
let timeoutHandle: number | null = null;
let width = 0;
let height = 0;
let phase = 0;
let running = false;
let lastFrameAt = performance.now();
let lastStatsAt = performance.now();
let framesSinceStats = 0;
let lastFrameMs = 0;

const requestFrame = (callback: FrameRequestCallback): void => {
  if (scope.requestAnimationFrame) {
    frameHandle = scope.requestAnimationFrame(callback);
    return;
  }

  timeoutHandle = scope.setTimeout(() => callback(performance.now()), 16);
};

const cancelFrame = (): void => {
  if (frameHandle !== null && scope.cancelAnimationFrame) {
    scope.cancelAnimationFrame(frameHandle);
  }

  if (timeoutHandle !== null) {
    scope.clearTimeout(timeoutHandle);
  }

  frameHandle = null;
  timeoutHandle = null;
};

const resize = (payload: RenderResizePayload): void => {
  if (!canvas || !context) {
    return;
  }

  const dpr = Math.max(1, payload.devicePixelRatio || 1);
  width = Math.max(1, payload.width);
  height = Math.max(1, payload.height);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
};

const draw = (now: number): void => {
  if (!context) {
    return;
  }

  const centerX = width * 0.5;
  const centerY = height * 0.52;
  const radius = Math.max(72, Math.min(width, height) * 0.28);
  const pulse = (Math.sin(phase) + 1) * 0.5;
  const progress = 0.64 + pulse * 0.22;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#101722";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(148, 163, 184, 0.13)";
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 32) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += 32) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  context.lineCap = "round";
  context.lineWidth = 18;
  context.strokeStyle = "rgba(71, 85, 105, 0.7)";
  context.beginPath();
  context.arc(centerX, centerY, radius, Math.PI * 0.78, Math.PI * 2.22);
  context.stroke();

  const gradient = context.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
  gradient.addColorStop(0, "#7dd3fc");
  gradient.addColorStop(0.55, "#86efac");
  gradient.addColorStop(1, "#facc15");

  context.strokeStyle = gradient;
  context.beginPath();
  context.arc(centerX, centerY, radius, Math.PI * 0.78, Math.PI * (0.78 + progress * 1.44));
  context.stroke();

  context.fillStyle = "#e2e8f0";
  context.font = "700 34px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("Worker FBO", centerX, centerY - 4);

  context.fillStyle = "#94a3b8";
  context.font = "500 14px Inter, system-ui, sans-serif";
  context.fillText("OffscreenCanvas render loop", centerX, centerY + 34);

  context.fillStyle = "rgba(134, 239, 172, 0.15)";
  context.fillRect(24, 24, 138, 34);
  context.strokeStyle = "rgba(134, 239, 172, 0.35)";
  context.lineWidth = 1;
  context.strokeRect(24.5, 24.5, 137, 33);
  context.fillStyle = "#bbf7d0";
  context.font = "700 13px Inter, system-ui, sans-serif";
  context.textAlign = "left";
  context.fillText("MAIN THREAD FREE", 38, 42);

  if (now - lastStatsAt >= 500) {
    const elapsed = now - lastStatsAt;
    const stats: RenderStatsPayload = {
      fps: (framesSinceStats / elapsed) * 1000,
      frameMs: lastFrameMs,
      width,
      height,
    };
    scope.postMessage({ type: "render:stats", payload: stats });
    framesSinceStats = 0;
    lastStatsAt = now;
  }
};

const tick = (now: number): void => {
  if (!running) {
    return;
  }

  lastFrameMs = now - lastFrameAt;
  lastFrameAt = now;
  phase += Math.min(lastFrameMs, 32) * 0.003;
  framesSinceStats += 1;

  draw(now);
  requestFrame(tick);
};

const init = (payload: RenderInitPayload): void => {
  canvas = payload.canvas;
  const maybeContext = canvas.getContext("2d");

  if (!maybeContext) {
    throw new Error("Unable to create OffscreenCanvas 2D context.");
  }

  context = maybeContext;
  resize(payload);
  running = true;
  lastFrameAt = performance.now();
  requestFrame(tick);
};

const dispose = (): void => {
  running = false;
  cancelFrame();
  context = null;
  canvas = null;
};

scope.onmessage = (event: MessageEvent<WorkerEnvelope>) => {
  const message = event.data;

  try {
    if (message.type === "render:init") {
      init(message.payload as RenderInitPayload);
      scope.postMessage({ id: message.id, type: "render:ready", payload: { ok: true } });
      return;
    }

    if (message.type === "render:resize") {
      resize(message.payload as RenderResizePayload);
      scope.postMessage({ id: message.id, type: "render:resized", payload: { ok: true } });
      return;
    }

    if (message.type === "render:dispose") {
      dispose();
      scope.postMessage({ id: message.id, type: "render:disposed", payload: { ok: true } });
      return;
    }

    if (message.type === "ping") {
      scope.postMessage({ id: message.id, type: "pong", payload: { worker: "render" } });
      return;
    }

    scope.postMessage({
      id: message.id,
      type: "error",
      error: `Unsupported render worker message: ${message.type}`,
    });
  } catch (error) {
    scope.postMessage({
      id: message.id,
      type: "error",
      error: error instanceof Error ? error.message : "Unknown render worker error",
    });
  }
};
