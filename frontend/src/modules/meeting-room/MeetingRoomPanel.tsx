import { useEffect, useMemo, useRef, useState } from "react";

import type {
  MeetingRoomBooking,
  MeetingRoomResultPayload,
  RenderStatusName,
} from "../../core/worker-messages";
import type { WorkerHost } from "../../core/worker-host";

type MeetingRoomPanelProps = {
  workerHost: WorkerHost;
};

type StatusChipProps = {
  label?: string;
  status: RenderStatusName;
  workerHost: WorkerHost;
};

const meetingRooms = [
  { id: "phuket", name: "Phuket", capacity: 8, zone: "Focus room" },
  { id: "pattaya", name: "Pattaya", capacity: 12, zone: "Project room" },
  { id: "singha", name: "Singha", capacity: 6, zone: "Quick sync" },
  { id: "chang", name: "Chang", capacity: 16, zone: "War room" },
];

const durationOptions = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hr" },
  { value: 90, label: "1.5 hr" },
  { value: 120, label: "2 hr" },
];

const workdayHours = Array.from({ length: 15 }, (_, index) => 7 + index);
const calendarHourStart = 7;
const calendarHourHeight = 46;
const calendarDayHeaderHeight = 76;
const calendarHourColumnWidth = 58;

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const todayKey = toDateKey(new Date());

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getMonday(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function formatWeekday(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 4);
  return `${formatShortDate(start)} - ${formatShortDate(end)}, ${end.getFullYear()}`;
}

