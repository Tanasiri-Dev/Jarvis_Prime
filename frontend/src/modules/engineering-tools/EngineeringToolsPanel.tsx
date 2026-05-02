import { useEffect, useMemo, useRef, useState } from "react";

import type {
  AlarmDecodeResultPayload,
  CapacityPlanResultPayload,
  DurationResultPayload,
  FactoryClockResultPayload,
  RenderStatusName,
  TimezoneConversionResultPayload,
  TimezoneTargetConfig,
  UnitConverterCategory,
  UnitConvertResultPayload,
  WeekShiftRequestPayload,
  WeekShiftResultPayload,
  YieldCalculateResultPayload,
} from "../../core/worker-messages";
import type { WorkerHost } from "../../core/worker-host";

type EngineeringToolsPanelProps = {
  workerHost: WorkerHost;
};

type ToolStatus = "idle" | "running" | "ready" | "error";
type ToolAudience = "engineer" | "planner" | "operator";
type ToolFilter = "all" | ToolAudience;

type ToolOption = {
  id: ActiveTool;
  label: string;
  category: string;
  audiences: ToolAudience[];
};

type StopwatchLap = {
  id: number;
  lapNumber: number;
  lapMs: number;
  totalMs: number;
  timestamp: string;
};

type OnlineAlarm = {
  id: number;
  hour: string;
  minute: string;
  label: string;
  sound: string;
  enabled: boolean;
  lastTriggeredKey: string | null;
};

type CalendarDay = {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
};

type CalendarWeek = {
  weekNumber: number;
  days: CalendarDay[];
};

type ActiveTool =
  | "workweek"
  | "duration"
  | "timezone"
  | "factory-clock"
  | "stopwatch"
  | "alarm-decoder"
  | "unit-converter"
  | "yield-calculator"
  | "capacity-planner"
  | "online-alarm"
  | "countdown-timer";

type StopwatchActionVariant = "start" | "stop" | "lap" | "reset" | "export";

const toolOptions: ToolOption[] = [
  { id: "workweek", label: "WorkWeek", category: "Week", audiences: ["engineer", "planner", "operator"] },
  { id: "duration", label: "Duration Calculator", category: "Day", audiences: ["engineer", "planner"] },
  { id: "factory-clock", label: "Factory Clock", category: "Time", audiences: ["engineer", "planner", "operator"] },
  { id: "timezone", label: "Timezone Converter", category: "Time", audiences: ["engineer", "planner"] },
  { id: "stopwatch", label: "Stopwatch", category: "Time", audiences: ["engineer", "operator"] },
  { id: "online-alarm", label: "Online Alarm", category: "Time", audiences: ["engineer", "planner", "operator"] },
  { id: "countdown-timer", label: "Countdown Timer", category: "Time", audiences: ["engineer", "operator"] },
  { id: "unit-converter", label: "Unit Converter", category: "Unit Convert", audiences: ["engineer"] },
  { id: "yield-calculator", label: "Yield / Scrap / UPH", category: "Manufacturing", audiences: ["engineer", "planner"] },
  { id: "capacity-planner", label: "Capacity / Takt Planner", category: "Manufacturing", audiences: ["planner", "engineer"] },
  { id: "alarm-decoder", label: "Alarm Decoder", category: "Decoder", audiences: ["engineer", "operator"] },
];

const toolCategoryOrder = ["Week", "Day", "Time", "Unit Convert", "Manufacturing", "Decoder"];

const toolFilterOptions: Array<{ id: ToolFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "engineer", label: "Engineer" },
  { id: "planner", label: "Planner" },
  { id: "operator", label: "Operator" },
];

const alarmSoundOptions = [
  { id: "clean", label: "Clean pulse", frequency: 880 },
  { id: "bright", label: "Bright chime", frequency: 1174 },
  { id: "deep", label: "Deep alert", frequency: 440 },
];

const unitCatalog: Record<
  UnitConverterCategory,
  {
    label: string;
    units: Array<{ id: string; label: string }>;
  }
> = {
  length: {
    label: "Length",
    units: [
      { id: "mm", label: "millimeter" },
      { id: "cm", label: "centimeter" },
      { id: "m", label: "meter" },
      { id: "km", label: "kilometer" },
      { id: "in", label: "inch" },
      { id: "ft", label: "foot" },
      { id: "mil", label: "mil" },
      { id: "um", label: "micrometer" },
    ],
  },
  temperature: {
    label: "Temperature",
    units: [
      { id: "C", label: "Celsius" },
      { id: "F", label: "Fahrenheit" },
      { id: "K", label: "Kelvin" },
    ],
  },
  pressure: {
    label: "Pressure",
    units: [
      { id: "Pa", label: "pascal" },
      { id: "kPa", label: "kilopascal" },
      { id: "MPa", label: "megapascal" },
      { id: "bar", label: "bar" },
      { id: "psi", label: "psi" },
      { id: "atm", label: "atmosphere" },
      { id: "torr", label: "torr" },
    ],
  },
  vacuum: {
    label: "Vacuum",
    units: [
      { id: "Pa", label: "pascal" },
      { id: "kPa", label: "kilopascal" },
      { id: "torr", label: "torr" },
      { id: "mTorr", label: "millitorr" },
      { id: "uTorr", label: "microtorr" },
      { id: "mbar", label: "millibar" },
    ],
  },
  mass: {
    label: "Mass",
    units: [
      { id: "mg", label: "milligram" },
      { id: "g", label: "gram" },
      { id: "kg", label: "kilogram" },
      { id: "oz", label: "ounce" },
      { id: "lb", label: "pound" },
    ],
  },
};

type TimezoneConfig = {
  sourceTimezones: TimezoneTargetConfig[];
  targetTimezones: TimezoneTargetConfig[];
};

type RawTimezoneConfigItem = {
  timezone?: unknown;
  label?: unknown;
};

type RawTimezoneConfig = {
  sourceTimezones?: unknown;
  targetTimezones?: unknown;
};

const fallbackTimezoneConfig: TimezoneConfig = {
  sourceTimezones: [
    { timezone: "Asia/Bangkok", label: "Thailand" },
    { timezone: "UTC", label: "UTC" },
    { timezone: "America/Los_Angeles", label: "Los Angeles" },
    { timezone: "America/New_York", label: "Durham NC" },
    { timezone: "Asia/Shanghai", label: "China" },
    { timezone: "Europe/Rome", label: "Italy" },
    { timezone: "Asia/Tokyo", label: "Tokyo" },
    { timezone: "Asia/Singapore", label: "Singapore" },
  ],
  targetTimezones: [
    { timezone: "Asia/Bangkok", label: "Thailand" },
    { timezone: "America/Los_Angeles", label: "Los Angeles" },
    { timezone: "America/New_York", label: "Durham NC" },
    { timezone: "Asia/Shanghai", label: "China" },
    { timezone: "Europe/Rome", label: "Italy" },
    { timezone: "Asia/Tokyo", label: "Tokyo" },
  ],
};

const timezoneStorageKey = "jarvis-prime.timezones";

function normalizeTimezoneItem(item: RawTimezoneConfigItem): TimezoneTargetConfig | null {
  if (typeof item.timezone !== "string" || item.timezone.trim().length === 0) {
    return null;
  }

  const timezone = item.timezone.trim();
  const fallbackLabel = timezone.split("/").at(-1)?.replaceAll("_", " ") ?? timezone;
  const label = typeof item.label === "string" && item.label.trim().length > 0
    ? item.label.trim()
    : fallbackLabel;
  return { timezone, label };
}

function normalizeTimezoneItems(items: unknown): TimezoneTargetConfig[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => normalizeTimezoneItem(item as RawTimezoneConfigItem))
    .filter((item): item is TimezoneTargetConfig => item !== null);
}

function mergeTimezoneItems(
  primary: TimezoneTargetConfig[],
  secondary: TimezoneTargetConfig[],
): TimezoneTargetConfig[] {
  const itemsByTimezone = new Map<string, TimezoneTargetConfig>();

  [...primary, ...secondary].forEach((item) => {
    itemsByTimezone.set(item.timezone, item);
  });

  return Array.from(itemsByTimezone.values());
}

function normalizeTimezoneConfig(raw: RawTimezoneConfig): TimezoneConfig {
  const sourceTimezones = normalizeTimezoneItems(raw.sourceTimezones);
  const targetTimezones = normalizeTimezoneItems(raw.targetTimezones);

  return {
    sourceTimezones: sourceTimezones.length > 0
      ? sourceTimezones
      : fallbackTimezoneConfig.sourceTimezones,
    targetTimezones: targetTimezones.length > 0
      ? targetTimezones
      : fallbackTimezoneConfig.targetTimezones,
  };
}

function readStoredTimezoneItems(): TimezoneTargetConfig[] {
  try {
    const storedValue = window.localStorage.getItem(timezoneStorageKey);
    return normalizeTimezoneItems(storedValue ? JSON.parse(storedValue) : []);
  } catch {
    return [];
  }
}

class StopwatchActionButtonModel {
  readonly label: string;
  readonly variant: StopwatchActionVariant;
  readonly ariaLabel: string;

