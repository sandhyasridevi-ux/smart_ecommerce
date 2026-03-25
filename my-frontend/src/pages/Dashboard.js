import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API, { buildNotificationsWsUrl } from "../services/api";
import NotificationBell from "../components/NotificationBell";
import { buildProductFallbackImage, resolveProductImage } from "../utils/productImages";
import {
  getWishlistItems,
  saveCartItems,
  saveWishlistItems,
} from "../services/shopStorage";

const fallbackProducts = [
  {
    id: 1,
    name: "iPhone 15",
    description: "Latest Apple smartphone with premium camera quality and smooth everyday performance.",
    price: 79999,
    category: "Mobiles",
    stock: 10,
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 2,
    name: "Samsung Galaxy S24",
    description: "Flagship Samsung phone built for sharp photography, bright display, and fast multitasking.",
    price: 74999,
    category: "Mobiles",
    stock: 15,
    image:
      "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 3,
    name: "HP Laptop",
    description: "Reliable laptop for office work, online classes, browsing, and daily productivity tasks.",
    price: 55999,
    category: "Laptops",
    stock: 8,
    image:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 4,
    name: "Boat Headphones",
    description: "Wireless headphones with punchy bass, comfortable fit, and long battery backup.",
    price: 2999,
    category: "Accessories",
    stock: 25,
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 5,
    name: "Dell Inspiron 15",
    description: "Everyday laptop with dependable battery life and performance for work and study.",
    price: 62999,
    category: "Laptops",
    stock: 12,
    image:
      "https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 6,
    name: "Apple Watch SE",
    description: "Smartwatch for fitness tracking, quick notifications, and daily convenience.",
    price: 24999,
    category: "Wearables",
    stock: 14,
    image:
      "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 7,
    name: "Realme Buds Air",
    description: "Compact wireless earbuds with low-latency sound and comfortable fit.",
    price: 3499,
    category: "Accessories",
    stock: 30,
    image:
      "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 8,
    name: "Sony WH-1000XM5",
    description: "Premium noise-cancelling headphones for travel, work, and immersive audio.",
    price: 29999,
    category: "Accessories",
    stock: 0,
    image:
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 9,
    name: "iPad Air",
    description: "Lightweight tablet for study, note taking, video, and creative work.",
    price: 54999,
    category: "Tablets",
    stock: 0,
    image:
      "https://images.unsplash.com/photo-1561154464-82e9adf32764?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 10,
    name: "Logitech MX Master 3S",
    description: "Advanced wireless mouse built for productivity and long working hours.",
    price: 8999,
    category: "Accessories",
    stock: 18,
    image:
      "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 11,
    name: "OnePlus 12",
    description: "Flagship Android phone with smooth display and super fast charging.",
    price: 64999,
    category: "Mobiles",
    stock: 11,
    image:
      "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 12,
    name: "Asus ROG Laptop",
    description: "Gaming laptop with strong graphics, cooling, and high refresh display.",
    price: 119999,
    category: "Laptops",
    stock: 0,
    image:
      "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 13,
    name: "Amazon Echo Dot",
    description: "Smart speaker with voice assistant support for your home.",
    price: 4499,
    category: "Smart Home",
    stock: 16,
    image:
      "https://images.unsplash.com/photo-1543512214-318c7553f230?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 14,
    name: "Canon EOS M50",
    description: "Mirrorless camera made for travel shots, creators, and casual video work.",
    price: 58999,
    category: "Cameras",
    stock: 0,
    image:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 15,
    name: "Samsung 27 Inch Monitor",
    description: "Full HD monitor with a clean display for office work and entertainment.",
    price: 15999,
    category: "Monitors",
    stock: 13,
    image:
      "https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&w=900&q=80",
  },
];

const categoryImages = {
  Mobiles:
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80",
  Laptops:
    "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80",
  Accessories:
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
  General:
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
};

