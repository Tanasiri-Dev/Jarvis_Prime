# Jarvis Prime Development Plan

This plan turns the product vision in `CODEX.md` into buildable phases. Each phase should finish with tests, documentation updates, and at least one usable vertical slice.

---

## Current Status

Phase: **0 - Foundation scaffold in progress**

Initial focus:

- Lock source-of-truth rules.
- Choose frontend approach through ADR.
- Create backend, frontend, infra, and CI skeletons.
- Prove worker-first rendering and async backend foundations before feature expansion.

Completed baseline items:

- Product and architecture rules created.
- ADR-0001 accepted: React + TypeScript + Vite.
- FastAPI health skeleton added.
- React shell, WorkerHost, ModuleRegistry, and OffscreenCanvas render-worker proof added.
- Docker Compose and CI scaffold added.

---

## Phase 0 - Foundation

Goal: establish architecture, repo layout, development workflow, and proof that the hard rules are technically viable.

Deliverables:

- `CODEX.md`, `DEVELOPMENT_PLAN.md`, README, ADR template.
- ADR-0001 through ADR-0004 accepted.
- Monorepo layout for `backend`, `frontend`, `infra`, `docs`, `scripts`.
- FastAPI health endpoint.
- PostgreSQL Docker Compose service.
- Frontend Vite skeleton.
- `WorkerHost`, `ModuleRegistry`, and typed worker message envelope.
- OffscreenCanvas demo rendered in a worker.
- Basic CI: lint, tests, typecheck.

Acceptance:

- Developer can start backend, frontend, and PostgreSQL locally.
- UI shows a non-blocking worker-rendered canvas proof.
- Main thread has no intentional heavy compute.
- First ADRs explain framework, worker protocol, rendering, and auth session strategy.

---

## Phase 1 - Auth, Users, RBAC

Goal: establish secure user access and role-based server-side authorization.

Deliverables:

- User model, role model, permission model.
- Alembic migration and seed roles.
- Registration or admin-created user flow.
- Login, refresh, logout, current-user endpoint.
- JWT access token and refresh strategy.
- Bcrypt password hashing.
- RBAC FastAPI dependencies.
- Frontend auth client and guarded routes.
- Admin user list and role assignment screen.

Acceptance:

- Protected routes reject missing, invalid, and expired tokens.
- Server rejects unauthorized role access even when client role claims are manipulated.
- Auth tests cover happy path and failure path.
- Audit log records login, logout, failed login, and role changes.

---

## Phase 2 - Command Center And Task Core

Goal: make the app useful every day before deep equipment integration.

Deliverables:

- Command Center dashboard.
- Personal tasks, assigned tasks, team tasks.
- Task priority, due date, status, owner, tags.
- Shift handover notes.
- Reminder and follow-up queue.
- AI-ready task extraction interface, with mock provider first if needed.
- Worker-backed client-side sorting, filtering, and large-list processing.

Acceptance:

- Users can manage daily work from the first screen after login.
- Dashboard remains responsive with large task lists.
- Permissions prevent viewers from editing tasks.
- Tests cover task CRUD, assignment, and RBAC.

---

## Phase 3 - Engineering Tools Library

Goal: provide practical tools for engineers and operators.

Initial tools:

- Date, week, shift, and duration calculator.
- Unit converter.
- Yield and scrap calculator. (Implemented in Phase 0 tool library prototype)
- Capacity, takt, and loading planner. (Implemented in Phase 0 tool library prototype)
- SPC quick helper.
- Alarm code decoder.
- Log parser.
- Recipe compare.
- File checksum and metadata viewer.

Architecture:

- Each tool is a module or submodule class.
- Heavy file parsing runs in a compute worker.
- Large visualizations render through OffscreenCanvas.
- Tools can run without factory connection.

Acceptance:

- Tool library loads quickly and lazy-loads individual tools.
- Large files do not block UI.
- Tool results can be copied, exported, or attached to a task.

