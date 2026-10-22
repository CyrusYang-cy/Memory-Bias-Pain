"""Database engine and per-request session dependency.

The engine lives on `app.state.engine` (set in `create_app`), so tests can build an app
with an in-memory database without touching any globals.
"""

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine


def make_engine(url: str, echo: bool = False) -> Engine:
    if url.startswith("sqlite"):
        kwargs = {"connect_args": {"check_same_thread": False}}
        if url == "sqlite://":  # in-memory: share one connection, or every session sees an empty DB
            kwargs["poolclass"] = StaticPool
        return create_engine(url, echo=echo, **kwargs)
    return create_engine(url, echo=echo, pool_pre_ping=True)


def create_tables(engine: Engine) -> None:
    from app import models  # noqa: F401  (registers the tables on SQLModel.metadata)

    SQLModel.metadata.create_all(engine)


def get_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
