from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.common.config import settings
from app.common.errors import register_error_handlers


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if settings.rate_limit_enabled:
        from slowapi import Limiter, _rate_limit_exceeded_handler
        from slowapi.errors import RateLimitExceeded
        from slowapi.middleware import SlowAPIMiddleware
        from slowapi.util import get_remote_address

        limiter = Limiter(
            key_func=get_remote_address, default_limits=[settings.rate_limit_default]
        )
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        app.add_middleware(SlowAPIMiddleware)

    register_error_handlers(app)

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok", "service": settings.app_name, "env": settings.environment}

    # --- Routers (registered as modules are built) ---
    from app.auth.router import router as auth_router
    from app.export.router import router as export_router
    from app.jobs.router import router as jobs_router
    from app.resumes.router import router as resumes_router
    from app.tailor.router import router as tailor_router

    app.include_router(auth_router)
    app.include_router(resumes_router)
    app.include_router(jobs_router)
    app.include_router(tailor_router)
    app.include_router(export_router)

    return app


app = create_app()
