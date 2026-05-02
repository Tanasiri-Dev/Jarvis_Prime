import { useEffect, useMemo, useRef, useState } from "react";

import type {
  PublicHolidayApiItem,
  PublicHolidayLookupResultPayload,
  RenderStatusName,
} from "../../core/worker-messages";
import type { WorkerHost } from "../../core/worker-host";

type CityPreset = {
  id: string;
  cityLabel: string;
  countryName: string;
  countryCode: string;
  subdivisionCode?: string;
  note: string;
};

type StatusChipProps = {
  label?: string;
  status: RenderStatusName;
  workerHost: WorkerHost;
};

const holidayCities: CityPreset[] = [
  {
    id: "united-states",
    cityLabel: "United States",
    countryName: "United States",
    countryCode: "US",
    note: "United States planner calendar",
  },
  {
    id: "durham-us-nc",
    cityLabel: "Durham NC",
    countryName: "United States",
    countryCode: "US",
    subdivisionCode: "US-NC",
    note: "North Carolina planner view",
  },
  {
    id: "bangkok-th",
    cityLabel: "Bangkok",
    countryName: "Thailand",
    countryCode: "TH",
    note: "Thailand factory calendar",
  },
  {
    id: "shanghai-cn",
    cityLabel: "Shanghai",
    countryName: "China",
    countryCode: "CN",
    note: "China production calendar",
  },
  {
    id: "rome-it",
    cityLabel: "Rome",
    countryName: "Italy",
    countryCode: "IT",
    note: "Italy support calendar",
  },
  {
    id: "tokyo-jp",
    cityLabel: "Tokyo",
    countryName: "Japan",
    countryCode: "JP",
    note: "Japan support calendar",
  },
  {
    id: "los-angeles-us-ca",
    cityLabel: "Los Angeles",
    countryName: "United States",
    countryCode: "US",
    subdivisionCode: "US-CA",
    note: "California logistics view",
  },
];

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

const currentYear = new Date().getFullYear();

function normalizeHoliday(rawHoliday: Partial<PublicHolidayApiItem>): PublicHolidayApiItem {
  return {
    date: rawHoliday.date ?? "",
    localName: rawHoliday.localName ?? rawHoliday.name ?? "Holiday",
    name: rawHoliday.name ?? rawHoliday.localName ?? "Holiday",
    countryCode: rawHoliday.countryCode ?? "",
    global: Boolean(rawHoliday.global),
    counties: rawHoliday.counties ?? null,
    launchYear: rawHoliday.launchYear ?? null,
    types: rawHoliday.types ?? ["Public"],
  };
}

