"""Mocked authentication: PBKDF2 passwords + opaque server-side session tokens."""
import hashlib
import hmac
import secrets
from datetime import timedelta

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import AuthSession, User, utcnow

COOKIE_NAME = "r53_session"
SESSION_TTL = timedelta(hours=12)


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 60_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    salt, _ = stored.split("$", 1)
    return hmac.compare_digest(hash_password(password, salt), stored)


def create_session(db: Session, user: User) -> AuthSession:
    s = AuthSession(token=secrets.token_urlsafe(32), user_id=user.id, expires_at=utcnow() + SESSION_TTL)
    db.add(s)
    db.commit()
    return s


def current_user(
    token: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: Session = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(401, "Not authenticated")
    s = db.get(AuthSession, token)
    if not s:
        raise HTTPException(401, "Session not found")
    expires = s.expires_at if s.expires_at.tzinfo else s.expires_at.replace(tzinfo=utcnow().tzinfo)
    if expires < utcnow():
        db.delete(s)
        db.commit()
        raise HTTPException(401, "Session expired")
    return s.user