  constructor(label: string, variant: StopwatchActionVariant, ariaLabel = label) {
    this.label = label;
    this.variant = variant;
    this.ariaLabel = ariaLabel;
  }

  get className(): string {
    return `round-action round-action-${this.variant}`;
  }
}

type RoundActionButtonProps = {
  disabled?: boolean;
  model: StopwatchActionButtonModel;
  onClick: () => void;
};

type StatusChipProps = {
  label?: string;
  status: RenderStatusName;
  workerHost: WorkerHost;
};

function RoundActionButton({ disabled = false, model, onClick }: RoundActionButtonProps) {
  return (
    <button
      aria-label={model.ariaLabel}
      className={model.className}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <span>{model.label}</span>
    </button>
  );
}

function StatusChip({ label, status, workerHost }: StatusChipProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const idRef = useRef(`status-${crypto.randomUUID()}`);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const displayLabel = label ?? status;

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !("transferControlToOffscreen" in canvas)) {
      return;
    }

    const offscreen = canvas.transferControlToOffscreen();
    let isCurrent = true;

    void workerHost
      .post(
        "render",
        "status:init",
        {
          id: idRef.current,
          canvas: offscreen,
          width: 18,
          height: 18,
          devicePixelRatio: window.devicePixelRatio || 1,
          status,
        },
        [offscreen],
      )
      .then(() => {
        if (isCurrent) {
          setIsCanvasReady(true);
        }
      })
      .catch(() => undefined);

    return () => {
      isCurrent = false;
      void workerHost
        .post("render", "status:dispose", { id: idRef.current })
        .catch(() => undefined);
    };
  }, [workerHost]);

  useEffect(() => {
    if (!isCanvasReady) {
      return;
    }

    void workerHost
      .post("render", "status:update", { id: idRef.current, status })
      .catch(() => undefined);
  }, [isCanvasReady, status, workerHost]);

  return (
    <span className={`status-chip status-${status}`} data-status={status}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="status-canvas"
        height={18}
        width={18}
      />
      <span className="status-label">{displayLabel}</span>
    </span>
  );
}

const pad = (value: number): string => String(value).padStart(2, "0");
const hourOptions = Array.from({ length: 24 }, (_, index) => pad(index));
const minuteOptions = Array.from({ length: 60 }, (_, index) => pad(index));

function toDatetimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function formatDuration(milliseconds: number): string {
  const totalMilliseconds = Math.max(0, Math.floor(milliseconds));
  const minutes = Math.floor(totalMilliseconds / 60000);
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const centiseconds = Math.floor((totalMilliseconds % 1000) / 10);

  return `${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`;
}

function formatClockTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatClockDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function startOfDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getIsoWeekInfo(date: Date): { isoWeek: number; isoYear: number } {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = utcDate.getUTCDay() || 7;

  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);

  const isoYear = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return { isoWeek, isoYear };
}

function getIsoWeeksInYear(year: number): number {
  return getIsoWeekInfo(new Date(year, 11, 28)).isoWeek;
}

function buildMonthCalendar(monthDate: Date, selectedDate: Date): CalendarWeek[] {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const firstMonday = new Date(monthStart);
  const firstDayOffset = (monthStart.getDay() + 6) % 7;
  const selectedKey = toIsoDateKey(selectedDate);
  const todayKey = toIsoDateKey(new Date());

  firstMonday.setDate(monthStart.getDate() - firstDayOffset);

  const weeks: CalendarWeek[] = [];
  const cursor = new Date(firstMonday);

  while (cursor <= monthEnd || cursor.getDay() !== 1) {
    const weekStart = new Date(cursor);
    const days = Array.from({ length: 7 }, () => {
      const dayDate = new Date(cursor);
      const dayKey = toIsoDateKey(dayDate);

      cursor.setDate(cursor.getDate() + 1);

      return {
        date: dayDate,
        dayNumber: dayDate.getDate(),
        isCurrentMonth: dayDate.getMonth() === monthDate.getMonth(),
        isSelected: dayKey === selectedKey,
        isToday: dayKey === todayKey,
      };
    });

    weeks.push({
      weekNumber: getIsoWeekInfo(weekStart).isoWeek,
      days,
    });
  }

  return weeks;
}

function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function playAlarmTone(soundId: string): void {
  const sound = alarmSoundOptions.find((option) => option.id === soundId) ?? alarmSoundOptions[0];
  const AudioContextClass = window.AudioContext;
  const audioContext = new AudioContextClass();
  const gain = audioContext.createGain();

  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.22, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 1.2);
  gain.connect(audioContext.destination);

  [0, 0.32, 0.64].forEach((delay) => {
    const oscillator = audioContext.createOscillator();

    oscillator.frequency.setValueAtTime(sound.frequency, audioContext.currentTime + delay);
    oscillator.type = "sine";
    oscillator.connect(gain);
    oscillator.start(audioContext.currentTime + delay);
    oscillator.stop(audioContext.currentTime + delay + 0.18);
  });

  window.setTimeout(() => void audioContext.close(), 1400);
}

