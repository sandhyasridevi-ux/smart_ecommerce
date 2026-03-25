from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging
from pathlib import Path

from .database import (
    Base,
    engine,
    ensure_schema_columns,
    seed_default_products,
)
from .routers import auth_router, products_router, carts_router, checkout_router, notifications_router, reports_router
from . import models

app = FastAPI(
    title="Smart E-Commerce API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)
logger = logging.getLogger(__name__)
MEDIA_ROOT = Path(__file__).resolve().parent / "media"
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change later for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/media", StaticFiles(directory=str(MEDIA_ROOT)), name="media")

# Routers
app.include_router(auth_router.router, prefix="/auth", tags=["Auth"])
app.include_router(products_router.router, prefix="/products", tags=["Products"])
app.include_router(carts_router.router, prefix="/cart", tags=["Cart"])
app.include_router(checkout_router.router, prefix="/checkout", tags=["Checkout"])
app.include_router(notifications_router.router, prefix="/notifications", tags=["Notifications"])
app.include_router(reports_router.router, prefix="/reports", tags=["Reports"])


@app.on_event("startup")
def startup_initialize():
    try:
        Base.metadata.create_all(bind=engine)
        ensure_schema_columns()
        seed_default_products()
    except Exception as exc:
        logger.exception("Startup initialization failed: %s", exc)


@app.get("/")
def root():
    return {"message": "Smart E-Commerce FastAPI is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
