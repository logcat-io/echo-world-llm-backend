from httpx import ASGITransport, AsyncClient

from echo_world.application.readiness import ReadinessUseCase
from echo_world.external.api.app import create_app
from echo_world.external.api.dependencies import get_readiness_use_case


class FakeReadiness:
    def __init__(self, ready: bool) -> None:
        self._ready = ready

    async def is_ready(self) -> bool:
        return self._ready


async def request(path: str, *, ready: bool) -> tuple[int, dict]:
    app = create_app()
    app.dependency_overrides[get_readiness_use_case] = (
        lambda: ReadinessUseCase(FakeReadiness(ready))
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(path)
    return response.status_code, response.json()


async def test_health_db상태와무관하게_200을반환한다() -> None:
    status, body = await request("/health", ready=False)

    assert status == 200
    assert body == {"status": "ok"}


async def test_ready_db정상이면_200을반환한다() -> None:
    status, body = await request("/ready", ready=True)

    assert status == 200
    assert body == {"status": "ready"}


async def test_ready_db장애면_503을반환한다() -> None:
    status, body = await request("/ready", ready=False)

    assert status == 503
    assert body["error"]["code"] == "DEPENDENCY_NOT_READY"