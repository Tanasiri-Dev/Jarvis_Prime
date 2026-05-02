# Jarvis Prime - Codex Handoff

Use this file to resume development quickly with Codex without restating the whole project context.

## Current Project State

- Repository: `D:\Development\Jarvis Prime`
- Remote: `git@github.com:Tanasiri-Dev/Jarvis_Prime.git`
- Main branch: `master`
- Frontend dev URL: `http://127.0.0.1:5173/`
- Primary app route for current work: `#public-holidays`

## Architecture Rules To Preserve

- Project source-of-truth rules live in `CODEX.md`.
- React + TypeScript + Vite frontend, chosen in `docs/adr/0001-frontend-framework.md`.
- Heavy calculation runs through `WorkerHost` and `compute-worker`.
- Canvas rendering remains off-main-thread through `render-worker` and `OffscreenCanvas`.
- Keep features module-oriented. Current engineering tools live under:
  - `frontend/src/modules/engineering-tools/EngineeringToolsPanel.tsx`
  - `frontend/src/modules/engineering-tools/EngineeringToolsModule.ts`
- Public holiday planner route lives under:
  - `frontend/src/modules/public-holidays/PublicHolidayPanel.tsx`
  - `frontend/src/modules/public-holidays/PublicHolidaysModule.ts`
- Shared worker message contracts live in:
  - `frontend/src/core/worker-messages.ts`
- Internationalization foundation lives in:
  - `frontend/src/core/i18n.ts`
- Tool calculations currently live in:
  - `frontend/src/workers/compute-worker.ts`

## Commands

```powershell
cd "D:\Development\Jarvis Prime\frontend"
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
npm run dev
npm run typecheck
npm run build
```

Backend checks:

```powershell
cd "D:\Development\Jarvis Prime"
.\backend\.venv\Scripts\python -m ruff check backend
.\backend\.venv\Scripts\python -m pytest backend
cd backend
.\.venv\Scripts\python -m mypy app
```

Git:

```powershell
git status --short --branch
git log --oneline -5
git push
```

## Implemented Engineering Tools

Route: `http://127.0.0.1:5173/#engineering-tools`

- WorkWeek / Shift Calculator
  - Shows date-to-WorkWeek output with a monthly calendar and WorkWeek column.
  - Includes a WorkWeek-to-date range converter for ISO year + WorkWeek inputs.
  - Uses `tool:week-shift` in `compute-worker`.
  - Uses `tool:week-range` in `compute-worker`.
- Duration Calculator
  - Start and End inputs are equal width.
  - Break minutes is displayed as a tile aligned with Crosses midnight.
  - Uses `tool:duration` in `compute-worker`.
- Time Utilities
  - Includes Sum Hours, Convert Time, Work Hours, Add/Subtract Time, and Count Dates modes.
  - Supports common duration formats such as `1:30`, `2h 15m`, `45m`, and decimal hours.
  - Uses `tool:time-utility` in `compute-worker`.
- Timezone Converter
  - Modern timezone card UI.
  - Defaults are loaded from `frontend/public/config/timezones.json`.
  - UTC is displayed as a top inline reference instead of a city card.
  - Default cards include Bangkok, Los Angeles, Durham NC (`America/New_York`), China (`Asia/Shanghai`), Italy (`Europe/Rome`), Tokyo.
  - User-added timezone cards are persisted in browser `localStorage` under `jarvis-prime.timezones`.
  - Add city uses the browser IANA timezone list via `Intl.supportedValuesOf("timeZone")`, with configured timezones as fallback.
  - Flag badges were removed to avoid external image/CDN dependency.
  - Uses `tool:timezone` in `compute-worker`.
- Factory Clock
  - Live local clock, UTC, current shift, next shift, shift-change remaining time.
  - Uses `tool:factory-clock` in `compute-worker`.
- Online Alarm
  - Multiple browser-based alarms with hour/minute selectors, quick time presets, labels, pause/remove actions, and test sound.
  - Uses lightweight frontend timer state; browser audio may require a user interaction before playback.
- Countdown Timer
  - Countdown timer with hour/minute/second selectors, quick presets, start/pause/reset, progress bar, timer label, and test sound.
  - Uses lightweight frontend timer state; browser audio may require a user interaction before playback.
- Process Stopwatch
  - Start/Stop/Lap/Reset plus Excel export.
  - Premium circular action buttons with color variants and shimmer effect.
  - Export is separated from the main stopwatch controls.
  - Keyboard shortcuts are active on the Stopwatch tool: Space start/stop, L lap, R reset, F full screen.
  - Lap history highlights faster, slower, and steady laps compared with the previous lap.
- Alarm Decoder
  - Decodes pasted SECS/GEM-style alarm payloads such as `S5F1 ALCD=0x85 ALID=3001 ALTX="..."`.
  - Parses ALCD, ALID, ALTX, set/clear state, category, severity, and recommended actions.
  - Uses `tool:alarm-decode` in `compute-worker`.
- Unit Converter
  - Converts Length, Temperature, Pressure, Vacuum, and Mass.
  - Shows the primary converted value, formula path, all related values in the selected category, and a Swap action.
  - Uses `tool:unit-convert` in `compute-worker`.
