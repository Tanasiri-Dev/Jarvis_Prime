import type {
  RenderInitPayload,
  RenderResizePayload,
  RenderStatsPayload,
  RenderStatusDisposePayload,
  RenderStatusInitPayload,
  RenderStatusName,
  RenderStatusUpdatePayload,
  RenderThemePayload,
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

type RenderThemeName = RenderThemePayload["theme"];

type RenderPalette = {
  background: string;
  backgroundAccent?: string;
  grid: string;
  track: string;
  accentStart: string;
  accentMiddle: string;
  accentEnd: string;
  text: string;
  muted: string;
  badgeBackground: string;
  badgeBorder: string;
  badgeText: string;
};

const renderPalettes: Record<RenderThemeName, RenderPalette> = {
  dark: {
    background: "#101722",
    grid: "rgba(148, 163, 184, 0.13)",
    track: "rgba(71, 85, 105, 0.7)",
    accentStart: "#7dd3fc",
    accentMiddle: "#86efac",
    accentEnd: "#facc15",
    text: "#e2e8f0",
    muted: "#94a3b8",
    badgeBackground: "rgba(134, 239, 172, 0.15)",
    badgeBorder: "rgba(134, 239, 172, 0.35)",
    badgeText: "#bbf7d0",
  },
  white: {
    background: "#f8fbff",
    grid: "rgba(71, 85, 105, 0.12)",
    track: "rgba(148, 163, 184, 0.56)",
    accentStart: "#0284c7",
    accentMiddle: "#059669",
    accentEnd: "#ca8a04",
    text: "#0f172a",
    muted: "#475569",
    badgeBackground: "rgba(5, 150, 105, 0.11)",
    badgeBorder: "rgba(5, 150, 105, 0.28)",
    badgeText: "#047857",
  },
  gradient: {
    background: "#0d1420",
    backgroundAccent: "#18263a",
    grid: "rgba(203, 213, 225, 0.12)",
    track: "rgba(100, 116, 139, 0.68)",
    accentStart: "#38bdf8",
    accentMiddle: "#34d399",
    accentEnd: "#f59e0b",
    text: "#f8fafc",
    muted: "#b8c4d8",
    badgeBackground: "rgba(45, 212, 191, 0.14)",
    badgeBorder: "rgba(45, 212, 191, 0.34)",
    badgeText: "#ccfbf1",
  },
};

let activeTheme: RenderThemeName = "dark";

type StatusCanvasState = {
  canvas: OffscreenCanvas;
  context: OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  status: RenderStatusName;
};

const statusCanvases = new Map<string, StatusCanvasState>();

const statusPalettes: Record<RenderStatusName, { fill: string; glow: string; symbol: string }> = {
  idle: { fill: "#94a3b8", glow: "rgba(148, 163, 184, 0.38)", symbol: "" },
  running: { fill: "#38bdf8", glow: "rgba(56, 189, 248, 0.58)", symbol: "" },
  ready: { fill: "#22c55e", glow: "rgba(34, 197, 94, 0.58)", symbol: "✓" },
  online: { fill: "#22c55e", glow: "rgba(34, 197, 94, 0.58)", symbol: "✓" },
  error: { fill: "#fb7185", glow: "rgba(251, 113, 133, 0.56)", symbol: "!" },
};

const drawStatusCanvas = (state: StatusCanvasState): void => {
  const { context: ctx } = state;
  const palette = statusPalettes[state.status] ?? statusPalettes.idle;
  const centerX = state.width / 2;
  const centerY = state.height / 2;
  const radius = Math.max(3, Math.min(state.width, state.height) * 0.26);

  ctx.clearRect(0, 0, state.width, state.height);

  const glow = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, radius * 2.2);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.fill;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  if (palette.symbol) {
    ctx.fillStyle = "#06101c";
    ctx.font = `900 ${Math.max(8, radius * 2.1)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(palette.symbol, centerX, centerY + 0.5);
  }
};

const initStatusCanvas = (payload: RenderStatusInitPayload): void => {
  const maybeContext = payload.canvas.getContext("2d");

  if (!maybeContext) {
    throw new Error("Unable to create status OffscreenCanvas 2D context.");
  }

  const dpr = Math.max(1, payload.devicePixelRatio || 1);
  const width = Math.max(1, payload.width);
  const height = Math.max(1, payload.height);

  payload.canvas.width = Math.floor(width * dpr);
  payload.canvas.height = Math.floor(height * dpr);
  maybeContext.setTransform(dpr, 0, 0, dpr, 0, 0);

  const state = {
    canvas: payload.canvas,
    context: maybeContext,
    width,
    height,
    status: payload.status,
  };

  statusCanvases.set(payload.id, state);
  drawStatusCanvas(state);
};

const updateStatusCanvas = (payload: RenderStatusUpdatePayload): void => {
  const state = statusCanvases.get(payload.id);

  if (!state) {
    return;
  }

  state.status = payload.status;
  drawStatusCanvas(state);
};

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

  const palette = renderPalettes[activeTheme];
  const centerX = width * 0.5;
  const centerY = height * 0.52;
  const radius = Math.max(72, Math.min(width, height) * 0.28);
  const pulse = (Math.sin(phase) + 1) * 0.5;
  const progress = 0.64 + pulse * 0.22;

  context.clearRect(0, 0, width, height);
  if (palette.backgroundAccent) {
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, palette.background);
    background.addColorStop(0.52, palette.backgroundAccent);
    background.addColorStop(1, palette.background);
    context.fillStyle = background;
  } else {
    context.fillStyle = palette.background;
  }
  context.fillRect(0, 0, width, height);

  context.strokeStyle = palette.grid;
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
  context.strokeStyle = palette.track;
  context.beginPath();
  context.arc(centerX, centerY, radius, Math.PI * 0.78, Math.PI * 2.22);
  context.stroke();

  const gradient = context.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
  gradient.addColorStop(0, palette.accentStart);
  gradient.addColorStop(0.55, palette.accentMiddle);
  gradient.addColorStop(1, palette.accentEnd);

  context.strokeStyle = gradient;
  context.beginPath();
  context.arc(centerX, centerY, radius, Math.PI * 0.78, Math.PI * (0.78 + progress * 1.44));
  context.stroke();

  context.fillStyle = palette.text;
  context.font = "700 34px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("Worker FBO", centerX, centerY - 4);

  context.fillStyle = palette.muted;
  context.font = "500 14px Inter, system-ui, sans-serif";
  context.fillText("OffscreenCanvas render loop", centerX, centerY + 34);

  context.fillStyle = palette.badgeBackground;
  context.fillRect(24, 24, 138, 34);
  context.strokeStyle = palette.badgeBorder;
  context.lineWidth = 1;
  context.strokeRect(24.5, 24.5, 137, 33);
  context.fillStyle = palette.badgeText;
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

    if (message.type === "render:set-theme") {
      activeTheme = (message.payload as RenderThemePayload).theme;
      draw(performance.now());
      scope.postMessage({ id: message.id, type: "render:theme-set", payload: { ok: true } });
      return;
    }

    if (message.type === "status:init") {
      initStatusCanvas(message.payload as RenderStatusInitPayload);
      scope.postMessage({ id: message.id, type: "status:ready", payload: { ok: true } });
      return;
    }

    if (message.type === "status:update") {
      updateStatusCanvas(message.payload as RenderStatusUpdatePayload);
      scope.postMessage({ id: message.id, type: "status:updated", payload: { ok: true } });
      return;
    }

    if (message.type === "status:dispose") {
      const payload = message.payload as RenderStatusDisposePayload;
      statusCanvases.delete(payload.id);
      scope.postMessage({ id: message.id, type: "status:disposed", payload: { ok: true } });
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
