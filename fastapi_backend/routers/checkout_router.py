from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..config import (
    STRIPE_CANCEL_URL,
    STRIPE_CURRENCY,
    STRIPE_PUBLISHABLE_KEY,
    STRIPE_SECRET_KEY,
    STRIPE_SUCCESS_URL,
)
from ..database import get_db
from ..dependencies import get_current_user, require_roles
from ..email_service import is_email_configuration_error, send_email_notification_with_result
from ..email_templates import (
    order_confirmation_html,
    payment_status_html,
    shipping_update_html,
)
from ..models import CartItem, Order, OrderItem, Payment, ReturnRequest, User
from ..notification_service import (
    LOW_STOCK_THRESHOLD,
    create_notification,
    get_admin_user_ids,
    serialize_notification,
)
from ..realtime import realtime_manager
from ..schemas import (
    CheckoutRequest,
    CheckoutResponse,
    OrderStatusUpdateRequest,
    ReturnRequestCreate,
    OrderItemResponse,
    OrderResponse,
    PaymentStatusUpdateRequest,
    PaymentResponse,
    StripeCheckoutResponse,
)

try:
    import stripe
except ImportError:  # pragma: no cover
    stripe = None


router = APIRouter()

TAX_PERCENT = 0.0
RETURN_WINDOW_DAYS = 7


def _format_inr(amount: float) -> str:
    return f"{amount:,.2f}".rstrip("0").rstrip(".")


def _serialize_order(order: Order) -> OrderResponse:
    effective_delivered_at = order.delivered_at
    if not effective_delivered_at and order.order_status == "delivered":
        effective_delivered_at = order.created_at

    return_deadline = (
        effective_delivered_at + timedelta(days=RETURN_WINDOW_DAYS)
        if effective_delivered_at
        else None
    )
    can_request_return = (
        order.order_status == "delivered"
        and order.return_status in {"not_requested", "rejected"}
        and return_deadline is not None
        and datetime.utcnow() <= return_deadline
    )

    items = [
        OrderItemResponse(
            id=item.id,
            product_id=item.product_id,
            quantity=item.quantity,
            price=round(item.price, 2),
            product=item.product,
        )
        for item in order.items
    ]
    return OrderResponse(
        id=order.id,
        user_id=order.user_id,
        total=round(order.total, 2),
        payment_status=order.payment_status,
        order_status=order.order_status,
        created_at=order.created_at.isoformat() if order.created_at else "",
        delivered_at=effective_delivered_at.isoformat() if effective_delivered_at else None,
        return_requested_at=order.return_requested_at.isoformat() if order.return_requested_at else None,
        return_status=order.return_status or "not_requested",
        return_reason=order.return_reason,
        return_comment=order.return_comment,
        can_request_return=can_request_return,
        return_window_days=RETURN_WINDOW_DAYS,
        items=items,
    )


def _serialize_payment(payment: Payment) -> PaymentResponse:
    return PaymentResponse(
        id=payment.id,
        order_id=payment.order_id,
        amount=round(payment.amount, 2),
        payment_method=payment.payment_method,
        transaction_id=payment.transaction_id,
        status=payment.status,
        timestamp=payment.timestamp.isoformat() if payment.timestamp else "",
    )


def _create_stripe_checkout(
    order: Order,
    payment: Payment,
    amount: float,
    currency: str,
    success_url: str,
    cancel_url: str,
) -> StripeCheckoutResponse:
    if not stripe or not STRIPE_SECRET_KEY:
        return StripeCheckoutResponse(
            payment_intent_id=None,
            checkout_session_id=None,
            checkout_session_url=None,
            publishable_key=STRIPE_PUBLISHABLE_KEY or None,
            configured=False,
            message="Stripe is not configured yet. Order and payment records were created in pending state.",
        )

    stripe.api_key = STRIPE_SECRET_KEY
    amount_in_smallest_unit = int(round(amount * 100))

    payment_intent = stripe.PaymentIntent.create(
        amount=amount_in_smallest_unit,
        currency=currency,
        metadata={"order_id": order.id, "payment_id": payment.id},
    )

    checkout_session = stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        success_url=success_url,
        cancel_url=cancel_url,
        line_items=[
            {
                "price_data": {
                    "currency": currency,
                    "product_data": {
                        "name": f"Order #{order.id}",
                        "description": f"Payment for order #{order.id}",
                    },
                    "unit_amount": amount_in_smallest_unit,
                },
                "quantity": 1,
            }
        ],
        metadata={"order_id": order.id, "payment_id": payment.id},
        payment_intent_data={"metadata": {"order_id": order.id, "payment_id": payment.id}},
    )

    payment.transaction_id = payment_intent.id

    return StripeCheckoutResponse(
        payment_intent_id=payment_intent.id,
        checkout_session_id=checkout_session.id,
        checkout_session_url=getattr(checkout_session, "url", None),
        publishable_key=STRIPE_PUBLISHABLE_KEY or None,
        configured=True,
        message="Stripe payment intent and checkout session created successfully.",
    )


