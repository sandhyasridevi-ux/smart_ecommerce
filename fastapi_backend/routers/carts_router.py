# C:\Users\Admin\smart_ecommerce\fastapi_backend\routers\carts_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import CartItem, Product, User
from ..schemas import (
    CartAddRequest,
    CartUpdateRequest,
    CartRemoveRequest,
    CartItemResponse,
    CartSummaryResponse,
)
from ..dependencies import get_current_user
from ..realtime import realtime_manager

router = APIRouter()

TAX_PERCENT = 0.0


def build_cart_summary(cart_items):
    items_data = []
    cart_total = 0.0

    for item in cart_items:
        item_total = item.quantity * item.product.price
        cart_total += item_total

        items_data.append(
            CartItemResponse(
                id=item.id,
                product_id=item.product_id,
                quantity=item.quantity,
                item_total=round(item_total, 2),
                product=item.product,
            )
        )

    tax = round(cart_total * TAX_PERCENT, 2)
    grand_total = round(cart_total + tax, 2)

    return CartSummaryResponse(
        items=items_data,
        cart_total=round(cart_total, 2),
        tax=tax,
        grand_total=grand_total,
    )


@router.post("/add", response_model=CartSummaryResponse)
async def add_to_cart(
    payload: CartAddRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.stock < payload.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    existing_item = (
        db.query(CartItem)
        .filter(
            CartItem.user_id == current_user.id,
            CartItem.product_id == payload.product_id
        )
        .first()
    )

    if existing_item:
        new_quantity = existing_item.quantity + payload.quantity
        if new_quantity > product.stock:
            raise HTTPException(status_code=400, detail="Quantity exceeds stock")
        existing_item.quantity = new_quantity
    else:
        cart_item = CartItem(
            user_id=current_user.id,
            product_id=payload.product_id,
            quantity=payload.quantity,
        )
        db.add(cart_item)

    db.commit()

    cart_items = (
        db.query(CartItem)
        .options(joinedload(CartItem.product))
        .filter(CartItem.user_id == current_user.id)
        .all()
    )
    summary = build_cart_summary(cart_items)
    payload = {
        **summary.model_dump(),
        "cart_items": len(summary.items),
        "cart_total": summary.cart_total,
        "message": "Your cart has been updated.",
    }
    await realtime_manager.send_to_user(
        current_user.id,
        "cart_updated",
        payload,
    )
    return summary


@router.put("/update", response_model=CartSummaryResponse)
async def update_cart(
    payload: CartUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cart_item = (
        db.query(CartItem)
        .filter(
            CartItem.user_id == current_user.id,
            CartItem.product_id == payload.product_id
        )
        .first()
    )

    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.quantity > product.stock:
        raise HTTPException(status_code=400, detail="Quantity exceeds stock")

    if payload.quantity == 0:
        db.delete(cart_item)
        db.commit()
        cart_items = (
            db.query(CartItem)
            .options(joinedload(CartItem.product))
            .filter(CartItem.user_id == current_user.id)
            .all()
        )
        summary = build_cart_summary(cart_items)
        payload = {
            **summary.model_dump(),
            "cart_items": len(summary.items),
            "cart_total": summary.cart_total,
            "message": "Your cart has been updated.",
        }
        await realtime_manager.send_to_user(
            current_user.id,
            "cart_updated",
            payload,
        )
        return summary

    cart_item.quantity = payload.quantity
    db.commit()

    cart_items = (
        db.query(CartItem)
        .options(joinedload(CartItem.product))
        .filter(CartItem.user_id == current_user.id)
        .all()
    )
    summary = build_cart_summary(cart_items)
    payload = {
        **summary.model_dump(),
        "cart_items": len(summary.items),
        "cart_total": summary.cart_total,
        "message": "Your cart has been updated.",
    }
    await realtime_manager.send_to_user(
        current_user.id,
        "cart_updated",
        payload,
    )
    return summary


@router.delete("/remove", response_model=CartSummaryResponse)
async def remove_from_cart(
    payload: CartRemoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cart_item = (
        db.query(CartItem)
        .filter(
            CartItem.user_id == current_user.id,
            CartItem.product_id == payload.product_id
        )
        .first()
    )

    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    db.delete(cart_item)
    db.commit()

    cart_items = (
        db.query(CartItem)
        .options(joinedload(CartItem.product))
        .filter(CartItem.user_id == current_user.id)
        .all()
    )
    summary = build_cart_summary(cart_items)
    payload = {
        **summary.model_dump(),
        "cart_items": len(summary.items),
        "cart_total": summary.cart_total,
        "message": "Your cart has been updated.",
    }
    await realtime_manager.send_to_user(
        current_user.id,
        "cart_updated",
        payload,
    )
    return summary


@router.get("", response_model=CartSummaryResponse)
def view_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cart_items = (
        db.query(CartItem)
        .options(joinedload(CartItem.product))
        .filter(CartItem.user_id == current_user.id)
        .all()
    )
    return build_cart_summary(cart_items)