function getCalendarMonthDays(anchorDate: Date): Date[] {
  const firstDay = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const gridStart = addDays(firstDay, -firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function StatusChip({ label, status, workerHost }: StatusChipProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const idRef = useRef(`meeting-status-${crypto.randomUUID()}`);
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

function buildMockBookings(date: string): MeetingRoomBooking[] {
  return [
    {
      id: `${date}-phuket-1`,
      roomId: "phuket",
      roomName: "Phuket",
      title: "Daily line review",
      owner: "Engineer",
      start: `${date}T08:30:00`,
      end: `${date}T09:15:00`,
      purpose: "Shift handover",
    },
    {
      id: `${date}-pattaya-1`,
      roomId: "pattaya",
      roomName: "Pattaya",
      title: "Planner commit",
      owner: "Planner",
      start: `${date}T10:00:00`,
      end: `${date}T11:00:00`,
      purpose: "WIP and output plan",
    },
    {
      id: `${date}-singha-1`,
      roomId: "singha",
      roomName: "Singha",
      title: "Tool alarm triage",
      owner: "Equipment",
      start: `${date}T13:00:00`,
      end: `${date}T13:45:00`,
      purpose: "Recovery action",
    },
    {
      id: `${date}-chang-1`,
      roomId: "chang",
      roomName: "Chang",
      title: "NPI readiness",
      owner: "Management",
      start: `${date}T14:00:00`,
      end: `${date}T15:30:00`,
      purpose: "Build readiness",
    },
    {
      id: `${date}-chang-2`,
      roomId: "chang",
      roomName: "Chang",
      title: "Customer call",
      owner: "Program",
      start: `${date}T16:00:00`,
      end: `${date}T17:00:00`,
      purpose: "Status update",
    },
  ];
}

function buildWorkWeekBookings(weekStart: Date): MeetingRoomBooking[] {
  const days = Array.from({ length: 5 }, (_, index) => toDateKey(addDays(weekStart, index)));

  return days.flatMap((date, index) => {
    const baseBookings = buildMockBookings(date);

    if (index === 0) {
      return [
        baseBookings[0],
        {
          id: `${date}-all-hands`,
          roomId: "chang",
          roomName: "Chang",
          title: "Weekly yields report",
          owner: "Planner",
          start: `${date}T08:00:00`,
          end: `${date}T08:45:00`,
          purpose: "Output review",
        },
        {
          id: `${date}-standup-night`,
          roomId: "phuket",
          roomName: "Phuket",
          title: "Daily stand-up Q2/Q3 readiness",
          owner: "Engineer",
          start: `${date}T20:00:00`,
          end: `${date}T20:45:00`,
          purpose: "Night coverage",
        },
      ];
    }

    if (index === 1) {
      return [
        baseBookings[1],
        {
          id: `${date}-npi`,
          roomId: "pattaya",
          roomName: "Pattaya",
          title: "NPI meeting between Fabrinet and Phononic",
          owner: "NPI",
          start: `${date}T14:00:00`,
          end: `${date}T15:00:00`,
          purpose: "Build plan",
        },
        {
          id: `${date}-team-dinner`,
          roomId: "singha",
          roomName: "Singha",
          title: "Team dinner planning",
          owner: "Program",
          start: `${date}T18:00:00`,
          end: `${date}T19:30:00`,
          purpose: "Team event",
        },
      ];
    }

    if (index === 2) {
      return [
        {
          id: `${date}-capacity`,
          roomId: "chang",
          roomName: "Chang",
          title: "Capacity readiness proposal",
          owner: "Planner",
          start: `${date}T08:00:00`,
          end: `${date}T08:45:00`,
          purpose: "Capacity",
        },
        {
          id: `${date}-contract`,
          roomId: "phuket",
          roomName: "Phuket",
          title: "Contract discussion",
          owner: "Management",
          start: `${date}T14:00:00`,
          end: `${date}T15:30:00`,
          purpose: "Commercial review",
        },
      ];
    }

    if (index === 3) {
      return [
        {
          id: `${date}-daily`,
          roomId: "pattaya",
          roomName: "Pattaya",
          title: "Daily stand-up for Q2/Q3 readiness",
          owner: "Engineer",
          start: `${date}T09:00:00`,
          end: `${date}T09:45:00`,
          purpose: "Execution",
        },
        {
          id: `${date}-solution`,
          roomId: "chang",
          roomName: "Chang",
          title: "NSW solution presentation",
          owner: "IT",
          start: `${date}T10:00:00`,
          end: `${date}T10:45:00`,
          purpose: "Support",
        },
        {
          id: `${date}-chang-project`,
          roomId: "chang",
          roomName: "Chang",
          title: "Project Chang status update",
          owner: "Program",
          start: `${date}T20:30:00`,
          end: `${date}T21:15:00`,
          purpose: "Program status",
        },
      ];
    }

    return [
      {
        id: `${date}-qa`,
        roomId: "singha",
        roomName: "Singha",
        title: "Quality assurance weekly",
        owner: "Quality",
        start: `${date}T08:00:00`,
        end: `${date}T09:00:00`,
        purpose: "Quality",
      },
    ];
  });
}

function formatBookingTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function getBookingTop(start: string): number {
  const date = new Date(start);
  const minutes = Math.max(0, (date.getHours() - calendarHourStart) * 60 + date.getMinutes());

  return calendarDayHeaderHeight + (minutes / 60) * calendarHourHeight;
}

function getBookingHeight(start: string, end: string): number {
  const durationMinutes = Math.max(20, (new Date(end).getTime() - new Date(start).getTime()) / 60000);

  return Math.max(24, (durationMinutes / 60) * calendarHourHeight);
}

function getBookingLeft(dayIndex: number): string {
  return `calc(${calendarHourColumnWidth}px + ((100% - ${calendarHourColumnWidth}px) / 5) * ${dayIndex} + 4px)`;
}

function getBookingWidth(): string {
  return `calc((100% - ${calendarHourColumnWidth}px) / 5 - 8px)`;
}

function getBookingDetailTop(start: string, end: string): number {
  return Math.min(
    calendarDayHeaderHeight + calendarHourHeight * workdayHours.length - 230,
    getBookingTop(start) + getBookingHeight(start, end) + 8,
  );
}

function getBookingDetailLeft(dayIndex: number): string {
  if (dayIndex >= 3) {
    return `calc(${calendarHourColumnWidth}px + ((100% - ${calendarHourColumnWidth}px) / 5) * ${dayIndex} - 280px)`;
  }

  return `calc(${calendarHourColumnWidth}px + ((100% - ${calendarHourColumnWidth}px) / 5) * ${dayIndex} + 18px)`;
}

export function MeetingRoomPanel({ workerHost }: MeetingRoomPanelProps) {
  const [meetingDate, setMeetingDate] = useState(todayKey);
  const [startTime, setStartTime] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [selectedRoomId, setSelectedRoomId] = useState("pattaya");
  const [owner, setOwner] = useState("Planner");
  const [purpose, setPurpose] = useState("Production sync");
  const [visibleRoomIds, setVisibleRoomIds] = useState(() => new Set(meetingRooms.map((room) => room.id)));
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [status, setStatus] = useState<RenderStatusName>("idle");
  const [result, setResult] = useState<MeetingRoomResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const weekStart = useMemo(() => getMonday(parseDateKey(meetingDate)), [meetingDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekBookings = useMemo(() => buildWorkWeekBookings(weekStart), [weekStart]);
  const bookings = useMemo(() => buildMockBookings(meetingDate), [meetingDate]);
  const visibleBookings = useMemo(
    () => weekBookings.filter((booking) => visibleRoomIds.has(booking.roomId)),
    [visibleRoomIds, weekBookings],
  );
  const selectedBooking = useMemo(
    () => visibleBookings.find((booking) => booking.id === selectedBookingId) ?? null,
    [selectedBookingId, visibleBookings],
  );
  const selectedBookingDayIndex = selectedBooking
    ? weekDays.findIndex((day) => toDateKey(day) === selectedBooking.start.slice(0, 10))
    : -1;
  const monthDays = useMemo(() => getCalendarMonthDays(parseDateKey(meetingDate)), [meetingDate]);
  const selectedRoom = result?.rooms.find((room) => room.roomId === selectedRoomId);

  const requestPayload = useMemo(
    () => ({
      date: meetingDate,
      startTime,
      durationMinutes,
      selectedRoomId,
      rooms: meetingRooms,
      bookings,
    }),
    [bookings, durationMinutes, meetingDate, selectedRoomId, startTime],
  );

  useEffect(() => {
    let isCurrent = true;
    setStatus("running");
    setError(null);

    void workerHost
      .post<MeetingRoomResultPayload>("compute", "planner:meeting-rooms", requestPayload)
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
        setError(reason instanceof Error ? reason.message : "Unable to calculate room availability.");
      });

    return () => {
      isCurrent = false;
    };
  }, [requestPayload, workerHost]);

  const goToToday = () => setMeetingDate(todayKey);
  const moveWeek = (amount: number) => setMeetingDate(toDateKey(addDays(weekStart, amount * 7)));
  const toggleRoom = (roomId: string) => {
    setVisibleRoomIds((current) => {
      const next = new Set(current);

      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }

      return next;
    });
    setSelectedBookingId(null);
  };

  return (
    <section className="meeting-page" aria-label="Meeting Room Planner">
      <article className="panel meeting-summary-panel">
        <p className="eyebrow">Planner workspace</p>
        <h2>Book factory meetings without schedule collisions.</h2>
        <p>Room availability, conflicts, and calendar cards for daily planning.</p>
      </article>

      <article className="panel meeting-tool-card">
        <div className="tool-card-header">
          <div>
            <p className="eyebrow">Meeting room</p>
            <h3>Room Calendar Mockup</h3>
          </div>
          <StatusChip status={status} workerHost={workerHost} />
        </div>

        <div className="meeting-control-grid">
          <label>
            <span>Date</span>
            <input
              type="date"
              value={meetingDate}
              onChange={(event) => setMeetingDate(event.target.value)}
            />
          </label>

          <label>
            <span>Start</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </label>

          <label>
            <span>Duration</span>
            <select
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
            >
              {durationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Room</span>
            <select
              value={selectedRoomId}
              onChange={(event) => setSelectedRoomId(event.target.value)}
            >
              {meetingRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Owner</span>
            <input value={owner} onChange={(event) => setOwner(event.target.value)} />
          </label>

          <label>
            <span>Purpose</span>
            <input value={purpose} onChange={(event) => setPurpose(event.target.value)} />
          </label>
        </div>

        {error ? <div className="error-note">{error}</div> : null}

        <div className={`meeting-hero meeting-status-${selectedRoom?.status ?? "available"}`}>
          <div>
            <span>Request window</span>
            <strong>{result?.requestedRangeLabel ?? "--"}</strong>
            <p>
              {owner} • {purpose}
            </p>
          </div>
          <div>
            <span>Selected room</span>
            <strong>{selectedRoom?.roomName ?? "--"}</strong>
            <p>{selectedRoom?.statusLabel ?? "Calculating availability"}</p>
          </div>
        </div>

        <div className="yield-metric-grid">
          {result?.metrics.map((metric) => (
            <article className={`yield-metric-card yield-tone-${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          )) ?? null}
        </div>

        <div className="meeting-outlook-shell">
          <aside className="meeting-outlook-sidebar" aria-label="Meeting room calendars">
            <section className="meeting-mini-calendar">
              <div className="meeting-mini-calendar-header">
                <strong>{formatMonthYear(parseDateKey(meetingDate))}</strong>
              </div>
              <div className="meeting-mini-weekdays">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="meeting-mini-days">
                {monthDays.map((day) => {
                  const key = toDateKey(day);
                  const isSelected = key === meetingDate;
                  const isCurrentMonth = day.getMonth() === parseDateKey(meetingDate).getMonth();

                  return (
                    <button
                      key={key}
                      className={isCurrentMonth ? "" : "is-muted"}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setMeetingDate(key)}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="meeting-calendar-list">
              <p className="eyebrow">Rooms</p>
              {meetingRooms.map((room) => (
                <label key={room.id}>
                  <input
                    checked={visibleRoomIds.has(room.id)}
                    type="checkbox"
                    onChange={() => toggleRoom(room.id)}
                  />
                  <span>{room.name}</span>
                </label>
              ))}
            </section>
          </aside>

          <section className="meeting-outlook-calendar" aria-label="Work week room calendar">
            <div className="meeting-calendar-toolbar">
              <div className="meeting-calendar-actions">
                <button type="button" onClick={goToToday}>Today</button>
                <button type="button" aria-label="Previous week" onClick={() => moveWeek(-1)}>‹</button>
                <button type="button" aria-label="Next week" onClick={() => moveWeek(1)}>›</button>
              </div>
              <strong>{formatWeekRange(weekStart)}</strong>
              <span>Work Week</span>
            </div>

            <div className="meeting-week-grid">
              <div className="meeting-week-corner" />
              {weekDays.map((day) => (
                <button
                  key={toDateKey(day)}
                  className="meeting-week-day-header"
                  type="button"
                  aria-pressed={toDateKey(day) === meetingDate}
                  onClick={() => setMeetingDate(toDateKey(day))}
                >
                  <span>{formatWeekday(day)}</span>
                  <strong>{formatShortDate(day)}</strong>
                </button>
              ))}

              {workdayHours.map((hour) => (
                <div
                  className="meeting-hour-label"
                  key={`hour-${hour}`}
                  style={{ gridRow: hour - calendarHourStart + 2 }}
                >
                  {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                </div>
              ))}

              {weekDays.map((day, dayIndex) => (
                <div
                  className="meeting-day-column"
                  key={`column-${toDateKey(day)}`}
                  style={{ gridColumn: dayIndex + 2 }}
                />
              ))}

              {visibleBookings.map((booking) => {
                const dayIndex = weekDays.findIndex((day) => toDateKey(day) === booking.start.slice(0, 10));

                if (dayIndex < 0) {
                  return null;
                }

                return (
                  <button
                    className={`meeting-outlook-event room-${booking.roomId}`}
                    key={booking.id}
                    type="button"
                    aria-pressed={selectedBookingId === booking.id}
                    onClick={() => setSelectedBookingId((current) => (current === booking.id ? null : booking.id))}
                    style={{
                      top: `${getBookingTop(booking.start)}px`,
                      left: getBookingLeft(dayIndex),
                      width: getBookingWidth(),
                      height: `${getBookingHeight(booking.start, booking.end)}px`,
                    }}
                    title={`${booking.title} • ${booking.roomName}`}
                  >
                    <strong>{booking.title}</strong>
                    <span>
                      {formatBookingTime(booking.start)} - {formatBookingTime(booking.end)}
                    </span>
                    <small>{booking.roomName}</small>
                  </button>
                );
              })}

              {selectedBooking && selectedBookingDayIndex >= 0 ? (
                <aside
                  className="meeting-detail-popover"
                  style={{
                    top: `${getBookingDetailTop(selectedBooking.start, selectedBooking.end)}px`,
                    left: getBookingDetailLeft(selectedBookingDayIndex),
                  }}
                  aria-live="polite"
                >
                  <button
                    className="meeting-detail-close"
                    type="button"
                    aria-label="Close meeting details"
                    onClick={() => setSelectedBookingId(null)}
                  >
                    ×
                  </button>
                  <span>{selectedBooking.roomName}</span>
                  <strong>{selectedBooking.title}</strong>
                  <dl>
                    <div>
                      <dt>Time</dt>
                      <dd>
                        {formatBookingTime(selectedBooking.start)} - {formatBookingTime(selectedBooking.end)}
                      </dd>
                    </div>
                    <div>
                      <dt>Owner</dt>
                      <dd>{selectedBooking.owner}</dd>
                    </div>
                    <div>
                      <dt>Purpose</dt>
                      <dd>{selectedBooking.purpose}</dd>
                    </div>
                  </dl>
                  <p>Transparent meeting preview for planner review before Outlook sync.</p>
                </aside>
              ) : null}
            </div>
          </section>
        </div>
      </article>
    </section>
  );
}
