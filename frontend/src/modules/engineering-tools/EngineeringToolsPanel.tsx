import { useEffect, useMemo, useState } from "react";

import type {
  DurationResultPayload,
  FactoryClockResultPayload,
  TimezoneConversionResultPayload,
  WeekShiftRequestPayload,
  WeekShiftResultPayload,
} from "../../core/worker-messages";
import type { WorkerHost } from "../../core/worker-host";

type EngineeringToolsPanelProps = {
  workerHost: WorkerHost;
};

type ToolStatus = "idle" | "running" | "ready" | "error";

type StopwatchLap = {
  id: number;
  lapNumber: number;
  lapMs: number;
  totalMs: number;
  timestamp: string;
};

type ActiveTool = "workweek" | "duration" | "timezone" | "factory-clock" | "stopwatch";

type StopwatchActionVariant = "start" | "stop" | "lap" | "reset" | "export";

const toolOptions: Array<{ id: ActiveTool; label: string; category: string }> = [
  { id: "workweek", label: "WorkWeek", category: "Time and shift" },
  { id: "duration", label: "Duration Calculator", category: "Time and shift" },
  { id: "timezone", label: "Timezone Converter", category: "Time and shift" },
  { id: "factory-clock", label: "Factory Clock", category: "Clock" },
  { id: "stopwatch", label: "Stopwatch", category: "Manufacturing" },
];

const timezoneOptions = [
  "Asia/Bangkok",
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
];

const targetTimezones = [
  "UTC",
  "Asia/Bangkok",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/Berlin",
  "Asia/Tokyo",
];

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

const pad = (value: number): string => String(value).padStart(2, "0");

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
  const [sourceTimezone, setSourceTimezone] = useState("Asia/Bangkok");
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [dayShiftStartHour, setDayShiftStartHour] = useState(8);
  const [shiftLengthHours, setShiftLengthHours] = useState(12);
  const [result, setResult] = useState<WeekShiftResultPayload | null>(null);
  const [durationResult, setDurationResult] = useState<DurationResultPayload | null>(null);
  const [timezoneResult, setTimezoneResult] = useState<TimezoneConversionResultPayload | null>(
    null,
  );
  const [clock, setClock] = useState<FactoryClockResultPayload | null>(null);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [durationStatus, setDurationStatus] = useState<ToolStatus>("idle");
  const [timezoneStatus, setTimezoneStatus] = useState<ToolStatus>("idle");
  const [clockStatus, setClockStatus] = useState<ToolStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);
  const [clockError, setClockError] = useState<string | null>(null);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [stopwatchStartedAt, setStopwatchStartedAt] = useState<number | null>(null);
  const [stopwatchBaseMs, setStopwatchBaseMs] = useState(0);
  const [stopwatchNowMs, setStopwatchNowMs] = useState(Date.now());
  const [stopwatchHistory, setStopwatchHistory] = useState<StopwatchLap[]>([]);

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
  const timezonePayload = useMemo(
    () => ({
      localTimestamp: timezoneTimestamp,
      sourceTimezone,
      targetTimezones: targetTimezones.filter((timezone) => timezone !== sourceTimezone),
    }),
    [sourceTimezone, timezoneTimestamp],
  );

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

  return (
    <section id="engineering-tools" className="tools-layout" aria-label="Engineering Tools">
      <article className="panel tools-intro">
        <p className="eyebrow">Engineering Tools</p>
        <h2>Fast utilities for daily engineering work.</h2>
        <p>
          This first tool runs through the compute worker, keeping the UI responsive while the
          tool library grows into file parsing, conversion, and manufacturing calculators.
        </p>
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
            <span className={`status-chip status-${status}`}>{status}</span>
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

          <div className="result-grid" aria-live="polite">
            <div className="result-tile">
              <span>Year</span>
              <strong>{result?.isoYear ?? "--"}</strong>
            </div>
            <div className="result-tile">
              <span>WorkWeek</span>
              <strong>{result ? `WW${String(result.isoWeek).padStart(2, "0")}` : "--"}</strong>
            </div>
            <div className="result-tile">
              <span>Shift</span>
              <strong>{result?.shiftName ?? "--"}</strong>
            </div>
            <div className="result-tile">
              <span>Shift date</span>
              <strong>{result?.shiftDate ?? "--"}</strong>
            </div>
            <div className="result-tile">
              <span>Day</span>
              <strong>{result?.dayName ?? "--"}</strong>
            </div>
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
            <span className={`status-chip status-${durationStatus}`}>{durationStatus}</span>
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
            <span className={`status-chip status-${timezoneStatus}`}>{timezoneStatus}</span>
          </div>

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
                {timezoneOptions.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
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
            <p>{timezoneResult?.source.timezone ?? sourceTimezone}</p>
          </div>

          <div className="timezone-card-grid">
            {timezoneResult?.targets.map((target) => (
              <article className={`timezone-card day-${target.dayRelation}`} key={target.timezone}>
                <div>
                  <span>{target.cityLabel}</span>
                  <small>{target.timezone}</small>
                </div>
                <strong>{target.timeLabel}</strong>
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
            <span className={`status-chip status-${clockStatus}`}>{clockStatus}</span>
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
            <span className={`status-chip ${isStopwatchRunning ? "status-running" : "status-ready"}`}>
              {isStopwatchRunning ? "running" : "ready"}
            </span>
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
        </div>

        <aside className="panel tool-library">
          <p className="eyebrow">Tool Library</p>
          <div className="tool-picker" role="listbox" aria-label="Engineering tool picker">
            {toolOptions.map((tool) => (
              <button
                key={tool.id}
                aria-selected={activeTool === tool.id}
                className="tool-picker-item"
                role="option"
                type="button"
                onClick={() => setActiveTool(tool.id)}
              >
                <span>{tool.category}</span>
                <strong>{tool.label}</strong>
              </button>
            ))}
          </div>

          <p className="eyebrow library-subtitle">Coming next</p>
          <ul>
            <li>Unit converter</li>
            <li>Yield / scrap / UPH calculator</li>
            <li>Alarm decoder</li>
            <li>CSV and log quick parser</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
