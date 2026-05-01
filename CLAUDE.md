# Jarvis Prime - Assistance Web Platform

> Source of truth for project vision, hard architectural rules, product scope, conventions, and historical decisions. Read this first in every AI-assisted coding session.

---

## 1. Mission

Build a highly optimized daily assistance web platform for engineers, planners, operators, managers, and technically curious users working around semiconductor, electronic manufacturing, and factory tools.

Jarvis Prime combines:

- AI-assisted daily work planning and task follow-up.
- Engineering utilities for calculations, review, conversion, and troubleshooting.
- Semiconductor and factory-tool intelligence, including SECS/GEM-ready machine integration.
- A premium SaaS-grade interface that feels fast, calm, and dependable during real production work.

Target users: **Admin, Engineer, Planner, Management, Operator, Viewer (Guest)**.

---

## 2. Product Principles

1. **Operator-grade reliability** - dashboards and actions must be predictable under pressure.
2. **Engineer-first density** - expose useful data without marketing-style filler.
3. **AI as assistant, not authority** - AI may suggest, summarize, draft, and rank; the system must preserve human approval for risky actions.
4. **Factory data is sensitive** - logs, recipes, alarms, traceability, documents, and prompts are protected by least privilege.
5. **Fast by architecture** - performance is not a later optimization. It is a core contract.
6. **Composable modules** - every feature can be enabled, disabled, tested, and replaced independently.
7. **Audit everything important** - security-sensitive and production-impacting actions must leave a clear trail.

---

## 3. Hard Architectural Rules (NON-NEGOTIABLE)

Any code that breaks these rules is a defect unless an accepted ADR explicitly changes the rule.

| # | Rule | Implication |
|---|------|-------------|
| R1 | **True Parallelism** - heavy frontend logic runs in `Web Workers`. | Main thread stays responsive at 60 fps. No blocking compute on UI thread. |
| R2 | **Worker Rendering** - canvas rendering uses `OffscreenCanvas` inside workers. | No main-thread canvas painting. UI thread only owns DOM orchestration. |
| R3 | **OOP + Callbacks** - features are independent classes and communicate through callbacks, events, or message passing. | No tight coupling, no shared mutable globals, hot-swappable modules. |
| R4 | **AudioWorklet-ready** - the architecture must accept an `AudioWorklet` pipeline in v2 without refactor. | Worker registry and message bus are media-agnostic. |
| R5 | **Tech stack lock** - FastAPI async backend, Python SECS/GEM layer, React or Vanilla TypeScript frontend with worker integration, PostgreSQL database. | No alternative backend runtime, frontend runtime, database, or ORM without ADR. |
| R6 | **Security baseline** - passwords use `bcrypt`; auth uses JWT; middleware verifies every protected request; RBAC is enforced server-side. | No plaintext passwords. No client-only role gating. |
| R7 | **Async all the way** - backend I/O uses async APIs for DB, network, and equipment communication where libraries support it. | Blocking equipment or DB calls must be isolated from request handlers. |
| R8 | **Audit and traceability** - production-impacting, security-sensitive, and AI-assisted decisions are logged. | Actions can be reviewed by user, time, source module, and affected entity. |
| R9 | **Provider isolation for AI** - AI providers are behind an internal service interface. | No feature code calls external model APIs directly. Prompts are versioned. |
| R10 | **Privacy and IP protection** - factory data sent to AI must pass policy checks, redaction, and user permission rules. | No raw confidential payloads leave the trusted boundary by accident. |
| R11 | **Testable modules** - every module ships with contract tests or harness tests for its public behavior. | No feature is considered complete without verification. |
| R12 | **ADR for major decisions** - any decision that constrains architecture, security, data model, or deployment requires an ADR. | Historical reasoning stays visible. |

---

## 4. Role Model And RBAC

Server-side authorization is the source of truth. The frontend may hide actions for usability, but it must never be the only gate.

| Capability | Admin | Engineer | Planner | Management | Operator | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Manage users and roles | Y |  |  |  |  |  |
| Configure system settings | Y |  |  |  |  |  |
| View personal assistant dashboard | Y | Y | Y | Y | Y | Y |
| Create and assign tasks | Y | Y | Y | Y |  |  |
| Run engineering tools | Y | Y | Y |  | Y |  |
| View factory dashboards | Y | Y | Y | Y | Y | Y |
| Send SECS/GEM remote commands | Y | Y |  |  |  |  |
| Acknowledge alarms | Y | Y |  |  | Y |  |
| Edit production plan | Y |  | Y |  |  |  |
| Access traceability genealogy | Y | Y | Y | Y | Y | Y |
| Approve AI-suggested risky action | Y | Y |  |  |  |  |
| View audit logs | Y |  |  | Y |  |  |

