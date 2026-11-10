"""FastAPI entry point."""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, SessionLocal, engine
from .routers import auth, records, zones
from .seed import seed


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if os.environ.get("SEED_DEMO_DATA", "1") == "1":
            seed(db)
    yield


app = FastAPI(title="Route 53 Clone API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(zones.router)
app.include_router(records.router)


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}
