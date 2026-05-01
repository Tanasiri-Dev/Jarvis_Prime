from pydantic import BaseModel


class HealthResponse(BaseModel):
    app: str
    environment: str
    status: str
    version: str
