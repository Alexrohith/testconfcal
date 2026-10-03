import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import conferences, categories, reminders, sync


development_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
frontend_url = os.getenv("FRONTEND_URL", "https://confcal-five.vercel.app").strip()
allowed_origins = list(dict.fromkeys([*development_origins, frontend_url.rstrip("/")]))

app = FastAPI(
    title="ConfCal API",
    description="Academic Conference Calendar API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Accept", "Authorization", "Content-Type"],
)


app.include_router(conferences.router)
app.include_router(categories.router)
app.include_router(reminders.router)
app.include_router(sync.router)


@app.get("/")
def root():
    return {
        "message": "ConfCal API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }