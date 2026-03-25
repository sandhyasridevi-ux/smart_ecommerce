import React from "react";
import { useNavigate } from "react-router-dom";

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const orderTotal = localStorage.getItem("last_order_total") || "0";
  const orderDetails = JSON.parse(localStorage.getItem("last_order_details") || "{}");

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.badge}>Order Confirmed</div>
        <h1 style={styles.title}>Your order has been placed</h1>
        <p style={styles.text}>
          Thank you for shopping with Smart E-Commerce.
        </p>
        <p style={styles.total}>Paid: Rs. {Number(orderTotal).toLocaleString("en-IN")}</p>
        <div style={styles.infoCard}>
          <p style={styles.infoLine}>
            <strong>Order ID:</strong> {orderDetails.orderId || "N/A"}
          </p>
          <p style={styles.infoLine}>
            <strong>Order Status:</strong> {orderDetails.status || "N/A"}
          </p>
          <p style={styles.infoLine}>
            <strong>Payment Status:</strong> {orderDetails.paymentStatus || "N/A"}
          </p>
          <p style={styles.infoLine}>
            <strong>Payment:</strong> {orderDetails.paymentMethod || "N/A"}
          </p>
          <p style={styles.infoLine}>
            <strong>Name:</strong> {orderDetails.fullName || "N/A"}
          </p>
          <p style={styles.infoLine}>
            <strong>Mobile:</strong> {orderDetails.mobile || "N/A"}
          </p>
          <p style={styles.infoLine}>
            <strong>Address:</strong> {orderDetails.address || "N/A"}
          </p>
        </div>
        <div style={styles.actions}>
          <button style={styles.primaryBtn} onClick={() => navigate("/dashboard")}>
            Continue Shopping
          </button>
          <button style={styles.primaryBtnAlt} onClick={() => navigate("/orders")}>
            Track Order
          </button>
          <button style={styles.secondaryBtn} onClick={() => navigate("/cart")}>
            Back to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "linear-gradient(180deg, #ecfeff 0%, #f8fafc 100%)",
  },
  card: {
    width: "100%",
    maxWidth: "560px",
    background: "#fff",
    borderRadius: "24px",
    padding: "40px 32px",
    textAlign: "center",
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
  },
  badge: {
    display: "inline-block",
    padding: "8px 14px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontWeight: "700",
    marginBottom: "16px",
  },
  title: {
    fontSize: "34px",
    color: "#111827",
    marginBottom: "12px",
  },
  text: {
    color: "#64748b",
    lineHeight: 1.6,
    marginBottom: "18px",
  },
  total: {
    fontSize: "24px",
    color: "#0f172a",
    fontWeight: "800",
    marginBottom: "22px",
  },
  infoCard: {
    background: "#f8fafc",
    borderRadius: "18px",
    padding: "18px",
    textAlign: "left",
    marginBottom: "22px",
  },
  infoLine: {
    color: "#334155",
    lineHeight: 1.7,
  },
  actions: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  primaryBtn: {
    border: "none",
    borderRadius: "14px",
    background: "#2563eb",
    color: "#fff",
    padding: "14px 18px",
    fontWeight: "800",
    cursor: "pointer",
  },
  primaryBtnAlt: {
    border: "none",
    borderRadius: "14px",
    background: "#0f766e",
    color: "#fff",
    padding: "14px 18px",
    fontWeight: "800",
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "none",
    borderRadius: "14px",
    background: "#e2e8f0",
    color: "#0f172a",
    padding: "14px 18px",
    fontWeight: "800",
    cursor: "pointer",
  },
};
