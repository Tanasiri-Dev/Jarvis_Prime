# Jarvis Prime Web App Blueprint

This blueprint translates the Jarvis Prime vision into screens, interaction patterns, and module boundaries.

---

## 1. Product Shape

Jarvis Prime is not a landing page. The authenticated app opens directly into a daily work surface.

Core promise:

- Help users understand what matters today.
- Help engineers move faster through common calculations, investigations, reviews, and documentation.
- Help factory teams see equipment state, tasks, traceability, and handover context in one place.
- Help management understand trends without giving them unsafe operational controls.

---

## 2. Personas

### Admin

Needs to manage users, roles, permissions, feature flags, integrations, audit logs, and system health.

### Engineer

Needs task follow-up, issue investigation, engineering tools, AI summaries, alarm/event context, traceability, and controlled remote commands.

### Planner

Needs production priorities, schedule impact, holds/releases, capacity signals, task coordination, and plan history.

### Management

Needs KPI summaries, trend reports, risk signals, team load, and audit-friendly visibility without operational command access.

### Operator

Needs shift focus, assigned actions, alarms, tool state, handover notes, and simple guided workflows.

### Viewer

Needs read-only visibility into allowed dashboards, reports, knowledge, and traceability.

---

## 3. Information Architecture

Primary app sections:

1. Command Center
2. Tasks
3. AI Review
4. Engineering Tools
5. Factory
6. Traceability
7. Planner
8. Knowledge
9. Reports
10. Admin
11. Diagnostics

The left navigation should remain stable. Hide unauthorized destinations, but also rely on backend authorization.

---

## 4. Command Center

Purpose: the first screen for daily work.

Panels:

- Today / current shift focus.
- My urgent tasks.
- Watchlist: tools, lots, alarms, or reports the user follows.
- AI suggestions waiting for review.
- Handover notes.
- Quick launch engineering tools.
- Recent activity.

Design:

- Dense grid with clear hierarchy.
- No oversized hero.
- No decorative cards inside cards.
- Status and priority should be visible at a glance.

---

## 5. Tasks

Views:

- My Tasks.
- Team Tasks.
- Assigned By Me.
- Follow-ups.
- Completed.

Task fields:

- Title, description, owner, requester, role visibility.
- Priority, status, due date, shift, tool, lot, product, station.
- Attachments, links, related alarms, related knowledge.
- AI extracted source and confidence if generated.

Expected interactions:

- Fast filtering and sorting.
- Bulk assignment for permitted roles.
- Convert AI suggestion to task.
- Link task to engineering tool result.
- Add handover note from task.

---

## 6. AI Review

Purpose: keep AI assistance transparent and controllable.

Queues:

- Extracted tasks.
- Draft replies.
- Summaries.
- Issue classifications.
- Recommended next actions.

Rules:

- AI output is never silently applied.
- Show source context when permitted.
- Human approval is required for risky actions.
- Keep prompt version and model metadata available for audit.

---

## 7. Engineering Tools

Tool categories:

- Time and shift: date, week, shift, duration.
- Manufacturing math: yield, scrap, UPH, takt, capacity.
- Quality: SPC helper, trend review, outlier scan.
- Files and logs: parser, compare, checksum, metadata.
- Equipment: alarm decoder, SECS/GEM message helper, SVID explorer.
- Utilities: unit conversion, regex tester, CSV cleaner.

Worker strategy:

- File parsing, diffing, graph layout, large calculations, and AI post-processing run in workers.
- Render-heavy views use OffscreenCanvas.

---

## 8. Factory

Views:

- Tool status board.
- Tool detail.
- Alarm timeline.
- Event stream.
- Remote command console for authorized roles.
- Watchlist.

Safety:

- Remote commands require permission, confirmation, audit logging, and clear result state.
- Connection loss must show degraded state, not stale confidence.
- Equipment integration must be isolated behind backend services.

---

## 9. Traceability

Views:

- Search by lot, wafer, panel, serial, material, tool, recipe, time range.
- Genealogy graph.
- Process route timeline.
- Related alarms, tasks, and knowledge.

Rendering:

- Large graphs use worker layout and OffscreenCanvas rendering.
- Search results must remain usable without loading the full graph.

---

## 10. Planner

Views:

- Production plan board.
- Priority queue.
- Holds and releases.
- Capacity signals.
- Schedule risk list.

Rules:

- Planner edits are audited.
- Operator and viewer roles do not edit plans.
- Changes should show impact where possible.

---

## 11. Knowledge

Content types:

- SOP.
- Troubleshooting card.
- Lesson learned.
- Engineering note.
- FAQ.
- Vendor/tool reference.

Features:

- Permission-aware search.
- Tagging by tool, product, process, station, failure mode.
- Link from tasks, alarms, traceability, and engineering tools.

---

## 12. Reports

Views:

- Management KPI summary.
- Engineering issue trends.
- Tool alarm trends.
- Task completion and aging.
- Production and planning snapshots.

Rules:

- Exports are permission-gated.
- Report generation should not block web request handlers.
- Generated reports should be traceable by user, filters, and timestamp.

---

## 13. Diagnostics

Purpose: prove and monitor the architecture.

Tools:

- API health.
- Worker health.
- Message bus inspector.
- OffscreenCanvas render test.
- Compute worker load test.
- Auth and permission smoke checks.
- SECS/GEM connection simulator status.

Diagnostics can be visible to engineers and admins based on permissions.

---

## 14. Visual System

Tone:

- Premium SaaS.
- Industrial and calm.
- Dense but readable.

Rules:

- Use semantic color tokens.
- Keep status colors consistent.
- Avoid decorative gradients and marketing composition.
- Use compact, stable controls.
- Keep tables scannable.
- Use icons for tools and actions where familiar.
- Preserve keyboard access.

---

## 15. First MVP Slice

Recommended first usable slice:

1. Login.
2. Command Center shell.
3. My Tasks CRUD.
4. Engineering Tools launcher with one worker-backed calculator.
5. AI Review queue with mock AI suggestions.
6. Admin role assignment.
7. Audit log for auth, task edit, and AI approval.

This gives users a real daily assistant before factory integration is complete.