function escapeExcelCell(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function exportStopwatchHistory(laps: StopwatchLap[]): void {
  const rows = laps.map(
    (lap) => `
      <tr>
        <td>${lap.lapNumber}</td>
        <td>${escapeExcelCell(lap.timestamp)}</td>
        <td>${escapeExcelCell(formatDuration(lap.lapMs))}</td>
        <td>${escapeExcelCell(formatDuration(lap.totalMs))}</td>
      </tr>`,
  );
  const worksheet = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; }
          th, td { border: 1px solid #9ca3af; padding: 8px 10px; }
          th { background: #dbeafe; font-weight: 700; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Lap</th>
              <th>Timestamp</th>
              <th>Lap Time</th>
              <th>Total Time</th>
            </tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </body>
    </html>`;
  const blob = new Blob([worksheet], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `jarvis-prime-stopwatch-${new Date().toISOString().slice(0, 10)}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

export function EngineeringToolsPanel({ workerHost }: EngineeringToolsPanelProps) {
  const [activeTool, setActiveTool] = useState<ActiveTool>("workweek");
  const [timestamp, setTimestamp] = useState(() => toDatetimeLocalValue(new Date()));
  const [durationStart, setDurationStart] = useState(() => toDatetimeLocalValue(new Date()));
  const [durationEnd, setDurationEnd] = useState(() =>
    toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [timezoneTimestamp, setTimezoneTimestamp] = useState(() => toDatetimeLocalValue(new Date()));
  const [timezoneConfig, setTimezoneConfig] = useState<TimezoneConfig>(fallbackTimezoneConfig);
  const [sourceTimezone, setSourceTimezone] = useState("Asia/Bangkok");
  const [isAddingTimezone, setIsAddingTimezone] = useState(false);
  const [newTimezone, setNewTimezone] = useState<TimezoneTargetConfig>({
    timezone: "",
    label: "",
  });
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [alarmRaw, setAlarmRaw] = useState(
    'S5F1 ALCD=0x85 ALID=3001 ALTX="Chamber pressure interlock"',
  );
  const [unitCategory, setUnitCategory] = useState<UnitConverterCategory>("length");
  const [unitInputValue, setUnitInputValue] = useState(25.4);
  const [unitFrom, setUnitFrom] = useState("mm");
  const [unitTo, setUnitTo] = useState("in");
  const [yieldInputQuantity, setYieldInputQuantity] = useState(1000);
  const [yieldGoodQuantity, setYieldGoodQuantity] = useState(960);
  const [yieldScrapQuantity, setYieldScrapQuantity] = useState(40);
  const [yieldRuntimeMinutes, setYieldRuntimeMinutes] = useState(480);
  const [yieldTargetUph, setYieldTargetUph] = useState(115);
  const [capacityDemand, setCapacityDemand] = useState(5000);
  const [capacityPlannedHours, setCapacityPlannedHours] = useState(24);
  const [capacityTools, setCapacityTools] = useState(3);
  const [capacityOperators, setCapacityOperators] = useState(3);
  const [capacityTargetUph, setCapacityTargetUph] = useState(80);
  const [capacityEfficiency, setCapacityEfficiency] = useState(85);
  const [capacityDowntimeMinutes, setCapacityDowntimeMinutes] = useState(60);
  const [workweekMonthOffset, setWorkweekMonthOffset] = useState(0);
  const [toolFilter, setToolFilter] = useState<ToolFilter>("all");
  const [alarmClockNow, setAlarmClockNow] = useState(() => new Date());
  const [alarmHour, setAlarmHour] = useState("07");
  const [alarmMinute, setAlarmMinute] = useState("00");
  const [alarmLabel, setAlarmLabel] = useState("Factory reminder");
  const [alarmSound, setAlarmSound] = useState(alarmSoundOptions[0].id);
  const [countdownHours, setCountdownHours] = useState("00");
  const [countdownMinutes, setCountdownMinutes] = useState("10");
  const [countdownSeconds, setCountdownSeconds] = useState("00");
  const [countdownLabel, setCountdownLabel] = useState("Countdown");
  const [countdownSound, setCountdownSound] = useState(alarmSoundOptions[0].id);
  const [countdownDurationMs, setCountdownDurationMs] = useState(10 * 60 * 1000);
  const [countdownRemainingMs, setCountdownRemainingMs] = useState(10 * 60 * 1000);
  const [countdownStartedAt, setCountdownStartedAt] = useState<number | null>(null);
  const [isCountdownRunning, setIsCountdownRunning] = useState(false);
  const [onlineAlarms, setOnlineAlarms] = useState<OnlineAlarm[]>([
    {
      id: 1,
      hour: "05",
      minute: "00",
      label: "Shift preparation",
      sound: "clean",
      enabled: true,
      lastTriggeredKey: null,
    },
    {
      id: 2,
      hour: "07",
      minute: "30",
      label: "Morning handover",
      sound: "bright",
      enabled: true,
      lastTriggeredKey: null,
    },
  ]);
  const [dayShiftStartHour, setDayShiftStartHour] = useState(8);
  const [shiftLengthHours, setShiftLengthHours] = useState(12);
  const [result, setResult] = useState<WeekShiftResultPayload | null>(null);
  const [durationResult, setDurationResult] = useState<DurationResultPayload | null>(null);
  const [timezoneResult, setTimezoneResult] = useState<TimezoneConversionResultPayload | null>(
    null,
  );
  const [clock, setClock] = useState<FactoryClockResultPayload | null>(null);
  const [alarmResult, setAlarmResult] = useState<AlarmDecodeResultPayload | null>(null);
  const [unitResult, setUnitResult] = useState<UnitConvertResultPayload | null>(null);
  const [yieldResult, setYieldResult] = useState<YieldCalculateResultPayload | null>(null);
  const [capacityResult, setCapacityResult] = useState<CapacityPlanResultPayload | null>(null);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [durationStatus, setDurationStatus] = useState<ToolStatus>("idle");
  const [timezoneStatus, setTimezoneStatus] = useState<ToolStatus>("idle");
  const [clockStatus, setClockStatus] = useState<ToolStatus>("idle");
  const [alarmStatus, setAlarmStatus] = useState<ToolStatus>("idle");
  const [unitStatus, setUnitStatus] = useState<ToolStatus>("idle");
  const [yieldStatus, setYieldStatus] = useState<ToolStatus>("idle");
  const [capacityStatus, setCapacityStatus] = useState<ToolStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);
  const [clockError, setClockError] = useState<string | null>(null);
  const [alarmError, setAlarmError] = useState<string | null>(null);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [yieldError, setYieldError] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [stopwatchStartedAt, setStopwatchStartedAt] = useState<number | null>(null);
  const [stopwatchBaseMs, setStopwatchBaseMs] = useState(0);
  const [stopwatchNowMs, setStopwatchNowMs] = useState(Date.now());
  const [stopwatchHistory, setStopwatchHistory] = useState<StopwatchLap[]>([]);
  const alarmIdRef = useRef(3);

  const elapsedMs =
    stopwatchBaseMs +
    (isStopwatchRunning && stopwatchStartedAt ? stopwatchNowMs - stopwatchStartedAt : 0);
  const primaryStopwatchAction = useMemo(
    () =>
      new StopwatchActionButtonModel(
        isStopwatchRunning ? "Stop" : "Start",
        isStopwatchRunning ? "stop" : "start",
        isStopwatchRunning ? "Stop stopwatch" : "Start stopwatch",
      ),
    [isStopwatchRunning],
  );
  const lapStopwatchAction = useMemo(
    () => new StopwatchActionButtonModel("Lap", "lap", "Record lap"),
    [],
  );
  const resetStopwatchAction = useMemo(
    () => new StopwatchActionButtonModel("Reset", "reset", "Reset stopwatch"),
    [],
  );
  const exportStopwatchAction = useMemo(
    () => new StopwatchActionButtonModel("Excel", "export", "Export stopwatch history to Excel"),
    [],
  );

  const requestPayload = useMemo<WeekShiftRequestPayload>(
    () => ({
      timestamp,
      dayShiftStartHour,
      shiftLengthHours,
    }),
    [dayShiftStartHour, shiftLengthHours, timestamp],
  );
  const durationPayload = useMemo(
    () => ({
      startTimestamp: durationStart,
      endTimestamp: durationEnd,
      breakMinutes,
    }),
    [breakMinutes, durationEnd, durationStart],
  );
  const sourceTimezoneMeta = useMemo(
    () =>
      timezoneConfig.sourceTimezones.find((timezone) => timezone.timezone === sourceTimezone) ??
      fallbackTimezoneConfig.sourceTimezones[0],
    [sourceTimezone, timezoneConfig.sourceTimezones],
  );
  const timezonePayload = useMemo(
    () => ({
      localTimestamp: timezoneTimestamp,
      sourceTimezone,
      sourceLabel: sourceTimezoneMeta.label,
      targetTimezones: timezoneConfig.targetTimezones.filter(
        (timezone) => timezone.timezone !== sourceTimezone && timezone.timezone !== "UTC",
      ),
    }),
    [sourceTimezone, sourceTimezoneMeta, timezoneConfig.targetTimezones, timezoneTimestamp],
  );
  const alarmPayload = useMemo(
    () => ({
      rawAlarm: alarmRaw,
    }),
    [alarmRaw],
  );
  const unitOptions = unitCatalog[unitCategory].units;
  const unitPayload = useMemo(
    () => ({
      category: unitCategory,
      inputValue: unitInputValue,
      fromUnit: unitFrom,
      toUnit: unitTo,
    }),
    [unitCategory, unitFrom, unitInputValue, unitTo],
  );
  const workweekCalendar = useMemo(() => {
    const selectedDate = result?.shiftDate
      ? startOfDate(new Date(`${result.shiftDate}T00:00:00`))
      : startOfDate(new Date(timestamp));
    const visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + workweekMonthOffset, 1);
    const monthLabel = visibleMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const selectedWeek = result?.isoWeek ?? getIsoWeekInfo(selectedDate).isoWeek;
    const weeksInYear = getIsoWeeksInYear(result?.isoYear ?? selectedDate.getFullYear());

    return {
      monthLabel,
      selectedDateLabel: selectedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }),
      selectedWeek,
      weeks: buildMonthCalendar(visibleMonth, selectedDate),
      weeksRemaining: Math.max(0, weeksInYear - selectedWeek),
    };
  }, [result?.isoWeek, result?.isoYear, result?.shiftDate, timestamp, workweekMonthOffset]);
  const yieldPayload = useMemo(
    () => ({
      inputQuantity: yieldInputQuantity,
      goodQuantity: yieldGoodQuantity,
      scrapQuantity: yieldScrapQuantity,
      runtimeMinutes: yieldRuntimeMinutes,
      targetUph: yieldTargetUph,
    }),
    [
      yieldGoodQuantity,
      yieldInputQuantity,
      yieldRuntimeMinutes,
      yieldScrapQuantity,
      yieldTargetUph,
    ],
  );
  const capacityPayload = useMemo(
    () => ({
      demandQuantity: capacityDemand,
      plannedHours: capacityPlannedHours,
      availableTools: capacityTools,
      operators: capacityOperators,
      targetUphPerTool: capacityTargetUph,
      efficiencyPercent: capacityEfficiency,
      downtimeMinutes: capacityDowntimeMinutes,
    }),
    [
      capacityDemand,
      capacityDowntimeMinutes,
      capacityEfficiency,
      capacityOperators,
      capacityPlannedHours,
      capacityTargetUph,
      capacityTools,
    ],
  );
  const filteredToolOptions = useMemo(
    () =>
      toolOptions.filter((tool) =>
        toolFilter === "all" ? true : tool.audiences.includes(toolFilter),
      ),
    [toolFilter],
  );
  const toolGroups = useMemo(
    () =>
      toolCategoryOrder
        .map((category) => ({
          label: category,
          tools: filteredToolOptions.filter((tool) => tool.category === category),
        }))
        .filter((group) => group.tools.length > 0),
    [filteredToolOptions],
  );
  const nextAlarm = useMemo(() => {
    const enabledAlarms = onlineAlarms.filter((alarm) => alarm.enabled);

    if (enabledAlarms.length === 0) {
      return null;
    }

    return enabledAlarms
      .map((alarm) => {
        const nextRun = new Date(alarmClockNow);
        nextRun.setHours(Number(alarm.hour), Number(alarm.minute), 0, 0);

        if (nextRun.getTime() <= alarmClockNow.getTime()) {
          nextRun.setDate(nextRun.getDate() + 1);
        }

        return { alarm, nextRun };
      })
      .sort((left, right) => left.nextRun.getTime() - right.nextRun.getTime())[0];
  }, [alarmClockNow, onlineAlarms]);
  const countdownProgress =
    countdownDurationMs > 0
      ? Math.min(100, Math.max(0, ((countdownDurationMs - countdownRemainingMs) / countdownDurationMs) * 100))
      : 0;
  const availableTimezoneNames = useMemo(() => {
    const intlWithTimezoneList = Intl as typeof Intl & {
      supportedValuesOf?: (key: "timeZone") => string[];
    };
    const browserTimezones = intlWithTimezoneList.supportedValuesOf?.("timeZone") ?? [];
    const configuredTimezones = [
      ...timezoneConfig.sourceTimezones.map((timezone) => timezone.timezone),
      ...timezoneConfig.targetTimezones.map((timezone) => timezone.timezone),
    ];

    return Array.from(new Set([...configuredTimezones, ...browserTimezones])).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [timezoneConfig.sourceTimezones, timezoneConfig.targetTimezones]);

  useEffect(() => {
    let isCurrent = true;

    void fetch("/config/timezones.json")
      .then((response) => (response.ok ? response.json() : fallbackTimezoneConfig))
      .then((rawConfig: RawTimezoneConfig) => {
        if (!isCurrent) {
          return;
        }

        const config = normalizeTimezoneConfig(rawConfig);
        const storedTargets = readStoredTimezoneItems();
        const targetTimezones = mergeTimezoneItems(config.targetTimezones, storedTargets);
        const sourceTimezones = mergeTimezoneItems(config.sourceTimezones, storedTargets);

        setTimezoneConfig({ sourceTimezones, targetTimezones });

        if (!sourceTimezones.some((timezone) => timezone.timezone === sourceTimezone)) {
          setSourceTimezone(sourceTimezones[0]?.timezone ?? "Asia/Bangkok");
        }
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }

        const storedTargets = readStoredTimezoneItems();
        setTimezoneConfig({
          sourceTimezones: mergeTimezoneItems(fallbackTimezoneConfig.sourceTimezones, storedTargets),
          targetTimezones: mergeTimezoneItems(fallbackTimezoneConfig.targetTimezones, storedTargets),
        });
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    setStatus("running");
    setError(null);

    const timeoutId = window.setTimeout(() => {
      void workerHost
        .post<WeekShiftResultPayload>("compute", "tool:week-shift", requestPayload)
        .then((payload) => {
          if (!isCurrent) {
            return;
          }
          setResult(payload);
          setStatus("ready");
        })
        .catch((reason: unknown) => {
          if (!isCurrent) {
            return;
          }
          setStatus("error");
          setError(reason instanceof Error ? reason.message : "Unable to calculate shift data.");
        });
    }, 120);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [requestPayload, workerHost]);

  useEffect(() => {
    setWorkweekMonthOffset(0);
  }, [timestamp]);

  useEffect(() => {
    let isCurrent = true;
    setDurationStatus("running");
    setDurationError(null);

    const timeoutId = window.setTimeout(() => {
      void workerHost
        .post<DurationResultPayload>("compute", "tool:duration", durationPayload)
        .then((payload) => {
          if (!isCurrent) {
            return;
          }
          setDurationResult(payload);
          setDurationStatus("ready");
        })
        .catch((reason: unknown) => {
          if (!isCurrent) {
            return;
          }
          setDurationStatus("error");
          setDurationError(reason instanceof Error ? reason.message : "Unable to calculate duration.");
        });
    }, 120);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [durationPayload, workerHost]);

  useEffect(() => {
    let isCurrent = true;
    setTimezoneStatus("running");
    setTimezoneError(null);

    const timeoutId = window.setTimeout(() => {
      void workerHost
        .post<TimezoneConversionResultPayload>("compute", "tool:timezone", timezonePayload)
        .then((payload) => {
          if (!isCurrent) {
            return;
          }
          setTimezoneResult(payload);
          setTimezoneStatus("ready");
        })
        .catch((reason: unknown) => {
          if (!isCurrent) {
            return;
          }
          setTimezoneStatus("error");
          setTimezoneError(reason instanceof Error ? reason.message : "Unable to convert timezone.");
        });
    }, 120);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [timezonePayload, workerHost]);

  useEffect(() => {
    let isCurrent = true;
    setAlarmStatus("running");
    setAlarmError(null);

    const timeoutId = window.setTimeout(() => {
      void workerHost
        .post<AlarmDecodeResultPayload>("compute", "tool:alarm-decode", alarmPayload)
        .then((payload) => {
          if (!isCurrent) {
            return;
          }
          setAlarmResult(payload);
          setAlarmStatus("ready");
        })
        .catch((reason: unknown) => {
          if (!isCurrent) {
            return;
          }
          setAlarmStatus("error");
          setAlarmError(reason instanceof Error ? reason.message : "Unable to decode alarm.");
        });
    }, 160);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [alarmPayload, workerHost]);

  useEffect(() => {
    const units = unitCatalog[unitCategory].units;

    if (!units.some((unit) => unit.id === unitFrom)) {
      setUnitFrom(units[0]?.id ?? "");
    }

    if (!units.some((unit) => unit.id === unitTo)) {
      setUnitTo(units[1]?.id ?? units[0]?.id ?? "");
    }
  }, [unitCategory, unitFrom, unitTo]);

  useEffect(() => {
    let isCurrent = true;
    setUnitStatus("running");
    setUnitError(null);

    const timeoutId = window.setTimeout(() => {
      void workerHost
        .post<UnitConvertResultPayload>("compute", "tool:unit-convert", unitPayload)
        .then((payload) => {
          if (!isCurrent) {
            return;
          }
          setUnitResult(payload);
          setUnitStatus("ready");
        })
        .catch((reason: unknown) => {
          if (!isCurrent) {
            return;
          }
          setUnitStatus("error");
          setUnitError(reason instanceof Error ? reason.message : "Unable to convert units.");
        });
    }, 120);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [unitPayload, workerHost]);

  useEffect(() => {
    let isCurrent = true;
    setYieldStatus("running");
    setYieldError(null);

    const timeoutId = window.setTimeout(() => {
      void workerHost
        .post<YieldCalculateResultPayload>("compute", "tool:yield-calculate", yieldPayload)
        .then((payload) => {
          if (!isCurrent) {
            return;
          }

          setYieldResult(payload);
          setYieldStatus("ready");
        })
        .catch((reason: unknown) => {
          if (!isCurrent) {
            return;
          }

          setYieldStatus("error");
          setYieldError(reason instanceof Error ? reason.message : "Unable to calculate yield.");
        });
    }, 120);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [workerHost, yieldPayload]);

  useEffect(() => {
    let isCurrent = true;
    setCapacityStatus("running");
    setCapacityError(null);

    const timeoutId = window.setTimeout(() => {
      void workerHost
        .post<CapacityPlanResultPayload>("compute", "tool:capacity-plan", capacityPayload)
        .then((payload) => {
          if (!isCurrent) {
            return;
          }

          setCapacityResult(payload);
          setCapacityStatus("ready");
        })
        .catch((reason: unknown) => {
          if (!isCurrent) {
            return;
          }

          setCapacityStatus("error");
          setCapacityError(reason instanceof Error ? reason.message : "Unable to calculate capacity.");
        });
    }, 120);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [capacityPayload, workerHost]);

  useEffect(() => {
    let isCurrent = true;

    const refreshClock = () => {
      setClockStatus((current) => (current === "ready" ? "ready" : "running"));
      setClockError(null);

      void workerHost
        .post<FactoryClockResultPayload>("compute", "tool:factory-clock", {
          ...requestPayload,
          timestamp: new Date().toISOString(),
        })
        .then((payload) => {
          if (!isCurrent) {
            return;
          }
          setClock(payload);
          setClockStatus("ready");
        })
        .catch((reason: unknown) => {
          if (!isCurrent) {
            return;
          }
          setClockStatus("error");
          setClockError(reason instanceof Error ? reason.message : "Unable to refresh clock.");
        });
    };

    refreshClock();
    const intervalId = window.setInterval(refreshClock, 1000);

    return () => {
      isCurrent = false;
      window.clearInterval(intervalId);
    };
  }, [requestPayload, workerHost]);

  useEffect(() => {
    if (!isStopwatchRunning) {
      return;
    }

    const intervalId = window.setInterval(() => setStopwatchNowMs(Date.now()), 50);
    return () => window.clearInterval(intervalId);
  }, [isStopwatchRunning]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setAlarmClockNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const triggerKey = `${alarmClockNow.getFullYear()}-${pad(alarmClockNow.getMonth() + 1)}-${pad(
      alarmClockNow.getDate(),
    )}-${pad(alarmClockNow.getHours())}:${pad(alarmClockNow.getMinutes())}`;

    onlineAlarms.forEach((alarm) => {
      if (
        alarm.enabled &&
        alarm.hour === pad(alarmClockNow.getHours()) &&
        alarm.minute === pad(alarmClockNow.getMinutes()) &&
        alarm.lastTriggeredKey !== triggerKey
      ) {
        playAlarmTone(alarm.sound);
        setOnlineAlarms((current) =>
          current.map((item) =>
            item.id === alarm.id ? { ...item, lastTriggeredKey: triggerKey } : item,
          ),
        );
      }
    });
  }, [alarmClockNow, onlineAlarms]);

  useEffect(() => {
    if (!isCountdownRunning || countdownStartedAt === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - countdownStartedAt;
      const remaining = Math.max(0, countdownDurationMs - elapsed);

      setCountdownRemainingMs(remaining);

      if (remaining <= 0) {
        setIsCountdownRunning(false);
        setCountdownStartedAt(null);
        playAlarmTone(countdownSound);
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [countdownDurationMs, countdownSound, countdownStartedAt, isCountdownRunning]);

  const startStopwatch = () => {
    if (isStopwatchRunning) {
      return;
    }

    setStopwatchStartedAt(Date.now());
    setStopwatchNowMs(Date.now());
    setIsStopwatchRunning(true);
  };

  const stopStopwatch = () => {
    if (!isStopwatchRunning || !stopwatchStartedAt) {
      return;
    }

    const stoppedAt = Date.now();
    setStopwatchBaseMs((current) => current + stoppedAt - stopwatchStartedAt);
    setStopwatchNowMs(stoppedAt);
    setStopwatchStartedAt(null);
    setIsStopwatchRunning(false);
  };

  const resetStopwatch = () => {
    setIsStopwatchRunning(false);
    setStopwatchStartedAt(null);
    setStopwatchBaseMs(0);
    setStopwatchNowMs(Date.now());
    setStopwatchHistory([]);
  };

  const recordLap = () => {
    if (elapsedMs <= 0) {
      return;
    }

    setStopwatchHistory((current) => {
      const previousTotal = current.at(0)?.totalMs ?? 0;
      const lapNumber = current.length + 1;

      return [
        {
          id: Date.now(),
          lapNumber,
          lapMs: elapsedMs - previousTotal,
          totalMs: elapsedMs,
          timestamp: new Date().toLocaleString(),
        },
        ...current,
      ];
    });
  };

  const addTimezoneCard = () => {
    const timezone = newTimezone.timezone.trim();

    if (timezone.length === 0) {
      return;
    }

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    } catch {
      setTimezoneError("Please enter a valid IANA timezone, for example Europe/Rome.");
      return;
    }

    const label =
      newTimezone.label.trim() ||
      timezone.split("/").at(-1)?.replaceAll("_", " ") ||
      timezone;
    const item: TimezoneTargetConfig = { timezone, label };

    setTimezoneConfig((current) => {
      const targetTimezones = mergeTimezoneItems(current.targetTimezones, [item]);
      const sourceTimezones = mergeTimezoneItems(current.sourceTimezones, [item]);
      const defaultTimezones = new Set(
        fallbackTimezoneConfig.targetTimezones.map((timezoneItem) => timezoneItem.timezone),
      );
      const storedTargets = targetTimezones.filter(
        (timezoneItem) => !defaultTimezones.has(timezoneItem.timezone),
      );

      window.localStorage.setItem(timezoneStorageKey, JSON.stringify(storedTargets));

      return { sourceTimezones, targetTimezones };
    });
    setNewTimezone({ timezone: "", label: "" });
    setTimezoneError(null);
    setIsAddingTimezone(false);
  };

  const addOnlineAlarm = () => {
    const label = alarmLabel.trim() || "Jarvis alarm";

    setOnlineAlarms((current) => [
      ...current,
      {
        id: alarmIdRef.current,
        hour: alarmHour,
        minute: alarmMinute,
        label,
        sound: alarmSound,
        enabled: true,
        lastTriggeredKey: null,
      },
    ]);
    alarmIdRef.current += 1;
  };

  const toggleOnlineAlarm = (alarmId: number) => {
    setOnlineAlarms((current) =>
      current.map((alarm) =>
        alarm.id === alarmId ? { ...alarm, enabled: !alarm.enabled, lastTriggeredKey: null } : alarm,
      ),
    );
  };

  const removeOnlineAlarm = (alarmId: number) => {
    setOnlineAlarms((current) => current.filter((alarm) => alarm.id !== alarmId));
  };

  const applyCountdownDuration = (hours: string, minutes: string, seconds: string) => {
    const durationMs =
      (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000;
    const nextDurationMs = Math.max(1000, durationMs);

    setCountdownHours(hours);
    setCountdownMinutes(minutes);
    setCountdownSeconds(seconds);
    setCountdownDurationMs(nextDurationMs);
    setCountdownRemainingMs(nextDurationMs);
    setCountdownStartedAt(null);
    setIsCountdownRunning(false);
  };

  const startCountdown = () => {
    const durationMs =
      countdownRemainingMs > 0 ? countdownRemainingMs : countdownDurationMs;

    setCountdownDurationMs(durationMs);
    setCountdownRemainingMs(durationMs);
    setCountdownStartedAt(Date.now());
    setIsCountdownRunning(true);
  };

  const pauseCountdown = () => {
    setIsCountdownRunning(false);
    setCountdownStartedAt(null);
  };

  const resetCountdown = () => {
    setIsCountdownRunning(false);
    setCountdownStartedAt(null);
    setCountdownRemainingMs(countdownDurationMs);
  };

  return (
    <section id="engineering-tools" className="tools-layout" aria-label="Engineering Tools">
      <article className="panel tools-intro">
        <p className="eyebrow">Engineering Tools</p>
        <h2>Fast utilities for daily engineering work.</h2>
        <p>Worker-backed tools for time, conversion, manufacturing, and diagnostics.</p>
      </article>

      <div className="tools-grid">
        <div className="tool-workspace">
        {activeTool === "workweek" ? (
        <article className="panel tool-card active-tool">
          <div className="tool-card-header">
            <div>
              <p className="eyebrow">Time and shift</p>
              <h3>WorkWeek / Shift Calculator</h3>
            </div>
            <StatusChip status={status} workerHost={workerHost} />
          </div>

          <div className="tool-form">
            <label>
              <span>Date and time</span>
              <input
                type="datetime-local"
                value={timestamp}
                onChange={(event) => setTimestamp(event.target.value)}
              />
            </label>

            <label>
              <span>Day shift start</span>
              <input
                max={23}
                min={0}
                type="number"
                value={dayShiftStartHour}
                onChange={(event) => setDayShiftStartHour(Number(event.target.value))}
              />
            </label>

            <label>
              <span>Shift length</span>
              <input
                max={24}
                min={1}
                type="number"
                value={shiftLengthHours}
                onChange={(event) => setShiftLengthHours(Number(event.target.value))}
              />
            </label>
          </div>

          {error ? <div className="error-note">{error}</div> : null}

          <div className="workweek-overview" aria-live="polite">
            <section className="workweek-number-card">
              <span>WorkWeek</span>
              <strong>{result ? String(result.isoWeek).padStart(2, "0") : "--"}</strong>
              <p>{workweekCalendar.selectedDateLabel}</p>
              <small>Weeks remaining this year: {workweekCalendar.weeksRemaining}</small>
            </section>

            <section className="workweek-calendar-card">
              <div className="workweek-calendar-header">
                <button
                  aria-label="Previous month"
                  className="month-nav-button month-nav-previous"
                  type="button"
                  onClick={() => setWorkweekMonthOffset((current) => current - 1)}
                />
                <span>{workweekCalendar.monthLabel}</span>
                <button
                  aria-label="Next month"
                  className="month-nav-button month-nav-next"
                  type="button"
                  onClick={() => setWorkweekMonthOffset((current) => current + 1)}
                />
                <strong>WW{String(workweekCalendar.selectedWeek).padStart(2, "0")}</strong>
              </div>
              <div className="workweek-calendar-grid" aria-label="Monthly calendar with WorkWeek">
                {["#", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                  <span className="workweek-calendar-heading" key={label}>
                    {label}
                  </span>
                ))}
                {workweekCalendar.weeks.map((week) => (
                  <div className="workweek-calendar-row" key={`${workweekCalendar.monthLabel}-${week.weekNumber}`}>
                    <span className="workweek-calendar-week">{String(week.weekNumber).padStart(2, "0")}</span>
                    {week.days.map((day) => (
                      <span
                        className={[
                          "workweek-calendar-day",
                          day.isCurrentMonth ? "" : "is-muted",
                          day.isSelected ? "is-selected" : "",
                          day.isToday ? "is-today" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={day.date.toISOString()}
                      >
                        {day.dayNumber}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <div className="workweek-shift-summary">
                <span>Year: {result?.isoYear ?? "--"}</span>
                <span>Shift: {result?.shiftName ?? "--"}</span>
                <span>Shift date: {result?.shiftDate ?? "--"}</span>
                <span>Day: {result?.dayName ?? "--"}</span>
              </div>
            </section>
          </div>
        </article>
        ) : null}

        {activeTool === "duration" ? (
        <article className="panel tool-card duration-tool">
          <div className="tool-card-header">
            <div>
              <p className="eyebrow">Time and shift</p>
              <h3>Duration Calculator</h3>
            </div>
            <StatusChip status={durationStatus} workerHost={workerHost} />
          </div>

          <div className="tool-form duration-form">
            <label>
              <span>Start</span>
              <input
                type="datetime-local"
                value={durationStart}
                onChange={(event) => setDurationStart(event.target.value)}
              />
            </label>

            <label>
              <span>End</span>
              <input
                type="datetime-local"
                value={durationEnd}
                onChange={(event) => setDurationEnd(event.target.value)}
              />
            </label>
          </div>

          {durationError ? <div className="error-note">{durationError}</div> : null}

          <div className="result-grid duration-result-grid" aria-live="polite">
            <div className="result-tile emphasis-tile">
              <span>Net duration</span>
              <strong>{durationResult?.netLabel ?? "--"}</strong>
            </div>
            <div className="result-tile">
              <span>Gross duration</span>
              <strong>{durationResult?.grossLabel ?? "--"}</strong>
            </div>
            <div className="result-tile break-minute-tile">
              <label>
                <span>Break minutes</span>
                <input
                  min={0}
                  type="number"
                  value={breakMinutes}
                  onChange={(event) => setBreakMinutes(Number(event.target.value))}
                />
              </label>
              <strong>{durationResult?.breakLabel ?? "--"}</strong>
            </div>
            <div className="result-tile">
              <span>Crosses midnight</span>
              <strong>{durationResult?.crossesMidnight ? "Yes" : "No"}</strong>
            </div>
          </div>

          <div className="duration-summary">
            <span>Start: {durationResult?.startLabel ?? "--"}</span>
            <span>End: {durationResult?.endLabel ?? "--"}</span>
          </div>
        </article>
        ) : null}

        {activeTool === "timezone" ? (
        <article className="panel tool-card timezone-tool">
          <div className="tool-card-header">
            <div>
              <p className="eyebrow">Time and shift</p>
              <h3>Timezone Converter</h3>
            </div>
            <StatusChip status={timezoneStatus} workerHost={workerHost} />
          </div>

          <div className="timezone-topline" aria-live="polite">
            <div className="utc-inline">
              <div>
                <span>UTC</span>
                <strong>{timezoneResult?.utc.timeLabel ?? "--:--:--"}</strong>
                <small>
                  {timezoneResult?.utc.weekdayLabel ?? "--"} ·{" "}
                  {timezoneResult?.utc.dateLabel ?? "----"} ·{" "}
                  {timezoneResult?.utc.offsetLabel ?? "GMT"}
                </small>
              </div>
            </div>

            <button
              className="add-city-button"
              type="button"
              onClick={() => setIsAddingTimezone((current) => !current)}
            >
              {isAddingTimezone ? "Close" : "Add city"}
            </button>
          </div>

          {isAddingTimezone ? (
            <div className="timezone-add-panel">
              <label>
                <span>Timezone</span>
                <input
                  list="timezone-name-options"
                  placeholder="Europe/Rome"
                  type="text"
                  value={newTimezone.timezone}
                  onChange={(event) =>
                    setNewTimezone((current) => ({
                      ...current,
                      timezone: event.target.value,
                    }))
                  }
                />
                <datalist id="timezone-name-options">
                  {availableTimezoneNames.map((timezone) => (
                    <option key={timezone} value={timezone} />
                  ))}
                </datalist>
              </label>
              <label>
                <span>City label</span>
                <input
                  placeholder="Italy"
                  type="text"
                  value={newTimezone.label}
                  onChange={(event) =>
                    setNewTimezone((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                />
              </label>
              <button className="add-city-submit" type="button" onClick={addTimezoneCard}>
                Save city
              </button>
            </div>
          ) : null}

          <div className="tool-form timezone-form">
            <label>
              <span>Source time</span>
              <input
                type="datetime-local"
                value={timezoneTimestamp}
                onChange={(event) => setTimezoneTimestamp(event.target.value)}
              />
            </label>

            <label>
              <span>Source timezone</span>
              <select
                value={sourceTimezone}
                onChange={(event) => setSourceTimezone(event.target.value)}
              >
                {timezoneConfig.sourceTimezones.map((timezone) => (
                  <option key={timezone.timezone} value={timezone.timezone}>
                    {timezone.label} · {timezone.timezone}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {timezoneError ? <div className="error-note">{timezoneError}</div> : null}

          <div className="timezone-source-card" aria-live="polite">
            <span>Source</span>
            <strong>{timezoneResult?.source.timeLabel ?? "--:--:--"}</strong>
            <small>
              {timezoneResult?.source.weekdayLabel ?? "--"} ·{" "}
              {timezoneResult?.source.dateLabel ?? "----"} ·{" "}
              {timezoneResult?.source.offsetLabel ?? "--"}
            </small>
            <p>{timezoneResult?.source.cityLabel ?? sourceTimezoneMeta.label}</p>
            <small>{timezoneResult?.source.timezone ?? sourceTimezone}</small>
          </div>

          <div className="timezone-card-grid">
            {timezoneResult?.targets.map((target) => (
              <article className={`timezone-card day-${target.dayRelation}`} key={target.timezone}>
                <div className="timezone-card-heading">
                  <div>
                    <span>{target.cityLabel}</span>
                    <small>{target.timezone}</small>
                  </div>
                </div>
                <div>
                  <strong>{target.timeLabel}</strong>
                </div>
                <p>
                  {target.weekdayLabel} · {target.dateLabel} · {target.offsetLabel}
                </p>
              </article>
            )) ?? null}
          </div>
        </article>
        ) : null}

        {activeTool === "factory-clock" ? (
        <article className="panel tool-card clock-tool">
          <div className="tool-card-header">
            <div>
              <p className="eyebrow">Clock</p>
              <h3>Factory Clock</h3>
            </div>
            <StatusChip status={clockStatus} workerHost={workerHost} />
          </div>

          {clockError ? <div className="error-note">{clockError}</div> : null}

          <div className="clock-face" aria-live="polite">
            <span>{clock?.localDate ?? "--"}</span>
            <strong>{clock?.localTime ?? "--:--:--"}</strong>
            <small>{clock?.timezone ?? "Local timezone"}</small>
          </div>

          <div className="result-grid clock-result-grid">
            <div className="result-tile">
              <span>UTC</span>
              <strong>{clock?.utcTime ?? "--"}</strong>
            </div>
            <div className="result-tile">
              <span>Current shift</span>
              <strong>{clock?.shiftName ?? "--"}</strong>
            </div>
            <div className="result-tile">
              <span>Next shift</span>
              <strong>{clock?.nextShiftName ?? "--"}</strong>
            </div>
            <div className="result-tile">
              <span>Change in</span>
              <strong>{clock?.remainingLabel ?? "--"}</strong>
            </div>
          </div>

          <p className="tool-note">
            Next shift change: <strong>{clock?.nextShiftChange ?? "--"}</strong>
          </p>
        </article>
        ) : null}

        {activeTool === "stopwatch" ? (
        <article className="panel tool-card stopwatch-tool">
          <div className="tool-card-header">
            <div>
              <p className="eyebrow">Manufacturing</p>
              <h3>Process Stopwatch</h3>
            </div>
            <StatusChip
              status={isStopwatchRunning ? "running" : "ready"}
              workerHost={workerHost}
            />
          </div>

          <div className="stopwatch-face" aria-live="polite">
            <span>Elapsed process time</span>
            <strong>{formatDuration(elapsedMs)}</strong>
          </div>

          <div className="stopwatch-actions" aria-label="Stopwatch controls">
            <div className="export-control-group">
              <RoundActionButton
                disabled={stopwatchHistory.length === 0}
                model={exportStopwatchAction}
                onClick={() => exportStopwatchHistory(stopwatchHistory)}
              />
            </div>
            <div className="round-control-row">
              <RoundActionButton
                model={primaryStopwatchAction}
                onClick={isStopwatchRunning ? stopStopwatch : startStopwatch}
              />
              <RoundActionButton model={lapStopwatchAction} onClick={recordLap} />
              <RoundActionButton model={resetStopwatchAction} onClick={resetStopwatch} />
            </div>
          </div>

          <div className="history-panel">
            <div className="history-header">
              <span>History</span>
              <strong>{stopwatchHistory.length}</strong>
            </div>
            {stopwatchHistory.length > 0 ? (
              <div className="history-table-wrap">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Lap</th>
                      <th>Timestamp</th>
                      <th>Lap time</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stopwatchHistory.map((lap) => (
                      <tr key={lap.id}>
                        <td>{lap.lapNumber}</td>
                        <td>{lap.timestamp}</td>
                        <td>{formatDuration(lap.lapMs)}</td>
                        <td>{formatDuration(lap.totalMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-history">No laps recorded yet.</p>
            )}
          </div>
        </article>
        ) : null}

        {activeTool === "online-alarm" ? (
        <article className="panel tool-card online-alarm-tool">
          <div className="tool-card-header">
            <div>
              <p className="eyebrow">Time</p>
              <h3>Online Alarm</h3>
            </div>
            <StatusChip label="online" status="online" workerHost={workerHost} />
          </div>

          <div className="alarm-clock-face" aria-live="polite">
            <span>{formatClockDate(alarmClockNow)}</span>
            <strong>{formatClockTime(alarmClockNow)}</strong>
            <small>
              Next alarm:{" "}
              {nextAlarm
                ? `${nextAlarm.alarm.hour}:${nextAlarm.alarm.minute} · ${nextAlarm.alarm.label}`
                : "No active alarms"}
            </small>
          </div>

          <div className="alarm-builder">
            <label>
              <span>Hour</span>
              <select value={alarmHour} onChange={(event) => setAlarmHour(event.target.value)}>
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Minute</span>
              <select value={alarmMinute} onChange={(event) => setAlarmMinute(event.target.value)}>
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Sound</span>
              <select value={alarmSound} onChange={(event) => setAlarmSound(event.target.value)}>
                {alarmSoundOptions.map((sound) => (
                  <option key={sound.id} value={sound.id}>
                    {sound.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Alarm name</span>
              <input
                type="text"
                value={alarmLabel}
                onChange={(event) => setAlarmLabel(event.target.value)}
              />
            </label>

            <button className="add-city-submit" type="button" onClick={addOnlineAlarm}>
              Add alarm
            </button>
          </div>

          <div className="alarm-quick-grid">
            {["05:00", "05:30", "06:00", "06:30", "07:00", "07:30", "08:00", "08:30"].map(
              (time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => {
                    const [hour, minute] = time.split(":");
                    setAlarmHour(hour);
                    setAlarmMinute(minute);
                  }}
                >
                  {time}
                </button>
              ),
            )}
          </div>

          <div className="alarm-sound-row">
            <button
              className="add-city-button"
              type="button"
              onClick={() => playAlarmTone(alarmSound)}
            >
              Test sound
            </button>
          </div>

          <div className="online-alarm-list">
            {onlineAlarms.map((alarm) => (
              <article className="online-alarm-card" key={alarm.id}>
                <div>
                  <span>{alarm.enabled ? "Enabled" : "Paused"}</span>
                  <strong>
                    {alarm.hour}:{alarm.minute}
                  </strong>
                  <small>{alarm.label}</small>
                </div>
                <div className="online-alarm-actions">
                  <button type="button" onClick={() => toggleOnlineAlarm(alarm.id)}>
                    {alarm.enabled ? "Pause" : "Enable"}
                  </button>
                  <button type="button" onClick={() => removeOnlineAlarm(alarm.id)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        </article>
        ) : null}

        {activeTool === "countdown-timer" ? (
        <article className="panel tool-card countdown-tool">
          <div className="tool-card-header">
            <div>
              <p className="eyebrow">Time</p>
              <h3>Countdown Timer</h3>
            </div>
            <StatusChip
              status={isCountdownRunning ? "running" : "ready"}
              workerHost={workerHost}
            />
          </div>

          <div className="countdown-face" aria-live="polite">
            <span>{countdownLabel || "Countdown"}</span>
            <strong>{formatCountdown(countdownRemainingMs)}</strong>
            <div className="countdown-progress" aria-hidden="true">
              <span style={{ width: `${countdownProgress}%` }} />
            </div>
          </div>

          <div className="countdown-builder">
            <label>
              <span>Hours</span>
              <select
                value={countdownHours}
                onChange={(event) =>
                  applyCountdownDuration(event.target.value, countdownMinutes, countdownSeconds)
                }
              >
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Minutes</span>
              <select
                value={countdownMinutes}
                onChange={(event) =>
                  applyCountdownDuration(countdownHours, event.target.value, countdownSeconds)
                }
              >
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Seconds</span>
              <select
                value={countdownSeconds}
                onChange={(event) =>
                  applyCountdownDuration(countdownHours, countdownMinutes, event.target.value)
                }
              >
                {minuteOptions.map((second) => (
                  <option key={second} value={second}>
                    {second}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Sound</span>
              <select
                value={countdownSound}
                onChange={(event) => setCountdownSound(event.target.value)}
              >
                {alarmSoundOptions.map((sound) => (
                  <option key={sound.id} value={sound.id}>
                    {sound.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Timer name</span>
              <input
                type="text"
                value={countdownLabel}
                onChange={(event) => setCountdownLabel(event.target.value)}
              />
            </label>
          </div>

          <div className="alarm-quick-grid">
            {[
              ["00", "01", "00", "1 min"],
              ["00", "05", "00", "5 min"],
              ["00", "10", "00", "10 min"],
              ["00", "15", "00", "15 min"],
              ["00", "20", "00", "20 min"],
              ["00", "25", "00", "25 min"],
              ["00", "30", "00", "30 min"],
              ["00", "45", "00", "45 min"],
            ].map(([hours, minutes, seconds, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => applyCountdownDuration(hours, minutes, seconds)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="countdown-actions">
            <button className="add-city-button" type="button" onClick={() => playAlarmTone(countdownSound)}>
              Test sound
            </button>
            <button
              className="add-city-submit"
              type="button"
              onClick={isCountdownRunning ? pauseCountdown : startCountdown}
            >
              {isCountdownRunning ? "Pause" : "Start countdown"}
            </button>
            <button className="add-city-button" type="button" onClick={resetCountdown}>
              Reset
            </button>
          </div>
        </article>
        ) : null}

        {activeTool === "alarm-decoder" ? (
        <article className="panel tool-card alarm-tool">
          <div className="tool-card-header">
            <div>
              <p className="eyebrow">Factory tools</p>
              <h3>Alarm Decoder</h3>
            </div>
            <StatusChip status={alarmStatus} workerHost={workerHost} />
          </div>

          <div className="alarm-layout">
            <label className="alarm-input-panel">
              <span>Raw alarm message</span>
              <textarea
                value={alarmRaw}
                onChange={(event) => setAlarmRaw(event.target.value)}
                spellCheck={false}
              />
            </label>

            <div className="alarm-summary-panel" aria-live="polite">
              <span className={`alarm-severity alarm-severity-${alarmResult?.severity ?? "unknown"}`}>
                {alarmResult?.severity ?? "unknown"}
              </span>
              <strong>{alarmResult?.state === "clear" ? "Cleared" : alarmResult?.state === "set" ? "Active" : "Unknown"}</strong>
              <p>{alarmResult?.summary ?? "Paste an alarm payload to decode."}</p>
            </div>
          </div>

          {alarmError ? <div className="error-note">{alarmError}</div> : null}

          <div className="alarm-result-grid">
            <div className="result-tile emphasis-tile">
              <span>ALCD</span>
              <strong>{alarmResult?.alarmCode ?? "--"}</strong>
            </div>
            <div className="result-tile">
              <span>ALID</span>
              <strong>{alarmResult?.alarmId ?? "--"}</strong>
            </div>
            <div className="result-tile">
              <span>Category</span>
              <strong>{alarmResult?.categoryCode ?? "--"}</strong>
              <small>{alarmResult?.categoryLabel ?? "--"}</small>
            </div>
            <div className="result-tile">
              <span>Protocol</span>
              <strong>{alarmResult?.protocol ?? "--"}</strong>
            </div>
          </div>

          <div className="alarm-detail-grid">
            <section className="history-panel">
              <div className="history-header">
                <span>Decoded fields</span>
                <strong>{alarmResult?.parsedFields.length ?? 0}</strong>
              </div>
              <div className="alarm-field-list">
                {alarmResult?.parsedFields.map((field) => (
                  <div className="alarm-field-row" key={field.label}>
                    <span>{field.label}</span>
                    <strong>{field.value}</strong>
                  </div>
                )) ?? null}
              </div>
            </section>

            <section className="history-panel">
              <div className="history-header">
                <span>Recommended actions</span>
                <strong>{alarmResult?.recommendedActions.length ?? 0}</strong>
              </div>
              <ol className="alarm-action-list">
                {alarmResult?.recommendedActions.map((action) => (
                  <li key={action}>{action}</li>
                )) ?? null}
              </ol>
            </section>
          </div>
        </article>
        ) : null}

        {activeTool === "unit-converter" ? (
        <article className="panel tool-card unit-tool">
          <div className="tool-card-header">
            <div>
              <p className="eyebrow">Engineering math</p>
              <h3>Unit Converter</h3>
            </div>
            <StatusChip status={unitStatus} workerHost={workerHost} />
          </div>

          <div className="tool-form unit-form">
            <label>
              <span>Category</span>
              <select
                value={unitCategory}
                onChange={(event) => {
                  const nextCategory = event.target.value as UnitConverterCategory;
                  const nextUnits = unitCatalog[nextCategory].units;

                  setUnitCategory(nextCategory);
                  setUnitFrom(nextUnits[0]?.id ?? "");
                  setUnitTo(nextUnits[1]?.id ?? nextUnits[0]?.id ?? "");
                }}
              >
                {Object.entries(unitCatalog).map(([category, config]) => (
                  <option key={category} value={category}>
                    {config.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Value</span>
              <input
                type="number"
                value={unitInputValue}
                onChange={(event) => setUnitInputValue(Number(event.target.value))}
              />
            </label>

            <label>
              <span>From</span>
              <select value={unitFrom} onChange={(event) => setUnitFrom(event.target.value)}>
                {unitOptions.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.id} · {unit.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>To</span>
              <select value={unitTo} onChange={(event) => setUnitTo(event.target.value)}>
                {unitOptions.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.id} · {unit.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {unitError ? <div className="error-note">{unitError}</div> : null}

          <div className="unit-conversion-stage" aria-live="polite">
            <div>
              <span>{unitCatalog[unitCategory].label}</span>
              <strong>{unitResult?.outputLabel ?? "--"}</strong>
              <p>{unitResult?.inputLabel ?? "--"} converts to</p>
            </div>
            <button
              className="swap-unit-button"
              type="button"
              onClick={() => {
                setUnitFrom(unitTo);
                setUnitTo(unitFrom);
              }}
            >
              Swap
            </button>
          </div>

          <div className="history-panel">
            <div className="history-header">
              <span>Formula</span>
              <strong>{unitResult?.category ?? unitCategory}</strong>
            </div>
            <p className="unit-formula">{unitResult?.formula ?? "--"}</p>
          </div>

          <div className="unit-result-grid">
            {unitResult?.relatedValues.map((item) => (
              <article className="unit-result-card" key={item.unit}>
                <span>{item.label}</span>
                <strong>{item.formattedValue}</strong>
              </article>
            )) ?? null}
          </div>
        </article>
        ) : null}

        {activeTool === "yield-calculator" ? (
        <article className="panel tool-card yield-tool">
          <div className="tool-card-header">
            <div>
              <p className="eyebrow">Factory math</p>
              <h3>Yield / Scrap / UPH Calculator</h3>
            </div>
            <StatusChip status={yieldStatus} workerHost={workerHost} />
          </div>

          <div className="tool-form yield-form">
            <label>
              <span>Input quantity</span>
              <input
                min="0"
                type="number"
                value={yieldInputQuantity}
                onChange={(event) => setYieldInputQuantity(Number(event.target.value))}
              />
            </label>

            <label>
              <span>Good quantity</span>
              <input
                min="0"
                type="number"
                value={yieldGoodQuantity}
                onChange={(event) => setYieldGoodQuantity(Number(event.target.value))}
              />
            </label>

            <label>
              <span>Scrap quantity</span>
              <input
                min="0"
                type="number"
                value={yieldScrapQuantity}
                onChange={(event) => setYieldScrapQuantity(Number(event.target.value))}
              />
            </label>

            <label>
              <span>Runtime minutes</span>
              <input
                min="0"
                type="number"
                value={yieldRuntimeMinutes}
                onChange={(event) => setYieldRuntimeMinutes(Number(event.target.value))}
              />
            </label>

            <label>
              <span>Target UPH</span>
              <input
                min="0"
                type="number"
                value={yieldTargetUph}
                onChange={(event) => setYieldTargetUph(Number(event.target.value))}
              />
            </label>
          </div>

          {yieldError ? <div className="error-note">{yieldError}</div> : null}

          <div className={`yield-hero yield-status-${yieldResult?.status ?? "info"}`} aria-live="polite">
            <span>Line performance</span>
            <strong>{yieldResult ? `${yieldResult.metrics[0].value} yield` : "--"}</strong>
            <p>{yieldResult?.summary ?? "Enter production quantities to calculate yield and UPH."}</p>
          </div>

          <div className="yield-metric-grid">
            {yieldResult?.metrics.map((metric) => (
              <article className={`yield-metric-card yield-tone-${metric.tone}`} key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            )) ?? null}
          </div>

          <div className="alarm-detail-grid">
            <section className="history-panel">
              <div className="history-header">
                <span>Quantity reconciliation</span>
                <strong>{yieldResult ? yieldResult.status : "--"}</strong>
              </div>
              <div className="yield-reconcile-list">
                <div>
                  <span>Input</span>
                  <strong>{yieldResult?.totalQuantity ?? "--"}</strong>
                </div>
                <div>
                  <span>Good + scrap</span>
                  <strong>
                    {yieldResult ? yieldResult.goodQuantity + yieldResult.scrapQuantity : "--"}
                  </strong>
                </div>
                <div>
                  <span>Variance</span>
                  <strong>{yieldResult?.varianceQuantity ?? "--"}</strong>
                </div>
              </div>
            </section>

            <section className="history-panel">
              <div className="history-header">
                <span>Recommended actions</span>
                <strong>{yieldResult?.recommendedActions.length ?? 0}</strong>
              </div>
              <ol className="alarm-action-list">
                {yieldResult?.recommendedActions.map((action) => (
                  <li key={action}>{action}</li>
                )) ?? null}
              </ol>
            </section>
          </div>
        </article>
        ) : null}

        {activeTool === "capacity-planner" ? (
        <article className="panel tool-card capacity-tool">
          <div className="tool-card-header">
            <div>
              <p className="eyebrow">Planner</p>
              <h3>Capacity / Takt / Loading Planner</h3>
            </div>
            <StatusChip status={capacityStatus} workerHost={workerHost} />
          </div>

          <div className="tool-form capacity-form">
            <label>
              <span>Demand quantity</span>
              <input
                min="0"
                type="number"
                value={capacityDemand}
                onChange={(event) => setCapacityDemand(Number(event.target.value))}
              />
            </label>

            <label>
              <span>Planned hours</span>
              <input
                min="0"
                type="number"
                value={capacityPlannedHours}
                onChange={(event) => setCapacityPlannedHours(Number(event.target.value))}
              />
            </label>

            <label>
              <span>Tools</span>
              <input
                min="0"
                type="number"
                value={capacityTools}
                onChange={(event) => setCapacityTools(Number(event.target.value))}
              />
            </label>

            <label>
              <span>Operators</span>
              <input
                min="0"
                type="number"
                value={capacityOperators}
                onChange={(event) => setCapacityOperators(Number(event.target.value))}
              />
            </label>

            <label>
              <span>UPH / tool</span>
              <input
                min="0"
                type="number"
                value={capacityTargetUph}
                onChange={(event) => setCapacityTargetUph(Number(event.target.value))}
              />
            </label>

            <label>
              <span>Efficiency %</span>
              <input
                min="0"
                type="number"
                value={capacityEfficiency}
                onChange={(event) => setCapacityEfficiency(Number(event.target.value))}
              />
            </label>

            <label>
              <span>Downtime min</span>
              <input
                min="0"
                type="number"
                value={capacityDowntimeMinutes}
                onChange={(event) => setCapacityDowntimeMinutes(Number(event.target.value))}
              />
            </label>
          </div>

          {capacityError ? <div className="error-note">{capacityError}</div> : null}

          <div className={`capacity-hero capacity-status-${capacityResult?.status ?? "info"}`} aria-live="polite">
            <span>Plan coverage</span>
            <strong>{capacityResult ? capacityResult.metrics[0].value : "--"}</strong>
            <p>{capacityResult?.summary ?? "Enter demand and available resources to calculate the plan."}</p>
          </div>

          <div className="yield-metric-grid">
            {capacityResult?.metrics.map((metric) => (
              <article className={`yield-metric-card yield-tone-${metric.tone}`} key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            )) ?? null}
          </div>

          <div className="alarm-detail-grid">
            <section className="history-panel">
              <div className="history-header">
                <span>Loading summary</span>
                <strong>{capacityResult?.status ?? "--"}</strong>
              </div>
              <div className="yield-reconcile-list">
                <div>
                  <span>Staffed tools</span>
                  <strong>{capacityResult?.staffedTools ?? "--"}</strong>
                </div>
                <div>
                  <span>Net hours</span>
                  <strong>{capacityResult ? `${capacityResult.netHours.toFixed(2)} hr` : "--"}</strong>
                </div>
                <div>
                  <span>Capacity gap</span>
                  <strong>{capacityResult?.capacityGap ?? "--"}</strong>
                </div>
              </div>
            </section>

            <section className="history-panel">
              <div className="history-header">
                <span>Recommended actions</span>
                <strong>{capacityResult?.recommendedActions.length ?? 0}</strong>
              </div>
              <ol className="alarm-action-list">
                {capacityResult?.recommendedActions.map((action) => (
                  <li key={action}>{action}</li>
                )) ?? null}
              </ol>
            </section>
          </div>
        </article>
        ) : null}
        </div>

        <aside className="panel tool-library">
          <p className="eyebrow">Tool Library</p>
          <div className="tool-filter" aria-label="Filter tools by role">
            {toolFilterOptions.map((filter) => (
              <button
                key={filter.id}
                aria-pressed={toolFilter === filter.id}
                type="button"
                onClick={() => setToolFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="tool-picker" role="listbox" aria-label="Engineering tool picker">
            {toolGroups.map((group) => (
              <div className="tool-picker-group" key={group.label}>
                <span>{group.label}</span>
                {group.tools.map((tool) => (
                  <button
                    key={tool.id}
                    aria-selected={activeTool === tool.id}
                    className="tool-picker-item"
                    role="option"
                    type="button"
                    onClick={() => setActiveTool(tool.id)}
                  >
                    <strong>{tool.label}</strong>
                  </button>
                ))}
              </div>
            ))}
          </div>

          <p className="eyebrow library-subtitle">Coming next</p>
          <ul>
            <li>OEE / downtime calculator</li>
            <li>SPC quick helper</li>
            <li>CSV and log quick parser</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
