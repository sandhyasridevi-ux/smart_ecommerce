from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require_roles
from ..models import OrderItem, Product, User
from ..notification_service import (
    LOW_STOCK_THRESHOLD,
    create_notification,
    get_admin_user_ids,
    serialize_notification,
)
from ..realtime import realtime_manager
from ..schemas import ProductCreate, ProductResponse, ProductStockUpdateRequest, ProductUpdateRequest

router = APIRouter()
MEDIA_DIR = Path(__file__).resolve().parents[1] / "media" / "products"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)


def _notify_admins(db: Session, title: str, message: str, event: str, payload: dict):
    admin_ids = get_admin_user_ids(db)
    notifications = []
    for admin_id in admin_ids:
        alert = create_notification(
            db=db,
            user_id=admin_id,
            title=title,
            message=message,
            notification_type="admin_alert",
        )
        notifications.append(serialize_notification(alert))
    db.commit()
    return admin_ids, notifications, event, payload


@router.get("/", response_model=list[ProductResponse])
def get_products(
    category: str | None = Query(default=None),
    min_price: float | None = Query(default=None),
    max_price: float | None = Query(default=None),
    min_popularity: int | None = Query(default=None, ge=0),
    sort_by: str | None = Query(default=None, pattern="^(price|popularity|name)$"),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
    in_stock: bool | None = Query(default=None),
    db: Session = Depends(get_db)
):
    query = db.query(Product)

    if category:
        query = query.filter(Product.category == category)

    if min_price is not None:
        query = query.filter(Product.price >= min_price)

    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    if min_popularity is not None:
        query = query.filter(Product.popularity >= min_popularity)

    if in_stock is True:
        query = query.filter(Product.stock > 0)
    elif in_stock is False:
        query = query.filter(Product.stock == 0)

    if sort_by:
        sort_column = getattr(Product, sort_by)
        query = query.order_by(
            sort_column.desc() if sort_order == "desc" else sort_column.asc()
        )

    return query.all()


@router.get("/category/{category}", response_model=list[ProductResponse])
def get_products_by_category(category: str, db: Session = Depends(get_db)):
    return db.query(Product).filter(Product.category == category).all()


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/admin", response_model=ProductResponse)
async def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    product = Product(
        name=payload.name.strip(),
        description=payload.description,
        category=payload.category,
        price=payload.price,
        stock=payload.stock,
        image=payload.image,
        images=payload.images,
        popularity=payload.popularity,
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    admin_ids, notifications, event, event_payload = _notify_admins(
        db=db,
        title="Product Added",
        message=f"{product.name} was added by {current_user.email}.",
        event="product:created",
        payload={"product_id": product.id, "name": product.name},
    )
    await realtime_manager.send_to_users(admin_ids, event, event_payload)
    for note in notifications:
        await realtime_manager.send_to_user(note["user_id"], "notification:new", note)

    return product


@router.put("/admin/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    payload: ProductUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] is not None:
        update_data["name"] = update_data["name"].strip()

    for key, value in update_data.items():
        setattr(product, key, value)

    db.commit()
    db.refresh(product)

    admin_ids, notifications, event, event_payload = _notify_admins(
        db=db,
        title="Product Updated",
        message=f"{product.name} was updated by {current_user.email}.",
        event="product:updated",
        payload={"product_id": product.id, "name": product.name},
    )
    await realtime_manager.send_to_users(admin_ids, event, event_payload)
    for note in notifications:
        await realtime_manager.send_to_user(note["user_id"], "notification:new", note)

    return product


@router.delete("/admin/{product_id}")
async def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    has_orders = db.query(OrderItem.id).filter(OrderItem.product_id == product_id).first()
    if has_orders:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete product because it is used in existing orders",
        )

    product_name = product.name
    db.delete(product)
    db.commit()

    admin_ids, notifications, event, event_payload = _notify_admins(
        db=db,
        title="Product Deleted",
        message=f"{product_name} was deleted by {current_user.email}.",
        event="product:deleted",
        payload={"product_id": product_id, "name": product_name},
    )
    await realtime_manager.send_to_users(admin_ids, event, event_payload)
    for note in notifications:
        await realtime_manager.send_to_user(note["user_id"], "notification:new", note)

    return {"message": "Product deleted successfully", "product_id": product_id}


@router.post("/admin/{product_id}/image", response_model=ProductResponse)
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        suffix = ".jpg"

    filename = f"product_{product_id}_{uuid4().hex}{suffix}"
    target_path = MEDIA_DIR / filename
    data = await file.read()
    target_path.write_bytes(data)

    image_url = f"/media/products/{filename}"
    product.image = image_url
    product.images = image_url
    db.commit()
    db.refresh(product)

    admin_ids, notifications, event, event_payload = _notify_admins(
        db=db,
        title="Product Image Updated",
        message=f"Image updated for {product.name} by {current_user.email}.",
        event="product:image_updated",
        payload={"product_id": product.id, "name": product.name, "image": image_url},
    )
    await realtime_manager.send_to_users(admin_ids, event, event_payload)
    for note in notifications:
        await realtime_manager.send_to_user(note["user_id"], "notification:new", note)

    return product


@router.put("/{product_id}/stock", response_model=ProductResponse)
async def update_product_stock(
    product_id: int,
    payload: ProductStockUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"])),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.stock = payload.stock
    admin_ids = get_admin_user_ids(db)
    notification_payloads = []
    for admin_id in admin_ids:
        alert = create_notification(
            db=db,
            user_id=admin_id,
            title="Stock Updated",
            message=f"{product.name} stock updated to {payload.stock} by {current_user.email}.",
            notification_type="stock",
        )
        notification_payloads.append(serialize_notification(alert))

    low_stock_payloads = []
    if product.stock <= LOW_STOCK_THRESHOLD:
        for admin_id in admin_ids:
            alert = create_notification(
                db=db,
                user_id=admin_id,
                title="Low Stock Alert",
                message=f"{product.name} stock is low ({product.stock} left).",
                notification_type="stock",
            )
            low_stock_payloads.append(serialize_notification(alert))

    db.commit()
    db.refresh(product)

    await realtime_manager.send_to_users(
        admin_ids,
        "stock:updated",
        {"product_id": product.id, "stock": product.stock, "name": product.name},
    )
    for payload_item in notification_payloads:
        await realtime_manager.send_to_user(payload_item["user_id"], "notification:new", payload_item)

    if low_stock_payloads:
        await realtime_manager.send_to_users(
            admin_ids,
            "stock:low",
            {"product_id": product.id, "stock": product.stock, "name": product.name},
        )
        for payload_item in low_stock_payloads:
            await realtime_manager.send_to_user(payload_item["user_id"], "notification:new", payload_item)

    return product
