import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginWithFallback } from "../services/localAuth";

const demoSocialProfiles = {
  google: {
    token: "google-demo-token",
    user: { name: "Google User", email: "google.user@example.com", role: "customer" },
  },
  facebook: {
    token: "facebook-demo-token",
    user: { name: "Facebook User", email: "facebook.user@example.com", role: "customer" },
  },
  auth0: {
    token: "auth0-demo-token",
    user: { name: "Auth0 User", email: "auth0.user@example.com", role: "customer" },
  },
};

const Loginpage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const response = await loginWithFallback(formData);

      localStorage.setItem("token", response?.access_token || "");
      localStorage.setItem("user", JSON.stringify(response?.user || {}));

      setMessage("Login successful");
      setTimeout(() => {
        if (response?.user?.role === "admin") {
          navigate("/admin-panel");
        } else {
          navigate("/dashboard");
        }
      }, 700);
    } catch (error) {
      setMessage(error?.message || "Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocialLogin = (provider) => {
    const profile = demoSocialProfiles[provider];
    localStorage.setItem("token", profile.token);
    localStorage.setItem("user", JSON.stringify(profile.user));
    setMessage(`${provider.toUpperCase()} sign in ready`);
    setTimeout(() => {
      navigate("/dashboard");
    }, 500);
  };

  return (
    <div style={styles.page}>
      <div style={styles.modal}>
        <button style={styles.closeBtn} onClick={() => navigate("/")}>
          x
        </button>
        <h1 style={styles.title}>SIGN IN TO SMART E-COMMERCE</h1>
        <p style={styles.subtitle}>Connect with a social network</p>

        <div style={styles.socialRow}>
          <button
            type="button"
            style={{ ...styles.socialBtn, ...styles.facebookBtn }}
            onClick={() => handleSocialLogin("facebook")}
          >
            Facebook
          </button>
          <button
            type="button"
            style={{ ...styles.socialBtn, ...styles.googleBtn }}
            onClick={() => handleSocialLogin("google")}
          >
            Google
          </button>
          <button
            type="button"
            style={{ ...styles.socialBtn, ...styles.auth0Btn }}
            onClick={() => handleSocialLogin("auth0")}
          >
            Auth0
          </button>
        </div>

        <div style={styles.dividerRow}>
          <div style={styles.line} />
          <span style={styles.orText}>Or</span>
          <div style={styles.line} />
        </div>

        <p style={styles.formNote}>Sign in with your email address</p>

        <form onSubmit={handleLogin}>
          <div style={styles.inputGrid}>
            <input
              type="email"
              placeholder="Email"
              style={styles.input}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              style={styles.input}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" disabled={submitting} style={styles.signInBtn}>
            {submitting ? "Signing In..." : "Sign In"}
          </button>
        </form>

        {message ? (
          <p
            style={{
              ...styles.message,
              color:
                message.toLowerCase().includes("successful") ||
                message.toLowerCase().includes("ready")
                  ? "#059669"
                  : "#dc2626",
            }}
          >
            {message}
          </p>
        ) : null}

        <div style={styles.footerLinks}>
          <button type="button" style={styles.linkBtn}>
            Forgot Password?
          </button>
          <span style={styles.footerMuted}>Or</span>
          <Link to="/register" style={styles.linkText}>
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.18), rgba(15,23,42,0.28)), linear-gradient(135deg, #f8fafc, #e0f2fe)",
  },
  modal: {
    width: "100%",
    maxWidth: "760px",
    background: "#fff",
    borderRadius: "16px",
    padding: "34px 30px 40px",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.16)",
    position: "relative",
    textAlign: "center",
  },
  closeBtn: {
    position: "absolute",
    top: "14px",
    right: "16px",
    border: "none",
    background: "transparent",
    fontSize: "22px",
    fontWeight: "700",
    color: "#888",
    cursor: "pointer",
  },
  title: {
    fontSize: "22px",
    color: "#6b7280",
    marginBottom: "34px",
    letterSpacing: "0.04em",
  },
  subtitle: {
    fontSize: "18px",
    color: "#9ca3af",
    marginBottom: "22px",
  },
  socialRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
    marginBottom: "26px",
  },
  socialBtn: {
    border: "none",
    padding: "16px 12px",
    color: "#fff",
    fontSize: "16px",
    fontWeight: "800",
    cursor: "pointer",
  },
  facebookBtn: {
    background: "#4267B2",
  },
  googleBtn: {
    background: "#ff4d1f",
  },
  auth0Btn: {
    background: "#111827",
  },
  dividerRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
  },
  line: {
    flex: 1,
    height: "1px",
    background: "#e5e7eb",
  },
  orText: {
    color: "#9ca3af",
    fontSize: "18px",
  },
  formNote: {
    color: "#9ca3af",
    fontSize: "16px",
    marginBottom: "20px",
  },
  inputGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "18px",
    marginBottom: "20px",
  },
  input: {
    width: "100%",
    padding: "18px 16px",
    border: "1px solid #d1d5db",
    fontSize: "16px",
    outline: "none",
  },
  signInBtn: {
    width: "100%",
    border: "none",
    background: "#14b8e6",
    color: "#fff",
    fontSize: "18px",
    fontWeight: "800",
    padding: "16px",
    cursor: "pointer",
  },
  message: {
    marginTop: "14px",
    fontWeight: "700",
  },
  footerLinks: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "20px",
  },
  linkBtn: {
    border: "none",
    background: "transparent",
    color: "#0ea5e9",
    cursor: "pointer",
    fontWeight: "700",
  },
  footerMuted: {
    color: "#9ca3af",
  },
  linkText: {
    color: "#0ea5e9",
    textDecoration: "none",
    fontWeight: "700",
  },
};

export default Loginpage;
