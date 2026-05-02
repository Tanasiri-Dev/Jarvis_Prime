import type {
  AlarmDecodeRequestPayload,
  AlarmDecodeResultPayload,
  CapacityPlanRequestPayload,
  CapacityPlanResultPayload,
  CapacityPlanStatus,
  DurationRequestPayload,
  DurationResultPayload,
  FactoryClockRequestPayload,
  FactoryClockResultPayload,
  TimeUtilityMode,
  TimeUtilityRequestPayload,
  TimeUtilityResultPayload,
  TimezoneConversionItem,
  TimezoneConversionRequestPayload,
  TimezoneConversionResultPayload,
  TimezoneTargetConfig,
  UnitConvertRequestPayload,
  UnitConvertResultPayload,
  WeekShiftRequestPayload,
  WeekShiftResultPayload,
  WeekRangeDay,
  WeekRangeRequestPayload,
  WeekRangeResultPayload,
  WorkerEnvelope,
  WorkerNotification,
  YieldCalculateRequestPayload,
  YieldCalculateResultPayload,
  YieldStatus,
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

function getIsoWeeksInYear(year: number): number {
  return getIsoWeek(new Date(year, 11, 28)).isoWeek;
}

function getIsoWeekStart(isoYear: number, isoWeek: number): Date {
  const fourthOfJanuary = new Date(isoYear, 0, 4);
  const dayOffset = (fourthOfJanuary.getDay() + 6) % 7;
  const firstMonday = new Date(fourthOfJanuary);

  firstMonday.setDate(fourthOfJanuary.getDate() - dayOffset);
  firstMonday.setHours(0, 0, 0, 0);
  firstMonday.setDate(firstMonday.getDate() + (isoWeek - 1) * 7);

  return firstMonday;
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

function calculateWeekRange(payload: WeekRangeRequestPayload): WeekRangeResultPayload {
  const isoYear = Math.trunc(Number(payload.isoYear));
  const isoWeek = Math.trunc(Number(payload.isoWeek));

  if (!Number.isFinite(isoYear) || isoYear < 1900 || isoYear > 9999) {
    throw new Error("Enter a valid ISO year.");
  }

  const weeksInYear = getIsoWeeksInYear(isoYear);

  if (!Number.isFinite(isoWeek) || isoWeek < 1 || isoWeek > weeksInYear) {
    throw new Error(`WorkWeek must be between 1 and ${weeksInYear} for ${isoYear}.`);
  }

  const start = getIsoWeekStart(isoYear, isoWeek);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const days: WeekRangeDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      date: toDateKey(date),
      dayName: dayNames[date.getDay()],
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });

  return {
    isoYear,
    isoWeek,
    isoWeekLabel: `${isoYear}-W${pad(isoWeek)}`,
    startDate: toDateKey(start),
    endDate: toDateKey(end),
    rangeLabel: `${toDateKey(start)} to ${toDateKey(end)}`,
    days,
  };
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

const secondsByTimeUnit: Record<string, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
};

function formatDurationSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) {
    return "--";
  }

  const sign = totalSeconds < 0 ? "-" : "";
  const absoluteSeconds = Math.abs(Math.round(totalSeconds));
  const days = Math.floor(absoluteSeconds / 86400);
  const hours = Math.floor((absoluteSeconds % 86400) / 3600);
  const minutes = Math.floor((absoluteSeconds % 3600) / 60);
  const seconds = absoluteSeconds % 60;

  if (days > 0) {
    return `${sign}${days} d ${hours} hr ${minutes} min`;
  }

  if (hours > 0) {
    return `${sign}${hours} hr ${minutes} min`;
  }

  if (minutes > 0) {
    return `${sign}${minutes} min ${seconds} sec`;
  }

  return `${sign}${seconds} sec`;
}