---

## 5. Product Modules

| ID | Module | Goal |
|----|--------|------|
| M1 | Authentication and RBAC | Register, login, refresh, logout, server-side permissions, role management. |
| M2 | Daily Command Center | Personal day plan, reminders, focus queue, shift handover, follow-up tracking. |
| M3 | AI Work Assistant | Summarize notes, draft replies, extract tasks, classify issues, suggest next actions. |
| M4 | Engineering Tools | Unit conversion, week/date calculator, SPC helpers, recipe compare, alarm decoder, log parser. |
| M5 | Knowledge Hub | Searchable SOPs, lessons learned, troubleshooting cards, engineering notes. |
| M6 | Factory Dashboard | Tool status, alarm timeline, WIP snapshot, utilization, engineering watchlist. |
| M7 | SECS/GEM Integration | HSMS connection lifecycle, SVID subscriptions, events, alarms, remote command gateway. |
| M8 | Traceability | Lot, wafer, panel, material, station, and process genealogy. |
| M9 | Planner Workspace | Production plan, priority queue, hold/release coordination, capacity signals. |
| M10 | Reports and Management View | KPI dashboards, trend summaries, exported reports, audit-friendly history. |
| M11 | Sandbox and Diagnostics | Worker load tests, API health, message bus inspection, rendering diagnostics. |
| M12 | Admin Console | Users, roles, permissions, feature flags, AI policy, integration settings. |

Each module must be implemented as an isolated class registered through the module registry. Modules must not directly instantiate workers, API clients, or global services outside the approved context object.

---

## 6. Web App UX Architecture

### Primary Navigation

Use a persistent left navigation for desktop and a compact icon rail for dense operator stations.

Core sections:

- Command Center
- Tasks
- Engineering Tools
- Factory
- Traceability
- Planner
- Knowledge
- Reports
- Admin
- Diagnostics

### First Screen

The first screen after login is the **Command Center**, not a landing page. It should show:

- Current shift/day focus.
- Open assigned tasks.
- Urgent alarms or watches the user is allowed to see.
- AI-prepared summaries waiting for review.
- Quick launch tools.
- Recent handover notes.

### Design Standard

- Dense, calm, premium SaaS dashboard style.
- Industrial clarity over decorative composition.
- 8-point spacing grid.
- Status colors are semantic and reserved:
  - Running: green
  - Idle: neutral or blue-gray
  - Alarm: amber
  - Error: red
  - Offline: gray
- WCAG AA contrast for status text.
- Motion is short and purposeful: <=200 ms feedback, <=400 ms layout transition.
- Tables, charts, and command surfaces must be keyboard reachable and screen-reader labelled.

### Expected Screens

- Login and session recovery.
- Command Center.
- My Tasks and Team Tasks.
- AI Review Queue.
- Engineering Tools Library.
- Tool Status Dashboard.
- Tool Detail View.
- Alarm and Event Timeline.
- Traceability Search.
- Lot/Wafer Genealogy Graph.
- Production Plan Board.
- Knowledge Search and Article View.
- Reports Dashboard.
- Admin Users and Roles.
- Diagnostics Sandbox.

---

## 7. Frontend Conventions

Target stack: React + TypeScript + Vite is allowed if worker integration remains first-class. Vanilla TypeScript is also allowed. The selected approach must be recorded in ADR-0001.

Expected layout:

```text
frontend/
  src/
    main.tsx
    app/
    core/
      api-client.ts
      auth-client.ts
      event-bus.ts
      module-registry.ts
      worker-host.ts
    workers/
      render-worker.ts
      compute-worker.ts
      ingest-worker.ts
    worklets/
      audio-worklet-placeholder.ts
    modules/
      command-center/
      tasks/
      ai-assistant/
      engineering-tools/
      factory/
      traceability/
      planner/
      knowledge/
      reports/
      admin/
      diagnostics/
    ui/
    styles/
    tests/
```

Rules:

- Feature modules export one class implementing the module contract.
- Feature code requests workers through `WorkerHost`; it must not call `new Worker()` directly.
- Render-heavy visualizations use `OffscreenCanvas` transferred to the render worker.
- Compute-heavy parsing, graph layout, file processing, and AI post-processing run in workers.
- Module lifecycle contract: `init(ctx)`, `mount(target)`, `dispose()`.
- Use typed message envelopes for worker communication.
- Prefer Transferable objects for large payloads.
- No shared mutable global state.
- No localStorage for access tokens.

