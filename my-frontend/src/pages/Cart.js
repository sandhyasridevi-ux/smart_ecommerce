import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API, { buildNotificationsWsUrl } from "../services/api";
import { getCartItems, saveCartItems } from "../services/shopStorage";
import { buildProductFallbackImage, resolveProductImage } from "../utils/productImages";

const ADDRESSES_KEY = "saved_addresses";

const readSavedAddresses = () => {
  try {
    const addresses = JSON.parse(localStorage.getItem(ADDRESSES_KEY) || "[]");
    return Array.isArray(addresses) ? addresses : [];
  } catch (error) {
    return [];
  }
};

export default function Cart() {
  const [items, setItems] = useState([]);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [saveAddressChecked, setSaveAddressChecked] = useState(true);
  const [toast, setToast] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    mobile: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    paymentMethod: "upi",
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    upiId: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    if (token.startsWith("local-token-")) {
      setCheckoutMessage("Please logout and login again to use backend checkout.");
      return;
    }

    loadCart();
    setSavedAddresses(readSavedAddresses());
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
        if (parsed?.event !== "cart_updated") return;
        const payload = parsed?.payload || {};
        const backendItems = Array.isArray(payload.items) ? payload.items : [];
        const nextItems = backendItems.map((item) => ({
          id: item.product_id,
          name: item.product?.name,
          description: item.product?.description,
          price: Number(item.product?.price || 0),
          category: item.product?.category,
          stock: item.product?.stock,
          image:
            resolveProductImage(item.product || {}) ||
            buildProductFallbackImage(item.product?.name, item.product?.category),
          quantity: item.quantity,
        }));
        setItems(nextItems);
        saveCartItems(nextItems);
        setToast(payload.message || "Cart updated");
        window.setTimeout(() => setToast(""), 2000);
      } catch (error) {
        // ignore malformed payload
      }
    };

    return () => ws.close();
  }, []);

  const loadCart = async () => {
    try {
      const res = await API.get("/cart");
      const backendItems = Array.isArray(res.data?.items) ? res.data.items : [];
      if (backendItems.length === 0) {
        const localItems = getCartItems();
        if (localItems.length > 0) {
          for (const localItem of localItems) {
            try {
              await API.post("/cart/add", {
                product_id: localItem.id,
                quantity: localItem.quantity || 1,
              });
            } catch (error) {
              // continue migrating remaining items
            }
          }
          const refresh = await API.get("/cart");
          const refreshedItems = Array.isArray(refresh.data?.items) ? refresh.data.items : [];
          const migrated = refreshedItems.map((item) => ({
            id: item.product_id,
            name: item.product?.name,
            description: item.product?.description,
            price: Number(item.product?.price || 0),
            category: item.product?.category,
            stock: item.product?.stock,
            image:
              resolveProductImage(item.product || {}) ||
              buildProductFallbackImage(item.product?.name, item.product?.category),
            quantity: item.quantity,
          }));
          setItems(migrated);
          saveCartItems(migrated);
          return;
        }
      }
      const nextItems = backendItems.map((item) => ({
        id: item.product_id,
        name: item.product?.name,
        description: item.product?.description,
        price: Number(item.product?.price || 0),
        category: item.product?.category,
        stock: item.product?.stock,
        image:
          resolveProductImage(item.product || {}) ||
          buildProductFallbackImage(item.product?.name, item.product?.category),
        quantity: item.quantity,
      }));
      setItems(nextItems);
      saveCartItems(nextItems);
    } catch (error) {
      setCheckoutMessage(error?.response?.data?.detail || "Could not load cart.");
    }
  };

  const updateQuantity = async (productId, delta) => {
    const current = items.find((item) => item.id === productId);
    if (!current) return;
    const nextQuantity = Math.max(1, (current.quantity || 1) + delta);

    try {
      const res = await API.put("/cart/update", {
        product_id: productId,
        quantity: nextQuantity,
      });
      const backendItems = Array.isArray(res.data?.items) ? res.data.items : [];
      const nextItems = backendItems.map((item) => ({
        id: item.product_id,
        name: item.product?.name,
        description: item.product?.description,
        price: Number(item.product?.price || 0),
        category: item.product?.category,
        stock: item.product?.stock,
        image:
          resolveProductImage(item.product || {}) ||
          buildProductFallbackImage(item.product?.name, item.product?.category),
        quantity: item.quantity,
      }));
      setItems(nextItems);
      saveCartItems(nextItems);
    } catch (error) {
      setCheckoutMessage(error?.response?.data?.detail || "Could not update quantity.");
    }
  };

  const removeItem = async (productId) => {
    try {
      const res = await API.delete("/cart/remove", {
        data: { product_id: productId },
      });
      const backendItems = Array.isArray(res.data?.items) ? res.data.items : [];
      const nextItems = backendItems.map((item) => ({
        id: item.product_id,
        name: item.product?.name,
        description: item.product?.description,
        price: Number(item.product?.price || 0),
        category: item.product?.category,
        stock: item.product?.stock,
        image:
          resolveProductImage(item.product || {}) ||
          buildProductFallbackImage(item.product?.name, item.product?.category),
        quantity: item.quantity,
      }));
      setItems(nextItems);
      saveCartItems(nextItems);
    } catch (error) {
      setCheckoutMessage(error?.response?.data?.detail || "Could not remove item.");
    }
  };

  const summary = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.price) * (item.quantity || 1),
      0
    );
    const tax = subtotal * 0.05;
    return {
      subtotal,
      tax,
      total: subtotal + tax,
    };
  }, [items]);

  const handleInputChange = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSelectSavedAddress = (index) => {
    const selected = savedAddresses[index];
    if (!selected) {
      return;
    }

    setFormData((current) => ({
      ...current,
      fullName: selected.fullName || "",
      mobile: selected.mobile || "",
      addressLine1: selected.addressLine1 || "",
      addressLine2: selected.addressLine2 || "",
      city: selected.city || "",
      state: selected.state || "",
      pincode: selected.pincode || "",
    }));
    setCheckoutMessage("Saved address loaded.");
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      setCheckoutMessage("Your cart is empty.");
      return;
    }

    setCheckoutMessage("");
    setShowCheckoutForm(true);
  };

  const handlePlaceOrder = async () => {
    const addressReady =
      formData.fullName &&
      formData.mobile &&
      formData.addressLine1 &&
      formData.city &&
      formData.state &&
      formData.pincode;

    const paymentReady =
      formData.paymentMethod === "cod" ||
      (formData.paymentMethod === "upi" && formData.upiId) ||
      (formData.paymentMethod === "card" &&
        formData.cardName &&
        formData.cardNumber &&
        formData.expiry &&
        formData.cvv);

    if (!addressReady || !paymentReady) {
      setCheckoutMessage("Please fill address and payment details.");
      return;
    }

    if (saveAddressChecked) {
      const addressToSave = {
        fullName: formData.fullName,
        mobile: formData.mobile,
        addressLine1: formData.addressLine1,
        addressLine2: formData.addressLine2,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
      };

      const currentAddresses = readSavedAddresses();
      const alreadySaved = currentAddresses.some(
        (item) =>
          item.fullName === addressToSave.fullName &&
          item.mobile === addressToSave.mobile &&
          item.addressLine1 === addressToSave.addressLine1 &&
          item.pincode === addressToSave.pincode
      );

      if (!alreadySaved) {
        const nextAddresses = [addressToSave, ...currentAddresses].slice(0, 5);
        localStorage.setItem(ADDRESSES_KEY, JSON.stringify(nextAddresses));
        setSavedAddresses(nextAddresses);
      }
    }

    try {
      const response = await API.post("/checkout", {
        payment_method: formData.paymentMethod,
        currency: "inr",
      });
      const order = response?.data?.order;
      const orderDetails = {
        orderId: order?.id || "",
        placedAt: order?.created_at || new Date().toISOString(),
        status: order?.order_status || "pending",
        paymentStatus: order?.payment_status || "pending",
        paymentMethod: formData.paymentMethod?.toUpperCase() || "N/A",
        fullName: formData.fullName,
        mobile: formData.mobile,
        address: [
          formData.addressLine1,
          formData.addressLine2,
          `${formData.city}, ${formData.state} - ${formData.pincode}`,
        ]
          .filter(Boolean)
          .join(", "),
      };
      localStorage.setItem(
        "last_order_total",
        String(Math.round(Number(order?.total || summary.total)))
      );
      localStorage.setItem("last_order_details", JSON.stringify(orderDetails));
      saveCartItems([]);
      setItems([]);
      setCheckoutMessage("Order placed successfully.");
      navigate("/checkout-success");
    } catch (error) {
      setCheckoutMessage(error?.response?.data?.detail || "Order placement failed.");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>My Cart</h1>
            <p style={styles.subtitle}>Review your products, address, and payment details.</p>
          </div>
          <button style={styles.backBtn} onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>

        {items.length === 0 ? (
          <div style={styles.emptyCard}>
            <h3 style={styles.emptyTitle}>Your cart is empty</h3>
            <p style={styles.emptyText}>Add products from the dashboard to see them here.</p>
          </div>
        ) : (
          <>
            <div style={styles.layout}>
              <div style={styles.list}>
                {items.map((item) => (
                  <div key={item.id} style={styles.itemCard}>
                <img
                  src={resolveProductImage(item) || item.image || buildProductFallbackImage(item.name, item.category)}
                  alt={item.name}
                  style={styles.image}
                  onError={(e) => {
                    e.currentTarget.src = buildProductFallbackImage(item.name, item.category);
                  }}
                />
                    <div style={styles.info}>
                      <h3 style={styles.productName}>{item.name}</h3>
                      <p style={styles.productText}>{item.description}</p>
                      <p style={styles.price}>
                        Rs. {Number(item.price).toLocaleString("en-IN")}
                      </p>
                      <p style={styles.itemTotal}>
                        Item Total: Rs. {Number(item.price * (item.quantity || 1)).toLocaleString("en-IN")}
                      </p>
                      <div style={styles.qtyRow}>
                        <button style={styles.qtyBtn} onClick={() => updateQuantity(item.id, -1)}>
                          -
                        </button>
                        <span style={styles.qtyValue}>{item.quantity || 1}</span>
                        <button style={styles.qtyBtn} onClick={() => updateQuantity(item.id, 1)}>
                          +
                        </button>
                        <button style={styles.removeBtn} onClick={() => removeItem(item.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.summaryCard}>
                <h3 style={styles.summaryTitle}>Order Summary</h3>
                <div style={styles.summaryRow}>
                  <span>Subtotal</span>
                  <strong>Rs. {summary.subtotal.toLocaleString("en-IN")}</strong>
                </div>
                <div style={styles.summaryRow}>
                  <span>Tax</span>
                  <strong>
                    Rs. {summary.tax.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </strong>
                </div>
                <div style={styles.totalRow}>
                  <span>Grand Total</span>
                  <strong>
                    Rs. {summary.total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </strong>
                </div>
                {checkoutMessage ? <p style={styles.message}>{checkoutMessage}</p> : null}
                <button style={styles.checkoutBtn} onClick={handleCheckout}>
                  Proceed to Checkout
                </button>
              </div>
            </div>

            {showCheckoutForm ? (
              <div style={styles.checkoutSection}>
                <div style={styles.formCard}>
                  <h3 style={styles.formTitle}>Delivery Address</h3>
                  {savedAddresses.length > 0 ? (
                    <div style={styles.savedAddressBox}>
                      <div style={styles.savedAddressHeader}>
                        <strong>Saved Addresses</strong>
                        <span>{savedAddresses.length} saved</span>
                      </div>
                      <div style={styles.savedAddressList}>
                        {savedAddresses.map((address, index) => (
                          <button
                            key={`${address.mobile}-${index}`}
                            type="button"
                            style={styles.savedAddressButton}
                            onClick={() => handleSelectSavedAddress(index)}
                          >
                            <strong>{address.fullName}</strong>
                            <span>{address.addressLine1}</span>
                            <span>
                              {address.city}, {address.state} - {address.pincode}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div style={styles.formGrid}>
                    <input
                      style={styles.input}
                      placeholder="Full Name"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange("fullName", e.target.value)}
                    />
                    <input
                      style={styles.input}
                      placeholder="Mobile Number"
                      value={formData.mobile}
                      onChange={(e) => handleInputChange("mobile", e.target.value)}
                    />
                    <input
                      style={{ ...styles.input, gridColumn: "1 / -1" }}
                      placeholder="Address Line 1"
                      value={formData.addressLine1}
                      onChange={(e) => handleInputChange("addressLine1", e.target.value)}
                    />
                    <input
                      style={{ ...styles.input, gridColumn: "1 / -1" }}
                      placeholder="Address Line 2"
                      value={formData.addressLine2}
                      onChange={(e) => handleInputChange("addressLine2", e.target.value)}
                    />
                    <input
                      style={styles.input}
                      placeholder="City"
                      value={formData.city}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                    />
                    <input
                      style={styles.input}
                      placeholder="State"
                      value={formData.state}
                      onChange={(e) => handleInputChange("state", e.target.value)}
                    />
                    <input
                      style={styles.input}
                      placeholder="Pincode"
                      value={formData.pincode}
                      onChange={(e) => handleInputChange("pincode", e.target.value)}
                    />
                  </div>
                  <label style={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={saveAddressChecked}
                      onChange={(e) => setSaveAddressChecked(e.target.checked)}
                    />
                    <span>Save this address for next checkout</span>
                  </label>
                </div>

                <div style={styles.formCard}>
                  <h3 style={styles.formTitle}>Payment Details</h3>
                  <div style={styles.paymentTabs}>
                    <button
                      style={{
                        ...styles.paymentTab,
                        ...(formData.paymentMethod === "upi" ? styles.paymentTabActive : {}),
                      }}
                      onClick={() => handleInputChange("paymentMethod", "upi")}
                    >
                      UPI
                    </button>
                    <button
                      style={{
                        ...styles.paymentTab,
                        ...(formData.paymentMethod === "card" ? styles.paymentTabActive : {}),
                      }}
                      onClick={() => handleInputChange("paymentMethod", "card")}
                    >
                      Card
                    </button>
                    <button
                      style={{
                        ...styles.paymentTab,
                        ...(formData.paymentMethod === "cod" ? styles.paymentTabActive : {}),
                      }}
                      onClick={() => handleInputChange("paymentMethod", "cod")}
                    >
                      Cash on Delivery
                    </button>
                  </div>

                  {formData.paymentMethod === "upi" ? (
                    <input
                      style={styles.input}
                      placeholder="UPI ID"
                      value={formData.upiId}
                      onChange={(e) => handleInputChange("upiId", e.target.value)}
                    />
                  ) : null}

                  {formData.paymentMethod === "card" ? (
                    <div style={styles.formGrid}>
                      <input
                        style={{ ...styles.input, gridColumn: "1 / -1" }}
                        placeholder="Name on Card"
                        value={formData.cardName}
                        onChange={(e) => handleInputChange("cardName", e.target.value)}
                      />
                      <input
                        style={{ ...styles.input, gridColumn: "1 / -1" }}
                        placeholder="Card Number"
                        value={formData.cardNumber}
                        onChange={(e) => handleInputChange("cardNumber", e.target.value)}
                      />
                      <input
                        style={styles.input}
                        placeholder="MM/YY"
                        value={formData.expiry}
                        onChange={(e) => handleInputChange("expiry", e.target.value)}
                      />
                      <input
                        style={styles.input}
                        placeholder="CVV"
                        value={formData.cvv}
                        onChange={(e) => handleInputChange("cvv", e.target.value)}
                      />
                    </div>
                  ) : null}

                  {formData.paymentMethod === "cod" ? (
                    <p style={styles.codText}>
                      Pay with cash when your order is delivered.
                    </p>
                  ) : null}

                  <button style={styles.placeOrderBtn} onClick={handlePlaceOrder}>
                    Place Order
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
      {toast ? <div style={styles.toast}>🛒 {toast}</div> : null}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)",
    padding: "32px 18px",
  },
  wrapper: {
    maxWidth: "1120px",
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
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
    gap: "20px",
  },
  list: {
    display: "grid",
    gap: "16px",
  },
  itemCard: {
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    gap: "18px",
    background: "#fff",
    borderRadius: "22px",
    padding: "16px",
    boxShadow: "0 18px 40px rgba(30, 41, 59, 0.08)",
  },
  image: {
    width: "100%",
    height: "160px",
    objectFit: "cover",
    borderRadius: "18px",
  },
  info: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  productName: {
    fontSize: "24px",
    color: "#111827",
    marginBottom: "8px",
  },
  productText: {
    color: "#64748b",
    lineHeight: 1.6,
  },
  price: {
    marginTop: "12px",
    fontSize: "24px",
    fontWeight: "800",
    color: "#1d4ed8",
  },
  itemTotal: {
    marginTop: "8px",
    color: "#0f172a",
    fontWeight: "700",
  },
  qtyRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "16px",
  },
  qtyBtn: {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    border: "none",
    background: "#e2e8f0",
    fontSize: "20px",
    cursor: "pointer",
  },
  qtyValue: {
    minWidth: "26px",
    textAlign: "center",
    fontWeight: "700",
  },
  removeBtn: {
    border: "none",
    borderRadius: "10px",
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: "700",
  },
  summaryCard: {
    background: "#fff",
    borderRadius: "24px",
    padding: "24px",
    height: "fit-content",
    boxShadow: "0 18px 40px rgba(30, 41, 59, 0.08)",
  },
  summaryTitle: {
    fontSize: "26px",
    color: "#111827",
    marginBottom: "18px",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "12px",
    color: "#475569",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "18px",
    paddingTop: "18px",
    borderTop: "1px solid #e2e8f0",
    fontSize: "18px",
    color: "#111827",
  },
  checkoutBtn: {
    marginTop: "22px",
    width: "100%",
    border: "none",
    borderRadius: "14px",
    background: "linear-gradient(90deg, #1d4ed8, #2563eb)",
    color: "#fff",
    padding: "14px 16px",
    fontWeight: "800",
    cursor: "pointer",
  },
  message: {
    marginTop: "16px",
    color: "#166534",
    fontWeight: "700",
  },
  checkoutSection: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginTop: "24px",
  },
  formCard: {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 18px 40px rgba(30, 41, 59, 0.08)",
  },
  savedAddressBox: {
    border: "1px solid #dbeafe",
    background: "#f8fbff",
    borderRadius: "16px",
    padding: "14px",
    marginBottom: "16px",
  },
  savedAddressHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "12px",
    color: "#1e3a8a",
  },
  savedAddressList: {
    display: "grid",
    gap: "10px",
  },
  savedAddressButton: {
    display: "grid",
    gap: "4px",
    textAlign: "left",
    border: "1px solid #bfdbfe",
    background: "#ffffff",
    borderRadius: "12px",
    padding: "12px",
    cursor: "pointer",
    color: "#334155",
  },
  formTitle: {
    fontSize: "24px",
    color: "#111827",
    marginBottom: "18px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "14px 14px",
    fontSize: "15px",
    outline: "none",
    marginBottom: "14px",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#334155",
    fontWeight: "600",
  },
  paymentTabs: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "14px",
  },
  paymentTab: {
    border: "1px solid #cbd5e1",
    borderRadius: "999px",
    padding: "10px 14px",
    background: "#fff",
    color: "#334155",
    fontWeight: "700",
    cursor: "pointer",
  },
  paymentTabActive: {
    background: "#dbeafe",
    color: "#1d4ed8",
    border: "1px solid #93c5fd",
  },
  codText: {
    color: "#475569",
    lineHeight: 1.6,
    marginBottom: "16px",
  },
  placeOrderBtn: {
    width: "100%",
    border: "none",
    borderRadius: "14px",
    background: "linear-gradient(90deg, #16a34a, #15803d)",
    color: "#fff",
    padding: "14px 16px",
    fontWeight: "800",
    cursor: "pointer",
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
