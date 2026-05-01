import type {
  WeekShiftRequestPayload,
  WeekShiftResultPayload,
  WorkerEnvelope,
  WorkerNotification,
} from "../core/worker-messages";

const scope = self as unknown as {
  postMessage(message: WorkerNotification): void;
  onmessage: ((event: MessageEvent<WorkerEnvelope>) => void) | null;
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (value: number): string => String(value).padStart(2, "0");

const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const toLocalDateTime = (date: Date): string =>
  `${toDateKey(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

function getIsoWeek(date: Date): { isoWeek: number; isoYear: number } {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);

  const isoYear = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return { isoWeek, isoYear };
}

function normalizeHour(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(23, Math.max(0, Math.trunc(value)));
}

function normalizeLength(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(24, Math.max(1, Math.trunc(value)));
}

function calculateWeekShift(payload: WeekShiftRequestPayload): WeekShiftResultPayload {
  const timestamp = new Date(payload.timestamp);

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("Invalid date/time input.");
  }

  const dayShiftStartHour = normalizeHour(payload.dayShiftStartHour, 8);
  const shiftLengthHours = normalizeLength(payload.shiftLengthHours, 12);
  const dayShiftStart = new Date(timestamp);
  dayShiftStart.setHours(dayShiftStartHour, 0, 0, 0);

  const nightShiftStart = new Date(dayShiftStart);
  nightShiftStart.setHours(dayShiftStart.getHours() + shiftLengthHours);

  let shiftName = "Day";
  let shiftStart = new Date(dayShiftStart);
  let shiftDate = new Date(dayShiftStart);

  if (timestamp < dayShiftStart) {
    shiftName = "Night";
    shiftStart = new Date(dayShiftStart);
    shiftStart.setHours(shiftStart.getHours() - shiftLengthHours);
    shiftDate = new Date(shiftStart);
  } else if (timestamp >= nightShiftStart) {
    shiftName = "Night";
    shiftStart = new Date(nightShiftStart);
    shiftDate = new Date(dayShiftStart);
  }

  const shiftEnd = new Date(shiftStart);
  shiftEnd.setHours(shiftEnd.getHours() + shiftLengthHours);

  const { isoWeek, isoYear } = getIsoWeek(timestamp);

  return {
    isoWeek,
    isoWeekLabel: `${isoYear}-W${pad(isoWeek)}`,
    isoYear,
    dayName: dayNames[timestamp.getDay()],
    shiftName,
    shiftDate: toDateKey(shiftDate),
    shiftStart: toLocalDateTime(shiftStart),
    shiftEnd: toLocalDateTime(shiftEnd),
  };
}

scope.onmessage = (event: MessageEvent<WorkerEnvelope>) => {
  const message = event.data;

  try {
    if (message.type === "ping") {
      scope.postMessage({ id: message.id, type: "pong", payload: { worker: "compute" } });
      return;
    }

    if (message.type === "tool:week-shift") {
      const payload = calculateWeekShift(message.payload as WeekShiftRequestPayload);
      scope.postMessage({ id: message.id, type: "tool:week-shift:result", payload });
      return;
    }

    scope.postMessage({
      id: message.id,
      type: "error",
      error: `Unsupported compute worker message: ${message.type}`,
    });
  } catch (error) {
    scope.postMessage({
      id: message.id,
      type: "error",
      error: error instanceof Error ? error.message : "Unknown compute worker error",
    });
  }
};
