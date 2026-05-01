# ADR-0001: Frontend Framework Choice

Status: Accepted

Date: 2026-05-01

---

## Context

Jarvis Prime needs a premium, dense, highly interactive web interface for daily engineering work and factory-tool intelligence. The frontend must support role-based screens, dashboards, diagnostics, engineering tools, and future real-time equipment views.

The hard architectural rules require true parallelism, worker-based heavy logic, OffscreenCanvas rendering inside workers, OOP feature modules, and an AudioWorklet-ready message architecture.

The main decision is whether to use Vanilla TypeScript or React with TypeScript.

---

## Decision

Use **React + TypeScript + Vite** for the Jarvis Prime frontend.

React is the UI orchestration layer only. It owns DOM composition, routing, state presentation, accessibility, and interaction wiring. It must not own heavy computation or canvas rendering.

Hard boundaries:

- Heavy parsing, filtering, graph layout, file processing, and AI post-processing run in Web Workers.
- Canvas rendering runs in workers through OffscreenCanvas.
- Feature code obtains workers through `WorkerHost`.
- Feature modules are classes registered through `ModuleRegistry`.
- React components may mount module views, but module logic stays isolated behind OOP contracts.

---

## Consequences

Benefits:

- React gives strong composition for a complex SaaS dashboard.
- TypeScript improves contracts between modules, workers, and backend schemas.
- Vite provides a lean development loop and first-class TypeScript support.
- The team can reuse mature React ecosystem patterns for accessibility, forms, and testing.

Costs:

- React can tempt developers to put compute in hooks or render paths. This is forbidden by R1 and must be caught in review.
- Worker and OffscreenCanvas boundaries require deliberate architecture from the first phase.
- React StrictMode can double-run effects in development, so worker/canvas transfer code must be idempotent or mounted outside StrictMode until hardened.

---

## Alternatives Considered

- **Vanilla TypeScript + Vite**: smallest bundle and direct control, but slower to build a large role-based dashboard and more local UI infrastructure would be needed.
- **React + TypeScript + Vite**: selected. Good balance of productivity and control as long as workers remain mandatory for heavy work.
- **Next.js**: rejected for now because Jarvis Prime is an authenticated operational app, not an SSR/content-first site. It adds routing and server concerns that do not help Phase 0.
- **Vue/Svelte/Solid**: not selected because React has the broadest team familiarity and ecosystem support for dashboard-style applications.

---

## Validation

Phase 0 must prove:

- React shell mounts without blocking the main thread.
- `WorkerHost` is the only worker creation gateway used by feature modules.
- A diagnostics canvas is transferred to a render worker with OffscreenCanvas.
- No main-thread `requestAnimationFrame` canvas painting exists.
- TypeScript contracts exist for module lifecycle and worker messages.

---

## Related Rules

- R1: True Parallelism
- R2: Worker Rendering
- R3: OOP + Callbacks
- R4: AudioWorklet-ready
- R5: Tech stack lock
- R11: Testable modules
- R12: ADR for major decisions
