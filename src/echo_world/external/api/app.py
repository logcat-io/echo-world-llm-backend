from fastapi import FastAPI
from fastapi.responses import JSONResponse

from echo_world.application.readiness import ReadinessUseCase


def create_app(readiness: ReadinessUseCase) -> FastAPI:
    app = FastAPI(title="ECHO WORLD", version="0.1.0")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/ready")
    async def ready():
        if await readiness.execute():
            return {"status": "ready"}
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "DEPENDENCY_NOT_READY",
                    "message": "데이터베이스 연결을 확인해주세요.",
                    "request_id": None,
                }
            },
        )

    return app
