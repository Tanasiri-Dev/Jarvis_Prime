# Jarvis Prime - Codex Handoff

Use this file to resume development quickly with Codex without restating the whole project context.

## Current Project State

- Repository: `D:\Development\Jarvis Prime`
- Remote: `git@github.com:Tanasiri-Dev/Jarvis_Prime.git`
- Main branch: `master`
- Frontend dev URL: `http://127.0.0.1:5173/`
- Primary app route for current work: `#engineering-tools`

## Architecture Rules To Preserve

- Project source-of-truth rules live in `CODEX.md`.
- React + TypeScript + Vite frontend, chosen in `docs/adr/0001-frontend-framework.md`.
- Heavy calculation runs through `WorkerHost` and `compute-worker`.
- Canvas rendering remains off-main-thread through `render-worker` and `OffscreenCanvas`.
- Keep features module-oriented. Current engineering tools live under:
  - `frontend/src/modules/engineering-tools/EngineeringToolsPanel.tsx`
  - `frontend/src/modules/engineering-tools/EngineeringToolsModule.ts`
- Shared worker message contracts live in:
  - `frontend/src/core/worker-messages.ts`
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

## UI System Notes

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

Add `OEE / downtime calculator` next.

Suggested first fields:

- Planned production time
- Downtime minutes
- Ideal cycle time or target UPH
- Total count
- Good count
- Downtime reason summary

Suggested implementation pattern:

1. Add `oee-calculator` to `ActiveTool`.
2. Add item to `toolOptions` under `Manufacturing` for Engineer and Planner.
3. Add request/result types in `frontend/src/core/worker-messages.ts`.
4. Add `tool:oee-calculate` handler in `frontend/src/workers/compute-worker.ts`.
5. Return Availability, Performance, Quality, OEE, top downtime reason, and recommended actions.
6. Add export/copy result after the calculation is stable.
7. Run `npm run typecheck` and `npm run build`.
8. Commit and push.

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
