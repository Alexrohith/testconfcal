from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import conferences, categories, sync


app = FastAPI(
    title="ConfCal API",
    description="Academic Conference Calendar API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET"],
    allow_headers=["Accept"],
)


app.include_router(conferences.router)
app.include_router(categories.router)
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