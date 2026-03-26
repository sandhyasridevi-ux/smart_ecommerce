# C:\Users\Admin\smart_ecommerce\fastapi_backend\main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi_backend.database import Base, engine
from fastapi_backend.routers import auth_router, products_router, carts_router
from fastapi_backend import models

app = FastAPI(
    title="Smart E-Commerce API",
    version="1.0.0"
)

# Create tables
Base.metadata.create_all(bind=engine)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change later for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router.router, prefix="/auth", tags=["Auth"])
app.include_router(products_router.router, prefix="/products", tags=["Products"])
app.include_router(carts_router.router, prefix="/cart", tags=["Cart"])


@app.get("/")
def root():
    return {"message": "Smart E-Commerce FastAPI is running"}
