from typing import Annotated, cast

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncEngine

from echo_world.application.readiness import ReadinessPort, ReadinessUseCase
from echo_world.external.persistence.database import SqlAlchemyReadinessAdapter


def get_engine(request: Request) -> AsyncEngine:
    return cast(AsyncEngine, request.app.state.engine)


EngineDep = Annotated[AsyncEngine, Depends(get_engine)]


def get_readiness_port(engine: EngineDep) -> ReadinessPort:
    return SqlAlchemyReadinessAdapter(engine)


ReadinessPortDep = Annotated[ReadinessPort, Depends(get_readiness_port)]


def get_readiness_use_case(readiness: ReadinessPortDep) -> ReadinessUseCase:
    return ReadinessUseCase(readiness)


ReadinessUseCaseDep = Annotated[
    ReadinessUseCase,
    Depends(get_readiness_use_case),
]
