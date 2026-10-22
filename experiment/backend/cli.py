"""Maintenance commands. Run from `backend/`:

uv run python cli.py --help
uv run python cli.py export                  # local SQLite
railway run uv run python cli.py export      # production Postgres (Railway env vars)

From a laptop the export needs the database's public address: give the Railway service a
variable DATABASE_PUBLIC_URL=${{Postgres.DATABASE_PUBLIC_URL}} (the server itself keeps using
DATABASE_URL, the internal address).
"""

import json
import os
from pathlib import Path

import pandas as pd
import typer
from sqlmodel import Session, SQLModel, select

from app.assignment import POOLS, count_table
from app.config import REPO_ROOT, Settings, load_settings
from app.db import create_tables, make_engine
from app.models import Data, Participant

cli = typer.Typer(no_args_is_help=True, add_completion=False)


def get_engine():
    """The database to work on: the public address if available (see module docstring)."""
    public = os.environ.get("DATABASE_PUBLIC_URL", "")
    if public and "${" not in public:
        url = Settings(_env_file=None, database_url=public).database_url  # normalizes the URL
    else:
        url = load_settings().database_url
    engine = make_engine(url)
    typer.echo(f"Database: {engine.url.render_as_string(hide_password=True)}", err=True)
    return engine


@cli.command()
def init_db() -> None:
    """Create any missing tables (safe to run repeatedly)."""
    create_tables(get_engine())
    typer.echo("Tables are up to date.")


@cli.command()
def reset_db(yes: bool = typer.Option(False, "--yes", help="Skip the confirmation prompt")) -> None:
    """DELETE ALL DATA and recreate empty tables."""
    engine = get_engine()
    typer.echo(f"Database: {engine.url.render_as_string(hide_password=True)}")
    if not yes:
        typer.confirm(
            "This permanently deletes every participant and all data. Continue?", abort=True
        )
    from app import models  # noqa: F401  (registers tables)

    SQLModel.metadata.drop_all(engine)
    create_tables(engine)
    typer.echo("Database reset.")


@cli.command()
def export(out_dir: Path = REPO_ROOT / "data" / "export") -> None:
    """Write participants.csv, trials.csv / trials.json (one row per jsPsych trial) and
    target_counts.csv. trials.json is the input for the analysis report
    (frontend: npm run report)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    with Session(get_engine()) as session:
        participants = session.exec(select(Participant)).all()
        datasets = session.exec(select(Data)).all()
        settings = load_settings()
        counts = [row for pool in POOLS for row in count_table(session, settings, pool)]
    pd.DataFrame(counts).to_csv(out_dir / "target_counts.csv", index=False)

    pd.DataFrame([p.model_dump() for p in participants]).to_csv(
        out_dir / "participants.csv", index=False
    )
    condition_of = {p.data_id: p.condition for p in participants if p.data_id is not None}
    trials = [
        {
            "data_id": d.id,
            "worker_id": d.worker_id,
            "condition": condition_of.get(d.id, d.condition),
            **trial,
        }
        for d in datasets
        for trial in d.json_data
    ]
    pd.DataFrame(trials).to_csv(out_dir / "trials.csv", index=False)
    (out_dir / "trials.json").write_text(json.dumps(trials, default=str))
    typer.echo(f"Exported {len(participants)} participants and {len(trials)} trials to {out_dir}")


if __name__ == "__main__":
    cli()
