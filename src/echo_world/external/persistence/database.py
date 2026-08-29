from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine


def build_engine(database_url: str) -> AsyncEngine:
	return create_async_engine(database_url, pool_pre_ping=True)

class SqlAlchemyReadinessAdapter:
	def __init__(self, engine: AsyncEngine) -> None:
		self._engine = engine

	async def is_ready(self) -> bool:
		try:
			async with self._engine.connect() as connection:
				await connection.execute(text("SELECT 1"))
			return True
		except SQLAlchemyError:
			return False
