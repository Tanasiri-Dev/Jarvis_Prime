# Jarvis Prime

Jarvis Prime is an AI-assisted daily work and engineering web platform for semiconductor, electronic manufacturing, and factory-tool teams.

Read these first:

- [CLAUDE.md](CLAUDE.md) - project mission, non-negotiable rules, architecture, roles, and conventions.
- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) - phased delivery plan.
- [docs/product/app-blueprint.md](docs/product/app-blueprint.md) - web app design blueprint.
- [docs/adr/0000-template.md](docs/adr/0000-template.md) - ADR format.

## Target Stack

- Backend: FastAPI async, SQLAlchemy 2.x async, Alembic, PostgreSQL, Python SECS/GEM layer.
- Frontend: React + TypeScript + Vite or Vanilla TypeScript + Vite, selected by ADR.
- Runtime architecture: Web Workers for heavy logic, OffscreenCanvas for canvas rendering, AudioWorklet-ready message pipeline.
- Security: bcrypt passwords, JWT auth, server-side RBAC, audit logs.

## Current Status

This repository currently contains the product and architecture baseline. Implementation begins with Phase 0 in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md).

## Local Git

This folder is intended to be its own Git repository so project commits stay isolated from other development folders.
