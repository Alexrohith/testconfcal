import os
from pathlib import Path
from uuid import UUID

import requests
from dotenv import load_dotenv
from fastapi import Header, HTTPException


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _supabase_configuration() -> tuple[str | None, str | None]:
    load_dotenv(BACKEND_DIR / ".env")
    load_dotenv(BACKEND_DIR.parent / "frontend" / ".env.local")

    return (
        os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    )


def get_current_user_id(
    authorization: str | None = Header(default=None),
) -> UUID:
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authentication is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    scheme, _, access_token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not access_token or " " in access_token:
        raise HTTPException(
            status_code=401,
            detail="A valid Supabase bearer token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    supabase_url, supabase_anon_key = _supabase_configuration()
    if not supabase_url or not supabase_anon_key:
        raise HTTPException(
            status_code=503,
            detail="Supabase authentication is not configured on the API.",
        )

    try:
        response = requests.get(
            f"{supabase_url.rstrip('/')}/auth/v1/user",
            headers={
                "apikey": supabase_anon_key,
                "Authorization": f"Bearer {access_token}",
            },
            timeout=5,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=503,
            detail="Supabase authentication is temporarily unavailable.",
        ) from exc

    if response.status_code in (401, 403):
        raise HTTPException(
            status_code=401,
            detail="The Supabase session is invalid or expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=503,
            detail="Supabase authentication is temporarily unavailable.",
        )

    try:
        user_id = UUID(response.json()["id"])
    except (AttributeError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Supabase returned an invalid authenticated user.",
        ) from exc

    return user_id
