import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildNotificationsWsUrl } from "../services/api";
import {
  deleteNotification,
  fetchNotifications,
  setAllNotificationsReadState,
  setNotificationReadState,
} from "../services/notifications";

const typeColors = {
  order: { dot: "#2563eb", bg: "#eff6ff" },
  payment: { dot: "#16a34a", bg: "#ecfdf5" },
  stock: { dot: "#d97706", bg: "#fffbeb" },
  admin_alert: { dot: "#dc2626", bg: "#fef2f2" },
  system: { dot: "#6d28d9", bg: "#f5f3ff" },
};

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN");
};

const compactStatus = (item) =>
  item.read_status || (item.is_read ? "read" : "unread");

const isEmailFailureSystemNotification = (item) => {
  const title = String(item?.title || "").toLowerCase();
  const message = String(item?.message || "").toLowerCase();
  return (
    item?.type === "system" &&
    (title.includes("email delivery issue") ||
      message.includes("email could not be delivered") ||
      message.includes("email delivery failed"))
  );
};

export default function NotificationBell({ role }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const wrapRef = useRef(null);
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch (error) {
      return null;
    }
  }, []);
  const effectiveRole = role || currentUser?.role;
  const isAdmin = effectiveRole === "admin" || effectiveRole === "staff";

  const visibleItems = useMemo(() => {
    if (isAdmin) {
      return items;
    }
    return items.filter(
      (item) => item.type !== "admin_alert" && !isEmailFailureSystemNotification(item)
    );
  }, [items, isAdmin]);

  const adminAlerts = useMemo(
    () => visibleItems.filter((item) => item.type === "admin_alert"),
    [visibleItems]
  );
  const regularItems = useMemo(
    () => visibleItems.filter((item) => item.type !== "admin_alert"),
    [visibleItems]
  );

  const unreadCount = useMemo(
    () => visibleItems.filter((item) => !item.is_read).length,
    [visibleItems]
  );

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const next = await fetchNotifications();
      setItems(next);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    if (token.startsWith("local-token-")) {
      setError("Please login again to enable backend notifications.");
      return;
    }

    loadNotifications();
    const pollTimer = window.setInterval(() => {
      loadNotifications();
    }, 15000);

    let ws;
    try {
      ws = new WebSocket(buildNotificationsWsUrl(token));
    } catch (err) {
      ws = null;
    }

    if (ws) {
      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data || "{}");
          const payload = parsed?.payload;
          switch (parsed?.event) {
            case "notification:new":
              if (payload?.id) {
                setItems((current) => [payload, ...current.filter((item) => item.id !== payload.id)]);
              }
              break;
            case "notification:read":
            case "notification:read_state":
              if (payload?.id) {
                setItems((current) =>
                  current.map((item) => (item.id === payload.id ? payload : item))
                );
              }
              break;
            case "notification:bulk_read_state":
              if (typeof payload?.is_read === "boolean") {
                setItems((current) =>
                  current.map((item) => ({ ...item, is_read: payload.is_read }))
                );
              }
              break;
            case "notification:deleted":
              if (payload?.id) {
                setItems((current) => current.filter((item) => item.id !== payload.id));
              }
              break;
            default:
              break;
          }
        } catch (err) {
          // ignore invalid payload
        }
      };

      ws.onerror = () => {
        setError((current) => current || "Live socket unavailable, using auto-refresh.");
      };
    }

    return () => {
      window.clearInterval(pollTimer);
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (!wrapRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleRead = async (notification) => {
    try {
      const updated = await setNotificationReadState(notification.id, !notification.is_read);
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      setError("Could not update notification");
    }
  };

  const markAllAsRead = async () => {
    try {
      await setAllNotificationsReadState(true);
      setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch (err) {
      setError("Could not update notifications");
    }
  };

  const removeOne = async (notificationId) => {
    try {
      await deleteNotification(notificationId);
      setItems((current) => current.filter((item) => item.id !== notificationId));
    } catch (err) {
      setError("Could not delete notification");
    }
  };

  return (
    <div ref={wrapRef} style={styles.wrap}>
      <button type="button" style={styles.bellBtn} onClick={() => setOpen((value) => !value)}>
        <svg viewBox="0 0 24 24" style={styles.bellIcon} aria-hidden="true">
          <path
            d="M12 3a4 4 0 0 0-4 4v2.4c0 1.3-.5 2.5-1.4 3.4L5 14.4V16h14v-1.6l-1.6-1.6A4.8 4.8 0 0 1 16 9.4V7a4 4 0 0 0-4-4Zm0 19a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Z"
            fill="currentColor"
          />
        </svg>
        {unreadCount > 0 ? <span style={styles.badge}>{unreadCount}</span> : null}
      </button>
      {open ? (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <strong style={styles.panelTitle}>Notifications</strong>
            <button type="button" style={styles.linkBtn} onClick={markAllAsRead}>
              Mark all as read
            </button>
          </div>
          {loading ? <p style={styles.stateText}>Loading...</p> : null}
          {error ? <p style={styles.errorText}>{error}</p> : null}
          {!loading && visibleItems.length === 0 ? (
            <p style={styles.stateText}>No notifications yet.</p>
          ) : (
            <div style={styles.list}>
              {regularItems.length > 0 ? (
                <>
                  {isAdmin ? <p style={styles.sectionLabel}>Customer Updates</p> : null}
                  {regularItems.map((item) => {
                    const color = typeColors[item.type] || typeColors.system;
                    return (
                      <div
                        key={item.id}
                        style={{
                          ...styles.row,
                          background: item.is_read ? "#ffffff" : color.bg,
                          borderLeft: `4px solid ${color.dot}`,
                        }}
                      >
                        <div style={styles.rowContent}>
                          <p style={styles.rowTitle}>{item.title}</p>
                          <p style={styles.rowMessage}>{item.message}</p>
                          <p style={styles.rowMeta}>
                            id: {item.id} | user: {item.user_id} | type: {item.type}
                          </p>
                          <p style={styles.rowMeta}>
                            read_status: {compactStatus(item)} | timestamp: {formatTime(item.timestamp || item.created_at)}
                          </p>
                          <p style={styles.rowTime}>{formatTime(item.created_at)}</p>
                        </div>
                        <div style={styles.rowActions}>
                          <button
                            type="button"
                            style={styles.actionBtn}
                            onClick={() => toggleRead(item)}
                          >
                            {item.is_read ? "Mark unread" : "Mark read"}
                          </button>
                          <button
                            type="button"
                            style={styles.deleteBtn}
                            onClick={() => removeOne(item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : null}
              {isAdmin && adminAlerts.length > 0 ? (
                <>
                  <p style={styles.sectionLabel}>Admin Alerts</p>
                  {adminAlerts.map((item) => {
                    const color = typeColors[item.type] || typeColors.system;
                    return (
                      <div
                        key={item.id}
                        style={{
                          ...styles.row,
                          background: item.is_read ? "#ffffff" : color.bg,
                          borderLeft: `4px solid ${color.dot}`,
                        }}
                      >
                        <div style={styles.rowContent}>
                          <p style={styles.rowTitle}>{item.title}</p>
                          <p style={styles.rowMessage}>{item.message}</p>
                          <p style={styles.rowMeta}>
                            id: {item.id} | user: {item.user_id} | type: {item.type}
                          </p>
                          <p style={styles.rowMeta}>
                            read_status: {compactStatus(item)} | timestamp: {formatTime(item.timestamp || item.created_at)}
                          </p>
                          <p style={styles.rowTime}>{formatTime(item.created_at)}</p>
                        </div>
                        <div style={styles.rowActions}>
                          <button
                            type="button"
                            style={styles.actionBtn}
                            onClick={() => toggleRead(item)}
                          >
                            {item.is_read ? "Mark unread" : "Mark read"}
                          </button>
                          <button
                            type="button"
                            style={styles.deleteBtn}
                            onClick={() => removeOne(item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  wrap: {
    position: "relative",
  },
  bellBtn: {
    position: "relative",
    border: "1px solid #dbe4ff",
    background: "rgba(255,255,255,0.95)",
    borderRadius: "999px",
    width: "44px",
    height: "44px",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  },
  bellIcon: {
    width: "20px",
    height: "20px",
    color: "#334155",
  },
  badge: {
    position: "absolute",
    top: "-6px",
    right: "-6px",
    minWidth: "21px",
    height: "21px",
    borderRadius: "999px",
    background: "#16a34a",
    color: "#fff",
    fontWeight: "800",
    fontSize: "12px",
    display: "grid",
    placeItems: "center",
    padding: "0 6px",
    border: "2px solid #fff",
  },
  panel: {
    position: "absolute",
    right: 0,
    top: "52px",
    width: "390px",
    maxHeight: "460px",
    overflow: "auto",
    background: "#fff",
    border: "1px solid #dbeafe",
    borderRadius: "16px",
    boxShadow: "0 20px 42px rgba(15, 23, 42, 0.18)",
    zIndex: 40,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #e2e8f0",
    padding: "12px 14px",
    position: "sticky",
    top: 0,
    background: "#fff",
    zIndex: 1,
  },
  panelTitle: {
    color: "#111827",
  },
  linkBtn: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    cursor: "pointer",
    fontWeight: "700",
  },
  stateText: {
    padding: "14px",
    color: "#64748b",
  },
  errorText: {
    padding: "0 14px 10px",
    color: "#dc2626",
    fontWeight: "700",
  },
  list: {
    display: "grid",
  },
  sectionLabel: {
    margin: 0,
    padding: "10px 14px 6px",
    color: "#64748b",
    fontWeight: "800",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "10px",
    padding: "12px 14px",
    borderBottom: "1px solid #e2e8f0",
  },
  rowContent: {
    minWidth: 0,
  },
  rowTitle: {
    margin: 0,
    color: "#111827",
    fontWeight: "800",
  },
  rowMessage: {
    margin: "6px 0",
    color: "#334155",
    lineHeight: 1.35,
    fontSize: "14px",
  },
  rowTime: {
    margin: 0,
    fontSize: "12px",
    color: "#64748b",
  },
  rowMeta: {
    margin: "2px 0",
    fontSize: "11px",
    color: "#475569",
  },
  rowActions: {
    display: "grid",
    gap: "6px",
    alignContent: "start",
  },
  actionBtn: {
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    background: "#fff",
    padding: "6px 10px",
    cursor: "pointer",
    color: "#334155",
    fontWeight: "700",
    fontSize: "12px",
  },
  deleteBtn: {
    border: "1px solid #fecaca",
    borderRadius: "10px",
    background: "#fff1f2",
    padding: "6px 10px",
    cursor: "pointer",
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: "12px",
  },
};