@router.post("", response_model=CheckoutResponse)
async def checkout(
    payload: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cart_items = (
        db.query(CartItem)
        .options(joinedload(CartItem.product))
        .filter(CartItem.user_id == current_user.id)
        .all()
    )

    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    subtotal = 0.0
    for item in cart_items:
        if not item.product:
            raise HTTPException(status_code=404, detail=f"Product missing for cart item {item.id}")
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail=f"Invalid quantity for {item.product.name}")
        if item.product.stock < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {item.product.name}",
            )
        subtotal += item.product.price * item.quantity

    tax = round(subtotal * TAX_PERCENT, 2)
    grand_total = round(subtotal + tax, 2)
    currency = (payload.currency or STRIPE_CURRENCY).lower()
    success_url = payload.success_url or STRIPE_SUCCESS_URL
    cancel_url = payload.cancel_url or STRIPE_CANCEL_URL

    instant_payment_methods = {"card", "upi", "wallet"}
    is_instant_payment = payload.payment_method in instant_payment_methods
    initial_payment_status = "completed" if is_instant_payment else "pending"
    initial_order_status = "paid" if is_instant_payment else "pending"

    order = Order(
        user_id=current_user.id,
        total=grand_total,
        payment_status=initial_payment_status,
        order_status=initial_order_status,
        created_at=datetime.utcnow(),
    )
    db.add(order)
    db.flush()

    order_items = []
    for cart_item in cart_items:
        order_item = OrderItem(
            order_id=order.id,
            product_id=cart_item.product_id,
            quantity=cart_item.quantity,
            price=cart_item.product.price,
        )
        cart_item.product.stock -= cart_item.quantity
        db.add(order_item)
        order_items.append(order_item)

    payment = Payment(
        order_id=order.id,
        amount=grand_total,
        payment_method=payload.payment_method,
        status=initial_payment_status,
        timestamp=datetime.utcnow(),
    )
    db.add(payment)
    db.flush()

    try:
        stripe_result = _create_stripe_checkout(
            order,
            payment,
            grand_total,
            currency,
            success_url,
            cancel_url,
        )
    except Exception as exc:  # pragma: no cover
        stripe_result = StripeCheckoutResponse(
            payment_intent_id=None,
            checkout_session_id=None,
            checkout_session_url=None,
            publishable_key=STRIPE_PUBLISHABLE_KEY or None,
            configured=False,
            message=f"Stripe initialization failed: {exc}",
        )

    db.query(CartItem).filter(CartItem.user_id == current_user.id).delete()
    user_notification = create_notification(
        db=db,
        user_id=current_user.id,
        title="Order confirmed",
        message=f"Order confirmed (#{order.id})",
        notification_type="order",
    )

    payment_notification = create_notification(
        db=db,
        user_id=current_user.id,
        title="Payment successful" if initial_payment_status == "completed" else "Payment pending",
        message=(
            f"Payment successful for order #{order.id}"
            if initial_payment_status == "completed"
            else f"Payment pending for order #{order.id}"
        ),
        notification_type="payment",
    )

    admin_ids = [admin_id for admin_id in get_admin_user_ids(db) if admin_id != current_user.id]
    admin_notifications = []
    for admin_id in admin_ids:
        alert = create_notification(
            db=db,
            user_id=admin_id,
            title="New Order Placed",
            message=f"Order #{order.id} was placed by {current_user.email}.",
            notification_type="admin_alert",
        )
        admin_notifications.append(serialize_notification(alert))

    low_stock_notifications = []
    for order_item in order_items:
        product = order_item.product
        if product and product.stock <= LOW_STOCK_THRESHOLD:
            for admin_id in admin_ids:
                stock_alert = create_notification(
                    db=db,
                    user_id=admin_id,
                    title="Low Stock Alert",
                    message=f"{product.name} stock is low ({product.stock} left).",
                    notification_type="stock",
                )
                low_stock_notifications.append(serialize_notification(stock_alert))

    db.commit()

    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order.id)
        .first()
    )
    payment = db.query(Payment).filter(Payment.id == payment.id).first()
    db.refresh(current_user)

    user_notification_payload = serialize_notification(user_notification)
    payment_notification_payload = serialize_notification(payment_notification)
    await realtime_manager.send_to_user(
        current_user.id,
        "order:new",
        {"order_id": order.id, "status": order.order_status, "payment_status": order.payment_status},
    )
    await realtime_manager.send_to_user(
        current_user.id,
        "order_status_updated",
        {
            "event": "order_status_updated",
            "order_id": order.id,
            "status": order.order_status,
            "message": f"Your order #{order.id} has been confirmed.",
        },
    )
    await realtime_manager.send_to_user(current_user.id, "notification:new", user_notification_payload)
    await realtime_manager.send_to_user(current_user.id, "notification:new", payment_notification_payload)
    if initial_payment_status == "completed":
        await realtime_manager.send_to_user(
            current_user.id,
            "payment:success",
            {"order_id": order.id, "payment_status": order.payment_status},
        )

    if admin_ids:
        await realtime_manager.send_to_users(
            admin_ids,
            "admin:new_order",
            {"order_id": order.id, "user_id": current_user.id, "amount": round(grand_total, 2)},
        )
        for admin_notification in admin_notifications:
            await realtime_manager.send_to_user(
                admin_notification["user_id"],
                "notification:new",
                admin_notification,
            )
        if low_stock_notifications:
            await realtime_manager.send_to_users(
                admin_ids,
                "stock:low",
                {"order_id": order.id, "alerts": low_stock_notifications},
            )
            for stock_alert in low_stock_notifications:
                await realtime_manager.send_to_user(
                    stock_alert["user_id"],
                    "notification:new",
                    stock_alert,
                )

    email_ok, email_detail = send_email_notification_with_result(
        to_email=current_user.email,
        subject="Order Confirmation",
        body=(
            f"Hello {current_user.name},\n\n"
            f"Your order #{order.id} has been placed successfully.\n"
            f"Total Amount: ₹{_format_inr(round(grand_total, 2))}\n\n"
            "Thank you for shopping with us."
        ),
        html_body=order_confirmation_html(
            customer_name=current_user.name,
            order_id=order.id,
            items=[
                {
                    "name": item.product.name if item.product else f"Product #{item.product_id}",
                    "quantity": item.quantity,
                    "line_total": round(item.quantity * item.price, 2),
                }
                for item in order.items
            ],
            total=round(grand_total, 2),
            confirmation_message="Your order has been confirmed.",
        ),
    )
    if not email_ok and not is_email_configuration_error(email_detail):
        for admin_id in admin_ids:
            fallback_note = create_notification(
                db=db,
                user_id=admin_id,
                title="Email delivery issue",
                message=f"Order #{order.id} email could not be delivered to {current_user.email}.",
                notification_type="admin_alert",
            )
            db.commit()
            await realtime_manager.send_to_user(
                admin_id,
                "notification:new",
                serialize_notification(fallback_note),
            )

    if initial_payment_status == "completed":
        payment_email_ok, payment_email_detail = send_email_notification_with_result(
            to_email=current_user.email,
            subject="Payment Successful",
            body=(
                f"Hello {current_user.name},\n\n"
                f"We have received your payment of ₹{_format_inr(round(grand_total, 2))} successfully.\n\n"
                f"Transaction ID: {payment.transaction_id or 'N/A'}"
            ),
            html_body=payment_status_html(
                customer_name=current_user.name,
                order_id=order.id,
                status="completed",
                total=round(grand_total, 2),
            ),
        )
        if not payment_email_ok and not is_email_configuration_error(payment_email_detail):
            for admin_id in admin_ids:
                fallback_note = create_notification(
                    db=db,
                    user_id=admin_id,
                    title="Email delivery issue",
                    message=f"Payment email for order #{order.id} could not be delivered to {current_user.email}.",
                    notification_type="admin_alert",
                )
                db.commit()
                await realtime_manager.send_to_user(
                    admin_id,
                    "notification:new",
                    serialize_notification(fallback_note),
                )

    return CheckoutResponse(
        order=_serialize_order(order),
        payment=_serialize_payment(payment),
        amount=round(grand_total, 2),
        currency=currency,
        stripe=stripe_result,
    )


