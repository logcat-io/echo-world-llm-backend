from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from echo_world.external.persistence.config import get_settings
from echo_world.external.persistence.database import build_engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
	settings = get_settings()
	engine = build_engine(settings.database_url)
	app.state.engine = engine

	try:
		yield
	finally:
		await engine.dispose()
