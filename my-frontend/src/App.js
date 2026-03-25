import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Loginpage from "./pages/Login";
import Registerpage from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Wishlist from "./pages/Wishlist";
import Cart from "./pages/Cart";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import AdminPanel from "./pages/AdminPanel";
import Orders from "./pages/Orders";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Loginpage />} />
      <Route path="/register" element={<Registerpage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/wishlist" element={<Wishlist />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout-success" element={<CheckoutSuccess />} />
      <Route path="/admin-panel" element={<AdminPanel />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
