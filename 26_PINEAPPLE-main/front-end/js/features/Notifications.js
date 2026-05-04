function renderNotifications() {
  const list = document.getElementById("notif-list");
  if (!list) return;

  const escapeNotificationsHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

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
          <p class="text-sm text-muted mt-1">${escapeNotificationsHtml(request.from)} requested to join project ${escapeNotificationsHtml(request.projectName || request.projectId)}.</p>
          <p class="text-xs text-muted mt-1">Status: ${escapeNotificationsHtml(request.status)}</p>
        </div>
        <span class="text-xs text-muted" style="white-space:nowrap">${escapeNotificationsHtml(request.time || "Just now")}</span>
      </div>
      <div style="height:1px;background:var(--border)"></div>
    `,
  );

  const notificationItems = (currentUserData.notifications || []).map(
    (notification) => {
      const iconText = escapeNotificationsHtml(notification.icon || "🔔");
      const titleText = escapeNotificationsHtml(notification.title || notification.type || "Notification");
      const descText = escapeNotificationsHtml(notification.desc || notification.message || "");
      const projectIdText = escapeNotificationsHtml(notification.projectId || "");
      const statusText = escapeNotificationsHtml(notification.status || "");
      const timeText = escapeNotificationsHtml(notification.time || notification.timestamp || "");
      return `
      <div class="notif-item${notification.unread ? " unread" : ""}">
        <div class="notif-icon">${iconText}</div>
        <div style="flex:1;min-width:0">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-sm">${titleText}</span>
            ${notification.unread ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--info);flex-shrink:0"></span>' : ""}
          </div>
          <p class="text-sm text-muted mt-1">${descText}</p>
          ${
            notification.projectId || notification.status
              ? `<p class="text-xs text-muted mt-1">${notification.projectId ? `Project: ${projectIdText}` : ""}${notification.projectId && notification.status ? " · " : ""}${notification.status ? `Status: ${statusText}` : ""}</p>`
              : ""
          }
        </div>
        <span class="text-xs text-muted" style="white-space:nowrap">${timeText}</span>
      </div>
      <div style="height:1px;background:var(--border)"></div>
    `;
    },
  );

  list.innerHTML = [...requestItems, ...notificationItems].join("");
}
