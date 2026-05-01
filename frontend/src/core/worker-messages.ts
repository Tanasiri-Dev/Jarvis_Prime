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

export interface WeekShiftRequestPayload {
  timestamp: string;
  dayShiftStartHour: number;
  shiftLengthHours: number;
}

export interface WeekShiftResultPayload {
  isoWeek: number;
  isoWeekLabel: string;
  isoYear: number;
  dayName: string;
  shiftName: string;
  shiftDate: string;
  shiftStart: string;
  shiftEnd: string;
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

export interface RenderThemePayload {
  theme: "dark" | "white" | "gradient";
}

export interface RenderStatsPayload {
  fps: number;
  frameMs: number;
  width: number;
  height: number;
}
