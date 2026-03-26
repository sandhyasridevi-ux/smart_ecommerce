from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..auth import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from ..auth0_verify import decode_auth0_token
from ..database import get_db
from ..dependencies import get_current_user, decode_token, require_roles
from ..models import User
from ..notification_service import create_notification, get_admin_user_ids, serialize_notification
from ..realtime import realtime_manager
from ..schemas import (
    AccessTokenResponse,
    RefreshTokenRequest,
    SocialLoginRequest,
    TokenResponse,
    AdminUserResponse,
    AdminUserUpdateRequest,
    UserCreate,
    UserLogin,
    UserMeResponse,
)

router = APIRouter()


def build_auth_response(user: User) -> TokenResponse:
    token_payload = {
        "user_id": user.id,
        "email": user.email,
        "sub": user.email,
        "role": user.role,
    }
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user={
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
    )


@router.post("/register", response_model=TokenResponse)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        name=user.name,
        email=user.email,
        password=hash_password(user.password),
        role=user.role if user.role in {"admin", "staff", "customer"} else "customer",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    admin_ids = [admin_id for admin_id in get_admin_user_ids(db) if admin_id != new_user.id]
    created_alerts = []
    for admin_id in admin_ids:
        alert = create_notification(
            db=db,
            user_id=admin_id,
            title="New User Registration",
            message=f"New user {new_user.email} registered.",
            notification_type="admin_alert",
        )
        created_alerts.append(serialize_notification(alert))
    if created_alerts:
        db.commit()
        await realtime_manager.send_to_users(admin_ids, "admin:new_user", {"user_id": new_user.id, "email": new_user.email})
        for admin_id in admin_ids:
            admin_alert = next((item for item in created_alerts if item["user_id"] == admin_id), None)
            if admin_alert:
                await realtime_manager.send_to_user(admin_id, "notification:new", admin_alert)

    return build_auth_response(new_user)


@router.post("/login", response_model=TokenResponse)
def login(user: UserLogin, db: Session = Depends(get_db)):
    login_email = user.email or user.username
    existing_user = db.query(User).filter(User.email == login_email).first()
    if not existing_user or not verify_password(user.password, existing_user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not existing_user.is_active:
        raise HTTPException(status_code=403, detail="User account is deactivated")

    return build_auth_response(existing_user)


@router.post("/token", response_model=AccessTokenResponse)
def token_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    existing_user = db.query(User).filter(User.email == form_data.username).first()
    if not existing_user or not verify_password(form_data.password, existing_user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not existing_user.is_active:
        raise HTTPException(status_code=403, detail="User account is deactivated")

    token_payload = {
        "user_id": existing_user.id,
        "email": existing_user.email,
        "sub": existing_user.email,
        "role": existing_user.role,
    }
    return AccessTokenResponse(
        access_token=create_access_token(token_payload),
        token_type="bearer",
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    if payload.refresh_token.strip() == "refresh_token":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use the real refresh_token returned by /auth/login or /auth/register",
        )

    decoded = decode_token(payload.refresh_token)
    if decoded.get("token_type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = decoded.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return build_auth_response(user)


@router.get("/me", response_model=UserMeResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserMeResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        is_active=bool(current_user.is_active),
        created_at=current_user.created_at.isoformat() if current_user.created_at else None,
    )


@router.get("/admin/users", response_model=list[AdminUserResponse])
def list_users_for_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        AdminUserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            is_active=bool(user.is_active),
            created_at=user.created_at.isoformat() if user.created_at else None,
        )
        for user in users
    ]


@router.put("/admin/users/{user_id}", response_model=AdminUserResponse)
async def update_user_for_admin(
    user_id: int,
    payload: AdminUserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.name is not None:
        target.name = payload.name.strip()

    if payload.role is not None:
        target.role = payload.role

    if payload.is_active is not None:
        if target.id == current_user.id and not payload.is_active:
            raise HTTPException(status_code=400, detail="Admin cannot deactivate own account")
        target.is_active = bool(payload.is_active)

    db.commit()
    db.refresh(target)

    admins = get_admin_user_ids(db)
    for admin_id in admins:
        if admin_id == current_user.id:
            continue
        alert = create_notification(
            db=db,
            user_id=admin_id,
            title="User Updated",
            message=f"{target.email} updated by {current_user.email}.",
            notification_type="admin_alert",
        )
        db.commit()
        await realtime_manager.send_to_user(admin_id, "notification:new", serialize_notification(alert))

    return AdminUserResponse(
        id=target.id,
        name=target.name,
        email=target.email,
        role=target.role,
        is_active=bool(target.is_active),
        created_at=target.created_at.isoformat() if target.created_at else None,
    )


@router.post("/social/auth0", response_model=TokenResponse)
async def social_auth(payload: SocialLoginRequest, db: Session = Depends(get_db)):
    if payload.provider not in {"auth0", "google", "facebook"}:
        raise HTTPException(status_code=400, detail="Unsupported social provider")

    claims = decode_auth0_token(payload.access_token)
    email = claims.get("email") or claims.get("sub")
    if not email:
        raise HTTPException(status_code=400, detail="Email not found in social token")

    name = claims.get("name") or email.split("@")[0]
    user = db.query(User).filter(User.email == email).first()
    if user and not user.is_active:
        raise HTTPException(status_code=403, detail="User account is deactivated")
    if not user:
        user = User(
            name=name,
            email=email,
            password=hash_password(f"{payload.provider}_social_login"),
            role="customer",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        admin_ids = [admin_id for admin_id in get_admin_user_ids(db) if admin_id != user.id]
        created_alerts = []
        for admin_id in admin_ids:
            alert = create_notification(
                db=db,
                user_id=admin_id,
                title="New Social Registration",
                message=f"New social login user {user.email} joined via {payload.provider}.",
                notification_type="admin_alert",
            )
            created_alerts.append(serialize_notification(alert))
        if created_alerts:
            db.commit()
            await realtime_manager.send_to_users(
                admin_ids,
                "admin:new_user",
                {"user_id": user.id, "email": user.email, "provider": payload.provider},
            )
            for admin_id in admin_ids:
                admin_alert = next((item for item in created_alerts if item["user_id"] == admin_id), None)
                if admin_alert:
                    await realtime_manager.send_to_user(admin_id, "notification:new", admin_alert)

    return build_auth_response(user)
