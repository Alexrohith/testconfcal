from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db


router = APIRouter(
    prefix="/api/categories",
    tags=["Categories"],
)


@router.get("/")
def get_categories(
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text("""
            SELECT
                id,
                name,
                display_name
            FROM categories
            ORDER BY display_name
        """)
    ).mappings().all()

    return {
        "categories": [dict(row) for row in rows]
    }