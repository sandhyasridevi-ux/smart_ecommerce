import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerWithFallback } from "../services/localAuth";

const Registerpage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "customer",
  });

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const response = await registerWithFallback(formData);

      setMessage(response?.message || "Registration successful");

      setFormData({
        name: "",
        email: "",
        password: "",
        role: "customer",
      });

      setTimeout(() => {
        navigate("/login");
      }, 800);
    } catch (error) {
      setMessage(error?.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Register</h2>

        <form onSubmit={handleRegister}>
          <input
            type="text"
            placeholder="Name"
            style={styles.input}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

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

          <select
            style={styles.input}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          >
            <option value="customer">Customer</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.button,
              background: "#6366f1",
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Registering..." : "Register"}
          </button>
        </form>

        {message ? (
          <p
            style={{
              marginTop: "15px",
              color: message.toLowerCase().includes("successful") ? "#059669" : "#dc2626",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            {message}
          </p>
        ) : null}

        <p style={styles.footerText}>
          Already have an account?{" "}
          <Link to="/login" style={styles.link}>
            Login
          </Link>
        </p>

        <button onClick={() => navigate("/")} style={styles.backButton}>
          Back to Home
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(90deg, #4f46e5, #22c7b8)",
    padding: "20px",
  },
  card: {
    background: "white",
    padding: "40px",
    borderRadius: "16px",
    textAlign: "center",
    color: "#1f2937",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  },
  title: {
    marginBottom: "20px",
    fontSize: "32px",
    fontWeight: "bold",
  },
  input: {
    width: "100%",
    padding: "12px",
    margin: "10px 0",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    boxSizing: "border-box",
    fontSize: "14px",
    outline: "none",
  },
  button: {
    width: "100%",
    padding: "12px",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    marginTop: "10px",
    fontSize: "14px",
  },
  footerText: {
    marginTop: "18px",
    fontSize: "14px",
    color: "#6b7280",
  },
  link: {
    color: "#6366f1",
    textDecoration: "none",
    fontWeight: "600",
  },
  backButton: {
    marginTop: "14px",
    background: "transparent",
    border: "none",
    color: "#374151",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
  },
};

export default Registerpage;
