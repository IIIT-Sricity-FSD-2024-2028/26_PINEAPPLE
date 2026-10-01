import { createContext, useState } from "react";
import { useEffect } from "react";
import notificationsApi from "../services/notificationsApi.js";

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  // const [notifications, setNotifications] = useState([
  //   { id: 1, title: 'Mentor Request Approved', message: 'Your request for "AI Integration" was approved by mentor Sarah.', isRead: false, type: 'success' },
  //   { id: 2, title: 'Invitation Accepted', message: 'You joined the project "Smart Grocery App".', isRead: false, type: 'info' },
  //   { id: 3, title: 'Task Assigned', message: 'You were assigned "Implement Authentication" in TeamForge.', isRead: true, type: 'warning' }
  // ]);

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Fetch notifications from the API when the component mounts
    const fetchNotifications = async () => {
      try {
        const response = await notificationsApi.list();
        setNotifications(
          Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
              ? response.data
              : [],
        );
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };
    fetchNotifications();
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const addNotification = (message) => {
    
    setNotifications((prev) => [
      { id: Date.now(), message, isRead: false },
      ...prev,
    ]);
  };

  const markAsRead = (id) => {
    const response = notificationsApi.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: response.isRead } : n)),
    );
  };

  const markAllAsRead = () => {
    const response = notificationsApi.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: response.isRead })));
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
