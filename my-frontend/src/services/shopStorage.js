const WISHLIST_KEY = "wishlist_items";
const CART_KEY = "cart_items";
const ORDERS_KEY = "placed_orders";

const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch (error) {
    return [];
  }
};

export const getWishlistItems = () => readJson(WISHLIST_KEY);

export const saveWishlistItems = (items) => {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
};

export const getCartItems = () => readJson(CART_KEY);

export const saveCartItems = (items) => {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
};

export const addCartItem = (product) => {
  const currentItems = getCartItems();
  const existingItem = currentItems.find((item) => item.id === product.id);
  const nextItems = existingItem
    ? currentItems.map((item) =>
        item.id === product.id
          ? { ...item, quantity: (item.quantity || 1) + 1 }
          : item
      )
    : [...currentItems, { ...product, quantity: 1 }];

  saveCartItems(nextItems);
  return nextItems;
};

export const getOrders = () => readJson(ORDERS_KEY);

export const saveOrders = (orders) => {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
};

export const addOrder = (order) => {
  const currentOrders = getOrders();
  const nextOrders = [order, ...currentOrders];
  saveOrders(nextOrders);
  return nextOrders;
};

export const updateOrderStatus = (orderId, status) => {
  const currentOrders = getOrders();
  const progressMap = {
    pending: 0,
    shipped: 2,
    out_for_delivery: 3,
    delivered: 4,
    cancelled: 0,
  };

  const nextOrders = currentOrders.map((order) =>
    order.orderId === orderId
      ? {
          ...order,
          status,
          progress: progressMap[status] ?? order.progress ?? 0,
        }
      : order
  );

  saveOrders(nextOrders);
  return nextOrders;
};
