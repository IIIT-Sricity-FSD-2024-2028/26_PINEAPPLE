import { createContext, useState, useEffect, useContext, useCallback } from "react";
import notificationsApi from "../services/notificationsApi.js";
import { AuthContext } from "./AuthContext";
import storage from "../utils/storage";

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
      const activeUserId = user?.id || storage.getBackendUserId() || null;
      if (!activeUserId || user?.profileComplete === false) {
        return;
      }
      const response = await notificationsApi.list({ userId: activeUserId });
      const rawList = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];
      setNotifications(rawList.map(normalizeNotification));

      const hasMentorApproval = rawList.some((n) => {
        const type = String(n.type || '').toUpperCase();
        const title = String(n.title || '');
        return type === 'MENTOR_APPLICATION_APPROVED' || title.includes('Mentor Application Approved');
      });
      if (hasMentorApproval && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('teamforge:mentor_status_updated'));
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, [user?.id, user?.profileComplete]);

  useEffect(() => {
    if (!user?.id || user?.profileComplete === false) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();

    let lastFetchTime = Date.now();
    const throttledFocusUpdate = () => {
      const now = Date.now();
      if (now - lastFetchTime > 15000 && !document.hidden) {
        lastFetchTime = now;
        fetchNotifications();
      }
    };

    const handleDirectUpdate = () => {
      lastFetchTime = Date.now();
      fetchNotifications();
    };

    const intervalId = setInterval(() => {
      if (!document.hidden) {
        lastFetchTime = Date.now();
        fetchNotifications();
      }
    }, 300000);

    const handleStopPolls = () => {
      clearInterval(intervalId);
      setNotifications([]);
    };

    window.addEventListener("focus", throttledFocusUpdate);
    document.addEventListener("visibilitychange", throttledFocusUpdate);
    window.addEventListener("teamforge:notification_updated", handleDirectUpdate);
    window.addEventListener("teamforge:stop_polls", handleStopPolls);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", throttledFocusUpdate);
      document.removeEventListener("visibilitychange", throttledFocusUpdate);
      window.removeEventListener("teamforge:notification_updated", handleDirectUpdate);
      window.removeEventListener("teamforge:stop_polls", handleStopPolls);
    };
  }, [fetchNotifications, user?.id, user?.profileComplete]);

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
    const currentUserId = user?.id || storage.getBackendUserId() || "";
    try {
      const res = await notificationsApi.markAllAsRead(undefined, currentUserId);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readStatus: true })),
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("teamforge:notification_updated"));
      }
      return res;
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
      throw err;
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
