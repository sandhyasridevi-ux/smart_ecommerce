import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { getWishlistItems, saveCartItems, saveWishlistItems } from "../services/shopStorage";
import { buildProductFallbackImage, resolveProductImage } from "../utils/productImages";

export default function Wishlist() {
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    setItems(getWishlistItems());
  }, [navigate]);

  const removeItem = (productId) => {
    const nextItems = items.filter((item) => item.id !== productId);
    setItems(nextItems);
    saveWishlistItems(nextItems);
  };

  const moveToCart = async (item) => {
    try {
      const res = await API.post("/cart/add", {
        product_id: item.id,
        quantity: 1,
      });
      const backendItems = Array.isArray(res.data?.items) ? res.data.items : [];
      saveCartItems(
        backendItems.map((entry) => ({
          id: entry.product_id,
          name: entry.product?.name,
          description: entry.product?.description,
          price: entry.product?.price,
          category: entry.product?.category,
          stock: entry.product?.stock,
          image:
            resolveProductImage(entry.product || {}) ||
            buildProductFallbackImage(entry.product?.name, entry.product?.category),
          quantity: entry.quantity,
        }))
      );
      const nextItems = items.filter((wishlistItem) => wishlistItem.id !== item.id);
      setItems(nextItems);
      saveWishlistItems(nextItems);
      navigate("/cart");
    } catch (error) {
      // keep item in wishlist when cart add fails
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Wishlist</h1>
            <p style={styles.subtitle}>Your saved products are waiting here.</p>
          </div>
          <button style={styles.backBtn} onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>

        {items.length === 0 ? (
          <div style={styles.emptyCard}>
            <h3 style={styles.emptyTitle}>Your wishlist is empty</h3>
            <p style={styles.emptyText}>Save products from the dashboard to see them here.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {items.map((item) => (
              <div key={item.id} style={styles.card}>
                <img
                  src={resolveProductImage(item) || buildProductFallbackImage(item.name, item.category)}
                  alt={item.name}
                  style={styles.image}
                  onError={(e) => {
                    e.currentTarget.src = buildProductFallbackImage(item.name, item.category);
                  }}
                />
                <div style={styles.content}>
                  <h3 style={styles.productName}>{item.name}</h3>
                  <p style={styles.productText}>{item.description}</p>
                  <p style={styles.price}>Rs. {Number(item.price).toLocaleString("en-IN")}</p>
                  <div style={styles.actions}>
                    <button style={styles.primaryBtn} onClick={() => moveToCart(item)}>
                      Move to Cart
                    </button>
                    <button style={styles.secondaryBtn} onClick={() => removeItem(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #fff7ed 0%, #f8fafc 100%)",
    padding: "32px 18px",
  },
  wrapper: {
    maxWidth: "1080px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  title: {
    fontSize: "38px",
    color: "#111827",
    marginBottom: "8px",
  },
  subtitle: {
    color: "#64748b",
  },
  backBtn: {
    border: "none",
    background: "#111827",
    color: "#fff",
    borderRadius: "12px",
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: "700",
  },
  emptyCard: {
    background: "#fff",
    borderRadius: "24px",
    padding: "36px",
    textAlign: "center",
    boxShadow: "0 18px 40px rgba(30, 41, 59, 0.08)",
  },
  emptyTitle: {
    fontSize: "28px",
    marginBottom: "10px",
    color: "#111827",
  },
  emptyText: {
    color: "#64748b",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "20px",
  },
  card: {
    overflow: "hidden",
    background: "#fff",
    borderRadius: "22px",
    boxShadow: "0 18px 40px rgba(30, 41, 59, 0.08)",
  },
  image: {
    width: "100%",
    height: "220px",
    objectFit: "cover",
    display: "block",
  },
  content: {
    padding: "18px",
  },
  productName: {
    fontSize: "24px",
    color: "#111827",
    marginBottom: "10px",
  },
  productText: {
    color: "#64748b",
    lineHeight: 1.6,
    minHeight: "72px",
  },
  price: {
    marginTop: "14px",
    fontSize: "24px",
    fontWeight: "800",
    color: "#ea580c",
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginTop: "16px",
  },
  primaryBtn: {
    border: "none",
    borderRadius: "12px",
    background: "#0f766e",
    color: "#fff",
    padding: "12px 14px",
    fontWeight: "700",
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "none",
    borderRadius: "12px",
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "12px 14px",
    fontWeight: "700",
    cursor: "pointer",
  },
};