- Yield / Scrap / UPH Calculator
  - Calculates yield percent, scrap percent, actual UPH, total UPH, target gap, projected target output, and quantity reconciliation.
  - Shows line-performance status and recommended actions for variance, scrap, and throughput risk.
  - Uses `tool:yield-calculate` in `compute-worker`.
- Capacity / Takt / Loading Planner
  - Calculates staffed tools, net production window, total capacity, capacity gap, load percent, required tools, required run hours, and takt.
  - Designed for Planner and Manufacturing Engineer use cases.
  - Uses `tool:capacity-plan` in `compute-worker`.
- OEE / Downtime Calculator
  - Calculates Availability, Performance, Quality, OEE, run window, lost units, reject count, and top downtime reason.
  - Designed for Manufacturing Engineer, Planner, and Operator use cases.
  - Uses `tool:oee-calculate` in `compute-worker`.
- SPC Quick Helper
  - Calculates Cp, Cpk, mean, sample standard deviation, min, max, range, out-of-spec count, and capability status.
  - Designed for Manufacturing Engineer and Planner quality checks.
  - Uses `tool:spc-calculate` in `compute-worker`.

## Implemented Planner Tools

Route: `http://127.0.0.1:5173/#public-holidays`

- Public Holidays
  - Added as a left-side primary navigation item named `Holidays`.
  - Defaults to `United States (US)` because Thailand coverage is incomplete.
  - Looks up public holidays by seeded city presets: United States, Durham NC, Bangkok, Shanghai, Rome, Tokyo, and Los Angeles.
  - Uses Nager.Date public holiday API and performs city/subdivision filtering plus month grouping in `compute-worker`.
  - Month count badges and current-month highlight render through `render-worker` canvas overlays that resize with the page/sidebar.
  - Uses `tool:public-holidays` in `compute-worker`.
- Meeting Room
  - Added as a left-side primary navigation item named `Meeting Room`.
  - Mock planner calendar for Phuket, Pattaya, Singha, and Chang rooms.
  - Uses an Outlook-like Work Week UI with a mini calendar, room checkbox list, week toolbar, time grid, and positioned meeting blocks.
  - Clicking a meeting block opens a transparent glass detail popover with room, title, time, owner, and purpose.
  - Supports date, start time, duration, room, owner, and purpose inputs.
  - Calculates availability, conflicts, tight windows, recommended room, timeline, and calendar cards in `compute-worker`.
  - Uses `planner:meeting-rooms` in `compute-worker`.

## UI System Notes

- Internationalization foundation supports `en`, `th`, and `zh-CN`.
- Language preference is stored in `localStorage` under `jarvis-prime.locale`.
- Current translated surface includes app navigation, top bar route titles, Command Center summary, footer, theme labels, language labels, common shell text, Diagnostics labels, Public Holiday panel shell, Meeting Room panel shell/calendar labels, Engineering Tools intro/tool-library labels, plus detailed labels for WorkWeek, Duration, Stopwatch, Alarm Decoder, Unit Converter, OEE, and SPC.
- Next i18n pass should move remaining tools such as Time Utilities, Timezone, Factory Clock, Online Alarm, Countdown, Yield, Capacity, and worker-generated metric/action labels into dictionaries.
- Theme switcher is compact icon-only: moon for dark, sun for white.
- Default dark theme follows the `CODEX.md` crypto-native glassmorphism direction: dark glass panels, luminous borders, sticky glass top bar, and stronger glow on hover.
- Page header titles use gradient text, and the top toolbar uses a pure liquid glass style with blur, saturation, inner highlights, and soft reflection.
- Theme styling is tokenized in `frontend/src/app/App.css`.
- Tool status chips use small OffscreenCanvas lights rendered by `render-worker`; `running` chips add a passing light scan, while `ready/online` use a check-style status light.
- Tool Library is on the right and selects one active tool at a time.
- Tool Library groups are ordered: Week, Day, Time, Unit Convert, Manufacturing, Decoder.
- Tool Library includes role filters: All, Engineer, Planner, Operator.
- Tool Library has an independent constrained scroll container and reveals its vertical scrollbar only on hover/focus.
- Avoid showing all tools at once. Add new tools as selectable tool cards.
- Preserve responsive layouts.

## Recommended Next Tool

Add `CSV and log quick parser` after sample logs are available.

Suggested first fields:

- Raw log text or uploaded sample log
- Pattern hints for timestamp, tool id, alarm id, and severity
- Parsed rows with filtering
- Export to CSV / Excel

## Latest Working Verification

Before this handoff was created:

- `npm run typecheck` passed.
- `npm run build` passed.
- `http://127.0.0.1:5173/#engineering-tools` responded with HTTP 200.

## Resume Prompt Template

Use this when returning:

```text
อ่าน CODEX_HANDOFF.md แล้วทำงานต่อจากสถานะล่าสุด
ต่อไปช่วยเพิ่ม/ปรับ <งานที่ต้องการ>
หลังทำเสร็จให้ run typecheck/build, commit และ push
```
