export type WorkerName = "compute" | "ingest" | "render";

export interface WorkerEnvelope<TPayload = unknown> {
  id: string;
  type: string;
  payload?: TPayload;
}

export interface WorkerNotification<TPayload = unknown> {
  id?: string;
  type: string;
  payload?: TPayload;
  error?: string;
}

export interface RenderInitPayload {
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface RenderResizePayload {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface RenderStatsPayload {
  fps: number;
  frameMs: number;
  width: number;
  height: number;
}
