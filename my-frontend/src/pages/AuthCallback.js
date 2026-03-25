import React, { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

function AuthCallback() {
  const { isLoading, isAuthenticated, user, error } = useAuth0();

  useEffect(() => {
    if (isAuthenticated && user) {
      localStorage.setItem("auth0_user", JSON.stringify(user));
      window.location.href = "/";
    }
  }, [isAuthenticated, user]);

  if (isLoading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2 style={styles.title}>Signing you in...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2 style={styles.title}>Login Error</h2>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Processing login...</h2>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f3f4f6",
  },
  card: {
    background: "white",
    padding: "40px",
    borderRadius: "12px",
    textAlign: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
  },
  title: {
    fontSize: "28px",
    fontWeight: "bold",
  },
};

export default AuthCallback;