function HolidayMonthFrame({
  count,
  isCurrentMonth,
  workerHost,
}: {
  count: number;
  isCurrentMonth: boolean;
  workerHost: WorkerHost;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(`holiday-frame-${crypto.randomUUID()}`);
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;

    if (!canvas || !wrapper || !("transferControlToOffscreen" in canvas)) {
      return;
    }

    const offscreen = canvas.transferControlToOffscreen();
    const rect = wrapper.getBoundingClientRect();
    let isCurrent = true;

    void workerHost
      .post(
        "render",
        "holiday-frame:init",
        {
          id: idRef.current,
          canvas: offscreen,
          width: Math.max(1, rect.width),
          height: Math.max(1, rect.height),
          devicePixelRatio: window.devicePixelRatio || 1,
          count,
          isCurrentMonth,
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
        .post("render", "holiday-frame:dispose", { id: idRef.current })
        .catch(() => undefined);
    };
  }, [workerHost]);

  useEffect(() => {
    const wrapper = wrapperRef.current;

    if (!isCanvasReady || !wrapper) {
      return;
    }

    const publishResize = () => {
      const rect = wrapper.getBoundingClientRect();

      void workerHost
        .post("render", "holiday-frame:resize", {
          id: idRef.current,
          width: Math.max(1, rect.width),
          height: Math.max(1, rect.height),
          devicePixelRatio: window.devicePixelRatio || 1,
          count,
          isCurrentMonth,
        })
        .catch(() => undefined);
    };

    publishResize();

    const resizeObserver = new ResizeObserver(publishResize);
    resizeObserver.observe(wrapper);
    window.addEventListener("resize", publishResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", publishResize);
    };
  }, [count, isCanvasReady, isCurrentMonth, workerHost]);

  return (
    <div ref={wrapperRef} className="holiday-month-frame" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

export function PublicHolidayPanel({ workerHost }: { workerHost: WorkerHost }) {
  const [selectedCityId, setSelectedCityId] = useState(holidayCities[0].id);
  const [year, setYear] = useState(currentYear);
  const [rawHolidays, setRawHolidays] = useState<PublicHolidayApiItem[]>([]);
  const [holidayLoadKey, setHolidayLoadKey] = useState(0);
  const [result, setResult] = useState<PublicHolidayLookupResultPayload | null>(null);
  const [status, setStatus] = useState<RenderStatusName>("idle");
  const [error, setError] = useState<string | null>(null);
  const selectedCity = useMemo(
    () => holidayCities.find((city) => city.id === selectedCityId) ?? holidayCities[0],
    [selectedCityId],
  );
  const sourceUrl = `https://date.nager.at/api/v3/PublicHolidays/${year}/${selectedCity.countryCode}`;
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(
    2,
    "0",
  )}`;

  useEffect(() => {
    const abortController = new AbortController();
    let isCurrent = true;

    setStatus("running");
    setError(null);
    setResult(null);

    fetch(sourceUrl, { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Holiday service returned ${response.status}.`);
        }

        return response.json() as Promise<Array<Partial<PublicHolidayApiItem>>>;
      })
      .then((payload) => {
        if (!isCurrent) {
          return;
        }

        setRawHolidays(payload.map(normalizeHoliday).filter((holiday) => holiday.date));
        setHolidayLoadKey((current) => current + 1);
      })
      .catch((reason: unknown) => {
        if (!isCurrent || abortController.signal.aborted) {
          return;
        }

        setRawHolidays([]);
        setResult(null);
        setStatus("error");
        setError(reason instanceof Error ? reason.message : "Unable to load public holidays.");
      });

    return () => {
      isCurrent = false;
      abortController.abort();
    };
  }, [sourceUrl]);

  useEffect(() => {
    if (holidayLoadKey === 0) {
      return;
    }

    let isCurrent = true;
    setStatus("running");
    setError(null);

    void workerHost
      .post<PublicHolidayLookupResultPayload>("compute", "tool:public-holidays", {
        year,
        cityLabel: selectedCity.cityLabel,
        countryName: selectedCity.countryName,
        countryCode: selectedCity.countryCode,
        subdivisionCode: selectedCity.subdivisionCode,
        holidays: rawHolidays,
      })
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

        setResult(null);
        setStatus("error");
        setError(reason instanceof Error ? reason.message : "Unable to prepare holiday calendar.");
      });

    return () => {
      isCurrent = false;
    };
  }, [holidayLoadKey, rawHolidays, selectedCity, workerHost, year]);

  return (
    <section id="public-holidays" className="holiday-page" aria-label="Public Holidays">
      <article className="panel holiday-summary-panel">
        <p className="eyebrow">Planner calendar</p>
        <h2>Public holiday lookup by city.</h2>
        <p>City presets with worker-grouped holiday months for planning coverage and handovers.</p>
      </article>

      <article className="panel holiday-tool-card">
        <div className="tool-card-header">
          <div>
            <p className="eyebrow">Calendar</p>
            <h3>City Holiday Lookup</h3>
          </div>
          <StatusChip status={status} workerHost={workerHost} />
        </div>

        <div className="holiday-control-grid">
          <label>
            <span>City</span>
            <select
              value={selectedCityId}
              onChange={(event) => setSelectedCityId(event.target.value)}
            >
              {holidayCities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.cityLabel === city.countryName
                    ? `${city.countryName} (${city.countryCode})`
                    : `${city.cityLabel} - ${city.countryName}`}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Year</span>
            <input
              max={9999}
              min={1900}
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </label>
        </div>

        {error ? <div className="error-note">{error}</div> : null}

        <div className="holiday-hero" aria-live="polite">
          <div>
            <span>{selectedCity.note}</span>
            <strong>{selectedCity.cityLabel}</strong>
            <p>
              {selectedCity.countryName} {result ? `(${result.countryCode})` : ""}
            </p>
          </div>
          <div>
            <span>Next holiday</span>
            <strong>{result?.nextHoliday?.dayLabel ?? "--"}</strong>
            <p>{result?.nextHoliday?.name ?? "Waiting for holiday data"}</p>
          </div>
        </div>

        <div className="holiday-metric-grid">
          {result?.metrics.map((metric) => (
            <article className={`yield-metric-card yield-tone-${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          )) ?? (
            <article className="yield-metric-card">
              <span>Loading</span>
              <strong>--</strong>
            </article>
          )}
        </div>

        <div className="holiday-month-grid">
          {result?.months.map((month) => (
            <section
              className={
                month.monthKey === currentMonthKey
                  ? "holiday-month-card holiday-month-current"
                  : "holiday-month-card"
              }
              key={month.monthKey}
            >
              <HolidayMonthFrame
                count={month.holidays.length}
                isCurrentMonth={month.monthKey === currentMonthKey}
                workerHost={workerHost}
              />
              <div className="holiday-month-header">
                <span>{month.monthLabel}</span>
              </div>
              <div className="holiday-list">
                {month.holidays.map((holiday) => (
                  <article
                    className={holiday.isUpcoming ? "holiday-item upcoming" : "holiday-item"}
                    key={`${holiday.date}-${holiday.name}`}
                  >
                    <div className="holiday-item-date">
                      <strong>{holiday.dayLabel}</strong>
                      <span>{holiday.date}</span>
                    </div>
                    <small>{holiday.scopeLabel}</small>
                    <div className="holiday-item-title">
                      <strong>{holiday.name}</strong>
                      <span>{holiday.localName}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </section>
  );
}