@router.put("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    payload: OrderStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"])),
):
    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    previous_status = order.order_status
    order.order_status = payload.order_status
    if payload.order_status == "paid":
        order.payment_status = "completed"
    if payload.order_status == "cancelled":
        order.payment_status = "failed"
    if payload.order_status == "delivered" and not order.delivered_at:
        order.delivered_at = datetime.utcnow()

    status_title_map = {
        "pending": "Order confirmed",
        "paid": "Payment successful",
        "shipped": "Order shipped",
        "delivered": "Order delivered",
        "cancelled": "Order cancelled",
    }
    status_message_map = {
        "pending": f"Order confirmed (#{order.id})",
        "paid": f"Payment successful for order #{order.id}",
        "shipped": f"Order shipped (#{order.id})",
        "delivered": f"Order delivered (#{order.id})",
        "cancelled": f"Order cancelled (#{order.id})",
    }

    customer_notification_type = (
        "shipping" if payload.order_status in {"shipped", "delivered"} else "order"
    )

    customer_notification = create_notification(
        db=db,
        user_id=order.user_id,
        title=status_title_map.get(payload.order_status, "Order status updated"),
        message=status_message_map.get(
            payload.order_status,
            f"Order #{order.id} moved to {payload.order_status}",
        ),
        notification_type=customer_notification_type,
    )

    payment_event_notification = None
    if payload.order_status == "paid":
        payment_event_notification = create_notification(
            db=db,
            user_id=order.user_id,
            title="Payment successful",
            message=f"Payment successful for order #{order.id}",
            notification_type="payment",
        )

    admin_ids = get_admin_user_ids(db)
    admin_notifications = []
    for admin_id in admin_ids:
        alert = create_notification(
            db=db,
            user_id=admin_id,
            title="Order Status Changed",
            message=f"Order #{order.id} moved to {payload.order_status} by {current_user.email}.",
            notification_type="admin_alert",
        )
        admin_notifications.append(serialize_notification(alert))

    db.commit()
    db.refresh(order)
    db.refresh(customer_notification)
    if payment_event_notification:
        db.refresh(payment_event_notification)

    await realtime_manager.send_to_user(
        order.user_id,
        "order:status_updated",
        {"order_id": order.id, "status": payload.order_status},
    )
    await realtime_manager.send_to_user(
        order.user_id,
        "order_status_updated",
        {
            "event": "order_status_updated",
            "order_id": order.id,
            "status": payload.order_status,
            "message": status_message_map.get(
                payload.order_status,
                f"Your order #{order.id} status updated.",
            ),
        },
    )
    await realtime_manager.send_to_user(
        order.user_id,
        "notification:new",
        serialize_notification(customer_notification),
    )
    if payment_event_notification:
        await realtime_manager.send_to_user(
            order.user_id,
            "payment:success",
            {"order_id": order.id, "payment_status": order.payment_status},
        )
        await realtime_manager.send_to_user(
            order.user_id,
            "notification:new",
            serialize_notification(payment_event_notification),
        )

    customer = db.query(User).filter(User.id == order.user_id).first()
    if customer:
        status_subject_map = {
            "shipped": "Order Shipped",
            "delivered": "Order Delivered",
            "cancelled": "Order Cancelled",
            "paid": "Payment Successful",
            "pending": "Order Confirmed",
        }
        status_message_map = {
            "shipped": (
                f"Hello {customer.name},\n\n"
                f"Your order #{order.id} has been shipped.\n"
                "You will receive it soon."
            ),
            "delivered": (
                f"Hello {customer.name},\n\n"
                f"Your order #{order.id} has been delivered.\n"
                "Thank you for shopping with us."
            ),
            "cancelled": (
                f"Hello {customer.name},\n\n"
                f"Your order #{order.id} has been cancelled.\n"
                "Please contact support for help."
            ),
            "paid": (
                f"Hello {customer.name},\n\n"
                f"We have received your payment of ₹{_format_inr(round(order.total, 2))} successfully.\n"
                "Thank you for shopping with us."
            ),
            "pending": (
                f"Hello {customer.name},\n\n"
                f"Your order #{order.id} has been placed successfully.\n"
                f"Total Amount: ₹{_format_inr(round(order.total, 2))}\n\n"
                "Thank you for shopping with us."
            ),
        }
        email_ok, email_detail = send_email_notification_with_result(
            to_email=customer.email,
            subject=status_subject_map.get(payload.order_status, "Order Status Updated"),
            body=status_message_map.get(
                payload.order_status,
                (
                    f"Hello {customer.name},\n\n"
                    f"Your order #{order.id} status is now '{payload.order_status}'.\n"
                    "You can track your order from your account."
                ),
            ),
            html_body=shipping_update_html(
                customer_name=customer.name,
                order_id=order.id,
                order_status=payload.order_status,
                total=round(order.total, 2),
            ),
        )
        if not email_ok and not is_email_configuration_error(email_detail):
            note = create_notification(
                db=db,
                user_id=current_user.id,
                title="Email delivery issue",
                message=f"Shipping update email failed for order #{order.id} ({customer.email}).",
                notification_type="admin_alert",
            )
            db.commit()
            await realtime_manager.send_to_user(current_user.id, "notification:new", serialize_notification(note))

    await realtime_manager.send_to_users(
        admin_ids,
        "admin:order_status",
        {"order_id": order.id, "status": payload.order_status},
    )
    for admin_alert in admin_notifications:
        await realtime_manager.send_to_user(admin_alert["user_id"], "notification:new", admin_alert)

    return _serialize_order(order)


