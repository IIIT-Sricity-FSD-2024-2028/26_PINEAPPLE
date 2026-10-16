import { createContext, useState, useEffect, useContext, useCallback } from "react";
import notificationsApi from "../services/notificationsApi.js";
import { AuthContext } from "./AuthContext";

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useContext(AuthContext) || {};
  const [notifications, setNotifications] = useState([]);

  const normalizeNotification = (n) => ({
    ...n,
    isRead: Boolean(n.isRead ?? n.readStatus ?? false),
    readStatus: Boolean(n.readStatus ?? n.isRead ?? false),
    title: n.title || (n.type ? n.type.replace(/_/g, " ") : "Notification"),
  });

  const fetchNotifications = useCallback(async () => {
    try {
      const userId = user?.id || (typeof localStorage !== "undefined" ? localStorage.getItem("teamforge.backendUserId") : null);
      const params = userId ? { userId } : undefined;
      const response = await notificationsApi.list(params);
      const rawList = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];
      setNotifications(rawList.map(normalizeNotification));
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, [user?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();

    const intervalId = setInterval(fetchNotifications, 10000);
    const handleUpdate = () => fetchNotifications();
    window.addEventListener("focus", handleUpdate);
    window.addEventListener("teamforge:notification_updated", handleUpdate);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleUpdate);
      window.removeEventListener("teamforge:notification_updated", handleUpdate);
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const addNotification = (message, type = "info", title) => {
    const newNotif = normalizeNotification({
      id: Date.now().toString(),
      message,
      type,
      title: title || "Notification",
      isRead: false,
      readStatus: false,
      createdAt: new Date().toISOString(),
    });
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const markAsRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (String(n.id) === String(id) ? { ...n, isRead: true, readStatus: true } : n)),
    );
    try {
      await notificationsApi.markAsRead(id);
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readStatus: true })),
    );
    try {
      const currentUserId =
        user?.id ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("teamforge.backendUserId")
          : "");
      await notificationsApi.markAllAsRead(undefined, currentUserId);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        refreshNotifications: fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
