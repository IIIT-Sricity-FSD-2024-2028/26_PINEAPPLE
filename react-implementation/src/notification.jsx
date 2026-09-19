import { useState } from "react";
function NotificationItem({ notification, onMarkRead }) {
  return (
    <div
      className={`notif-item ${
        notification.unread ? "unread" : ""
      }`}
    >
      <div style={{ flex: 1 }}>
        <strong>{notification.title}</strong>
        <p className="text-sm text-muted">
          {notification.desc}
        </p>
        <span className="text-xs text-muted">
          {notification.time}
        </span>
      </div>
      {notification.unread && (
        <button
          className="btn btn-outline btn-sm"
          type="button"
          onClick={() => onMarkRead(notification.id)}
        >
          Mark Read
        </button>
      )}
    </div>
  );
}
function NotificationList({ notifications, onMarkRead }) {
  return (
    <>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
        />
      ))}
    </>
  );
}
function NotificationsPage({
  notifications,
  onMarkRead,
}) {
  return (
    <section className="page active">
      <h1>Notifications</h1>
      <p className="page-subtitle">
        Stay updated on your projects and tasks.
      </p>
      <div className="card mt-4">
        <NotificationList
          notifications={notifications}
          onMarkRead={onMarkRead}
        />
      </div>
    </section>
  );
}
function App() {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "New Task Assigned",
      desc: "You have been assigned a new task.",
      time: "10 minutes ago",
      unread: true,
    },
    {
      id: 2,
      title: "Project Updated",
      desc: "The project details have been updated.",
      time: "1 hour ago",
      unread: true,
    },
    {
      id: 3,
      title: "Task Completed",
      desc: "Your task was successfully completed.",
      time: "Yesterday",
      unread: false,
    },
    {
      id: 4,
      title: "Deadline Reminder",
      desc: "Your project deadline is approaching.",
      time: "2 hours ago",
      unread: true,
    },
  ]);
  const handleMarkRead = (id) => {
    setNotifications((previousNotifications) =>
      previousNotifications.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              unread: false,
            }
          : notification
      )
    );
  };
  return (
    <NotificationsPage
      notifications={notifications}
      onMarkRead={handleMarkRead}
    />
  );
}

export default App;