---

## Phase 4 - AI Work Assistant

Goal: introduce governed AI assistance without leaking sensitive factory data.

Deliverables:

- Backend AI service interface.
- Provider adapter abstraction.
- Prompt template registry and versioning.
- Redaction and policy checks.
- AI review queue.
- Summarize notes, draft reply, extract tasks, classify issue.
- AI metadata audit logging.

Acceptance:

- Feature code never calls AI provider APIs directly.
- Sensitive payload policy is testable.
- AI outputs are clearly marked as suggestions.
- Risky actions require human approval.

---

## Phase 5 - Knowledge Hub

Goal: turn team knowledge into searchable operational memory.

Deliverables:

- Article and note model.
- SOP, lesson learned, troubleshooting card types.
- Attachments and tags.
- Search UI.
- Permission-aware visibility.
- Link knowledge items to tasks, tools, alarms, and equipment.

Acceptance:

- Users can search and open knowledge articles quickly.
- Restricted articles are not returned to unauthorized roles.
- Knowledge items can be referenced from Command Center and Engineering Tools.

---

## Phase 6 - Factory Dashboard And SECS/GEM Backbone

Goal: connect Jarvis Prime to real equipment signals safely.

Deliverables:

- SECS/GEM adapter layer.
- HSMS connection lifecycle.
- SVID subscription model.
- Event and alarm ingestion.
- Tool status dashboard.
- Tool detail page.
- Alarm timeline.
- RBAC-gated remote command endpoint.
- Worker-backed ingest path for high-frequency UI updates.

Acceptance:

- Equipment events flow to UI within performance budget.
- Remote commands are blocked for unauthorized roles.
- Remote commands require confirmation and audit logging.
- Connection failures show clear degraded state.

---

## Phase 7 - Traceability And Planner Workspace

Goal: support factory investigation and planning workflows.

Deliverables:

- Lot, wafer, panel, material, station, process entities.
- Traceability search.
- Genealogy graph rendered through worker OffscreenCanvas.
- Production plan board.
- Priority, hold, release, and capacity signals.
- Planner and management views.

Acceptance:

- Large genealogy graphs remain interactive.
- Planner changes are audited.
- Management can view summaries without edit privileges.

---

## Phase 8 - Reports, Observability, And Hardening

Goal: prepare the product for real operations.

Deliverables:

- KPI dashboard.
- Exportable reports.
- API metrics and structured logs.
- Frontend performance telemetry.
- Error boundaries and recovery flows.
- Backup and restore procedure.
- Security review checklist.
- Load testing for dashboard and ingestion paths.

Acceptance:

- Critical flows have automated tests.
- Performance budgets are measured.
- Logs can explain user action, system action, and equipment event paths.
- Deployment runbook exists.

---

## Phase 9 - Packaging And Deployment

Goal: make Jarvis Prime easy to run in a controlled environment.

Deliverables:

- Docker Compose for local and staging.
- Environment variable documentation.
- Database migration command.
- Seed command.
- Health checks.
- Reverse proxy example.
- Release checklist.

Acceptance:

- A clean machine can run the app from documented commands.
- Versioned release notes exist.
- Rollback steps are documented.

---

## Initial Build Order

1. Create ADRs for frontend, worker protocol, rendering, auth.
2. Scaffold backend and frontend.
3. Implement health checks and CI.
4. Build WorkerHost, ModuleRegistry, and render-worker proof.
5. Implement auth and RBAC.
6. Build Command Center and task core.
7. Add Engineering Tools.
8. Add AI governance layer.
9. Add factory integration.

---

## Definition Of Done

A feature is done only when:

- It follows `CODEX.md` hard rules.
- Server-side permissions are enforced.
- Tests cover success and failure paths.
- Performance-sensitive code is worker-isolated.
- UI handles loading, empty, error, and permission-denied states.
- Audit logging exists where required.
- Documentation and ADRs are updated when architecture changes.
