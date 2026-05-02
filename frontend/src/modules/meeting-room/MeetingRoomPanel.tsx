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

const todayKey = new Date().toISOString().slice(0, 10);

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

function formatBookingTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function MeetingRoomPanel({ workerHost }: MeetingRoomPanelProps) {
  const [meetingDate, setMeetingDate] = useState(todayKey);
  const [startTime, setStartTime] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [selectedRoomId, setSelectedRoomId] = useState("pattaya");
  const [owner, setOwner] = useState("Planner");
  const [purpose, setPurpose] = useState("Production sync");
  const [status, setStatus] = useState<RenderStatusName>("idle");
  const [result, setResult] = useState<MeetingRoomResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bookings = useMemo(() => buildMockBookings(meetingDate), [meetingDate]);
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

        <div className="meeting-room-grid">
          {result?.rooms.map((room) => (
            <button
              key={room.roomId}
              className={`meeting-room-card meeting-room-${room.status}`}
              type="button"
              aria-pressed={selectedRoomId === room.roomId}
              onClick={() => setSelectedRoomId(room.roomId)}
            >
              <span>{room.zone}</span>
              <strong>{room.roomName}</strong>
              <small>{room.capacity} seats • {room.utilizationPercent}% booked</small>
              <em>{room.statusLabel}</em>
            </button>
          )) ?? null}
        </div>

        <div className="meeting-planner-grid">
          <section className="history-panel">
            <div className="history-header">
              <span>Timeline</span>
              <strong>{meetingDate}</strong>
            </div>
            <div className="meeting-timeline">
              {result?.timeline.map((slot) => (
                <div className="meeting-timeline-row" key={slot.hourLabel}>
                  <span>{slot.hourLabel}</span>
                  <div>
                    {slot.bookings.length === 0 ? (
                      <small>Open</small>
                    ) : (
                      slot.bookings.map((booking) => (
                        <b key={booking.id}>{booking.roomName}</b>
                      ))
                    )}
                  </div>
                </div>
              )) ?? null}
            </div>
          </section>

          <section className="history-panel">
            <div className="history-header">
              <span>Calendar cards</span>
              <strong>{bookings.length}</strong>
            </div>
            <div className="meeting-booking-list">
              {bookings.map((booking) => (
                <article className="meeting-booking-card" key={booking.id}>
                  <div>
                    <strong>{booking.title}</strong>
                    <span>
                      {formatBookingTime(booking.start)} - {formatBookingTime(booking.end)}
                    </span>
                  </div>
                  <small>{booking.roomName}</small>
                  <p>{booking.owner} • {booking.purpose}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </article>
    </section>
  );
}