function parseDurationEntry(entry: string): number {
  const value = entry.trim().toLowerCase();

  if (value.length === 0) {
    throw new Error("Empty duration entry.");
  }

  const colonMatch = value.match(/^(-?\d+):([0-5]?\d)(?::([0-5]?\d))?$/);

  if (colonMatch) {
    const [, hours, minutes, seconds = "0"] = colonMatch;
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  }

  const unitMatches = Array.from(value.matchAll(/(-?\d+(?:\.\d+)?)\s*(d|day|days|h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)/g));

  if (unitMatches.length > 0) {
    return unitMatches.reduce((total, match) => {
      const amount = Number(match[1]);
      const unit = match[2];
      const multiplier = unit.startsWith("d")
        ? 86400
        : unit.startsWith("h")
          ? 3600
          : unit.startsWith("m")
            ? 60
            : 1;

      return total + amount * multiplier;
    }, 0);
  }

  const decimalHours = Number(value);

  if (Number.isFinite(decimalHours)) {
    return decimalHours * 3600;
  }

  throw new Error(`Unable to parse duration entry: ${entry}`);
}

function parseDurationEntries(entries: string): number[] {
  return entries
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(parseDurationEntry);
}

function parseDateOnly(dateValue: string): Date {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Enter a valid date.");
  }

  return date;
}

function countCalendarDays(start: Date, end: Date, inclusive: boolean): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);

  return Math.max(0, diffDays + (inclusive ? 1 : 0));
}