const formatPrice = (price) => `Rs. ${Number(price).toLocaleString("en-IN")}`;
const getProductImage = (item) =>
  resolveProductImage(item) ||
  categoryImages[item.category] ||
  categoryImages.General ||
  buildProductFallbackImage(item?.name, item?.category);

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usingFallback, setUsingFallback] = useState(false);
  const [wishlist, setWishlist] = useState([]);
  const [cart, setCart] = useState([]);
  const [flashMessage, setFlashMessage] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortOption, setSortOption] = useState("recommended");
  const [stockFilter, setStockFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    fetchCurrentUser();

    setWishlist(getWishlistItems().map((item) => item.id));
    loadCartCount();

    fetchProducts();
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || token.startsWith("local-token-")) {
      return;
    }

    const ws = new WebSocket(buildNotificationsWsUrl(token));
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data || "{}");
        const eventType = parsed?.event;
        const payload = parsed?.payload || {};
        if (eventType === "cart_updated") {
          const itemCount = Number(payload.cart_items || payload.items?.length || 0);
          setCart(Array.from({ length: itemCount }, (_, i) => i + 1));
          showFlash(payload.message || "Cart updated");
        }
        if (eventType === "order_status_updated") {
          showFlash(payload.message || `Order #${payload.order_id} ${payload.status}`);
        }
      } catch (error) {
        // ignore malformed ws payload
      }
    };

    return () => ws.close();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const me = await API.get("/auth/me");
      if (me?.data) {
        setUser(me.data);
        localStorage.setItem("user", JSON.stringify(me.data));
        return;
      }
    } catch (error) {
      // fallback to local cached user when /auth/me fails
    }

    try {
      const savedUser = JSON.parse(localStorage.getItem("user") || "null");
      if (savedUser) {
        setUser(savedUser);
      }
    } catch (error) {
      setUser(null);
    }
  };

  const loadCartCount = async () => {
    try {
      const res = await API.get("/cart");
      const backendItems = Array.isArray(res.data?.items) ? res.data.items : [];
      setCart(backendItems.map((item) => item.product_id));
          saveCartItems(
        backendItems.map((item) => ({
          id: item.product_id,
          name: item.product?.name,
          description: item.product?.description,
          price: item.product?.price,
          category: item.product?.category,
          stock: item.product?.stock,
          image: getProductImage(item.product || {}),
          quantity: item.quantity,
        }))
      );
    } catch (error) {
      setCart([]);
    }
  };

  const showFlash = (message) => {
    setFlashMessage(message);
    window.clearTimeout(window.__shopFlashTimer);
    window.__shopFlashTimer = window.setTimeout(() => {
      setFlashMessage("");
    }, 1800);
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError("");
      setUsingFallback(false);
      const productRes = await API.get("/products/");
      setProducts(Array.isArray(productRes.data) ? productRes.data : []);
    } catch (err) {
      console.error("Product fetch failed:", err);
      const isNetworkIssue =
        err?.code === "ECONNABORTED" ||
        err?.message === "Network Error" ||
        !err?.response;

      if (isNetworkIssue) {
        setProducts(fallbackProducts);
        setUsingFallback(true);
        setError(
          "Backend is not responding, so demo products are being shown right now."
        );
      } else {
        setError(
          err?.response?.data?.detail ||
            "Could not load products. Start FastAPI with: uvicorn fastapi_backend.main:app --reload"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const counts = products.reduce((acc, item) => {
      const key = item.category || "General";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const filteredProducts = useMemo(() => {
    let nextProducts = [...products];

    if (selectedCategories.length > 0) {
      nextProducts = nextProducts.filter((item) =>
        selectedCategories.includes(item.category || "General")
      );
    }

    if (stockFilter === "in_stock") {
      nextProducts = nextProducts.filter((item) => item.stock > 0);
    }

    if (stockFilter === "out_of_stock") {
      nextProducts = nextProducts.filter((item) => item.stock <= 0);
    }

    if (sortOption === "price_low_to_high") {
      nextProducts.sort((a, b) => Number(a.price) - Number(b.price));
    }

    if (sortOption === "price_high_to_low") {
      nextProducts.sort((a, b) => Number(b.price) - Number(a.price));
    }

    if (sortOption === "popularity_high_to_low") {
      nextProducts.sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));
    }

    return nextProducts;
  }, [products, selectedCategories, sortOption, stockFilter]);

  const toggleCategory = (categoryName) => {
    setSelectedCategories((current) =>
      current.includes(categoryName)
        ? current.filter((item) => item !== categoryName)
        : [...current, categoryName]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSortOption("recommended");
    setStockFilter("all");
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const toggleWishlist = (product) => {
    setWishlist((current) => {
      const exists = current.includes(product.id);
      const currentItems = getWishlistItems();
      const nextIds = exists
        ? current.filter((id) => id !== product.id)
        : [...current, product.id];
      const nextItems = exists
        ? currentItems.filter((item) => item.id !== product.id)
        : [
            ...currentItems,
            {
              id: product.id,
              name: product.name,
              description: product.description,
              price: product.price,
              category: product.category,
              stock: product.stock,
              image: getProductImage(product),
            },
          ];

      saveWishlistItems(nextItems);
      showFlash(
        exists
          ? `${product.name} removed from wishlist`
          : `${product.name} added to wishlist`
      );
      return nextIds;
    });
  };

  const addToCart = async (product) => {
    try {
      const res = await API.post("/cart/add", {
        product_id: product.id,
        quantity: 1,
      });
      const backendItems = Array.isArray(res.data?.items) ? res.data.items : [];
      setCart(backendItems.map((item) => item.product_id));
      saveCartItems(
        backendItems.map((item) => ({
          id: item.product_id,
          name: item.product?.name,
          description: item.product?.description,
          price: item.product?.price,
          category: item.product?.category,
          stock: item.product?.stock,
          image: getProductImage(item.product || {}),
          quantity: item.quantity,
        }))
      );
      showFlash(`${product.name} added to cart`);
    } catch (error) {
      showFlash(error?.response?.data?.detail || "Could not add to cart");
    }
  };

  const buyNow = async (product) => {
    await addToCart(product);
    navigate("/cart");
  };

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <div style={styles.topBar}>
          <div>
            <h2 style={styles.heading}>Dashboard</h2>
            <p style={styles.subheading}>Discover products you can wishlist, add to cart, or buy now.</p>
          </div>
          <div style={styles.topActions}>
            <NotificationBell role={user?.role} />
            <div style={styles.profileMenuWrap}>
              <button
                style={styles.profileTrigger}
                onClick={() => setShowProfileMenu((value) => !value)}
              >
                Profile
              </button>
              {showProfileMenu ? (
                <div style={styles.profileMenu}>
                  <h4 style={styles.profileMenuTitle}>Welcome</h4>
                  <p style={styles.profileMenuText}>
                    Access account and manage orders.
                  </p>
                  {!user ? (
                    <button
                      style={styles.profileMenuPrimary}
                      onClick={() => navigate("/login")}
                    >
                      LOGIN / SIGNUP
                    </button>
                  ) : (
                    <div style={styles.profileSignedInBox}>
                      Signed in as <strong>{user.name || user.email}</strong>
                    </div>
                  )}
                  <div style={styles.profileMenuDivider} />
                  <button
                    style={styles.profileMenuLink}
                    onClick={() =>
                      user?.role === "admin" ? navigate("/admin-panel") : navigate("/orders")
                    }
                  >
                    Orders
                  </button>
                  <button
                    style={styles.profileMenuLink}
                    onClick={() => navigate("/wishlist")}
                  >
                    Wishlist
                  </button>
                  <button
                    style={styles.profileMenuLink}
                    onClick={() => navigate("/cart")}
                  >
                    Bag
                  </button>
                  <button
                    style={styles.profileMenuLink}
                    onClick={() => navigate("/cart")}
                  >
                    Saved Addresses
                  </button>
                </div>
              ) : null}
            </div>
            <button style={styles.counterPillButton} onClick={() => navigate("/wishlist")}>
              Wishlist {wishlist.length}
            </button>
            <button style={styles.counterPillButton} onClick={() => navigate("/cart")}>
              Cart {cart.length}
            </button>
            <button style={styles.logoutBtn} onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        {flashMessage ? <div style={styles.flashMessage}>{flashMessage}</div> : null}

        {user && (
          <div style={styles.profileCard}>
            <div>
              <h3 style={styles.cardTitle}>Welcome, {user.name}</h3>
              <p style={styles.profileLine}>
                <strong>Email:</strong> {user.email}
              </p>
              <p style={styles.profileLine}>
                <strong>Role:</strong> {user.role}
              </p>
            </div>
            <div style={styles.profileBadge}>Premium Shopper</div>
          </div>
        )}

        <div style={styles.productsPanel}>
          <div style={styles.sectionHeader}>
            <div>
              <h3 style={styles.cardTitle}>Products</h3>
              <p style={styles.sectionSubtext}>Browse and filter the product collection.</p>
            </div>
            <span style={styles.sectionMeta}>{filteredProducts.length} items</span>
          </div>

          {loading ? (
            <p>Loading products...</p>
          ) : (
            <>
              {error ? (
                <p style={usingFallback ? styles.noticeText : styles.errorText}>{error}</p>
              ) : null}
              <div style={styles.catalogLayout}>
                <aside style={styles.filterPanel}>
                  <div style={styles.filterHeader}>
                    <h4 style={styles.filterTitle}>Filters</h4>
                    <button type="button" style={styles.clearBtn} onClick={clearFilters}>
                      Clear
                    </button>
                  </div>

                  <div style={styles.filterSection}>
                    <h5 style={styles.filterLabel}>Sort By</h5>
                    <select
                      style={styles.select}
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value)}
                    >
                      <option value="recommended">Recommended</option>
                      <option value="price_low_to_high">Price: Low to High</option>
                      <option value="price_high_to_low">Price: High to Low</option>
                      <option value="popularity_high_to_low">Popularity</option>
                    </select>
                  </div>

                  <div style={styles.filterSection}>
                    <h5 style={styles.filterLabel}>Stock</h5>
                    <label style={styles.checkboxRow}>
                      <input
                        type="radio"
                        name="stock-filter"
                        checked={stockFilter === "all"}
                        onChange={() => setStockFilter("all")}
                      />
                      <span>All Products</span>
                    </label>
                    <label style={styles.checkboxRow}>
                      <input
                        type="radio"
                        name="stock-filter"
                        checked={stockFilter === "in_stock"}
                        onChange={() => setStockFilter("in_stock")}
                      />
                      <span>In Stock</span>
                    </label>
                    <label style={styles.checkboxRow}>
                      <input
                        type="radio"
                        name="stock-filter"
                        checked={stockFilter === "out_of_stock"}
                        onChange={() => setStockFilter("out_of_stock")}
                      />
                      <span>Out of Stock</span>
                    </label>
                  </div>

                  <div style={styles.filterSection}>
                    <h5 style={styles.filterLabel}>Categories</h5>
                    <div style={styles.categoryList}>
                      {categories.map((category) => (
                        <label key={category.name} style={styles.checkboxRow}>
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(category.name)}
                            onChange={() => toggleCategory(category.name)}
                          />
                          <span>
                            {category.name} ({category.count})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </aside>

                <div>
                  {filteredProducts.length === 0 ? (
                    <p>No products match the selected filters.</p>
                  ) : (
                    <div style={styles.productGrid}>
                      {filteredProducts.map((item) => {
                        const isWishlisted = wishlist.includes(item.id);
                        const stockLabel = item.stock > 0 ? "In Stock" : "Out of Stock";

                        return (
                          <div key={item.id} style={styles.productCard}>
                            <div style={styles.imageWrap}>
                <img
                  src={getProductImage(item)}
                  alt={item.name}
                  style={styles.productImage}
                  onError={(e) => {
                    const fallback = buildProductFallbackImage(item.name, item.category);
                    if (e.currentTarget.src !== fallback) {
                      e.currentTarget.src = fallback;
                    }
                  }}
                />
                              <span style={styles.categoryTag}>
                                {item.category || "General"}
                              </span>
                            </div>

                            <div style={styles.productBody}>
                              <div style={styles.productTopRow}>
                                <h4 style={styles.productName}>{item.name}</h4>
                                <button
                                  type="button"
                                  onClick={() => toggleWishlist(item)}
                                  style={{
                                    ...styles.wishlistBtn,
                                    background: isWishlisted ? "#fee2e2" : "#f8fafc",
                                    color: isWishlisted ? "#dc2626" : "#334155",
                                  }}
                                >
                                  {isWishlisted ? "Wishlisted" : "Wishlist"}
                                </button>
                              </div>

                              <p style={styles.productDescription}>
                                {item.description || "A dependable product picked for everyday shopping."}
                              </p>

                              <div style={styles.metaRow}>
                                <span style={styles.priceText}>{formatPrice(item.price)}</span>
                                <span
                                  style={{
                                    ...styles.stockBadge,
                                    background: item.stock > 0 ? "#dcfce7" : "#fee2e2",
                                    color: item.stock > 0 ? "#166534" : "#b91c1c",
                                  }}
                                >
                                  {stockLabel}
                                </span>
                              </div>

                              <p style={styles.productContent}>
                                Great for customers looking for quality, value, and a smooth shopping experience.
                              </p>

                              <div style={styles.actionRow}>
                                <button
                                  type="button"
                                  onClick={() => addToCart(item)}
                                  style={styles.cartBtn}
                                  disabled={item.stock <= 0}
                                >
                                  Add to Cart
                                </button>
                                <button
                                  type="button"
                                  onClick={() => buyNow(item)}
                                  style={styles.buyBtn}
                                  disabled={item.stock <= 0}
                                >
                                  Buy Now
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #e8eefc 0%, #f8fbff 45%, #eef7f1 100%)",
    padding: "32px 18px 48px",
  },
  wrapper: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "22px",
    flexWrap: "wrap",
  },
  topActions: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  profileMenuWrap: {
    position: "relative",
  },
  profileTrigger: {
    padding: "10px 14px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.9)",
    border: "1px solid #dbe4ff",
    color: "#1e293b",
    fontWeight: "700",
    cursor: "pointer",
  },
  profileMenu: {
    position: "absolute",
    top: "54px",
    right: 0,
    width: "280px",
    background: "#ffffff",
    borderRadius: "20px",
    padding: "18px",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.14)",
    zIndex: 20,
  },
  profileMenuTitle: {
    color: "#0f172a",
    fontSize: "22px",
    marginBottom: "8px",
  },
  profileMenuText: {
    color: "#64748b",
    lineHeight: 1.5,
    marginBottom: "12px",
  },
  profileMenuPrimary: {
    width: "100%",
    border: "1px solid #fb7185",
    background: "#fff1f2",
    color: "#e11d48",
    borderRadius: "12px",
    padding: "12px 14px",
    fontWeight: "800",
    cursor: "pointer",
    marginBottom: "12px",
  },
  profileSignedInBox: {
    marginBottom: "12px",
    background: "#ecfeff",
    color: "#155e75",
    border: "1px solid #a5f3fc",
    borderRadius: "12px",
    padding: "10px 12px",
    fontWeight: "600",
  },
  profileMenuDivider: {
    height: "1px",
    background: "#e2e8f0",
    marginBottom: "8px",
  },
  profileMenuLink: {
    display: "block",
    width: "100%",
    textAlign: "left",
    border: "none",
    background: "transparent",
    color: "#334155",
    padding: "10px 0",
    cursor: "pointer",
    fontSize: "15px",
  },
  heading: {
    fontSize: "42px",
    color: "#0f172a",
    marginBottom: "8px",
  },
  subheading: {
    color: "#475569",
    fontSize: "15px",
    maxWidth: "580px",
    lineHeight: 1.6,
  },
  counterPillButton: {
    padding: "10px 14px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.9)",
    border: "1px solid #dbe4ff",
    color: "#1e293b",
    fontWeight: "600",
    cursor: "pointer",
  },
  logoutBtn: {
    background: "#0f172a",
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "700",
  },
  flashMessage: {
    marginBottom: "16px",
    padding: "14px 16px",
    borderRadius: "14px",
    background: "#ecfeff",
    color: "#155e75",
    fontWeight: "600",
    border: "1px solid #a5f3fc",
  },
  profileCard: {
    background: "rgba(255,255,255,0.95)",
    borderRadius: "24px",
    padding: "24px",
    marginBottom: "24px",
    boxShadow: "0 18px 40px rgba(30, 41, 59, 0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
  },
  profileBadge: {
    padding: "10px 14px",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #0f172a, #1d4ed8)",
    color: "white",
    fontWeight: "700",
  },
  profileLine: {
    marginTop: "8px",
    color: "#334155",
  },
  productsPanel: {
    background: "rgba(255,255,255,0.97)",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 18px 40px rgba(30, 41, 59, 0.08)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  sectionSubtext: {
    color: "#64748b",
    marginTop: "6px",
  },
  sectionMeta: {
    color: "#64748b",
    fontWeight: "600",
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: "30px",
    margin: 0,
  },
  catalogLayout: {
    display: "grid",
    gridTemplateColumns: "280px minmax(0, 1fr)",
    gap: "24px",
    alignItems: "start",
  },
  filterPanel: {
    border: "1px solid #e2e8f0",
    borderRadius: "20px",
    padding: "18px",
    background: "#fbfdff",
    position: "sticky",
    top: "16px",
  },
  filterHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  filterTitle: {
    fontSize: "24px",
    color: "#111827",
  },
  clearBtn: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    fontWeight: "700",
    cursor: "pointer",
  },
  filterSection: {
    paddingTop: "14px",
    marginTop: "14px",
    borderTop: "1px solid #e2e8f0",
  },
  filterLabel: {
    fontSize: "18px",
    color: "#111827",
    marginBottom: "12px",
  },
  select: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "15px",
    outline: "none",
    background: "#fff",
  },
  categoryList: {
    display: "grid",
    gap: "10px",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#334155",
    fontWeight: "500",
  },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "20px",
  },
  productCard: {
    overflow: "hidden",
    borderRadius: "22px",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
  },
  imageWrap: {
    position: "relative",
    height: "220px",
    overflow: "hidden",
    background: "#f8fafc",
  },
  productImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  categoryTag: {
    position: "absolute",
    top: "14px",
    left: "14px",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(15, 23, 42, 0.78)",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: "700",
  },
  productBody: {
    padding: "18px",
  },
  productTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
    marginBottom: "10px",
  },
  productName: {
    margin: 0,
    fontSize: "22px",
    color: "#111827",
  },
  wishlistBtn: {
    border: "1px solid #e2e8f0",
    borderRadius: "999px",
    padding: "8px 12px",
    fontWeight: "700",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  productDescription: {
    color: "#475569",
    lineHeight: 1.6,
    minHeight: "72px",
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginTop: "14px",
    marginBottom: "12px",
    flexWrap: "wrap",
  },
  priceText: {
    fontSize: "26px",
    color: "#0f172a",
    fontWeight: "800",
  },
  stockBadge: {
    padding: "8px 12px",
    borderRadius: "999px",
    fontWeight: "700",
    fontSize: "13px",
  },
  productContent: {
    color: "#64748b",
    lineHeight: 1.6,
    marginBottom: "16px",
  },
  actionRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  cartBtn: {
    border: "none",
    borderRadius: "14px",
    padding: "12px 14px",
    background: "#e2e8f0",
    color: "#0f172a",
    fontWeight: "800",
    cursor: "pointer",
  },
  buyBtn: {
    border: "none",
    borderRadius: "14px",
    padding: "12px 14px",
    background: "linear-gradient(90deg, #f97316, #ea580c)",
    color: "white",
    fontWeight: "800",
    cursor: "pointer",
  },
  errorText: {
    color: "#dc2626",
    fontWeight: "600",
  },
  noticeText: {
    color: "#b45309",
    fontWeight: "600",
    marginBottom: "14px",
  },
};
