import uvicorn

from echo_world.application.readiness import ReadinessUseCase
from echo_world.external.api.app import create_app
from echo_world.external.persistence.config import get_settings
from echo_world.external.persistence.database import (
    SqlAlchemyReadinessAdapter,
    build_engine,
)

settings = get_settings()
engine = build_engine(settings.database_url)
readiness = ReadinessUseCase(SqlAlchemyReadinessAdapter(engine))
app = create_app(readiness)

def run() -> None:
    uvicorn.run("echo_world.main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    run()