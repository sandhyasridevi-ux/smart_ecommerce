import os

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from ..database import SessionLocal, get_db
from ..dependencies import decode_token, get_current_user
from ..email_service import send_email_notification_with_result
from ..email_templates import order_confirmation_html
from ..models import Notification, User
from ..notification_service import create_notification, serialize_notification
from ..realtime import realtime_manager
from ..schemas import NotificationCreateRequest, NotificationReadRequest, NotificationResponse

router = APIRouter()


@router.get("", response_model=list[NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications_query = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
    )
    if current_user.role not in {"admin", "staff"}:
        notifications_query = notifications_query.filter(
            ~(
                (Notification.type == "system")
                & (Notification.title == "Email delivery issue")
            )
        )
    notifications = notifications_query.order_by(Notification.created_at.desc()).all()
    return [serialize_notification(item) for item in notifications]


@router.post("/create", response_model=NotificationResponse)
async def create_notification_api(
    payload: NotificationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_user_id = payload.user_id or current_user.id

    if current_user.role not in {"admin", "staff"} and target_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to create notifications for other users")

    target_user = db.query(User).filter(User.id == target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    notification = create_notification(
        db=db,
        user_id=target_user_id,
        title=payload.title,
        message=payload.message,
        notification_type=payload.type,
    )
    db.commit()

    response_payload = serialize_notification(notification)
    await realtime_manager.send_to_user(
        target_user_id,
        "notification:new",
        response_payload,
    )
    return response_payload


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notification.user_id != current_user.id and current_user.role not in {"admin", "staff"}:
        raise HTTPException(status_code=403, detail="You do not have permission to update this notification")

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    response_payload = serialize_notification(notification)
    await realtime_manager.send_to_user(
        notification.user_id,
        "notification:read",
        response_payload,
    )
    return response_payload


@router.post("/read")
async def mark_notification_read_state(
    payload: NotificationReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.mark_all:
        notifications = (
            db.query(Notification)
            .filter(Notification.user_id == current_user.id)
            .all()
        )
        for item in notifications:
            item.is_read = payload.is_read
        db.commit()
        await realtime_manager.send_to_user(
            current_user.id,
            "notification:bulk_read_state",
            {"is_read": payload.is_read},
        )
        return {"message": "All notifications updated"}

    if payload.notification_id is None:
        raise HTTPException(status_code=400, detail="notification_id is required when mark_all is false")

    notification = db.query(Notification).filter(Notification.id == payload.notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notification.user_id != current_user.id and current_user.role not in {"admin", "staff"}:
        raise HTTPException(status_code=403, detail="You do not have permission to update this notification")

    notification.is_read = payload.is_read
    db.commit()
    db.refresh(notification)
    response_payload = serialize_notification(notification)
    await realtime_manager.send_to_user(
        notification.user_id,
        "notification:read_state",
        response_payload,
    )
    return response_payload


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notification.user_id != current_user.id and current_user.role not in {"admin", "staff"}:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this notification")

    deleted_user_id = notification.user_id
    db.delete(notification)
    db.commit()

    await realtime_manager.send_to_user(
        deleted_user_id,
        "notification:deleted",
        {"id": notification_id},
    )
    return {"message": "Notification deleted"}


@router.websocket("/ws")
async def notifications_ws(
    websocket: WebSocket,
    token: str = Query(...),
):
    db = SessionLocal()
    user_id = None
    try:
        payload = decode_token(token)
        user_id = payload.get("user_id")
        if user_id is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await realtime_manager.connect(user.id, websocket)
        await realtime_manager.send_to_user(
            user.id,
            "ws:connected",
            {"user_id": user.id, "message": "Notifications socket connected"},
        )

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception:
            pass
    finally:
        if user_id is not None:
            realtime_manager.disconnect(user_id, websocket)
        db.close()


@router.post("/test-email")
async def send_test_email(
    current_user: User = Depends(get_current_user),
):
    html = order_confirmation_html(
        customer_name=current_user.name,
        order_id=9999,
        items=[
            {"name": "Sample Product A", "quantity": 1, "line_total": 499.0},
            {"name": "Sample Product B", "quantity": 2, "line_total": 998.0},
        ],
        total=1497.0,
        confirmation_message="This is a test order confirmation email.",
    )
    success, detail = send_email_notification_with_result(
        to_email=current_user.email,
        subject="Smart E-Commerce Test Email",
        body=(
            f"Hi {current_user.name},\n\n"
            "This is a test email from Smart E-Commerce.\n"
            "If you received this, your email setup works."
        ),
        html_body=html,
    )

    missing = []
    for key in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM_EMAIL"):
        value = (os.getenv(key, "") or "").strip()
        if key == "SMTP_FROM_EMAIL":
            # optional because code can fallback to SMTP_USER
            continue
        if not value:
            missing.append(key)

    return {
        "success": success,
        "detail": detail,
        "recipient": current_user.email,
        "provider": "configured_by_env",
        "missing_env": missing,
    }
