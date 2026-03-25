def _layout(title: str, intro: str, section_html: str, footer: str) -> str:
    return f"""
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#111827;color:#ffffff;padding:18px 24px;font-size:20px;font-weight:700;">
                Smart E-Commerce
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h2 style="margin:0 0 10px;font-size:28px;color:#111827;">{title}</h2>
                <p style="margin:0 0 18px;line-height:1.6;color:#374151;">{intro}</p>
                {section_html}
                <p style="margin:18px 0 0;line-height:1.6;color:#374151;">{footer}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def order_confirmation_html(
    customer_name: str,
    order_id: int,
    items: list[dict],
    total: float,
    confirmation_message: str,
) -> str:
    rows = "".join(
        [
            f"""
            <tr>
              <td style='padding:10px;border-bottom:1px solid #e5e7eb;'>{item['name']}</td>
              <td style='padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;'>{item['quantity']}</td>
              <td style='padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;'>Rs. {item['line_total']:.2f}</td>
            </tr>
            """
            for item in items
        ]
    )

    section_html = f"""
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-top:12px;">
      <p style="margin:0 0 8px;"><strong>Order ID:</strong> #{order_id}</p>
      <p style="margin:0 0 12px;"><strong>Confirmation:</strong> {confirmation_message}</p>
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px;text-align:left;">Item</th>
            <th style="padding:10px;text-align:center;">Qty</th>
            <th style="padding:10px;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      <p style="margin:12px 0 0;text-align:right;font-size:18px;"><strong>Total: Rs. {total:.2f}</strong></p>
    </div>
    """

    return _layout(
        title="Order Confirmation",
        intro=f"Hi {customer_name}, your order has been placed successfully.",
        section_html=section_html,
        footer="Thank you for shopping with us.",
    )


def payment_status_html(customer_name: str, order_id: int, status: str, total: float) -> str:
    status_label = status.title()
    color = "#16a34a" if status == "completed" else "#dc2626"
    section_html = f"""
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
      <p style="margin:0 0 8px;"><strong>Order ID:</strong> #{order_id}</p>
      <p style="margin:0 0 8px;"><strong>Payment Status:</strong> <span style="color:{color};font-weight:700;">{status_label}</span></p>
      <p style="margin:0;"><strong>Amount:</strong> Rs. {total:.2f}</p>
    </div>
    """
    return _layout(
        title=f"Payment {status_label}",
        intro=f"Hi {customer_name}, here is your latest payment update.",
        section_html=section_html,
        footer="If you have any questions, reply to this email.",
    )


def shipping_update_html(customer_name: str, order_id: int, order_status: str, total: float) -> str:
    section_html = f"""
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
      <p style="margin:0 0 8px;"><strong>Order ID:</strong> #{order_id}</p>
      <p style="margin:0 0 8px;"><strong>Order Status:</strong> {order_status.title()}</p>
      <p style="margin:0;"><strong>Order Total:</strong> Rs. {total:.2f}</p>
    </div>
    """
    return _layout(
        title="Shipping / Order Update",
        intro=f"Hi {customer_name}, your order tracking status has changed.",
        section_html=section_html,
        footer="Track your order from your Smart E-Commerce account.",
    )
