# Jarvis Prime Backend

FastAPI async backend for Jarvis Prime.

## Local Dev

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Health check:

```bash
curl http://localhost:8000/api/v1/health
```
