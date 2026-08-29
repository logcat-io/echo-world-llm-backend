from typing import Protocol


class ReadinessPort(Protocol):
    async def is_ready(self) -> bool: ...


class ReadinessUseCase:
    def __init__(self, readiness: ReadinessPort) -> None:
        self._readiness = readiness

    async def execute(self) -> bool:
        return await self._readiness.is_ready()
