"""Application entry point.

Serves three things from one origin:
  /api/...      JSON API (see app/api.py, app/admin.py)
  /stimuli/...  face images (repo-root `stimuli/`)
  /exp/...      the built frontend (`frontend/dist/`)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app import admin, api
from app.config import Settings, load_settings
from app.db import create_tables, make_engine
from app.study import load_study

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    engine = make_engine(settings.database_url, echo=settings.database_echo)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        create_tables(engine)
        logger.info(
            "Environment=%s, database=%s",
            settings.environment_type,
            engine.url.render_as_string(hide_password=True),
        )
        yield
        engine.dispose()

    docs = not settings.is_production
    app = FastAPI(
        title="Memory-Bias experiment",
        lifespan=lifespan,
        docs_url="/docs" if docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if docs else None,
    )
    app.state.settings = settings
    app.state.engine = engine

    # Fail at startup (not mid-session) if stimuli/study.json is missing or invalid.
    study = load_study(settings.stimuli_dir)
    missing = study.missing_images(settings.stimuli_dir)
    if missing:
        logger.error("%d stimulus images are missing, e.g. %s", len(missing), missing[:3])
    else:
        logger.info(
            "Stimuli: %s (%s)", study.title or "stimuli/study.json", ", ".join(study.groups)
        )
    app.include_router(api.router)
    app.include_router(admin.router)

    @app.get("/", include_in_schema=False)
    def root(request: Request):
        # Recruitment links may point at the bare domain; keep their query parameters.
        query = f"?{request.url.query}" if request.url.query else ""
        return RedirectResponse(f"/exp/{query}")

    app.mount("/stimuli", StaticFiles(directory=settings.stimuli_dir), name="stimuli")

    if (settings.frontend_dist_dir / "index.html").exists():
        app.mount("/exp", StaticFiles(directory=settings.frontend_dist_dir, html=True), name="exp")
    else:
        logger.warning(
            "No frontend build at %s; use the Vite dev server (npm run dev) "
            "or build it (npm run build).",
            settings.frontend_dist_dir,
        )

        @app.get("/exp/{path:path}", include_in_schema=False)
        def frontend_missing(path: str):
            return PlainTextResponse(
                "Frontend not built. In frontend/: `npm run dev` (then open "
                "http://localhost:5173/exp/) or `npm run build`.",
                status_code=503,
            )

    return app


app = create_app()
