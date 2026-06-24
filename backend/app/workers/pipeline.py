"""Celery task wrapper for the tailor pipeline.

v1 dispatches the pipeline via FastAPI BackgroundTasks (works with no broker).
For horizontal scale-out, point the router at ``tailor_task.delay(str(run_id))``
instead, and run the `worker` container from docker-compose.
"""

import asyncio
import uuid

from app.workers.celery_app import celery_app


@celery_app.task(name="pipeline.ping")
def ping() -> str:
    return "pong"


@celery_app.task(name="pipeline.tailor")
def tailor_task(run_id: str) -> None:
    from app.llm.adapter import LLMAdapter
    from app.tailor.service import process_run

    asyncio.run(process_run(uuid.UUID(run_id), LLMAdapter()))