---

## 8. Backend Conventions

Target stack:

- FastAPI async.
- SQLAlchemy 2.x async sessions.
- Alembic migrations.
- PostgreSQL.
- Pydantic schemas.
- Python SECS/GEM integration layer.
- Pytest with async HTTP tests.

Expected layout:

```text
backend/
  app/
    main.py
    core/
      config.py
      security.py
      deps.py
      permissions.py
    api/v1/
      auth/
      users/
      tasks/
      ai/
      tools/
      factory/
      secs_gem/
      traceability/
      planner/
      knowledge/
      reports/
      admin/
    models/
    schemas/
    services/
    db/
    workers/
  secs_gem/
  alembic/
  tests/
  pyproject.toml
```

Rules:

- Request handlers stay thin. Put business logic in services.
- RBAC checks happen in FastAPI dependencies or service-level guards.
- Equipment communication must not block API request handlers.
- Long-running jobs use background workers or task queues after an ADR.
- API responses use stable Pydantic schemas.
- Every database schema change has an Alembic migration.
- Every production-impacting API records an audit entry.

---

## 9. AI Governance

AI features must follow these rules:

- AI output is always marked as generated or suggested.
- Risky actions require explicit human approval.
- Prompts, tools, and retrieval policies are versioned.
- AI provider calls happen only through the backend AI service.
- Redaction and policy checks run before sending factory data to an external provider.
- Store enough metadata for audit: user, module, input category, prompt version, provider, model, timestamp, and action taken.
- Do not store raw prompts or outputs containing sensitive data unless the retention policy allows it.

---

## 10. Security Requirements

- Password hashing: `bcrypt`.
- Auth: JWT access token with secure refresh strategy recorded by ADR.
- Store refresh tokens in httpOnly secure cookies where browser deployment supports it.
- Validate JWT on every protected request.
- Enforce RBAC server-side.
- Use CSRF protection for cookie-authenticated unsafe methods.
- Secrets come from environment variables or secret manager, never source code.
- Rate-limit authentication endpoints.
- Lock or throttle repeated failed login attempts.
- Use audit logs for login, logout, permission changes, remote commands, AI approvals, and data exports.

---

## 11. Performance Budgets

| Metric | Budget |
|--------|--------|
| Main-thread long task | < 50 ms |
| Active dashboard frame time | < 16.6 ms |
| API p95 read latency | < 150 ms |
| API p95 write latency | < 300 ms |
| SECS/GEM event to UI visible update | < 250 ms |
| Initial JS bundle, gzipped | < 300 KB before lazy modules |
| Worker startup for active module | < 500 ms |
| Common dashboard interaction response | < 100 ms |

Budget violations require a tracked performance ticket or ADR before merge.

---

## 12. Repository Layout

```text
jarvis-prime/
  CLAUDE.md
  README.md
  DEVELOPMENT_PLAN.md
  docs/
    adr/
    product/
    api/
  backend/
  frontend/
  infra/
  scripts/
  .github/workflows/
```

---

## 13. Commit And Review Rules

- Use Conventional Commits:
  - `docs(product): define Jarvis Prime architecture rules`
  - `feat(auth): add JWT login flow`
  - `fix(factory): debounce alarm stream reconnect`
- Keep commits focused.
- Do not mix unrelated refactors with product work.
- Every PR or review should answer:
  - What changed?
  - Which rule or ADR is relevant?
  - How was it tested?
  - What risk remains?

---

## 14. ADR Index To Create Early

- ADR-0001: Frontend framework choice, React TypeScript vs Vanilla TypeScript.
- ADR-0002: Worker message protocol and Transferable strategy.
- ADR-0003: OffscreenCanvas rendering architecture.
- ADR-0004: JWT, refresh token, and session revocation strategy.
- ADR-0005: SECS/GEM Python library and HSMS lifecycle.
- ADR-0006: AI provider isolation and data redaction policy.
- ADR-0007: Background job strategy.
- ADR-0008: Audit log retention and export policy.

---

## 15. Session Notes

Newest entries at top.

- 2026-05-01 - ADR-0001 accepted for React + TypeScript + Vite. Phase 0 scaffold started with FastAPI health API, React shell, WorkerHost, ModuleRegistry, OffscreenCanvas render-worker proof, Docker Compose, and CI.
- 2026-05-01 - Project rules and planning baseline created for Jarvis Prime.
