function buildLeaderboardRows(period) {
  const rows = Array.isArray(LEADERBOARD?.[period]) ? [...LEADERBOARD[period]] : [];
  const currentName = STATE.currentUser?.name || "TeamForge User";
  const currentInitials = STATE.currentUser?.initials || "TF";
  const currentRecord =
    typeof getCurrentUserRecord === "function" ? getCurrentUserRecord() : null;
  const currentProjects = PROJECTS.filter((project) => {
    const isOwner = project.owner === currentName;
    const isMember = Array.isArray(project.members)
      ? project.members.some((member) => member.name === currentName)
      : false;
    return isOwner || isMember;
  }).length;
  const currentTasks = PROJECTS.reduce((count, project) => {
    const runtime =
      typeof getProjectRuntime === "function"
        ? getProjectRuntime(project)
        : project?.runtime;
    const tasks = Array.isArray(runtime?.tasks) ? runtime.tasks : [];
    return (
      count +
      tasks.filter((task) => String(task.assignee || "").trim() === currentName).length
    );
  }, 0);

  const existingIndex = rows.findIndex((row) => row.user === currentName);
  const currentRow = {
    user: currentName,
    initials: currentInitials,
    xp: Number(currentRecord?.profile?.xp ?? 0),
    rep: Number(currentRecord?.profile?.rep ?? 0),
    tasks: currentTasks,
    projects: currentProjects,
  };

  if (existingIndex >= 0) {
    rows[existingIndex] = { ...rows[existingIndex], ...currentRow };
  } else {
    rows.push(currentRow);
  }

  return rows
    .sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function escapeLeaderboardHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function switchLeaderboard(period, btn) {
  if (btn) {
    document
      .querySelectorAll("#page-leaderboard .tab")
      .forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
  }
  const data = buildLeaderboardRows(period || "weekly");
  const rankIcon = (r) =>
    r === 1 ? "🏆" : r === 2 ? "🥈" : r === 3 ? "🥉" : r;
  const rankColor = (r) =>
    r === 1
      ? "background:var(--warning)"
      : r === 2
        ? "background:#94a3b8"
        : r === 3
          ? "background:var(--accent)"
          : "background:var(--primary)";

  document.getElementById("leaderboard-body").innerHTML = data
    .map(
      (row) => `
    <tr class="clickable-row" onclick="viewUserProfile('${encodeURIComponent(String(row.user || ""))}','${encodeURIComponent(String(row.initials || ""))}')">
      <td>${rankIcon(row.rank)}</td>
      <td>
        <div class="flex items-center gap-2">
          <div class="rank-avatar" style="${rankColor(row.rank)}">${escapeLeaderboardHtml(row.initials)}</div>
          <span class="font-semibold" style="color:var(--fg)">${escapeLeaderboardHtml(row.user)}</span>
        </div>
      </td>
      <td class="font-semibold" style="color:var(--fg)">${Number(row.xp || 0).toLocaleString()}</td>
      <td>${row.rep}</td>
      <td>${row.tasks}</td>
      <td>${row.projects}</td>
    </tr>
  `,
    )
    .join("");
}

function viewUserProfile(name, initials) {
  const decodedName = decodeURIComponent(String(name || ""));
  const decodedInitials = decodeURIComponent(String(initials || ""));
  navigate("profile");
  renderProfile({ name: decodedName, initials: decodedInitials });
}
