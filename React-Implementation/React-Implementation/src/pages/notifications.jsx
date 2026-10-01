import React, { useContext } from "react";
import { NotificationContext } from "../context/NotificationContext";

// Simple helper to pick color based on notification type
const getIconColor = (type) => {
  switch (type) {
    case 'success': return '#16a34a'; // green
    case 'info': return '#3b82f6'; // blue
    case 'warning': return '#f59e0b'; // orange
    default: return '#6b7280'; // gray
  }
};

const Notifications = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useContext(NotificationContext);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#111827', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>Notifications</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '1.05rem' }}>Stay updated on your projects and tasks.</p>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            style={{ padding: '0.6rem 1.2rem', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: '#111827', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
            onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '0', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        
        {notifications.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#6b7280', fontSize: '1rem', background: '#fff' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>dY""</div>
            <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>You're all caught up!</div>
            <div>There are no notifications right now.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.map((notif, index) => (
              <div 
                key={notif.id}
                onClick={() => !notif.isRead && markAsRead(notif.id)}
                style={{ 
                  display: 'flex', 
                  gap: '1.25rem', 
                  alignItems: 'flex-start', 
                  padding: '1.5rem', 
                  background: notif.isRead ? 'transparent' : 'rgba(255, 255, 255, 0.9)', 
                  borderBottom: index === notifications.length - 1 ? 'none' : '1px solid #f3f4f6',
                  cursor: notif.isRead ? 'default' : 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => {
                  if (!notif.isRead) e.currentTarget.style.background = '#ffffff';
                }}
                onMouseOut={(e) => {
                  if (!notif.isRead) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
                }}
              >
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: getIconColor(notif.type), marginTop: '8px', flexShrink: 0, opacity: notif.isRead ? 0.4 : 1, transition: 'opacity 0.2s' }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: notif.isRead ? '#6b7280' : '#111827', transition: 'color 0.2s' }}>
                      {notif.title || "Notification"}
                    </div>
                    {!notif.isRead && (
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0, boxShadow: '0 0 0 4px rgba(59,130,246,0.1)' }}></span>
                    )}
                  </div>
                  <div style={{ color: notif.isRead ? '#9ca3af' : '#4b5563', fontSize: '0.95rem', lineHeight: '1.5', transition: 'color 0.2s' }}>
                    {notif.message}
                  </div>
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
