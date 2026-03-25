# Day 4 API Updates: Notifications and Real-Time

## Notification APIs

- `GET /notifications`
  - Returns notifications for the authenticated user.
- `POST /notifications/create`
  - Creates a notification.
  - Body:
    - `user_id` (optional, admin/staff can target any user; customer defaults to self)
    - `title`
    - `message`
    - `type` (`order|payment|stock|system|admin_alert`)
- `PUT /notifications/{id}/read`
  - Marks a notification as read.
- `POST /notifications/read`
  - Toggle read/unread state.
  - Supports single and bulk update:
    - Single: `{ "notification_id": 12, "is_read": true, "mark_all": false }`
    - Bulk: `{ "is_read": true, "mark_all": true }`
- `DELETE /notifications/{id}`
  - Deletes a notification.

## Real-Time WebSocket

- `GET /notifications/ws?token=<jwt>` (WebSocket handshake)
- Emits events:
  - `notification:new`
  - `notification:read`
  - `notification:deleted`
  - `order:new`
  - `order:status_updated`
  - `payment:success`
  - `payment:status_updated`
  - `stock:updated`
  - `stock:low`
  - `admin:new_user`
  - `admin:new_order`
  - `admin:order_status`
  - `admin:payment_status`

## Email Notifications

Email notifications are sent for:
- Order confirmation
- Payment success/failure
- Shipping/order status updates

Email content includes:
- Order ID
- Items purchased
- Total amount
- Confirmation/status message

Provider is configurable with environment variables:
- `EMAIL_PROVIDER=smtp|sendgrid|ses`

### SMTP
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `SMTP_USE_TLS`

### SendGrid
- `EMAIL_PROVIDER=sendgrid`
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`

### AWS SES
- `EMAIL_PROVIDER=ses`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SES_FROM_EMAIL`

## Order and Payment Admin Actions

- `PUT /checkout/orders/{order_id}/status`
  - Admin/staff only.
  - Body: `{ "order_status": "pending|paid|shipped|delivered|cancelled" }`
- `PUT /checkout/payments/{payment_id}/status`
  - Admin/staff only.
  - Body: `{ "status": "pending|completed|failed" }`
- `GET /checkout/orders/all`
  - Admin/staff only.
  - Returns all orders for dashboard use.

## Product Stock Admin Action

- `PUT /products/{product_id}/stock`
  - Admin/staff only.
  - Body: `{ "stock": <non-negative integer> }`
  - Emits stock update events and low-stock alerts when threshold is reached.
