import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCartItems, getWishlistItems } from "../services/shopStorage";

function Home() {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const wishlistCount = useMemo(() => getWishlistItems().length, []);
  const cartCount = useMemo(() => getCartItems().length, []);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>Smart E-Commerce</div>
        <div style={styles.headerActions}>
          <button style={styles.navItem} onClick={() => navigate("/wishlist")}>
            Wishlist
            <span style={styles.badge}>{wishlistCount}</span>
          </button>
          <button style={styles.navItem} onClick={() => navigate("/cart")}>
            Bag
            <span style={styles.badge}>{cartCount}</span>
          </button>
          <div style={styles.profileWrap}>
            <button
              style={styles.profileButton}
              onClick={() => setShowProfileMenu((value) => !value)}
            >
              Profile
            </button>

            {showProfileMenu ? (
              <div style={styles.profileMenu}>
                <h3 style={styles.menuTitle}>Welcome</h3>
                <p style={styles.menuText}>Access account and manage orders.</p>
                <button style={styles.loginButton} onClick={() => navigate("/login")}>
                  LOGIN / SIGNUP
                </button>
                <div style={styles.menuDivider} />
                <button style={styles.menuLink} onClick={() => navigate("/dashboard")}>
                  Orders
                </button>
                <button style={styles.menuLink} onClick={() => navigate("/wishlist")}>
                  Wishlist
                </button>
                <button style={styles.menuLink} onClick={() => navigate("/cart")}>
                  Bag
                </button>
                <button style={styles.menuLink} onClick={() => navigate("/login")}>
                  Contact Us
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main style={styles.hero}>
        <div style={styles.leftPanel}>
          <span style={styles.kicker}>Smart Shopping Experience</span>
          <h1 style={styles.title}>Sign in, explore products, and manage your cart easily.</h1>
          <p style={styles.subtitle}>
            Browse products, save your wishlist, review your bag, and access your account from one simple dashboard.
          </p>
          <div style={styles.buttonRow}>
            <button style={styles.primaryBtn} onClick={() => navigate("/login")}>
              Login
            </button>
            <button style={styles.secondaryBtn} onClick={() => navigate("/register")}>
              Create Account
            </button>
          </div>
        </div>

        <div style={styles.rightCard}>
          <div style={styles.infoPill}>Profile • Wishlist • Bag</div>
          <h2 style={styles.cardTitle}>Account Access</h2>
          <p style={styles.cardText}>
            Use the profile menu above to login, signup, open your wishlist, or review your saved cart items.
          </p>
          <div style={styles.previewGrid}>
            <div style={styles.previewCard}>
              <strong>Profile</strong>
              <span>Login and view account details</span>
            </div>
            <div style={styles.previewCard}>
              <strong>Wishlist</strong>
              <span>Save products for later</span>
            </div>
            <div style={styles.previewCard}>
              <strong>Bag</strong>
              <span>Track items before checkout</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fbff 0%, #eef2ff 100%)",
    padding: "22px",
  },
  header: {
    maxWidth: "1180px",
    margin: "0 auto 28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
  },
  brand: {
    fontSize: "26px",
    fontWeight: "800",
    color: "#0f172a",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  navItem: {
    border: "none",
    background: "#fff",
    borderRadius: "14px",
    padding: "12px 16px",
    color: "#0f172a",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    background: "#ef4444",
    color: "#fff",
    marginLeft: "8px",
    fontSize: "12px",
  },
  profileWrap: {
    position: "relative",
  },
  profileButton: {
    border: "none",
    background: "#fff",
    borderRadius: "14px",
    padding: "12px 18px",
    color: "#0f172a",
    fontWeight: "800",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
  },
  profileMenu: {
    position: "absolute",
    top: "56px",
    right: 0,
    width: "280px",
    background: "#fff",
    borderRadius: "20px",
    padding: "18px",
    boxShadow: "0 20px 40px rgba(15, 23, 42, 0.12)",
    zIndex: 10,
  },
  menuTitle: {
    fontSize: "24px",
    marginBottom: "8px",
    color: "#111827",
  },
  menuText: {
    color: "#64748b",
    lineHeight: 1.5,
    marginBottom: "14px",
  },
  loginButton: {
    width: "100%",
    border: "1px solid #f43f5e",
    background: "#fff1f2",
    color: "#e11d48",
    borderRadius: "12px",
    padding: "12px 14px",
    fontWeight: "800",
    cursor: "pointer",
    marginBottom: "14px",
  },
  menuDivider: {
    height: "1px",
    background: "#e2e8f0",
    marginBottom: "10px",
  },
  menuLink: {
    display: "block",
    width: "100%",
    textAlign: "left",
    border: "none",
    background: "transparent",
    padding: "10px 0",
    color: "#334155",
    fontSize: "15px",
    cursor: "pointer",
  },
  hero: {
    maxWidth: "1180px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.9fr)",
    gap: "24px",
    alignItems: "center",
  },
  leftPanel: {
    background: "linear-gradient(135deg, #0f172a, #1d4ed8)",
    color: "#fff",
    borderRadius: "28px",
    padding: "46px 38px",
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.18)",
  },
  kicker: {
    display: "inline-block",
    marginBottom: "14px",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.15)",
    fontWeight: "700",
  },
  title: {
    fontSize: "48px",
    lineHeight: 1.1,
    marginBottom: "16px",
  },
  subtitle: {
    color: "#dbeafe",
    lineHeight: 1.7,
    marginBottom: "24px",
    fontSize: "16px",
  },
  buttonRow: {
    display: "flex",
    gap: "14px",
    flexWrap: "wrap",
  },
  primaryBtn: {
    border: "none",
    borderRadius: "14px",
    background: "#f97316",
    color: "#fff",
    padding: "14px 22px",
    fontWeight: "800",
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "1px solid rgba(255,255,255,0.35)",
    borderRadius: "14px",
    background: "transparent",
    color: "#fff",
    padding: "14px 22px",
    fontWeight: "800",
    cursor: "pointer",
  },
  rightCard: {
    background: "#fff",
    borderRadius: "28px",
    padding: "34px",
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.1)",
  },
  infoPill: {
    display: "inline-block",
    marginBottom: "16px",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#fff7ed",
    color: "#c2410c",
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: "34px",
    color: "#111827",
    marginBottom: "12px",
  },
  cardText: {
    color: "#64748b",
    lineHeight: 1.7,
    marginBottom: "20px",
  },
  previewGrid: {
    display: "grid",
    gap: "14px",
  },
  previewCard: {
    padding: "16px",
    borderRadius: "18px",
    background: "#f8fafc",
    color: "#334155",
    display: "grid",
    gap: "6px",
  },
};

export default Home;
