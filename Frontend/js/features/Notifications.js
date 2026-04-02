function renderNotifications() {
  const list = document.getElementById("notif-list");
  if (!list) return;

  const currentUserData =
    (typeof getCurrentUserData === "function" && getCurrentUserData()) ||
    { projects: [], requests: [], notifications: [] };

  const requestItems = (currentUserData.requests || []).map(
    (request) => `
      <div class="notif-item${request.status === "pending" ? " unread" : ""}">
        <div class="notif-icon">🤝</div>
        <div style="flex:1;min-width:0">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-sm">Join Request</span>
            ${request.status === "pending" ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--info);flex-shrink:0"></span>' : ""}
          </div>
          <p class="text-sm text-muted mt-1">${request.from} requested to join project ${request.projectName || request.projectId}.</p>
          <p class="text-xs text-muted mt-1">Status: ${request.status}</p>
        </div>
        <span class="text-xs text-muted" style="white-space:nowrap">${request.time || "Just now"}</span>
      </div>
      <div style="height:1px;background:var(--border)"></div>
    `,
  );

  const notificationItems = (currentUserData.notifications || []).map(
    (notification) => `
      <div class="notif-item${notification.unread ? " unread" : ""}">
        <div class="notif-icon">${notification.icon || "🔔"}</div>
        <div style="flex:1;min-width:0">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-sm">${notification.title || notification.type || "Notification"}</span>
            ${notification.unread ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--info);flex-shrink:0"></span>' : ""}
          </div>
          <p class="text-sm text-muted mt-1">${notification.desc || notification.message || ""}</p>
          ${
            notification.projectId || notification.status
              ? `<p class="text-xs text-muted mt-1">${notification.projectId ? `Project: ${notification.projectId}` : ""}${notification.projectId && notification.status ? " · " : ""}${notification.status ? `Status: ${notification.status}` : ""}</p>`
              : ""
          }
        </div>
        <span class="text-xs text-muted" style="white-space:nowrap">${notification.time || notification.timestamp || ""}</span>
      </div>
      <div style="height:1px;background:var(--border)"></div>
    `,
  );

  list.innerHTML = [...requestItems, ...notificationItems].join("");
}
