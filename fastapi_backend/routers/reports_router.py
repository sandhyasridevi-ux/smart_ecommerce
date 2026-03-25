import csv
import io
from collections import defaultdict
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies import require_roles
from ..models import Order, OrderItem, User

router = APIRouter()


def _pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_simple_pdf(title: str, lines: list[str]) -> bytes:
    # Minimal single-page PDF generator with text rows.
    y = 790
    parts = ["BT"]
    parts.append("/F1 16 Tf")
    parts.append(f"1 0 0 1 50 {y} Tm ({_pdf_escape(title)}) Tj")
    y -= 24
    parts.append("/F1 10 Tf")
    for line in lines[:55]:
        if y < 40:
            break
        parts.append(f"1 0 0 1 50 {y} Tm ({_pdf_escape(line)}) Tj")
        y -= 14
    parts.append("ET")
    content_stream = "\n".join(parts).encode("latin-1", errors="ignore")

    objects = []
    objects.append(b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n")
    objects.append(b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n")
    objects.append(
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj\n"
    )
    objects.append(
        f"4 0 obj << /Length {len(content_stream)} >> stream\n".encode("ascii")
        + content_stream
        + b"\nendstream endobj\n"
    )
    objects.append(b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n")

    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(out.tell())
        out.write(obj)
    xref_pos = out.tell()
    out.write(f"xref\n0 {len(offsets)}\n".encode("ascii"))
    out.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.write(f"{off:010d} 00000 n \n".encode("ascii"))
    out.write(
        (
            "trailer << /Size {size} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".format(
                size=len(offsets), xref=xref_pos
            )
        ).encode("ascii")
    )
    return out.getvalue()


def _csv_response(filename: str, rows: list[dict]) -> Response:
    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    else:
        output.write("no_data\n")
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _pdf_response(filename: str, title: str, lines: list[str]) -> Response:
    data = _build_simple_pdf(title, lines)
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _order_code(order_id: int) -> str:
    return f"ORD{int(order_id):03d}"


def _user_code(user_id: int) -> str:
    return f"U{int(user_id):03d}"


def _fmt_date(value) -> str:
    if not value:
        return ""
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return value
    return value.strftime("%d-%m-%Y")


def _generate_orders_rows(db: Session) -> list[dict]:
    orders = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product), joinedload(Order.user))
        .order_by(Order.created_at.desc())
        .all()
    )
    rows = []
    for order in orders:
        customer_name = order.user.name if order.user else f"User {order.user_id}"
        if not order.items:
            rows.append(
                {
                    "Order ID": _order_code(order.id),
                    "Customer Name": customer_name,
                    "Product Name": "-",
                    "Quantity": 0,
                    "Amount": round(float(order.total or 0), 2),
                    "Status": str(order.order_status or "pending").title(),
                }
            )
            continue
        for item in order.items:
            rows.append(
                {
                    "Order ID": _order_code(order.id),
                    "Customer Name": customer_name,
                    "Product Name": item.product.name if item.product else f"Product #{item.product_id}",
                    "Quantity": int(item.quantity or 0),
                    "Amount": round(float((item.price or 0) * (item.quantity or 0)), 2),
                    "Status": str(order.order_status or "pending").title(),
                }
            )
    return rows


def _generate_sales_rows(db: Session) -> list[dict]:
    orders = db.query(Order).order_by(Order.created_at.asc()).all()
    daily = defaultdict(lambda: {"orders": 0, "revenue": 0.0, "failed": 0, "completed": 0})
    for order in orders:
        key = _fmt_date(order.created_at)
        bucket = daily[key]
        bucket["orders"] += 1
        bucket["revenue"] += float(order.total or 0)
        if str(order.payment_status or "").lower() in {"failed"}:
            bucket["failed"] += 1
        if str(order.payment_status or "").lower() in {"completed"}:
            bucket["completed"] += 1

    rows = []
    for date_key, values in sorted(
        daily.items(),
        key=lambda kv: datetime.strptime(kv[0], "%d-%m-%Y") if kv[0] else datetime.min,
    ):
        if values["failed"] > 0 and values["completed"] > 0:
            payment_label = "Partial Refund"
        elif values["completed"] > 0 and values["failed"] == 0:
            payment_label = "Success"
        elif values["failed"] > 0 and values["completed"] == 0:
            payment_label = "Failed"
        else:
            payment_label = "Pending"
        rows.append(
            {
                "Date": date_key,
                "Total Orders": values["orders"],
                "Total Revenue": round(values["revenue"], 2),
                "Payment Status": payment_label,
            }
        )
    return rows


def _generate_users_rows(db: Session) -> list[dict]:
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "User ID": _user_code(user.id),
            "Name": user.name,
            "Email": user.email,
            "Role": str(user.role or "").title(),
            "Status": "Active" if bool(user.is_active) else "Blocked",
        }
        for user in users
    ]


def _export_rows(report_name: str, rows: list[dict], format: Literal["csv", "pdf"]) -> Response:
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    if format == "csv":
        return _csv_response(f"{report_name}_report_{stamp}.csv", rows)
    headers = list(rows[0].keys()) if rows else []
    lines = [" | ".join(headers)] if headers else []
    lines.extend(" | ".join(str(r.get(h, "")) for h in headers) for r in rows)
    lines.append(f"Generated on: {datetime.now().strftime('%d-%m-%Y')}")
    return _pdf_response(f"{report_name}_report_{stamp}.pdf", f"{report_name.title()} Report", lines)


@router.get("/orders")
def export_orders_report(
    format: Literal["csv", "pdf"] = Query(default="csv"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    _ = current_user
    rows = _generate_orders_rows(db)
    return _export_rows("orders", rows, format)


@router.get("/sales")
def export_sales_report(
    format: Literal["csv", "pdf"] = Query(default="csv"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    _ = current_user
    rows = _generate_sales_rows(db)
    return _export_rows("sales", rows, format)


@router.get("/users")
def export_users_report(
    format: Literal["csv", "pdf"] = Query(default="csv"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    _ = current_user
    rows = _generate_users_rows(db)
    return _export_rows("users", rows, format)


@router.get("/orders/csv")
def export_orders_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    _ = current_user
    rows = _generate_orders_rows(db)
    return _export_rows("orders", rows, "csv")


@router.get("/orders/pdf")
def export_orders_pdf(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    _ = current_user
    rows = _generate_orders_rows(db)
    return _export_rows("orders", rows, "pdf")


@router.get("/sales/csv")
def export_sales_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    _ = current_user
    rows = _generate_sales_rows(db)
    return _export_rows("sales", rows, "csv")


@router.get("/sales/pdf")
def export_sales_pdf(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    _ = current_user
    rows = _generate_sales_rows(db)
    return _export_rows("sales", rows, "pdf")


@router.get("/users/csv")
def export_users_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    _ = current_user
    rows = _generate_users_rows(db)
    return _export_rows("users", rows, "csv")


@router.get("/users/pdf")
def export_users_pdf(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    _ = current_user
    rows = _generate_users_rows(db)
    return _export_rows("users", rows, "pdf")
