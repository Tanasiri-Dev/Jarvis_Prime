import { useEffect, useMemo, useState } from "react";

import type {
  FactoryClockResultPayload,
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
  const [timestamp, setTimestamp] = useState(() => toDatetimeLocalValue(new Date()));
  const [dayShiftStartHour, setDayShiftStartHour] = useState(8);
  const [shiftLengthHours, setShiftLengthHours] = useState(12);
  const [result, setResult] = useState<WeekShiftResultPayload | null>(null);
  const [clock, setClock] = useState<FactoryClockResultPayload | null>(null);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [clockStatus, setClockStatus] = useState<ToolStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [clockError, setClockError] = useState<string | null>(null);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [stopwatchStartedAt, setStopwatchStartedAt] = useState<number | null>(null);
  const [stopwatchBaseMs, setStopwatchBaseMs] = useState(0);
  const [stopwatchNowMs, setStopwatchNowMs] = useState(Date.now());
  const [stopwatchHistory, setStopwatchHistory] = useState<StopwatchLap[]>([]);

  const elapsedMs =
    stopwatchBaseMs +
    (isStopwatchRunning && stopwatchStartedAt ? stopwatchNowMs - stopwatchStartedAt : 0);

  const requestPayload = useMemo<WeekShiftRequestPayload>(
    () => ({
      timestamp,
      dayShiftStartHour,
      shiftLengthHours,
    }),
    [dayShiftStartHour, shiftLengthHours, timestamp],
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
        <article className="panel tool-card active-tool">
          <div className="tool-card-header">
            <div>
              <p className="eyebrow">Time and shift</p>
              <h3>Week / Shift Calculator</h3>
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

          <div className="round-control-row" aria-label="Stopwatch controls">
            <button
              className="round-action primary"
              type="button"
              onClick={isStopwatchRunning ? stopStopwatch : startStopwatch}
            >
              {isStopwatchRunning ? "Stop" : "Start"}
            </button>
            <button className="round-action" type="button" onClick={recordLap}>
              Lap
            </button>
            <button className="round-action" type="button" onClick={resetStopwatch}>
              Reset
            </button>
            <button
              className="round-action export"
              disabled={stopwatchHistory.length === 0}
              type="button"
              onClick={() => exportStopwatchHistory(stopwatchHistory)}
            >
              Excel
            </button>
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

        <aside className="panel tool-library">
          <p className="eyebrow">Next tools</p>
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
