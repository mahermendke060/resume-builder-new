"""Create all tables directly (dev bootstrap without Alembic).

For production, use Alembic migrations instead:
    alembic revision --autogenerate -m "message"
    alembic upgrade head

Run: python -m scripts.init_db
"""

from app.common.db import Base, engine
import app.models  # noqa: F401  (registers all models on Base.metadata)


def main() -> None:
    Base.metadata.create_all(engine)
    print("All tables created on", engine.url)


if __name__ == "__main__":
    main()
