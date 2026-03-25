from datetime import datetime

from sqlalchemy.orm import Session

from .models import Notification, User

LOW_STOCK_THRESHOLD = 5


def serialize_notification(notification: Notification) -> dict:
    read_status = bool(notification.is_read)
    timestamp = notification.created_at.isoformat() if notification.created_at else ""
    return {
        "id": notification.id,
        "user_id": notification.user_id,
        "title": notification.title,
        "message": notification.message,
        "type": notification.type,
        "is_read": bool(notification.is_read),
        "read_status": read_status,
        "timestamp": timestamp,
        "created_at": timestamp,
    }


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type,
        is_read=False,
        created_at=datetime.utcnow(),
    )
    db.add(notification)
    db.flush()
    db.refresh(notification)
    return notification


def get_admin_user_ids(db: Session) -> list[int]:
    admins = db.query(User.id).filter(User.role.in_(["admin", "staff"])).all()
    return [admin_id for (admin_id,) in admins]
