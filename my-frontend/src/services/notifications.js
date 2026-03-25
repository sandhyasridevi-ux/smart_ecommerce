import API from "./api";

export const fetchNotifications = async () => {
  const response = await API.get("/notifications");
  return Array.isArray(response.data) ? response.data : [];
};

export const setNotificationReadState = async (notificationId, isRead) => {
  const response = await API.post("/notifications/read", {
    notification_id: notificationId,
    is_read: isRead,
    mark_all: false,
  });
  return response.data;
};

export const setAllNotificationsReadState = async (isRead) => {
  const response = await API.post("/notifications/read", {
    is_read: isRead,
    mark_all: true,
  });
  return response.data;
};

export const deleteNotification = async (notificationId) => {
  const response = await API.delete(`/notifications/${notificationId}`);
  return response.data;
};
