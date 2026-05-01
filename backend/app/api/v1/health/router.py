from fastapi import APIRouter

from app.core.config import settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        app=settings.app_name,
        environment=settings.environment,
        status="ok",
        version="0.1.0",
    )
