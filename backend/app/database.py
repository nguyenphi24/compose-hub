from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DATA_DIR / 'composehub.db'}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)


class Base(DeclarativeBase):
    pass


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def initialize_database() -> None:
    """Create new tables and apply the one lightweight SQLite migration we need.

    The MVP intentionally does not depend on a migration framework. Existing
    local databases need this additive migration because ``create_all`` never
    adds a column to a table it already created.
    """

    Base.metadata.create_all(bind=engine)
    columns = {column["name"] for column in inspect(engine).get_columns("applications")}
    if "active_compose_yaml" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE applications ADD COLUMN active_compose_yaml TEXT")
            )
