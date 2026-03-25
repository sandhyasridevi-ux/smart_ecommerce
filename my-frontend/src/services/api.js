import axios from "axios";

export const API_BASE_URL = "http://127.0.0.1:8000";

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: {
    "Content-Type": "application/json",
  },
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const buildNotificationsWsUrl = (token) => {
  const wsBaseUrl = API_BASE_URL.replace("http://", "ws://").replace("https://", "wss://");
  return `${wsBaseUrl}/notifications/ws?token=${encodeURIComponent(token)}`;
};

export default API;
