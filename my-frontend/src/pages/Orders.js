import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API, { buildNotificationsWsUrl } from "../services/api";

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [submittingReturnId, setSubmittingReturnId] = useState(null);
  const [activeReturnFormId, setActiveReturnFormId] = useState(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnComment, setReturnComment] = useState("");

  const fetchOrders = async () => {
    try {
      const res = await API.get("/checkout/orders");
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    if (token.startsWith("local-token-")) {
      setLoading(false);
      setMessage("Session expired for backend features. Please logout and login again.");
      return;
    }

    fetchOrders();
    const pollTimer = window.setInterval(() => {
      fetchOrders();
    }, 20000);
    const ws = new WebSocket(buildNotificationsWsUrl(token));

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data || "{}");
        const eventType = parsed?.event;
        if (
          eventType === "order:status_updated" ||
          eventType === "order:new" ||
          eventType === "order_status_updated"
        ) {
          fetchOrders();
          if (parsed?.payload?.message) {
            setToast(parsed.payload.message);
            window.setTimeout(() => setToast(""), 2200);
          }
        }
        if (eventType === "notification:new" && parsed?.payload?.message) {
          setMessage(parsed.payload.message);
        }
      } catch (err) {
        // ignore malformed socket payloads
      }
    };

    ws.onerror = () => {
      setMessage((current) => current || "Live updates are unavailable right now.");
    };

    return () => {
      window.clearInterval(pollTimer);
      ws.close();
    };
  }, [navigate]);

  const statusStyles = {
    pending: { background: "#fef3c7", color: "#92400e" },
    paid: { background: "#dcfce7", color: "#166534" },
    shipped: { background: "#dbeafe", color: "#1d4ed8" },
    delivered: { background: "#dcfce7", color: "#166534" },
    return_requested: { background: "#fef3c7", color: "#b45309" },
    cancelled: { background: "#fee2e2", color: "#b91c1c" },
  };
  const steps = ["Pending", "Paid", "Shipped", "Delivered"];
  const stepMap = useMemo(
    () => ({
      pending: 0,
      paid: 1,
      shipped: 2,
      delivered: 3,
      return_requested: 3,
      cancelled: 0,
    }),
    []
  );

  const requestReturn = async (order) => {
    const trimmedReason = returnReason.trim();
    const trimmedComment = returnComment.trim();

    if (!trimmedReason || trimmedReason.length < 5) {
      setMessage("Return reason must be at least 5 characters.");
      return;
    }

    try {
      setSubmittingReturnId(order.id);
      const res = await API.post(`/checkout/orders/${order.id}/return`, {
        reason: trimmedReason,
        comment: trimmedComment || null,
      });
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? res.data : item))
      );
      setActiveReturnFormId(null);
      setReturnReason("");
      setReturnComment("");
      setToast(`Return request sent for order #${order.id}`);
      window.setTimeout(() => setToast(""), 2200);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Unable to submit return request.");
    } finally {
      setSubmittingReturnId(null);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Track Orders</h1>
            <p style={styles.subtitle}>Check your placed orders and current delivery status.</p>
          </div>
          <button style={styles.backBtn} onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>

        {loading ? (
          <div style={styles.emptyCard}>
            <h3 style={styles.emptyTitle}>Loading orders...</h3>
          </div>
        ) : orders.length === 0 ? (
          <div style={styles.emptyCard}>
            <h3 style={styles.emptyTitle}>No orders yet</h3>
            <p style={styles.emptyText}>Place an order from the cart to track it here.</p>
          </div>
        ) : (
          <div style={styles.list}>
            {orders.map((order) => (
              <div key={order.id} style={styles.orderCard}>
                <div style={styles.topRow}>
                  <div>
                    <h3 style={styles.orderId}>Order #{order.id}</h3>
                    <p style={styles.orderDate}>{new Date(order.created_at).toLocaleString("en-IN")}</p>
                  </div>
                  <span
                    style={{
                      ...styles.statusBadge,
                      ...(statusStyles[order.order_status] || statusStyles.pending),
                    }}
                  >
                    {String(order.order_status || "pending").replaceAll("_", " ")}
                  </span>
                </div>

                <div style={styles.infoGrid}>
                  <div style={styles.infoBox}>
                    <strong>Payment</strong>
                    <span>{String(order.payment_status || "pending").replaceAll("_", " ")}</span>
                  </div>
                  <div style={styles.infoBox}>
                    <strong>Total</strong>
                    <span>Rs. {Number(order.total).toLocaleString("en-IN")}</span>
                  </div>
                  <div style={styles.infoBox}>
                    <strong>Return Status</strong>
                    <span>{String(order.return_status || "not_requested").replaceAll("_", " ")}</span>
                  </div>
                </div>

                {order.return_reason ? (
                  <div style={styles.returnDetails}>
                    <strong>Return Reason</strong>
                    <p style={styles.returnText}>{order.return_reason}</p>
                    {order.return_comment ? (
                      <>
                        <strong>Comment</strong>
                        <p style={styles.returnText}>{order.return_comment}</p>
                      </>
                    ) : null}
                  </div>
                ) : null}

                <div style={styles.timeline}>
                  {steps.map((step, index) => (
                    <div
                      key={step}
                      style={{
                        ...styles.timelineStep,
                        opacity:
                          order.order_status === "cancelled"
                            ? index === 0
                              ? 1
                              : 0.25
                            : index <= (stepMap[order.order_status] ?? 0)
                              ? 1
                              : 0.45,
                      }}
                    >
                      <div style={styles.timelineDot} />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>

                <div style={styles.itemsBox}>
                  {order.items.map((item) => (
                    <div key={`${order.id}-${item.id}`} style={styles.itemRow}>
                      <span>{item.product?.name || `Product #${item.product_id}`}</span>
                      <span>Qty {item.quantity}</span>
                      <strong>Rs. {Number(item.price * item.quantity).toLocaleString("en-IN")}</strong>
                    </div>
                  ))}
                </div>

                <div style={styles.orderActions}>
                  {order.can_request_return ? (
                    activeReturnFormId === order.id ? (
                      <div style={styles.returnForm}>
                        <input
                          style={styles.returnInput}
                          placeholder="Return reason"
                          value={returnReason}
                          onChange={(e) => setReturnReason(e.target.value)}
                        />
                        <textarea
                          style={styles.returnTextarea}
                          placeholder="Optional comment"
                          value={returnComment}
                          onChange={(e) => setReturnComment(e.target.value)}
                        />
                        <div style={styles.returnFormActions}>
                          <button
                            style={styles.cancelReturnButton}
                            onClick={() => {
                              setActiveReturnFormId(null);
                              setReturnReason("");
                              setReturnComment("");
                            }}
                            disabled={submittingReturnId === order.id}
                          >
                            Cancel
                          </button>
                          <button
                            style={styles.returnButton}
                            onClick={() => requestReturn(order)}
                            disabled={
                              submittingReturnId === order.id ||
                              returnReason.trim().length < 5
                            }
                          >
                            {submittingReturnId === order.id ? "Submitting..." : "Submit Return"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        style={styles.returnButton}
                        onClick={() => {
                          setActiveReturnFormId(order.id);
                          setReturnReason("");
                          setReturnComment("");
                        }}
                      >
                        Request Return
                      </button>
                    )
                  ) : (
                    <span style={styles.returnHint}>
                      {order.return_status === "requested"
                        ? "Return request already submitted"
                        : order.order_status === "delivered"
                          ? `Return available only within ${order.return_window_days} days of delivery`
                          : "Return available only for delivered orders"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {message ? <p style={styles.notice}>{message}</p> : null}
        {toast ? <div style={styles.toast}>🔔 {toast}</div> : null}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)",
    padding: "28px 18px",
  },
  wrapper: {
    maxWidth: "1100px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    marginBottom: "22px",
    flexWrap: "wrap",
  },
  title: {
    fontSize: "36px",
    color: "#111827",
    marginBottom: "8px",
  },
  subtitle: {
    color: "#64748b",
  },
  backBtn: {
    border: "none",
    borderRadius: "14px",
    background: "#111827",
    color: "#fff",
    padding: "12px 18px",
    fontWeight: "800",
    cursor: "pointer",
  },
  emptyCard: {
    background: "#fff",
    borderRadius: "24px",
    padding: "36px",
    textAlign: "center",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
  },
  emptyTitle: {
    fontSize: "28px",
    color: "#111827",
    marginBottom: "10px",
  },
  emptyText: {
    color: "#64748b",
  },
  list: {
    display: "grid",
    gap: "18px",
  },
  orderCard: {
    background: "#fff",
    borderRadius: "24px",
    padding: "22px",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  orderId: {
    fontSize: "24px",
    color: "#111827",
    marginBottom: "6px",
  },
  orderDate: {
    color: "#64748b",
  },
  statusBadge: {
    padding: "8px 14px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontWeight: "800",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "14px",
    marginBottom: "18px",
  },
  infoBox: {
    display: "grid",
    gap: "6px",
    background: "#f8fafc",
    borderRadius: "16px",
    padding: "14px",
    color: "#334155",
  },
  timeline: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
    marginBottom: "18px",
  },
  timelineStep: {
    display: "grid",
    justifyItems: "center",
    gap: "8px",
    color: "#334155",
    fontWeight: "700",
  },
  timelineDot: {
    width: "16px",
    height: "16px",
    borderRadius: "999px",
    background: "#2563eb",
  },
  itemsBox: {
    display: "grid",
    gap: "10px",
  },
  itemRow: {
    display: "grid",
    gridTemplateColumns: "1.3fr 0.5fr 0.7fr",
    gap: "12px",
    color: "#334155",
    padding: "10px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  returnDetails: {
    marginBottom: "16px",
    padding: "14px 16px",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: "14px",
    display: "grid",
    gap: "6px",
    color: "#9a3412",
  },
  returnText: {
    margin: 0,
    lineHeight: 1.5,
  },
  orderActions: {
    marginTop: "16px",
    display: "flex",
    justifyContent: "flex-end",
  },
  returnForm: {
    width: "100%",
    display: "grid",
    gap: "10px",
    maxWidth: "420px",
  },
  returnInput: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
  },
  returnTextarea: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    minHeight: "90px",
    resize: "vertical",
    fontFamily: "inherit",
  },
  returnFormActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
  returnButton: {
    border: "none",
    borderRadius: "12px",
    background: "#dc2626",
    color: "#fff",
    padding: "12px 16px",
    fontWeight: "800",
    cursor: "pointer",
  },
  cancelReturnButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    background: "#fff",
    color: "#334155",
    padding: "12px 16px",
    fontWeight: "800",
    cursor: "pointer",
  },
  returnHint: {
    color: "#64748b",
    fontWeight: "600",
  },
  notice: {
    marginTop: "16px",
    color: "#166534",
    fontWeight: "700",
  },
  toast: {
    position: "fixed",
    right: "24px",
    bottom: "24px",
    background: "#111827",
    color: "#fff",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: "700",
    boxShadow: "0 12px 30px rgba(15,23,42,0.24)",
    zIndex: 100,
  },
};
