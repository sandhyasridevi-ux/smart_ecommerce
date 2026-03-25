import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import API, { buildNotificationsWsUrl } from "../services/api";
import { getCartItems, getWishlistItems } from "../services/shopStorage";
import { resolveProductImage } from "../utils/productImages";

const roleOptions = ["admin", "staff", "customer"];
const LOW_STOCK_LIMIT = 5;

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function AdminPanel() {
  const navigate = useNavigate();
  const currentUser = useMemo(
    () => JSON.parse(localStorage.getItem("user") || "null"),
    []
  );

  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingUserId, setEditingUserId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("customer");
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [editingProductId, setEditingProductId] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    stock: "",
    image: "",
    popularity: "0",
  });
  const [exporting, setExporting] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await API.get("/auth/admin/users");
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Unable to fetch users.");
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await API.get("/checkout/orders/all");
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Unable to fetch admin orders.");
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await API.get("/products/");
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Unable to fetch products.");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !currentUser || currentUser.role !== "admin") {
      return;
    }
    if (token.startsWith("local-token-")) {
      setMessage("Session expired for backend admin APIs. Please logout and login again.");
      return;
    }

    fetchUsers();
    fetchOrders();
    fetchProducts();

    const pollTimer = window.setInterval(() => {
      fetchUsers();
      fetchOrders();
      fetchProducts();
    }, 20000);

    const ws = new WebSocket(buildNotificationsWsUrl(token));
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data || "{}");
        if (
          parsed?.event === "admin:new_order" ||
          parsed?.event === "admin:order_status" ||
          parsed?.event === "admin:new_user" ||
          parsed?.event === "product:created" ||
          parsed?.event === "product:updated" ||
          parsed?.event === "product:deleted" ||
          parsed?.event === "product:image_updated" ||
          parsed?.event === "stock:updated"
        ) {
          fetchUsers();
          fetchOrders();
          fetchProducts();
        }
      } catch (err) {
        // ignore malformed socket payloads
      }
    };
    ws.onerror = () => {
      setMessage((current) => current || "Admin live updates are unavailable.");
    };

    return () => {
      window.clearInterval(pollTimer);
      ws.close();
    };
  }, [currentUser?.role]);

  const filteredUsers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return users.filter((user) => {
      const matchSearch =
        !q ||
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q);
      const matchRole = roleFilter === "all" || user.role === roleFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && user.is_active) ||
        (statusFilter === "inactive" && !user.is_active);
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchText, roleFilter, statusFilter]);

  const orderCounts = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        acc.total += 1;
        acc[order.order_status] = (acc[order.order_status] || 0) + 1;
        return acc;
      },
      { total: 0, pending: 0, paid: 0, shipped: 0, delivered: 0, cancelled: 0 }
    );
  }, [orders]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((item) => {
      if (!q) return true;
      return (
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.category || "").toLowerCase().includes(q)
      );
    });
  }, [products, productSearch]);

  const analytics = useMemo(() => {
    const validRevenueOrders = orders.filter(
      (order) =>
        order.order_status !== "cancelled" &&
        (order.payment_status === "completed" || order.order_status === "paid")
    );
    const totalSales = validRevenueOrders.length;
    const totalRevenue = validRevenueOrders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0
    );

    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleString("en-IN", { month: "short" }),
      });
    }

    const monthlyRevenue = {};
    months.forEach((m) => {
      monthlyRevenue[m.key] = 0;
    });
    validRevenueOrders.forEach((order) => {
      const d = new Date(order.created_at || "");
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in monthlyRevenue) {
        monthlyRevenue[key] += Number(order.total || 0);
      }
    });

    const productTotals = {};
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const name = item.product?.name || `Product #${item.product_id}`;
        productTotals[name] = (productTotals[name] || 0) + Number(item.quantity || 0);
      });
    });

    const topProducts = Object.entries(productTotals)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const lowStockItems = [...products]
      .filter((item) => Number(item.stock || 0) <= LOW_STOCK_LIMIT)
      .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));

    return {
      totalSales,
      totalRevenue,
      months,
      monthlyRevenue,
      topProducts,
      lowStockItems,
    };
  }, [orders, products]);

  const revenueTrendData = useMemo(
    () => ({
      labels: analytics.months.map((m) => m.label),
      datasets: [
        {
          label: "Revenue",
          data: analytics.months.map((m) => Number(analytics.monthlyRevenue[m.key] || 0)),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.2)",
          tension: 0.35,
          fill: true,
        },
      ],
    }),
    [analytics]
  );

  const topProductsData = useMemo(
    () => ({
      labels: analytics.topProducts.map((item) => item.name),
      datasets: [
        {
          label: "Units Sold",
          data: analytics.topProducts.map((item) => item.qty),
          backgroundColor: ["#2563eb", "#0ea5e9", "#22c55e", "#f59e0b", "#a855f7"],
          borderRadius: 8,
        },
      ],
    }),
    [analytics]
  );

  const lowStockData = useMemo(() => {
    const inStockCount = products.filter((item) => Number(item.stock || 0) > LOW_STOCK_LIMIT).length;
    const lowCount = analytics.lowStockItems.length;
    return {
      labels: ["Healthy Stock", "Low Stock"],
      datasets: [
        {
          data: [inStockCount, lowCount],
          backgroundColor: ["#16a34a", "#ef4444"],
          borderWidth: 1,
        },
      ],
    };
  }, [analytics.lowStockItems.length, products]);

  const handleStatusChange = async (orderId, status) => {
    try {
      const res = await API.put(`/checkout/orders/${orderId}/status`, {
        order_status: status,
      });
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? res.data : order))
      );
      setMessage(`Order #${orderId} moved to ${status}.`);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to update order status.");
    }
  };

  const handlePaymentStatusChange = async (orderId, paymentStatus) => {
    try {
      const paymentsRes = await API.get(`/checkout/payments/${orderId}`);
      const payments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
      if (payments.length === 0) {
        setMessage(`No payment record found for order #${orderId}.`);
        return;
      }

      const latestPayment = payments[0];
      const apiStatus =
        paymentStatus === "completed" || paymentStatus === "failed"
          ? paymentStatus
          : "pending";

      await API.put(`/checkout/payments/${latestPayment.id}/status`, {
        status: apiStatus,
      });

      await fetchOrders();
      setMessage(`Payment status for order #${orderId} updated to ${apiStatus}.`);
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Failed to update payment status.");
    }
  };

  const beginEdit = (user) => {
    setEditingUserId(user.id);
    setEditName(user.name);
    setEditRole(user.role);
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditName("");
    setEditRole("customer");
  };

  const saveUser = async (userId) => {
    try {
      const res = await API.put(`/auth/admin/users/${userId}`, {
        name: editName.trim(),
        role: editRole,
      });
      setUsers((current) =>
        current.map((user) => (user.id === userId ? res.data : user))
      );
      setMessage("User details updated successfully.");
      cancelEdit();
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Unable to update user.");
    }
  };

  const toggleUserStatus = async (user) => {
    try {
      const res = await API.put(`/auth/admin/users/${user.id}`, {
        is_active: !user.is_active,
      });
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? res.data : item))
      );
      setMessage(
        !user.is_active
          ? `${user.email} activated successfully.`
          : `${user.email} deactivated successfully.`
      );
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Unable to change user status.");
    }
  };

  const onNewProductChange = (field, value) => {
    setNewProduct((current) => ({ ...current, [field]: value }));
  };

  const createProduct = async () => {
    try {
      const payload = {
        name: newProduct.name.trim(),
        description: newProduct.description.trim(),
        category: newProduct.category.trim(),
        price: Number(newProduct.price || 0),
        stock: Number(newProduct.stock || 0),
        image: newProduct.image.trim() || null,
        images: newProduct.image.trim() || null,
        popularity: Number(newProduct.popularity || 0),
      };
      if (!payload.name) {
        setMessage("Product name is required.");
        return;
      }
      const res = await API.post("/products/admin", payload);
      setProducts((current) => [res.data, ...current]);
      setNewProduct({
        name: "",
        description: "",
        category: "",
        price: "",
        stock: "",
        image: "",
        popularity: "0",
      });
      setMessage("Product added successfully.");
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Unable to add product.");
    }
  };

  const beginProductEdit = (item) => {
    setEditingProductId(item.id);
    setEditProduct({
      id: item.id,
      name: item.name || "",
      description: item.description || "",
      category: item.category || "",
      price: String(item.price ?? 0),
      stock: String(item.stock ?? 0),
      image: item.image || "",
      popularity: String(item.popularity ?? 0),
    });
  };

  const cancelProductEdit = () => {
    setEditingProductId(null);
    setEditProduct(null);
  };

  const saveProduct = async (id) => {
    if (!editProduct) return;
    try {
      const payload = {
        name: editProduct.name.trim(),
        description: editProduct.description.trim(),
        category: editProduct.category.trim(),
        price: Number(editProduct.price || 0),
        stock: Number(editProduct.stock || 0),
        image: editProduct.image.trim() || null,
        images: editProduct.image.trim() || null,
        popularity: Number(editProduct.popularity || 0),
      };
      const res = await API.put(`/products/admin/${id}`, payload);
      setProducts((current) => current.map((item) => (item.id === id ? res.data : item)));
      setMessage("Product updated successfully.");
      cancelProductEdit();
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Unable to update product.");
    }
  };

  const removeProduct = async (id) => {
    try {
      await API.delete(`/products/admin/${id}`);
      setProducts((current) => current.filter((item) => item.id !== id));
      setMessage("Product deleted successfully.");
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Unable to delete product.");
    }
  };

  const updateStock = async (id, nextStock) => {
    try {
      const res = await API.put(`/products/${id}/stock`, { stock: Number(nextStock || 0) });
      setProducts((current) => current.map((item) => (item.id === id ? res.data : item)));
      setMessage("Stock updated successfully.");
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Unable to update stock.");
    }
  };

  const uploadProductImage = async (id, file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await API.post(`/products/admin/${id}/image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProducts((current) => current.map((item) => (item.id === id ? res.data : item)));
      setMessage("Product image uploaded successfully.");
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Unable to upload product image.");
    }
  };

  const toCsv = (rows) => {
    if (!rows || rows.length === 0) return "no_data\n";
    const headers = Object.keys(rows[0]);
    const escape = (value) => {
      const text = String(value ?? "");
      if (text.includes(",") || text.includes('"') || text.includes("\n")) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };
    const lines = [headers.join(",")];
    rows.forEach((row) => {
      lines.push(headers.map((h) => escape(row[h])).join(","));
    });
    return `${lines.join("\n")}\n`;
  };

  const buildSimplePdfBlob = (title, lines) => {
    const esc = (text) =>
      String(text || "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
    let y = 790;
    const parts = ["BT"];
    parts.push("/F1 16 Tf");
    parts.push(`1 0 0 1 50 ${y} Tm (${esc(title)}) Tj`);
    y -= 24;
    parts.push("/F1 10 Tf");
    (lines || []).slice(0, 55).forEach((line) => {
      if (y < 40) return;
      parts.push(`1 0 0 1 50 ${y} Tm (${esc(line)}) Tj`);
      y -= 14;
    });
    parts.push("ET");
    const content = parts.join("\n");
    const enc = new TextEncoder();
    const contentBytes = enc.encode(content);
    const obj = [];
    obj.push(enc.encode("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"));
    obj.push(enc.encode("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"));
    obj.push(
      enc.encode(
        "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj\n"
      )
    );
    obj.push(
      enc.encode(`4 0 obj << /Length ${contentBytes.length} >> stream\n`)
    );
    obj.push(contentBytes);
    obj.push(enc.encode("\nendstream endobj\n"));
    obj.push(enc.encode("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"));

    const header = enc.encode("%PDF-1.4\n");
    const chunks = [header];
    const offsets = [0];
    let offset = header.length;
    obj.forEach((chunk) => {
      offsets.push(offset);
      chunks.push(chunk);
      offset += chunk.length;
    });
    const xrefPos = offset;
    const xrefLines = [`xref\n0 ${offsets.length}\n`, "0000000000 65535 f \n"];
    for (let i = 1; i < offsets.length; i += 1) {
      xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
    }
    xrefLines.push(`trailer << /Size ${offsets.length} /Root 1 0 R >>\n`);
    xrefLines.push(`startxref\n${xrefPos}\n%%EOF`);
    chunks.push(enc.encode(xrefLines.join("")));
    return new Blob(chunks, { type: "application/pdf" });
  };

  const exportFromLocalData = (reportType, format) => {
    let rows = [];
    let pdfLines = [];
    if (reportType === "orders") {
      rows = orders.map((order) => ({
        order_id: order.id,
        user_id: order.user_id,
        total: Number(order.total || 0),
        payment_status: order.payment_status,
        order_status: order.order_status,
        created_at: order.created_at || "",
      }));
      pdfLines = rows.map(
        (r) =>
          `Order #${r.order_id} | User ${r.user_id} | Total ${r.total} | Payment ${r.payment_status} | Status ${r.order_status}`
      );
    }
    if (reportType === "sales") {
      rows = [
        { metric: "total_sales", value: analytics.totalSales },
        { metric: "total_revenue", value: analytics.totalRevenue },
        ...analytics.topProducts.map((p, idx) => ({
          metric: `top_product_${idx + 1}`,
          value: `${p.name} (${p.qty})`,
        })),
      ];
      pdfLines = [
        `Total Sales: ${analytics.totalSales}`,
        `Total Revenue: ${analytics.totalRevenue}`,
        "Top Selling Products:",
        ...analytics.topProducts.map((p) => `${p.name} - ${p.qty}`),
      ];
    }
    if (reportType === "users") {
      rows = users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.is_active ? "active" : "inactive",
        created_at: user.created_at || "",
      }));
      pdfLines = rows.map(
        (r) => `${r.id} | ${r.name} | ${r.email} | ${r.role} | ${r.status}`
      );
    }

    const blob =
      format === "csv"
        ? new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" })
        : buildSimplePdfBlob(`${reportType.toUpperCase()} REPORT`, pdfLines);
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${reportType}_report.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  };

  const exportReport = async (reportType, format) => {
    try {
      setExporting(`${reportType}_${format}`);
      const res = await API.get(`/reports/${reportType}/${format}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: format === "pdf" ? "application/pdf" : "text/csv",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${reportType}_report.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      setMessage(`${reportType} report (${format.toUpperCase()}) downloaded.`);
    } catch (error) {
      const blobError = error?.response?.data;
      if (blobError instanceof Blob) {
        try {
          const parsed = JSON.parse(await blobError.text());
          setMessage(parsed?.detail || `Unable to export ${reportType} report from server. Downloaded local fallback.`);
        } catch (e) {
          setMessage(`Unable to export ${reportType} report from server. Downloaded local fallback.`);
        }
      } else {
        setMessage(error?.response?.data?.detail || `Unable to export ${reportType} report from server. Downloaded local fallback.`);
      }
      exportFromLocalData(reportType, format);
    } finally {
      setExporting("");
    }
  };

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Admin Access Required</h1>
          <p style={styles.text}>Login with an admin account to open this panel.</p>
          <button style={styles.button} onClick={() => navigate("/login")}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>User Management</h1>
            <p style={styles.text}>View, edit, assign roles, and activate/deactivate users.</p>
          </div>
          <button style={styles.button} onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>

        <div style={styles.exportBar}>
          <strong style={styles.exportTitle}>Export Reports</strong>
          <div style={styles.reportTable}>
            <div style={styles.reportHead}>
              <span>Report Type</span>
              <span>Description</span>
              <span>Actions</span>
            </div>
            <div style={styles.reportRow}>
              <span>Orders Report</span>
              <span>All order details</span>
              <span style={styles.exportButtons}>
                <button
                  style={styles.smallButton}
                  disabled={Boolean(exporting)}
                  onClick={() => exportReport("orders", "csv")}
                >
                  Export CSV
                </button>
                <button
                  style={styles.smallButton}
                  disabled={Boolean(exporting)}
                  onClick={() => exportReport("orders", "pdf")}
                >
                  Export PDF
                </button>
              </span>
            </div>
            <div style={styles.reportRow}>
              <span>Sales Report</span>
              <span>Revenue / sales summary</span>
              <span style={styles.exportButtons}>
                <button
                  style={styles.smallButton}
                  disabled={Boolean(exporting)}
                  onClick={() => exportReport("sales", "csv")}
                >
                  Export CSV
                </button>
                <button
                  style={styles.smallButton}
                  disabled={Boolean(exporting)}
                  onClick={() => exportReport("sales", "pdf")}
                >
                  Export PDF
                </button>
              </span>
            </div>
            <div style={styles.reportRow}>
              <span>User Report</span>
              <span>User list / roles / status</span>
              <span style={styles.exportButtons}>
                <button
                  style={styles.smallButton}
                  disabled={Boolean(exporting)}
                  onClick={() => exportReport("users", "csv")}
                >
                  Export CSV
                </button>
                <button
                  style={styles.smallButton}
                  disabled={Boolean(exporting)}
                  onClick={() => exportReport("users", "pdf")}
                >
                  Export PDF
                </button>
              </span>
            </div>
          </div>
        </div>

        <div style={styles.metrics}>
          <div style={styles.metricCard}>
            <span style={styles.metricLabel}>Users</span>
            <strong style={styles.metricValue}>{users.length}</strong>
          </div>
          <div style={styles.metricCard}>
            <span style={styles.metricLabel}>Wishlist Items</span>
            <strong style={styles.metricValue}>{getWishlistItems().length}</strong>
          </div>
          <div style={styles.metricCard}>
            <span style={styles.metricLabel}>Cart Items</span>
            <strong style={styles.metricValue}>{getCartItems().length}</strong>
          </div>
          <div style={styles.metricCard}>
            <span style={styles.metricLabel}>Orders</span>
            <strong style={styles.metricValue}>{orderCounts.total}</strong>
          </div>
          <div style={styles.metricCard}>
            <span style={styles.metricLabel}>Products</span>
            <strong style={styles.metricValue}>{products.length}</strong>
          </div>
        </div>

        <div style={styles.tableCard}>
          <h2 style={styles.sectionTitle}>Analytics Dashboard</h2>
          <div style={styles.analyticsCards}>
            <div style={styles.analyticsCard}>
              <span style={styles.metricLabel}>Total Sales</span>
              <strong style={styles.analyticsValue}>{analytics.totalSales}</strong>
            </div>
            <div style={styles.analyticsCard}>
              <span style={styles.metricLabel}>Total Revenue</span>
              <strong style={styles.analyticsValue}>
                Rs. {analytics.totalRevenue.toLocaleString("en-IN")}
              </strong>
            </div>
            <div style={styles.analyticsCard}>
              <span style={styles.metricLabel}>Top-Selling Products</span>
              <strong style={styles.analyticsValue}>{analytics.topProducts.length}</strong>
            </div>
            <div style={styles.analyticsCard}>
              <span style={styles.metricLabel}>Low Stock Alerts</span>
              <strong style={styles.analyticsValue}>{analytics.lowStockItems.length}</strong>
            </div>
          </div>

          <div style={styles.chartsGrid}>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>Revenue Trends (Last 6 Months)</h3>
              <div style={styles.chartCanvas}>
                <Line data={revenueTrendData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>Top-Selling Products</h3>
              {analytics.topProducts.length === 0 ? (
                <p style={styles.emptyText}>No sales data yet.</p>
              ) : (
                <div style={styles.chartCanvas}>
                  <Bar
                    data={topProductsData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                    }}
                  />
                </div>
              )}
            </div>
            <div style={styles.chartCard}>
              <h3 style={styles.chartTitle}>Low Stock Alerts</h3>
              <div style={styles.chartCanvas}>
                <Doughnut data={lowStockData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </div>

          <div style={styles.lowStockTable}>
            <h3 style={styles.chartTitle}>{`Low Stock Products (<= ${LOW_STOCK_LIMIT})`}</h3>
            {analytics.lowStockItems.length === 0 ? (
              <p style={styles.emptyText}>No low stock alerts.</p>
            ) : (
              <>
                <div style={styles.lowStockHead}>
                  <span>Product</span>
                  <span>Category</span>
                  <span>Stock</span>
                </div>
                {analytics.lowStockItems.slice(0, 8).map((item) => (
                  <div key={item.id} style={styles.lowStockRow}>
                    <span>{item.name}</span>
                    <span>{item.category || "-"}</span>
                    <span>{item.stock}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div style={styles.tableCard}>
          <div style={styles.filters}>
            <input
              style={styles.search}
              placeholder="Search users..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <select
              style={styles.filterSelect}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="customer">Customer</option>
            </select>
            <select
              style={styles.filterSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button style={styles.addButton} onClick={() => navigate("/register")}>
              Add User
            </button>
          </div>

          <h2 style={styles.sectionTitle}>User List</h2>
          <div style={styles.userHead}>
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {filteredUsers.map((user) => {
            const isEditing = editingUserId === user.id;
            return (
              <div key={user.id} style={styles.userRow}>
                <span>
                  {isEditing ? (
                    <input
                      style={styles.inlineInput}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  ) : (
                    user.name
                  )}
                </span>
                <span>{user.email}</span>
                <span>
                  {isEditing ? (
                    <select
                      style={styles.inlineSelect}
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  ) : (
                    user.role
                  )}
                </span>
                <span>
                  <span style={user.is_active ? styles.activeBadge : styles.inactiveBadge}>
                    {user.is_active ? "Active" : "Inactive"}
                  </span>
                </span>
                <span style={styles.actions}>
                  {isEditing ? (
                    <>
                      <button style={styles.editButton} onClick={() => saveUser(user.id)}>
                        Save
                      </button>
                      <button style={styles.cancelButton} onClick={cancelEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button style={styles.editButton} onClick={() => beginEdit(user)}>
                        Edit
                      </button>
                      <button
                        style={user.is_active ? styles.deactivateButton : styles.activateButton}
                        onClick={() => toggleUserStatus(user)}
                      >
                        {user.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
          {filteredUsers.length === 0 ? (
            <p style={styles.emptyText}>No users match current filters.</p>
          ) : null}
        </div>

        <div style={styles.tableCard}>
          <h2 style={styles.sectionTitle}>Product Management</h2>
          <div style={styles.productFilters}>
            <input
              style={styles.search}
              placeholder="Search products..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </div>

          <div style={styles.createGrid}>
            <input
              style={styles.inlineInput}
              placeholder="Name"
              value={newProduct.name}
              onChange={(e) => onNewProductChange("name", e.target.value)}
            />
            <input
              style={styles.inlineInput}
              placeholder="Category"
              value={newProduct.category}
              onChange={(e) => onNewProductChange("category", e.target.value)}
            />
            <input
              style={styles.inlineInput}
              placeholder="Price"
              type="number"
              min="0"
              value={newProduct.price}
              onChange={(e) => onNewProductChange("price", e.target.value)}
            />
            <input
              style={styles.inlineInput}
              placeholder="Stock"
              type="number"
              min="0"
              value={newProduct.stock}
              onChange={(e) => onNewProductChange("stock", e.target.value)}
            />
            <input
              style={styles.inlineInput}
              placeholder="Image URL (optional)"
              value={newProduct.image}
              onChange={(e) => onNewProductChange("image", e.target.value)}
            />
            <input
              style={styles.inlineInput}
              placeholder="Popularity"
              type="number"
              min="0"
              value={newProduct.popularity}
              onChange={(e) => onNewProductChange("popularity", e.target.value)}
            />
            <textarea
              style={styles.textarea}
              placeholder="Description"
              value={newProduct.description}
              onChange={(e) => onNewProductChange("description", e.target.value)}
            />
            <button style={styles.addButton} onClick={createProduct}>
              Add Product
            </button>
          </div>

          <div style={styles.productHead}>
            <span>Product</span>
            <span>Category</span>
            <span>Price</span>
            <span>Stock</span>
            <span>Image</span>
            <span>Actions</span>
          </div>
          {filteredProducts.map((item) => {
            const editing = editingProductId === item.id;
            return (
              <div key={item.id} style={styles.productRow}>
                <span>
                  {editing ? (
                    <input
                      style={styles.inlineInput}
                      value={editProduct?.name || ""}
                      onChange={(e) =>
                        setEditProduct((current) => ({ ...current, name: e.target.value }))
                      }
                    />
                  ) : (
                    item.name
                  )}
                </span>
                <span>
                  {editing ? (
                    <input
                      style={styles.inlineInput}
                      value={editProduct?.category || ""}
                      onChange={(e) =>
                        setEditProduct((current) => ({ ...current, category: e.target.value }))
                      }
                    />
                  ) : (
                    item.category || "-"
                  )}
                </span>
                <span>
                  {editing ? (
                    <input
                      style={styles.inlineInput}
                      type="number"
                      min="0"
                      value={editProduct?.price || "0"}
                      onChange={(e) =>
                        setEditProduct((current) => ({ ...current, price: e.target.value }))
                      }
                    />
                  ) : (
                    `Rs. ${Number(item.price || 0).toLocaleString("en-IN")}`
                  )}
                </span>
                <span>
                  <div style={styles.stockWrap}>
                    {editing ? (
                      <input
                        style={styles.inlineInput}
                        type="number"
                        min="0"
                        value={editProduct?.stock || "0"}
                        onChange={(e) =>
                          setEditProduct((current) => ({ ...current, stock: e.target.value }))
                        }
                      />
                    ) : (
                      <span>{item.stock}</span>
                    )}
                    {!editing ? (
                      <button
                        style={styles.smallButton}
                        onClick={() => {
                          const next = window.prompt("Enter new stock value", String(item.stock ?? 0));
                          if (next !== null) updateStock(item.id, next);
                        }}
                      >
                        Update Stock
                      </button>
                    ) : null}
                  </div>
                </span>
                <span>
                  <img
                    src={resolveProductImage(item)}
                    alt={item.name}
                    style={styles.productThumb}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    style={styles.fileInput}
                    onChange={(e) => uploadProductImage(item.id, e.target.files?.[0])}
                  />
                </span>
                <span style={styles.actions}>
                  {editing ? (
                    <>
                      <button style={styles.editButton} onClick={() => saveProduct(item.id)}>
                        Save
                      </button>
                      <button style={styles.cancelButton} onClick={cancelProductEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button style={styles.editButton} onClick={() => beginProductEdit(item)}>
                        Edit
                      </button>
                      <button style={styles.deactivateButton} onClick={() => removeProduct(item.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
          {filteredProducts.length === 0 ? (
            <p style={styles.emptyText}>No products match search.</p>
          ) : null}
        </div>

        <div style={styles.tableCard}>
          <h2 style={styles.sectionTitle}>Order Management</h2>
          {orders.length === 0 ? (
            <p style={styles.emptyText}>No orders available yet.</p>
          ) : (
            <>
              <div style={styles.statusSummary}>
                <span style={styles.statusChip}>Pending {orderCounts.pending}</span>
                <span style={styles.statusChip}>Paid {orderCounts.paid}</span>
                <span style={styles.statusChip}>Shipped {orderCounts.shipped}</span>
                <span style={styles.statusChip}>Delivered {orderCounts.delivered}</span>
                <span style={styles.statusChip}>Cancelled {orderCounts.cancelled}</span>
              </div>
              <div style={styles.orderHead}>
                <span>Order</span>
                <span>Customer</span>
                <span>Total</span>
                <span>Payment</span>
                <span>Status</span>
                <span>Update</span>
                <span>Payment Update</span>
              </div>
              {orders.map((order) => (
                <div key={order.id} style={styles.orderRow}>
                  <span>#{order.id}</span>
                  <span>User #{order.user_id}</span>
                  <span>Rs. {Number(order.total || 0).toLocaleString("en-IN")}</span>
                  <span>{String(order.payment_status || "pending").replaceAll("_", " ")}</span>
                  <span>{String(order.order_status || "pending").replaceAll("_", " ")}</span>
                  <select
                    style={styles.select}
                    value={order.order_status || "pending"}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <select
                    style={styles.select}
                    value={order.payment_status || "pending"}
                    onChange={(e) =>
                      handlePaymentStatusChange(order.id, e.target.value)
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              ))}
            </>
          )}
          {message ? <p style={styles.message}>{message}</p> : null}
        </div>
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
    maxWidth: "1180px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "22px",
    flexWrap: "wrap",
  },
  exportBar: {
    background: "#fff",
    borderRadius: "14px",
    padding: "12px 14px",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
    marginBottom: "18px",
    display: "grid",
    gap: "10px",
  },
  exportTitle: {
    color: "#0f172a",
  },
  exportButtons: {
    display: "flex",
    flexWrap: "nowrap",
    gap: "8px",
    alignItems: "center",
  },
  reportTable: {
    display: "grid",
    gap: "4px",
  },
  reportHead: {
    display: "grid",
    gridTemplateColumns: "1fr 1.4fr 1fr",
    gap: "10px",
    fontWeight: "800",
    color: "#334155",
    padding: "8px 4px",
    borderBottom: "1px solid #e2e8f0",
  },
  reportRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1.4fr 1fr",
    gap: "10px",
    alignItems: "center",
    padding: "10px 4px",
    borderBottom: "1px solid #f1f5f9",
    color: "#334155",
  },
  card: {
    maxWidth: "520px",
    margin: "80px auto",
    background: "#fff",
    borderRadius: "24px",
    padding: "32px",
    textAlign: "center",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
  },
  title: {
    fontSize: "34px",
    color: "#111827",
    marginBottom: "10px",
  },
  text: {
    color: "#64748b",
    lineHeight: 1.6,
  },
  button: {
    border: "none",
    borderRadius: "14px",
    background: "#1d4ed8",
    color: "#fff",
    padding: "12px 18px",
    fontWeight: "800",
    cursor: "pointer",
    marginTop: "16px",
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "22px",
  },
  metricCard: {
    background: "#fff",
    borderRadius: "20px",
    padding: "22px",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
  },
  metricLabel: {
    display: "block",
    color: "#64748b",
    marginBottom: "8px",
  },
  metricValue: {
    fontSize: "32px",
    color: "#0f172a",
  },
  tableCard: {
    background: "#fff",
    borderRadius: "20px",
    padding: "22px",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
    marginBottom: "20px",
  },
  analyticsCards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  analyticsCard: {
    border: "1px solid #dbeafe",
    borderRadius: "14px",
    padding: "14px",
    background: "#f8fbff",
  },
  analyticsValue: {
    fontSize: "26px",
    color: "#0f172a",
  },
  chartsGrid: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1fr 0.9fr",
    gap: "14px",
    marginBottom: "14px",
  },
  chartCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    background: "#fff",
    padding: "12px",
    minHeight: "210px",
    display: "grid",
    gridTemplateRows: "auto 1fr",
  },
  chartCanvas: {
    height: "150px",
  },
  chartTitle: {
    margin: "0 0 8px 0",
    color: "#1e293b",
    fontSize: "16px",
    fontWeight: "800",
  },
  lowStockTable: {
    border: "1px solid #fee2e2",
    borderRadius: "14px",
    padding: "12px",
    background: "#fff7f7",
  },
  lowStockHead: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1fr 0.5fr",
    gap: "10px",
    fontWeight: "800",
    color: "#475569",
    paddingBottom: "8px",
    borderBottom: "1px solid #fecaca",
  },
  lowStockRow: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1fr 0.5fr",
    gap: "10px",
    padding: "8px 0",
    borderBottom: "1px solid #fee2e2",
    color: "#334155",
  },
  sectionTitle: {
    fontSize: "24px",
    color: "#111827",
    marginBottom: "16px",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.6fr",
    gap: "12px",
    marginBottom: "18px",
  },
  productFilters: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "12px",
    marginBottom: "14px",
  },
  search: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "16px",
  },
  filterSelect: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "16px",
    background: "#fff",
  },
  addButton: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 14px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: "700",
    cursor: "pointer",
  },
  createGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 0.7fr 0.7fr 1.2fr 0.7fr",
    gap: "10px",
    marginBottom: "14px",
    alignItems: "center",
  },
  textarea: {
    gridColumn: "1 / span 5",
    minHeight: "70px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "8px 10px",
    resize: "vertical",
    fontFamily: "inherit",
  },
  userHead: {
    display: "grid",
    gridTemplateColumns: "1fr 1.2fr 0.7fr 0.7fr 1fr",
    gap: "12px",
    fontWeight: "800",
    color: "#475569",
    padding: "10px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  userRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1.2fr 0.7fr 0.7fr 1fr",
    gap: "12px",
    alignItems: "center",
    color: "#334155",
    padding: "12px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  productHead: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.8fr 0.7fr 0.9fr 0.9fr 1fr",
    gap: "12px",
    fontWeight: "800",
    color: "#475569",
    padding: "10px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  productRow: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.8fr 0.7fr 0.9fr 0.9fr 1fr",
    gap: "12px",
    alignItems: "center",
    color: "#334155",
    padding: "12px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  productThumb: {
    width: "56px",
    height: "56px",
    borderRadius: "8px",
    objectFit: "cover",
    display: "block",
    border: "1px solid #e2e8f0",
    marginBottom: "6px",
  },
  fileInput: {
    width: "100%",
    fontSize: "12px",
  },
  stockWrap: {
    display: "grid",
    gap: "6px",
  },
  smallButton: {
    border: "1px solid #93c5fd",
    borderRadius: "8px",
    padding: "6px 8px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "12px",
  },
  inlineInput: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "8px 10px",
  },
  inlineSelect: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "8px 10px",
    background: "#fff",
  },
  activeBadge: {
    padding: "6px 12px",
    borderRadius: "8px",
    background: "#16a34a",
    color: "#fff",
    fontWeight: "700",
    display: "inline-block",
  },
  inactiveBadge: {
    padding: "6px 12px",
    borderRadius: "8px",
    background: "#ef4444",
    color: "#fff",
    fontWeight: "700",
    display: "inline-block",
  },
  actions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  editButton: {
    border: "1px solid #60a5fa",
    borderRadius: "8px",
    padding: "7px 10px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: "700",
    cursor: "pointer",
  },
  cancelButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "7px 10px",
    background: "#f8fafc",
    color: "#475569",
    fontWeight: "700",
    cursor: "pointer",
  },
  activateButton: {
    border: "1px solid #22c55e",
    borderRadius: "8px",
    padding: "7px 10px",
    background: "#dcfce7",
    color: "#15803d",
    fontWeight: "700",
    cursor: "pointer",
  },
  deactivateButton: {
    border: "1px solid #ef4444",
    borderRadius: "8px",
    padding: "7px 10px",
    background: "#fee2e2",
    color: "#b91c1c",
    fontWeight: "700",
    cursor: "pointer",
  },
  emptyText: {
    color: "#64748b",
  },
  statusSummary: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  statusChip: {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: "700",
  },
  orderHead: {
    display: "grid",
    gridTemplateColumns: "0.6fr 1fr 0.8fr 0.8fr 0.8fr 1fr 1fr",
    gap: "12px",
    fontWeight: "800",
    color: "#475569",
    paddingBottom: "10px",
    borderBottom: "1px solid #e2e8f0",
  },
  orderRow: {
    display: "grid",
    gridTemplateColumns: "0.6fr 1fr 0.8fr 0.8fr 0.8fr 1fr 1fr",
    gap: "12px",
    alignItems: "center",
    color: "#334155",
    padding: "12px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  select: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "#fff",
    color: "#0f172a",
    fontWeight: "600",
  },
  message: {
    marginTop: "14px",
    color: "#166534",
    fontWeight: "700",
  },
};