function countBusinessDays(start: Date, end: Date, inclusive: boolean): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  let count = 0;
  const cursor = new Date(startDate);

  if (!inclusive) {
    cursor.setDate(cursor.getDate() + 1);
  }

  while (cursor <= endDate) {
    const day = cursor.getDay();

    if (day !== 0 && day !== 6) {
      count += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function getWeekdayWorkSeconds(start: Date, end: Date): number {
  if (end <= start) {
    return 0;
  }

  let totalSeconds = 0;
  const cursor = new Date(start);

  while (cursor < end) {
    const nextMidnight = new Date(cursor);
    nextMidnight.setHours(24, 0, 0, 0);
    const segmentEnd = nextMidnight < end ? nextMidnight : end;
    const day = cursor.getDay();

    if (day !== 0 && day !== 6) {
      totalSeconds += (segmentEnd.getTime() - cursor.getTime()) / 1000;
    }

    cursor.setTime(segmentEnd.getTime());
  }

  return totalSeconds;
}

function calculateTimeUtility(payload: TimeUtilityRequestPayload): TimeUtilityResultPayload {
  if (payload.mode === "sum-hours") {
    const durations = parseDurationEntries(payload.sumEntries);
    const totalSeconds = durations.reduce((total, seconds) => total + seconds, 0);

    return {
      mode: payload.mode,
      title: "Sum Hours",
      primaryValue: formatDurationSeconds(totalSeconds),
      summary: `${durations.length} entries summed.`,
      metrics: [
        { label: "Total hours", value: formatNumber(totalSeconds / 3600), tone: "good" },
        { label: "Total minutes", value: formatNumber(totalSeconds / 60), tone: "neutral" },
        { label: "Entries", value: formatNumber(durations.length), tone: "neutral" },
      ],
      details: durations.map((seconds, index) => ({
        label: `Entry ${index + 1}`,
        value: formatDurationSeconds(seconds),
      })),
    };
  }

  if (payload.mode === "convert-time") {
    const value = Number(payload.convertValue);
    const fromMultiplier = secondsByTimeUnit[payload.convertFromUnit];
    const toMultiplier = secondsByTimeUnit[payload.convertToUnit];

    if (!Number.isFinite(value) || !fromMultiplier || !toMultiplier) {
      throw new Error("Enter a valid time conversion.");
    }

    const seconds = value * fromMultiplier;
    const converted = seconds / toMultiplier;

    return {
      mode: payload.mode,
      title: "Convert Time",
      primaryValue: `${formatNumber(converted)} ${payload.convertToUnit}`,
      summary: `${formatNumber(value)} ${payload.convertFromUnit} equals ${formatNumber(converted)} ${payload.convertToUnit}.`,
      metrics: [
        { label: "Seconds", value: formatNumber(seconds), tone: "neutral" },
        { label: "Minutes", value: formatNumber(seconds / 60), tone: "neutral" },
        { label: "Hours", value: formatNumber(seconds / 3600), tone: "good" },
      ],
      details: [
        { label: "Input", value: `${formatNumber(value)} ${payload.convertFromUnit}` },
        { label: "Output", value: `${formatNumber(converted)} ${payload.convertToUnit}` },
      ],
    };
  }

  if (payload.mode === "work-hours") {
    const start = new Date(payload.workStartTimestamp);
    const end = new Date(payload.workEndTimestamp);
    const breakSeconds = Math.max(0, Number(payload.workBreakMinutes) * 60);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !Number.isFinite(breakSeconds)) {
      throw new Error("Enter valid start, end, and break values.");
    }

    if (end < start) {
      throw new Error("Work end must be after work start.");
    }

    const grossSeconds = payload.workdaysOnly
      ? getWeekdayWorkSeconds(start, end)
      : (end.getTime() - start.getTime()) / 1000;
    const netSeconds = Math.max(0, grossSeconds - breakSeconds);

    return {
      mode: payload.mode,
      title: "Work Hours",
      primaryValue: formatDurationSeconds(netSeconds),
      summary: payload.workdaysOnly ? "Weekend time excluded." : "Calendar time included.",
      metrics: [
        { label: "Net hours", value: formatNumber(netSeconds / 3600), tone: "good" },
        { label: "Gross hours", value: formatNumber(grossSeconds / 3600), tone: "neutral" },
        { label: "Break", value: formatDurationSeconds(breakSeconds), tone: "neutral" },
      ],
      details: [
        { label: "Start", value: toLocalDateTime(start) },
        { label: "End", value: toLocalDateTime(end) },
        { label: "Mode", value: payload.workdaysOnly ? "Weekdays only" : "Calendar time" },
      ],
    };
  }

  if (payload.mode === "add-subtract") {
    const baseDate = new Date(payload.mathTimestamp);
    const amount = Number(payload.mathAmount);
    const multiplier = secondsByTimeUnit[payload.mathUnit];

    if (Number.isNaN(baseDate.getTime()) || !Number.isFinite(amount) || !multiplier) {
      throw new Error("Enter valid time math values.");
    }

    const signedSeconds = amount * multiplier * (payload.mathOperation === "subtract" ? -1 : 1);
    const resultDate = new Date(baseDate.getTime() + signedSeconds * 1000);

    return {
      mode: payload.mode,
      title: "Add / Subtract Time",
      primaryValue: toLocalDateTime(resultDate),
      summary: `${payload.mathOperation === "subtract" ? "Subtracted" : "Added"} ${formatDurationSeconds(Math.abs(signedSeconds))}.`,
      metrics: [
        { label: "Base", value: toLocalDateTime(baseDate), tone: "neutral" },
        { label: "Delta", value: formatDurationSeconds(signedSeconds), tone: "neutral" },
        { label: "Result", value: toLocalDateTime(resultDate), tone: "good" },
      ],
      details: [
        { label: "Operation", value: payload.mathOperation },
        { label: "Unit", value: payload.mathUnit },
      ],
    };
  }

  if (payload.mode === "count-dates") {
    const start = parseDateOnly(payload.countStartDate);
    const end = parseDateOnly(payload.countEndDate);

    if (end < start) {
      throw new Error("End date must be after start date.");
    }

    const calendarDays = countCalendarDays(start, end, payload.countInclusive);
    const businessDays = countBusinessDays(start, end, payload.countInclusive);
    const weekendDays = Math.max(0, calendarDays - businessDays);

    return {
      mode: payload.mode,
      title: "Count Dates",
      primaryValue: `${calendarDays} days`,
      summary: payload.countInclusive ? "Counting includes both start and end dates." : "Counting excludes the start date.",
      metrics: [
        { label: "Calendar days", value: formatNumber(calendarDays), tone: "good" },
        { label: "Business days", value: formatNumber(businessDays), tone: "neutral" },
        { label: "Weekend days", value: formatNumber(weekendDays), tone: "neutral" },
      ],
      details: [
        { label: "Start", value: toDateKey(start) },
        { label: "End", value: toDateKey(end) },
      ],
    };
  }

  throw new Error("Unsupported time utility mode.");
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

type UnitDefinition = {
  label: string;
  factorToBase?: number;
};

const unitTables: Record<
  Exclude<UnitConvertRequestPayload["category"], "temperature">,
  {
    baseUnit: string;
    units: Record<string, UnitDefinition>;
  }
> = {
  length: {
    baseUnit: "m",
    units: {
      mm: { label: "millimeter", factorToBase: 0.001 },
      cm: { label: "centimeter", factorToBase: 0.01 },
      m: { label: "meter", factorToBase: 1 },
      km: { label: "kilometer", factorToBase: 1000 },
      in: { label: "inch", factorToBase: 0.0254 },
      ft: { label: "foot", factorToBase: 0.3048 },
      mil: { label: "mil", factorToBase: 0.0000254 },
      um: { label: "micrometer", factorToBase: 0.000001 },
    },
  },
  pressure: {
    baseUnit: "Pa",
    units: {
      Pa: { label: "pascal", factorToBase: 1 },
      kPa: { label: "kilopascal", factorToBase: 1000 },
      MPa: { label: "megapascal", factorToBase: 1000000 },
      bar: { label: "bar", factorToBase: 100000 },
      psi: { label: "pound per square inch", factorToBase: 6894.757293168 },
      atm: { label: "standard atmosphere", factorToBase: 101325 },
      torr: { label: "torr", factorToBase: 133.3223684211 },
    },
  },
  vacuum: {
    baseUnit: "Pa",
    units: {
      Pa: { label: "pascal", factorToBase: 1 },
      kPa: { label: "kilopascal", factorToBase: 1000 },
      torr: { label: "torr", factorToBase: 133.3223684211 },
      mTorr: { label: "millitorr", factorToBase: 0.1333223684211 },
      uTorr: { label: "microtorr", factorToBase: 0.0001333223684211 },
      mbar: { label: "millibar", factorToBase: 100 },
    },
  },
  mass: {
    baseUnit: "g",
    units: {
      mg: { label: "milligram", factorToBase: 0.001 },
      g: { label: "gram", factorToBase: 1 },
      kg: { label: "kilogram", factorToBase: 1000 },
      oz: { label: "ounce", factorToBase: 28.349523125 },
      lb: { label: "pound", factorToBase: 453.59237 },
    },
  },
};

const temperatureUnits: Record<string, UnitDefinition> = {
  C: { label: "Celsius" },
  F: { label: "Fahrenheit" },
  K: { label: "Kelvin" },
};

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(value) >= 1000 ? 3 : 6,
    minimumFractionDigits: 0,
  }).format(value);
}

