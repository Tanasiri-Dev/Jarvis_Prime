# Jarvis Prime

Jarvis Prime is an AI-assisted daily work and engineering web platform for semiconductor, electronic manufacturing, and factory-tool teams.

Read these first:

- [CLAUDE.md](CLAUDE.md) - project mission, non-negotiable rules, architecture, roles, and conventions.
- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) - phased delivery plan.
- [docs/product/app-blueprint.md](docs/product/app-blueprint.md) - web app design blueprint.
- [docs/adr/0000-template.md](docs/adr/0000-template.md) - ADR format.
- [CODEX_HANDOFF.md](CODEX_HANDOFF.md) - short resume context for future Codex sessions.

## Target Stack

- Backend: FastAPI async, SQLAlchemy 2.x async, Alembic, PostgreSQL, Python SECS/GEM layer.
- Frontend: React + TypeScript + Vite or Vanilla TypeScript + Vite, selected by ADR.
- Runtime architecture: Web Workers for heavy logic, OffscreenCanvas for canvas rendering, AudioWorklet-ready message pipeline.
- Security: bcrypt passwords, JWT auth, server-side RBAC, audit logs.

## Current Status

Phase 0 scaffold has started:

- Backend FastAPI health endpoint.
- Frontend React + TypeScript + Vite shell.
- WorkerHost and ModuleRegistry foundation.
- OffscreenCanvas render-worker proof.
- Docker Compose for PostgreSQL, backend, and frontend.
- CI workflow for backend and frontend checks.

## Quick Start

```bash
# Full local stack
docker compose -f infra/docker-compose.yml up --build

# Backend only
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload

# Frontend only
cd frontend
npm install
npm run dev
```

Open:

- Frontend: http://localhost:5173
- Backend health: http://localhost:8000/api/v1/health

## Local Git

This folder is intended to be its own Git repository so project commits stay isolated from other development folders.
