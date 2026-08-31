import logging

from echo_world.external.persistence.config import Settings


def setup_logging(settings: Settings) -> None:
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        force=True,
    )
