import { useEffect, useMemo, useState } from "react";

import type {
  WeekShiftRequestPayload,
  WeekShiftResultPayload,
} from "../../core/worker-messages";
import type { WorkerHost } from "../../core/worker-host";

type EngineeringToolsPanelProps = {
  workerHost: WorkerHost;
};

type ToolStatus = "idle" | "running" | "ready" | "error";

const pad = (value: number): string => String(value).padStart(2, "0");

function toDatetimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function EngineeringToolsPanel({ workerHost }: EngineeringToolsPanelProps) {
  const [timestamp, setTimestamp] = useState(() => toDatetimeLocalValue(new Date()));
  const [dayShiftStartHour, setDayShiftStartHour] = useState(8);
  const [shiftLengthHours, setShiftLengthHours] = useState(12);
  const [result, setResult] = useState<WeekShiftResultPayload | null>(null);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [error, setError] = useState<string | null>(null);

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
              <span>ISO week</span>
              <strong>{result?.isoWeekLabel ?? "--"}</strong>
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
