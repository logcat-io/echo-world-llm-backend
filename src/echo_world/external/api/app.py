from fastapi import FastAPI
from fastapi.responses import JSONResponse

from echo_world.external.api.dependencies import ReadinessUseCaseDep
from echo_world.external.api.lifecycle import lifespan


def create_app() -> FastAPI:
    app = FastAPI(
        title="ECHO WORLD",
        version="0.1.0",
        lifespan=lifespan,
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/ready")
    async def ready(use_case: ReadinessUseCaseDep):
        if await use_case.execute():
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
