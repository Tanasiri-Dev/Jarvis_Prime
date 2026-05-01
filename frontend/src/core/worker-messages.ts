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

export interface FactoryClockRequestPayload {
  timestamp: string;
  dayShiftStartHour: number;
  shiftLengthHours: number;
}

export interface FactoryClockResultPayload {
  localDate: string;
  localTime: string;
  utcTime: string;
  timezone: string;
  shiftName: string;
  nextShiftName: string;
  nextShiftChange: string;
  remainingLabel: string;
}

export interface DurationRequestPayload {
  startTimestamp: string;
  endTimestamp: string;
  breakMinutes: number;
}

export interface DurationResultPayload {
  grossMs: number;
  breakMs: number;
  netMs: number;
  grossLabel: string;
  breakLabel: string;
  netLabel: string;
  startLabel: string;
  endLabel: string;
  crossesMidnight: boolean;
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
