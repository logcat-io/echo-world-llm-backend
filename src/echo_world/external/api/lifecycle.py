import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from echo_world.external.logging_setup import setup_logging
from echo_world.external.persistence.config import get_settings
from echo_world.external.persistence.database import build_engine

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    setup_logging(settings)

    engine = build_engine(settings)
    app.state.engine = engine
    logger.info(
        "startup: engine created env=%s pool_size=%d max_overflow=%d",
        settings.app_env,
        settings.db_pool_size,
        settings.db_max_overflow,
    )

    try:
        yield
    finally:
        await engine.dispose()
        logger.info("shutdown: engine disposed")