function convertTemperature(value: number, fromUnit: string, toUnit: string): number {
  const celsius =
    fromUnit === "C" ? value : fromUnit === "F" ? ((value - 32) * 5) / 9 : value - 273.15;

  if (toUnit === "C") {
    return celsius;
  }

  if (toUnit === "F") {
    return (celsius * 9) / 5 + 32;
  }

  return celsius + 273.15;
}

function calculateUnitConvert(payload: UnitConvertRequestPayload): UnitConvertResultPayload {
  const inputValue = Number(payload.inputValue);

  if (!Number.isFinite(inputValue)) {
    throw new Error("Enter a valid numeric value.");
  }

  if (payload.category === "temperature") {
    if (!temperatureUnits[payload.fromUnit] || !temperatureUnits[payload.toUnit]) {
      throw new Error("Unsupported temperature unit.");
    }

    const outputValue = convertTemperature(inputValue, payload.fromUnit, payload.toUnit);

    return {
      category: payload.category,
      inputValue,
      inputLabel: `${formatNumber(inputValue)} ${payload.fromUnit}`,
      outputValue,
      outputLabel: `${formatNumber(outputValue)} ${payload.toUnit}`,
      formula: `Convert ${payload.fromUnit} to Celsius, then Celsius to ${payload.toUnit}.`,
      relatedValues: Object.entries(temperatureUnits).map(([unit, definition]) => {
        const value = convertTemperature(inputValue, payload.fromUnit, unit);

        return {
          unit,
          label: definition.label,
          value,
          formattedValue: `${formatNumber(value)} ${unit}`,
        };
      }),
    };
  }

  const table = unitTables[payload.category];

  if (!table?.units[payload.fromUnit] || !table.units[payload.toUnit]) {
    throw new Error("Unsupported unit selection.");
  }

  const baseValue = inputValue * (table.units[payload.fromUnit].factorToBase ?? 1);
  const outputValue = baseValue / (table.units[payload.toUnit].factorToBase ?? 1);

  return {
    category: payload.category,
    inputValue,
    inputLabel: `${formatNumber(inputValue)} ${payload.fromUnit}`,
    outputValue,
    outputLabel: `${formatNumber(outputValue)} ${payload.toUnit}`,
    formula: `${formatNumber(inputValue)} ${payload.fromUnit} -> ${formatNumber(baseValue)} ${table.baseUnit} -> ${payload.toUnit}`,
    relatedValues: Object.entries(table.units).map(([unit, definition]) => {
      const value = baseValue / (definition.factorToBase ?? 1);

      return {
        unit,
        label: definition.label,
        value,
        formattedValue: `${formatNumber(value)} ${unit}`,
      };
    }),
  };
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}%`;
}

function calculateYield(payload: YieldCalculateRequestPayload): YieldCalculateResultPayload {
  const inputQuantity = Number(payload.inputQuantity);
  const goodQuantity = Number(payload.goodQuantity);
  const scrapQuantity = Number(payload.scrapQuantity);
  const runtimeMinutes = Number(payload.runtimeMinutes);
  const targetUph = Number(payload.targetUph);

  const values = [inputQuantity, goodQuantity, scrapQuantity, runtimeMinutes, targetUph];

  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Enter valid numeric values for yield calculation.");
  }

  if (values.some((value) => value < 0)) {
    throw new Error("Yield, scrap, runtime, and target values cannot be negative.");
  }

  const reconciledQuantity = goodQuantity + scrapQuantity;
  const totalQuantity = inputQuantity > 0 ? inputQuantity : reconciledQuantity;
  const varianceQuantity = inputQuantity > 0 ? inputQuantity - reconciledQuantity : 0;
  const runtimeHours = runtimeMinutes / 60;
  const yieldPercent = totalQuantity > 0 ? (goodQuantity / totalQuantity) * 100 : 0;
  const scrapPercent = totalQuantity > 0 ? (scrapQuantity / totalQuantity) * 100 : 0;
  const actualUph = runtimeHours > 0 ? goodQuantity / runtimeHours : 0;
  const totalUph = runtimeHours > 0 ? totalQuantity / runtimeHours : 0;
  const targetGap = targetUph > 0 ? actualUph - targetUph : 0;
  const projectedGoodAtTarget = runtimeHours * targetUph;

  let status: YieldStatus = "info";

  if (targetUph > 0 && runtimeHours > 0) {
    status = actualUph >= targetUph ? "on-target" : actualUph >= targetUph * 0.9 ? "watch" : "risk";
  } else if (totalQuantity > 0) {
    status = yieldPercent >= 98 ? "on-target" : yieldPercent >= 95 ? "watch" : "risk";
  }

  const recommendations: string[] = [];

  if (Math.abs(varianceQuantity) > 0.001) {
    recommendations.push("Reconcile input quantity against good plus scrap before closing the lot.");
  }

  if (scrapPercent >= 5) {
    recommendations.push("Review scrap reason codes and tool alarms because scrap is above 5%.");
  }

  if (targetUph > 0 && runtimeHours > 0 && actualUph < targetUph) {
    recommendations.push("Check downtime, minor stops, and recipe cycle time against the UPH target.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Result is healthy. Keep monitoring trend by product, tool, and shift.");
  }

  const summary =
    status === "on-target"
      ? "Yield and UPH are on target for this run."
      : status === "watch"
        ? "Performance is close to target. Watch trend before the next handover."
        : status === "risk"
          ? "Performance needs attention. Prioritize scrap and throughput checks."
          : "Add runtime and target UPH to unlock throughput status.";

  return {
    totalQuantity,
    goodQuantity,
    scrapQuantity,
    yieldPercent,
    scrapPercent,
    actualUph,
    totalUph,
    targetUph,
    targetGap,
    projectedGoodAtTarget,
    varianceQuantity,
    status,
    summary,
    metrics: [
      {
        label: "Yield",
        value: formatPercent(yieldPercent),
        tone: yieldPercent >= 98 ? "good" : yieldPercent >= 95 ? "warning" : "danger",
      },
      {
        label: "Scrap",
        value: formatPercent(scrapPercent),
        tone: scrapPercent <= 2 ? "good" : scrapPercent <= 5 ? "warning" : "danger",
      },
      {
        label: "Actual UPH",
        value: `${formatNumber(actualUph)} UPH`,
        tone: targetUph <= 0 || actualUph >= targetUph ? "good" : actualUph >= targetUph * 0.9 ? "warning" : "danger",
      },
      {
        label: "Target gap",
        value: targetUph > 0 ? `${targetGap >= 0 ? "+" : ""}${formatNumber(targetGap)} UPH` : "No target",
        tone: targetUph <= 0 ? "neutral" : targetGap >= 0 ? "good" : targetGap >= -targetUph * 0.1 ? "warning" : "danger",
      },
      {
        label: "Total UPH",
        value: `${formatNumber(totalUph)} UPH`,
        tone: "neutral",
      },
      {
        label: "Projected target output",
        value: formatNumber(projectedGoodAtTarget),
        tone: "neutral",
      },
    ],
    recommendedActions: recommendations,
  };
}

function formatHours(value: number): string {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return `${formatNumber(value)} hr`;
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value)) {
    return "--";
  }

  if (value >= 60) {
    return `${formatNumber(value / 60)} min`;
  }

  return `${formatNumber(value)} sec`;
}

function calculateCapacityPlan(payload: CapacityPlanRequestPayload): CapacityPlanResultPayload {
  const demandQuantity = Number(payload.demandQuantity);
  const plannedHours = Number(payload.plannedHours);
  const availableTools = Number(payload.availableTools);
  const operators = Number(payload.operators);
  const targetUphPerTool = Number(payload.targetUphPerTool);
  const efficiencyPercent = Number(payload.efficiencyPercent);
  const downtimeMinutes = Number(payload.downtimeMinutes);
  const values = [
    demandQuantity,
    plannedHours,
    availableTools,
    operators,
    targetUphPerTool,
    efficiencyPercent,
    downtimeMinutes,
  ];

  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Enter valid numeric values for capacity planning.");
  }

  if (values.some((value) => value < 0)) {
    throw new Error("Planning inputs cannot be negative.");
  }

  const staffedTools = Math.max(0, Math.min(Math.floor(availableTools), Math.floor(operators)));
  const netHours = Math.max(0, plannedHours - downtimeMinutes / 60);
  const efficiency = Math.max(0, efficiencyPercent) / 100;
  const perToolCapacity = targetUphPerTool * netHours * efficiency;
  const totalCapacity = staffedTools * perToolCapacity;
  const capacityGap = totalCapacity - demandQuantity;
  const loadPercent = totalCapacity > 0 ? (demandQuantity / totalCapacity) * 100 : 0;
  const requiredTools = perToolCapacity > 0 ? Math.ceil(demandQuantity / perToolCapacity) : 0;
  const hourlyCapacity = staffedTools * targetUphPerTool * efficiency;
  const requiredRunHours = hourlyCapacity > 0 ? demandQuantity / hourlyCapacity : 0;
  const taktSeconds = demandQuantity > 0 && netHours > 0 ? (netHours * 3600) / demandQuantity : 0;

  let status: CapacityPlanStatus = "info";

  if (demandQuantity > 0 && totalCapacity > 0) {
    status = capacityGap >= 0 ? "covered" : totalCapacity >= demandQuantity * 0.95 ? "tight" : "short";
  }

  const recommendations: string[] = [];

  if (availableTools > operators) {
    recommendations.push("Operator coverage limits staffed tools. Add operator support or rebalance assignments.");
  }

  if (capacityGap < 0) {
    recommendations.push("Add tools, overtime, or split demand across another shift to close the capacity gap.");
  }

  if (downtimeMinutes > plannedHours * 60 * 0.15) {
    recommendations.push("Planned downtime is above 15% of the window. Review PM and setup timing.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Plan is covered. Keep monitoring demand changes and downtime risk.");
  }

  const summary =
    status === "covered"
      ? "Capacity covers the demand window."
      : status === "tight"
        ? "Plan is close to demand. Watch staffing and downtime."
        : status === "short"
          ? "Capacity is short. Add hours, tools, or reduce demand."
          : "Add demand, hours, tools, and UPH to calculate the plan.";

  return {
    demandQuantity,
    staffedTools,
    netHours,
    totalCapacity,
    capacityGap,
    loadPercent,
    requiredTools,
    requiredRunHours,
    taktSeconds,
    status,
    summary,
    metrics: [
      {
        label: "Capacity",
        value: formatNumber(totalCapacity),
        tone: capacityGap >= 0 ? "good" : totalCapacity >= demandQuantity * 0.95 ? "warning" : "danger",
      },
      {
        label: "Demand",
        value: formatNumber(demandQuantity),
        tone: "neutral",
      },
      {
        label: "Gap",
        value: `${capacityGap >= 0 ? "+" : ""}${formatNumber(capacityGap)}`,
        tone: capacityGap >= 0 ? "good" : capacityGap >= -demandQuantity * 0.05 ? "warning" : "danger",
      },
      {
        label: "Load",
        value: formatPercent(loadPercent),
        tone: loadPercent <= 90 ? "good" : loadPercent <= 100 ? "warning" : "danger",
      },
      {
        label: "Required tools",
        value: formatNumber(requiredTools),
        tone: requiredTools <= staffedTools ? "good" : requiredTools <= availableTools ? "warning" : "danger",
      },
      {
        label: "Takt",
        value: formatSeconds(taktSeconds),
        tone: "neutral",
      },
      {
        label: "Net window",
        value: formatHours(netHours),
        tone: "neutral",
      },
      {
        label: "Run hours needed",
        value: formatHours(requiredRunHours),
        tone: requiredRunHours <= netHours ? "good" : "danger",
      },
    ],
    recommendedActions: recommendations,
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

    if (message.type === "tool:week-range") {
      const payload = calculateWeekRange(message.payload as WeekRangeRequestPayload);
      scope.postMessage({ id: message.id, type: "tool:week-range:result", payload });
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

    if (message.type === "tool:time-utility") {
      const payload = calculateTimeUtility(message.payload as TimeUtilityRequestPayload);
      scope.postMessage({ id: message.id, type: "tool:time-utility:result", payload });
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

    if (message.type === "tool:unit-convert") {
      const payload = calculateUnitConvert(message.payload as UnitConvertRequestPayload);
      scope.postMessage({ id: message.id, type: "tool:unit-convert:result", payload });
      return;
    }

    if (message.type === "tool:yield-calculate") {
      const payload = calculateYield(message.payload as YieldCalculateRequestPayload);
      scope.postMessage({ id: message.id, type: "tool:yield-calculate:result", payload });
      return;
    }

    if (message.type === "tool:capacity-plan") {
      const payload = calculateCapacityPlan(message.payload as CapacityPlanRequestPayload);
      scope.postMessage({ id: message.id, type: "tool:capacity-plan:result", payload });
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
