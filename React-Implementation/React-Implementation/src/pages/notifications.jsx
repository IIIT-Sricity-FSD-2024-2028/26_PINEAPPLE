import { useContext } from "react";
import { NotificationContext } from "../context/NotificationContext";
import EmptyState from "../components/common/EmptyState";
import { formatRelativeTime } from "../utils/dateUtils";
import "./notifications.css";

const getIconColorClass = (type) => {
  switch (type) {
    case 'success': return 'notif-dot-success';
    case 'info': return 'notif-dot-info';
    case 'warning': return 'notif-dot-warning';
    default: return 'notif-dot-default';
  }
};

const Notifications = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useContext(NotificationContext);

  return (
    <div className="notifications-page">
      {/* Header */}
      <div className="notif-header-wrap">
        <div>
          <h1 className="notif-title-main">Notifications</h1>
          <p className="notif-subtitle">Stay updated on your projects and tasks.</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="notif-btn-secondary">
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="notif-glass-card">
        
        {notifications.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="You're all caught up!"
            message="There are no new notifications right now."
          />
        ) : (
          <div className="notif-list-container">
            {notifications.map((notif) => (
              <div 
                key={notif.id}
                onClick={() => !notif.isRead && markAsRead(notif.id)}
                className={`notif-item ${notif.isRead ? 'read' : 'unread'}`}
              >
                <div className={`notif-dot-icon ${getIconColorClass(notif.type)} ${notif.isRead ? 'read' : ''}`}></div>
                <div className="notif-content-col">
                  <div className="notif-title-row">
                    <div className={`notif-title ${notif.isRead ? 'read' : 'unread'}`}>
                      {notif.title || "Notification"}
                    </div>
                    {!notif.isRead && (
                      <span className="notif-badge"></span>
                    )}
                  </div>
                  <div className={`notif-desc ${notif.isRead ? 'read' : 'unread'}`}>
                    {notif.message}
                  </div>
                  {(notif.createdAt || notif.timestamp) && (
                    <div className="notif-time">
                      {formatRelativeTime(notif.createdAt || notif.timestamp)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