async def _submit_return_request(
    order_id: int,
    payload: ReturnRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id, Order.user_id == current_user.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.order_status != "delivered":
        raise HTTPException(status_code=400, detail="Return is allowed only for delivered orders")

    effective_delivered_at = order.delivered_at or order.created_at
    if not effective_delivered_at:
        raise HTTPException(status_code=400, detail="Delivered timestamp missing for this order")

    return_deadline = effective_delivered_at + timedelta(days=RETURN_WINDOW_DAYS)
    if datetime.utcnow() > return_deadline:
        raise HTTPException(
            status_code=400,
            detail=f"Return window has expired. Returns are allowed only within {RETURN_WINDOW_DAYS} days.",
        )

    if order.return_status == "requested":
        raise HTTPException(status_code=400, detail="Return request already submitted")

    return_request = ReturnRequest(
        order_id=order.id,
        user_id=current_user.id,
        reason=payload.reason.strip(),
        comment=payload.comment.strip() if payload.comment else None,
        status="pending",
    )
    db.add(return_request)

    order.return_status = "requested"
    order.order_status = "return_requested"
    order.return_requested_at = datetime.utcnow()
    order.return_reason = payload.reason.strip()
    order.return_comment = payload.comment.strip() if payload.comment else None

    customer_notification = create_notification(
        db=db,
        user_id=current_user.id,
        title="Return request submitted",
        message=(
            f"Return request submitted for order #{order.id}. "
            f"Reason: {payload.reason.strip()}."
            + (
                f" Comment: {payload.comment.strip()}."
                if payload.comment and payload.comment.strip()
                else ""
            )
        ),
        notification_type="order",
    )

    admin_ids = get_admin_user_ids(db)
    admin_notifications = []
    for admin_id in admin_ids:
        alert = create_notification(
            db=db,
            user_id=admin_id,
            title="Return request received",
            message=(
                f"Order #{order.id} has a new return request from {current_user.email}. "
                f"Reason: {payload.reason.strip()}."
                + (
                    f" Comment: {payload.comment.strip()}."
                    if payload.comment and payload.comment.strip()
                    else ""
                )
            ),
            notification_type="admin_alert",
        )
        admin_notifications.append(serialize_notification(alert))

    db.commit()
    db.refresh(order)
    db.refresh(return_request)

    await realtime_manager.send_to_user(
        current_user.id,
        "notification:new",
        serialize_notification(customer_notification),
    )
    await realtime_manager.send_to_user(
        current_user.id,
        "order:return_requested",
        {
            "order_id": order.id,
            "order_status": order.order_status,
            "return_status": order.return_status,
            "return_request_id": return_request.id,
        },
    )
    if admin_ids:
        await realtime_manager.send_to_users(
            admin_ids,
            "admin:return_request",
            {
                "order_id": order.id,
                "user_id": current_user.id,
                "order_status": order.order_status,
                "return_status": order.return_status,
                "return_request_id": return_request.id,
            },
        )
        for admin_alert in admin_notifications:
            await realtime_manager.send_to_user(
                admin_alert["user_id"],
                "notification:new",
                admin_alert,
            )

    return _serialize_order(order)


@router.post("/orders/{order_id}/return-request", response_model=OrderResponse)
async def request_return_legacy(
    order_id: int,
    payload: ReturnRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _submit_return_request(order_id, payload, db, current_user)


@router.post("/orders/{order_id}/return", response_model=OrderResponse)
async def request_return(
    order_id: int,
    payload: ReturnRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _submit_return_request(order_id, payload, db, current_user)


@router.get("/orders", response_model=list[OrderResponse])
def list_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    orders = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.user_id == current_user.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return [_serialize_order(order) for order in orders]


@router.get("/orders/all", response_model=list[OrderResponse])
def list_all_orders_for_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"])),
):
    orders = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .order_by(Order.created_at.desc())
        .all()
    )
    return [_serialize_order(order) for order in orders]


@router.get("/payments/{order_id}", response_model=list[PaymentResponse])
def list_payments_for_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payments = (
        db.query(Payment)
        .filter(Payment.order_id == order_id)
        .order_by(Payment.timestamp.desc())
        .all()
    )
    return [_serialize_payment(payment) for payment in payments]


@router.put("/payments/{payment_id}/status", response_model=PaymentResponse)
async def update_payment_status(
    payment_id: int,
    payload: PaymentStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"])),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    order = db.query(Order).filter(Order.id == payment.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payment.status = payload.status
    if payload.status == "completed":
        order.payment_status = "completed"
        if order.order_status == "pending":
            order.order_status = "paid"
    if payload.status == "failed":
        order.payment_status = "failed"

    customer_title = "Payment Completed" if payload.status == "completed" else "Payment Failed"
    customer_notification = create_notification(
        db=db,
        user_id=order.user_id,
        title=customer_title,
        message=f"Payment for order #{order.id} is {payload.status}.",
        notification_type="payment",
    )

    admin_ids = get_admin_user_ids(db)
    admin_notifications = []
    for admin_id in admin_ids:
        alert = create_notification(
            db=db,
            user_id=admin_id,
            title="Payment Status Updated",
            message=f"Payment #{payment.id} for order #{order.id} is {payload.status}.",
            notification_type="admin_alert",
        )
        admin_notifications.append(serialize_notification(alert))

    db.commit()
    db.refresh(payment)
    db.refresh(order)

    customer_payload = serialize_notification(customer_notification)
    await realtime_manager.send_to_user(
        order.user_id,
        "payment:status_updated",
        {"payment_id": payment.id, "order_id": order.id, "status": payment.status},
    )
    await realtime_manager.send_to_user(
        order.user_id,
        "order_status_updated",
        {
            "event": "order_status_updated",
            "order_id": order.id,
            "status": order.order_status,
            "message": (
                f"Payment successful for order #{order.id}."
                if payload.status == "completed"
                else f"Payment status for order #{order.id} changed to {payload.status}."
            ),
        },
    )
    await realtime_manager.send_to_user(order.user_id, "notification:new", customer_payload)
    if payload.status == "completed":
        await realtime_manager.send_to_user(
            order.user_id,
            "payment:success",
            {"payment_id": payment.id, "order_id": order.id},
        )

    customer = db.query(User).filter(User.id == order.user_id).first()
    if customer:
        is_success = payload.status == "completed"
        payment_subject = "Payment Successful" if is_success else "Payment Failed"
        transaction_id = payment.transaction_id or "N/A"
        email_ok, email_detail = send_email_notification_with_result(
            to_email=customer.email,
            subject=payment_subject,
            body=(
                (
                    f"Hello {customer.name},\n\n"
                    f"We have received your payment of ₹{_format_inr(round(payment.amount, 2))} successfully.\n\n"
                    f"Transaction ID: {transaction_id}"
                )
                if is_success
                else (
                    f"Hello {customer.name},\n\n"
                    f"Payment for your order #{order.id} failed.\n"
                    "Please retry payment."
                )
            ),
            html_body=payment_status_html(
                customer_name=customer.name,
                order_id=order.id,
                status=payload.status,
                total=round(payment.amount, 2),
            ),
        )
        if not email_ok and not is_email_configuration_error(email_detail):
            note = create_notification(
                db=db,
                user_id=current_user.id,
                title="Email delivery issue",
                message=f"Payment status email failed for order #{order.id} ({customer.email}).",
                notification_type="admin_alert",
            )
            db.commit()
            await realtime_manager.send_to_user(current_user.id, "notification:new", serialize_notification(note))

    await realtime_manager.send_to_users(
        admin_ids,
        "admin:payment_status",
        {"payment_id": payment.id, "order_id": order.id, "status": payment.status},
    )
    for admin_alert in admin_notifications:
        await realtime_manager.send_to_user(admin_alert["user_id"], "notification:new", admin_alert)

    return _serialize_payment(payment)
