import type {
  AlarmDecodeRequestPayload,
  AlarmDecodeResultPayload,
  DurationRequestPayload,
  DurationResultPayload,
  FactoryClockRequestPayload,
  FactoryClockResultPayload,
  TimezoneConversionItem,
  TimezoneConversionRequestPayload,
  TimezoneConversionResultPayload,
  TimezoneTargetConfig,
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

const toTime = (date: Date): string =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const toUtcTime = (date: Date): string =>
  `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;

const toDurationLabel = (milliseconds: number): string => {
  const totalMinutes = Math.max(0, Math.round(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  return `${hours} hr ${minutes} min`;
};

const getTimezoneParts = (date: Date, timezone: string): Record<string, string> => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
    timeZoneName: "shortOffset",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

const getTimezoneOffsetMs = (date: Date, timezone: string): number => {
  const parts = getTimezoneParts(date, timezone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return asUtc - date.getTime();
};

function parseZonedLocalTimestamp(localTimestamp: string, timezone: string): Date {
  const match = localTimestamp.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (!match) {
    throw new Error("Invalid source date/time input.");
  }

  const [, year, month, day, hour, minute, second = "00"] = match;
  const utcGuess = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );
  const offset = getTimezoneOffsetMs(utcGuess, timezone);
  const firstPass = new Date(utcGuess.getTime() - offset);
  const correctedOffset = getTimezoneOffsetMs(firstPass, timezone);

  return new Date(utcGuess.getTime() - correctedOffset);
}

const getTimezoneDateKey = (date: Date, timezone: string): string => {
  const parts = getTimezoneParts(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getDayRelation = (
  sourceDate: Date,
  sourceTimezone: string,
  targetTimezone: string,
): TimezoneConversionItem["dayRelation"] => {
  const sourceKey = getTimezoneDateKey(sourceDate, sourceTimezone);
  const targetKey = getTimezoneDateKey(sourceDate, targetTimezone);

  if (targetKey < sourceKey) {
    return "previous";
  }

  if (targetKey > sourceKey) {
    return "next";
  }

  return "same";
};

const timezoneCityLabels: Record<string, string> = {
  "America/New_York": "Durham NC",
  "Asia/Shanghai": "China",
  "Europe/Rome": "Italy",
};

const getCityLabel = (timezone: string): string =>
  timezoneCityLabels[timezone] ??
  timezone
    .split("/")
    .at(-1)
    ?.replaceAll("_", " ") ??
  timezone;

function formatTimezoneItem(
  date: Date,
  target: TimezoneTargetConfig,
  sourceTimezone: string,
): TimezoneConversionItem {
  const { label, timezone } = target;
  const parts = getTimezoneParts(date, timezone);

  return {
    timezone,
    cityLabel: label || getCityLabel(timezone),
    dateLabel: `${parts.year}-${parts.month}-${parts.day}`,
    timeLabel: `${parts.hour}:${parts.minute}:${parts.second}`,
    weekdayLabel: parts.weekday,
    offsetLabel: parts.timeZoneName,
    dayRelation: getDayRelation(date, sourceTimezone, timezone),
  };
}

type ShiftDetails = WeekShiftResultPayload & {
  shiftEndDate: Date;
};

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

function calculateWeekShiftDetails(payload: WeekShiftRequestPayload): ShiftDetails {
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
    shiftEndDate: shiftEnd,
  };
}

function calculateWeekShift(payload: WeekShiftRequestPayload): WeekShiftResultPayload {
  const { shiftEndDate: _shiftEndDate, ...result } = calculateWeekShiftDetails(payload);
  return result;
}

function formatRemaining(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  return `${hours} hr ${minutes} min`;
}

function calculateFactoryClock(payload: FactoryClockRequestPayload): FactoryClockResultPayload {
  const timestamp = new Date(payload.timestamp);

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("Invalid clock timestamp.");
  }

  const shift = calculateWeekShiftDetails(payload);
  const nextShiftName = shift.shiftName === "Day" ? "Night" : "Day";

  return {
    localDate: toDateKey(timestamp),
    localTime: toTime(timestamp),
    utcTime: toUtcTime(timestamp),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    shiftName: shift.shiftName,
    nextShiftName,
    nextShiftChange: toLocalDateTime(shift.shiftEndDate),
    remainingLabel: formatRemaining(shift.shiftEndDate.getTime() - timestamp.getTime()),
  };
}

function calculateDuration(payload: DurationRequestPayload): DurationResultPayload {
  const start = new Date(payload.startTimestamp);
  const end = new Date(payload.endTimestamp);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid start or end date/time input.");
  }

  const breakMinutes = Number.isFinite(payload.breakMinutes)
    ? Math.max(0, Math.trunc(payload.breakMinutes))
    : 0;
  const grossMs = Math.max(0, end.getTime() - start.getTime());
  const breakMs = Math.min(grossMs, breakMinutes * 60000);
  const netMs = Math.max(0, grossMs - breakMs);

  return {
    grossMs,
    breakMs,
    netMs,
    grossLabel: toDurationLabel(grossMs),
    breakLabel: toDurationLabel(breakMs),
    netLabel: toDurationLabel(netMs),
    startLabel: toLocalDateTime(start),
    endLabel: toLocalDateTime(end),
    crossesMidnight: start.toDateString() !== end.toDateString(),
  };
}

function calculateTimezoneConversion(
  payload: TimezoneConversionRequestPayload,
): TimezoneConversionResultPayload {
  const timestamp = parseZonedLocalTimestamp(payload.localTimestamp, payload.sourceTimezone);

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("Invalid source date/time input.");
  }

  const source = formatTimezoneItem(
    timestamp,
    {
      timezone: payload.sourceTimezone,
      label: payload.sourceLabel,
    },
    payload.sourceTimezone,
  );
  const utc = formatTimezoneItem(
    timestamp,
    { timezone: "UTC", label: "UTC" },
    payload.sourceTimezone,
  );
  const targets = payload.targetTimezones.map((target) =>
    formatTimezoneItem(timestamp, target, payload.sourceTimezone),
  );

  return { source, utc, targets };
}

const secsAlarmCategories: Record<number, string> = {
  0: "Not classified",
  1: "Personal safety",
  2: "Equipment safety",
  3: "Parameter control warning",
  4: "Parameter control error",
  5: "Irrecoverable error",
  6: "Equipment status warning",
  7: "Attention flag",
};

function decodeAlarmCode(rawCode: string): number | null {
  const normalized = rawCode.trim().replaceAll("_", "");

  if (/^0x[\da-f]+$/i.test(normalized)) {
    return Number.parseInt(normalized.slice(2), 16);
  }

  if (/^0b[01]+$/i.test(normalized)) {
    return Number.parseInt(normalized.slice(2), 2);
  }

  if (/^[01]{8}$/.test(normalized)) {
    return Number.parseInt(normalized, 2);
  }

  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  return null;
}

function extractAlarmValue(rawAlarm: string, keys: string[]): string {
  const keyPattern = keys.join("|");
  const quotedMatch = rawAlarm.match(
    new RegExp(`(?:${keyPattern})\\s*[:=]\\s*["']([^"']+)["']`, "i"),
  );

  if (quotedMatch) {
    return quotedMatch[1].trim();
  }

  const plainMatch = rawAlarm.match(new RegExp(`(?:${keyPattern})\\s*[:=]\\s*([^,;\\n\\r]+)`, "i"));
  return plainMatch?.[1]?.trim() ?? "";
}

function getAlarmSeverity(categoryCode: number | null): AlarmDecodeResultPayload["severity"] {
  if (categoryCode === null) {
    return "unknown";
  }

  if ([1, 2, 5].includes(categoryCode)) {
    return "critical";
  }

  if (categoryCode === 4) {
    return "major";
  }

  if ([3, 6, 7].includes(categoryCode)) {
    return "warning";
  }

  return "info";
}

function getAlarmActions(
  state: AlarmDecodeResultPayload["state"],
  severity: AlarmDecodeResultPayload["severity"],
): string[] {
  if (state === "clear") {
    return [
      "Confirm the clear event matches the original alarm ID.",
      "Review recent process or tool-state changes before releasing the lot.",
      "Record recovery notes if production was interrupted.",
    ];
  }

  if (severity === "critical") {
    return [
      "Stop remote or automated action until the tool owner confirms safe state.",
      "Check interlocks, safety chain, chamber state, and operator notification.",
      "Escalate to equipment engineering and attach the raw alarm payload.",
    ];
  }

  if (severity === "major") {
    return [
      "Hold affected lot or recipe step until parameter recovery is verified.",
      "Compare alarm timestamp with recent recipe, maintenance, and sensor changes.",
      "Capture ALID, ALTX, module, and current tool state for troubleshooting.",
    ];
  }

  return [
    "Verify whether the alarm repeats or clears after the next tool state transition.",
    "Check related SVID trends and recent operator actions.",
    "Add context notes before handover if the condition remains active.",
  ];
}

function calculateAlarmDecode(payload: AlarmDecodeRequestPayload): AlarmDecodeResultPayload {
  const rawAlarm = payload.rawAlarm.trim();

  if (rawAlarm.length === 0) {
    throw new Error("Paste an alarm message or enter ALCD / ALID values.");
  }

  const alarmCode =
    extractAlarmValue(rawAlarm, ["ALCD", "alarmCode", "code"]) ||
    rawAlarm.match(/\b(?:0x[\da-f]+|0b[01]+|[01]{8})\b/i)?.[0] ||
    "";
  const alarmId = extractAlarmValue(rawAlarm, ["ALID", "alarmId", "id"]) || "--";
  const alarmText = extractAlarmValue(rawAlarm, ["ALTX", "alarmText", "text", "message"]) || rawAlarm;
  const decodedCode = alarmCode ? decodeAlarmCode(alarmCode) : null;
  const normalizedCode = decodedCode === null ? "--" : `0x${decodedCode.toString(16).toUpperCase().padStart(2, "0")}`;
  const state = decodedCode === null ? "unknown" : decodedCode >= 128 ? "set" : "clear";
  const categoryCode = decodedCode === null ? null : decodedCode & 0x7f;
  const categoryLabel =
    categoryCode === null
      ? "Unable to decode category"
      : secsAlarmCategories[categoryCode] ?? "Vendor-specific alarm category";
  const severity = getAlarmSeverity(categoryCode);
  const protocol = /\bS5F1\b/i.test(rawAlarm) ? "SECS/GEM S5F1" : "SECS/GEM alarm";
  const stateLabel = state === "set" ? "active" : state === "clear" ? "cleared" : "unknown";
  const summary = `${protocol} ${stateLabel}: ${categoryLabel}${alarmId !== "--" ? `, ALID ${alarmId}` : ""}.`;

  return {
    protocol,
    alarmCode: normalizedCode,
    alarmId,
    alarmText,
    state,
    categoryCode,
    categoryLabel,
    severity,
    summary,
    recommendedActions: getAlarmActions(state, severity),
    parsedFields: [
      { label: "Protocol", value: protocol },
      { label: "ALCD", value: normalizedCode },
      { label: "ALID", value: alarmId },
      { label: "ALTX", value: alarmText },
    ],
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

    if (message.type === "tool:factory-clock") {
      const payload = calculateFactoryClock(message.payload as FactoryClockRequestPayload);
      scope.postMessage({ id: message.id, type: "tool:factory-clock:result", payload });
      return;
    }

    if (message.type === "tool:duration") {
      const payload = calculateDuration(message.payload as DurationRequestPayload);
      scope.postMessage({ id: message.id, type: "tool:duration:result", payload });
      return;
    }

    if (message.type === "tool:timezone") {
      const payload = calculateTimezoneConversion(
        message.payload as TimezoneConversionRequestPayload,
      );
      scope.postMessage({ id: message.id, type: "tool:timezone:result", payload });
      return;
    }

    if (message.type === "tool:alarm-decode") {
      const payload = calculateAlarmDecode(message.payload as AlarmDecodeRequestPayload);
      scope.postMessage({ id: message.id, type: "tool:alarm-decode:result", payload });
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
