from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AuthSession, User
from ..schemas import LoginIn, UserOut
from ..security import COOKIE_NAME, SESSION_TTL, create_session, current_user, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == body.username.strip()))
    if not user or user.account_id != body.account_id.strip().replace("-", "") or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Your authentication information is incorrect. Please try again.")
    s = create_session(db, user)
    response.set_cookie(COOKIE_NAME, s.token, max_age=int(SESSION_TTL.total_seconds()), httponly=True, samesite="lax", path="/")
    return user


@router.post("/logout", status_code=204)
def logout(response: Response, db: Session = Depends(get_db), user: User = Depends(current_user)):
    for s in db.scalars(select(AuthSession).where(AuthSession.user_id == user.id)).all():
        db.delete(s)
    db.commit()
    response.delete_cookie(COOKIE_NAME, path="/")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user
