// ══════════════════════════════════════════════
//   MY WORK (COLLABORATOR)
// ══════════════════════════════════════════════

function getInitialsFromName(name) {
  return (
    String(name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "TU"
  );
}

function syncApprovedAppliedToProjectMembers() {
  const currentUser = getCurrentUserName();

  APPLIED.filter(
    (a) => a.status === "Approved" && a.project && a.owner !== currentUser,
  ).forEach((app) => {
    const project = PROJECTS.find((p) => p.name === app.project);
    if (!project) return;

    const hasMember = Array.isArray(project.members)
      ? project.members.some((m) => m.name === currentUser)
      : false;
    if (project.owner === currentUser) return;

    if (!hasMember) {
      const initials = getInitialsFromName(currentUser);
      project.members = project.members || [];
      project.members.push({
        name: currentUser,
        initials,
        role: "Collaborator",
      });
      project.collaborators = project.members.length;
    }
  });
}

function renderMyWork() {
  const root = document.getElementById("my-work-content");
  if (!root) return;

  const currentUser = getCurrentUserName();

  syncApprovedAppliedToProjectMembers();

  // Only include projects that are
  // approved in the Applied list (model-level consistency).
  const approvedAppliedProjectNames = new Set(
    APPLIED.filter((a) => a.status === "Approved" && a.project).map(
      (a) => a.project,
    ),
  );

  const approvedAppliedProjects = PROJECTS.filter((p) =>
    approvedAppliedProjectNames.has(p.name),
  );

  const memberCollaborativeProjects = PROJECTS.filter(
    (p) =>
      p.owner !== currentUser &&
      Array.isArray(p.members) &&
      p.members.some((m) => m.name === currentUser),
  );

  const collaborativeProjects = [...approvedAppliedProjects];
  memberCollaborativeProjects.forEach((p) => {
    if (!collaborativeProjects.some((x) => x.id === p.id)) {
      collaborativeProjects.push(p);
    }
  });

  const activeProjects = collaborativeProjects.filter((p) => !p.isCompleted);
  const completedProjects = collaborativeProjects.filter((p) => p.isCompleted);

  const activeHTML = activeProjects
    .map((p) => {
      const userRole =
        p.members.find((m) => m.name === currentUser)?.role || "Collaborator";
      const assignedTasks = [
        {
          title: "Build event listing page",
          assigned: currentUser,
          difficulty: "Medium",
          due: "Mar 12",
          status: "In Review",
        },
        {
          title: "RSVP functionality",
          assigned: "Priya Patel",
          difficulty: "Hard",
          due: "Mar 20",
          status: "Open",
        },
        {
          title: "Push notification service",
          assigned: "Ananya Reddy",
          difficulty: "Hard",
          due: "Mar 25",
          status: "In Progress",
        },
        {
          title: "Map integration",
          assigned: "Unassigned",
          difficulty: "Medium",
          due: "Mar 28",
          status: "Open",
        },
      ];
      const userTasks = assignedTasks.filter((t) => t.assigned === currentUser);
      const progress = p.progress || 60;

      return `
        <div class="card mt-3" style="border:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
            <div>
              <div style="font-size:1.2rem;font-weight:700;margin-bottom:2px">${p.name}</div>
              <div style="font-size:0.85rem;color:var(--muted-fg)">owned by ${p.owner}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:0.95rem;font-weight:600;margin-bottom:2px;color:var(--muted-fg)">${userTasks.length} task${userTasks.length !== 1 ? "s" : ""} assigned to you</div>
              <div style="font-size:0.85rem;color:var(--muted-fg)">${progress}%</div>
            </div>
            <button class="btn btn-outline" onclick="openWorkspace('${p.id}')">Open Workspace</button>
          </div>
          <div class="progress-container" style="height:8px;margin-bottom:16px;"><div class="progress-fill" style="width:${progress}%"></div></div>

          <div style="display:flex;gap:10px;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:10px">
            <span style="font-size:0.85rem;font-weight:600;color:var(--fg)">ALL TASKS</span>
            <span style="font-size:0.8rem;color:var(--muted-fg)">You can only act on tasks assigned to you</span>
          </div>

          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border)">
                <th style="text-align:left;padding:8px 0;font-size:0.8rem;font-weight:600;color:var(--muted-fg)">Task</th>
                <th style="text-align:left;padding:8px 0;font-size:0.8rem;font-weight:600;color:var(--muted-fg)">Assigned To</th>
                <th style="text-align:left;padding:8px 0;font-size:0.8rem;font-weight:600;color:var(--muted-fg)">Difficulty</th>
                <th style="text-align:left;padding:8px 0;font-size:0.8rem;font-weight:600;color:var(--muted-fg)">Deadline</th>
                <th style="text-align:left;padding:8px 0;font-size:0.8rem;font-weight:600;color:var(--muted-fg)">Status</th>
                <th style="text-align:left;padding:8px 0;font-size:0.8rem;font-weight:600;color:var(--muted-fg)">Action</th>
              </tr>
            </thead>
            <tbody>
              ${assignedTasks
                .map(
                  (t) => `
                <tr style="border-bottom:1px solid var(--border);">
                  <td style="padding:10px 0;font-size:0.9rem;font-weight:${t.assigned === currentUser ? "600" : "400"}">${t.title} ${t.assigned === currentUser ? '<span style="font-size:0.75rem;color:var(--muted-fg)">(you)</span>' : ""}</td>
                  <td style="padding:10px 0;font-size:0.9rem;color:var(--muted-fg)">${t.assigned}</td>
                  <td style="padding:10px 0">
                    <span class="badge ${t.difficulty === "Hard" ? "badge-destructive" : t.difficulty === "Medium" ? "badge-warning" : "badge-secondary"}" style="${t.difficulty === "Hard" ? "background:rgba(239,68,68,.1);color:var(--destructive);" : ""}">${t.difficulty}</span>
                  </td>
                  <td style="padding:10px 0;font-size:0.9rem;color:var(--muted-fg)">${t.due}</td>
                  <td style="padding:10px 0">
                    <span class="badge ${t.status === "In Review" ? "badge-warning" : t.status === "In Progress" ? "badge-info" : "badge-secondary"}">${t.status}</span>
                  </td>
                  <td style="padding:10px 0;font-size:0.9rem;color:var(--muted-fg)">${t.assigned === currentUser ? "Awaiting review" : "—"}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `;
    })
    .join("");

  const completedHTML = completedProjects
    .map((p) => {
      const summary = getMyWorkCompletedSummary(p);
      return `
        <div class="card mt-3" style="border:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                <span style="font-size:1.2rem;font-weight:700">${p.name}</span>
                <span class="badge badge-success" style="background:rgba(34,197,94,.1);color:var(--success)">✓ Completed</span>
                <span style="font-size:0.85rem;color:var(--muted-fg)">owned by ${p.owner}</span>
              </div>
              <div style="font-size:0.85rem;color:var(--muted-fg);margin-top:2px">${summary.completedOn} · ${summary.tasksCompleted}/${summary.totalTasks} of your tasks done</div>
            </div>
            <button class="btn btn-outline" onclick="openContributionSummary('${p.id}')">🏆 My Summary</button>
          </div>
          <div class="progress-container" style="height:8px;margin:12px 0"><div class="progress-fill" style="width:100%"></div></div>
          <div style="display:flex;gap:12px;font-size:0.9rem;margin-bottom:8px">
            <span>⚡ <span style="font-weight:600;color:#f59e0b">+${summary.xpEarned} XP</span></span>
            <span>⭐ <span style="font-weight:600;color:#3b82f6">+${summary.repGained} Rep</span></span>
          </div>
          <div style="font-size:0.85rem;color:var(--muted-fg);display:flex;align-items:center;gap:4px">
            <span>🔒</span>
            <span>Archived — workspace is read-only</span>
          </div>
        </div>
      `;
    })
    .join("");

  root.innerHTML = `
    ${activeProjects.length ? `<div style="margin-bottom:20px"><div style="font-size:1.1rem;font-weight:700;color:var(--muted-fg);margin-bottom:10px">📁 ACTIVE (${activeProjects.length})</div>${activeHTML}</div>` : ""}
    ${completedProjects.length ? `<div><div style="font-size:1.1rem;font-weight:700;color:var(--muted-fg);margin-bottom:10px">✅ COMPLETED (${completedProjects.length})</div>${completedHTML}</div>` : ""}
    ${!activeProjects.length && !completedProjects.length ? '<div class="card"><p class="text-sm text-muted italic">No collaborative projects found. Join a project to get started!</p></div>' : ""}
  `;
}

function getMyWorkCompletedSummary(project) {
  const reportSource =
    typeof PROJECT_REPORTS !== "undefined" && PROJECT_REPORTS
      ? PROJECT_REPORTS[project.name]
      : null;

  const fallbackTotal = Number.isFinite(Number(project.totalTasks))
    ? Number(project.totalTasks)
    : 3;
  const totalTasks = Number.isFinite(Number(reportSource?.totalTasks))
    ? Number(reportSource.totalTasks)
    : fallbackTotal;

  const fallbackCompleted = Number.isFinite(Number(project.completedTasks))
    ? Number(project.completedTasks)
    : Math.min(
        totalTasks,
        Math.max(
          1,
          Math.round(((Number(project.progress) || 100) / 100) * totalTasks),
        ),
      );
  const tasksCompleted = Number.isFinite(Number(reportSource?.tasksCompleted))
    ? Number(reportSource.tasksCompleted)
    : fallbackCompleted;

  const xpEarned = Number.isFinite(Number(reportSource?.xpEarned))
    ? Number(reportSource.xpEarned)
    : Math.max(60, tasksCompleted * 40);
  const repGained = Number.isFinite(Number(reportSource?.repGained))
    ? Number(reportSource.repGained)
    : Math.max(4, Math.round(xpEarned / 15));

  const contribution =
    typeof reportSource?.contribution === "string" &&
    reportSource.contribution.trim()
      ? reportSource.contribution.trim()
      : `Contributed key features and delivery support for ${project.name}.`;

  const completedOn =
    typeof reportSource?.duration === "string" &&
    reportSource.duration.includes("–")
      ? `Completed ${reportSource.duration.split("–").pop().trim()}`
      : "Completed Feb 2026";

  return {
    xpEarned,
    repGained,
    totalTasks,
    tasksCompleted,
    contribution,
    completedOn,
  };
}

function openContributionSummary(projectId) {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }

  const summary = getMyWorkCompletedSummary(project);
  const xpEarned = summary.xpEarned;
  const repGained = summary.repGained;
  const tasksCompleted = summary.tasksCompleted;
  const totalTasks = summary.totalTasks;
  const completionPercent = Math.max(
    0,
    Math.min(100, Math.round((tasksCompleted / Math.max(1, totalTasks)) * 100)),
  );

  const teamAvatars = (Array.isArray(project.members) ? project.members : [])
    .slice(0, 4)
    .map(
      (m) => `
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--secondary);font-size:0.75rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0" title="${m.name}">
          ${m.initials}
        </div>
        <span style="font-size:0.95rem;color:var(--muted-fg)">${m.name.split(" ")[0]}</span>
      </div>
    `,
    )
    .join("");

  const content = document.getElementById("contribution-summary-content");
  const title = document.getElementById("contribution-summary-title");
  if (!content || !title) return;

  title.textContent = `Your Contribution Summary`;
  content.innerHTML = `
    <div style="font-size:0.9rem;color:var(--muted-fg);margin-bottom:20px">${project.name} · ${summary.completedOn}</div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
      <div style="text-align:center;padding:12px;background:rgba(248,248,248,0.6);border:1px solid var(--border);border-radius:6px">
        <div style="font-size:1.8rem;margin-bottom:4px">⚡</div>
        <div style="font-size:1.6rem;font-weight:700;color:var(--foreground);margin-bottom:4px">+${xpEarned}</div>
        <div style="font-size:0.8rem;color:var(--muted-fg);font-weight:500">XP Earned</div>
      </div>
      <div style="text-align:center;padding:12px;background:rgba(248,248,248,0.6);border:1px solid var(--border);border-radius:6px">
        <div style="font-size:1.8rem;margin-bottom:4px">⭐</div>
        <div style="font-size:1.6rem;font-weight:700;color:var(--foreground);margin-bottom:4px">+${repGained}</div>
        <div style="font-size:0.8rem;color:var(--muted-fg);font-weight:500">Rep Gained</div>
      </div>
      <div style="text-align:center;padding:12px;background:rgba(248,248,248,0.6);border:1px solid var(--border);border-radius:6px">
        <div style="font-size:1.8rem;margin-bottom:4px">✓</div>
        <div style="font-size:1.6rem;font-weight:700;color:var(--foreground);margin-bottom:4px">${tasksCompleted}/${totalTasks}</div>
        <div style="font-size:0.8rem;color:var(--muted-fg);font-weight:500">My Tasks</div>
      </div>
    </div>

    <div style="padding:14px;margin-bottom:12px;background:rgba(248,248,248,0.6);border:1px solid var(--border);border-radius:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:0.95rem">
          <span>📊</span>
          <span>Task Completion</span>
        </div>
        <span style="color:#22b45a;font-weight:700;font-size:0.95rem">${completionPercent}%</span>
      </div>
      <div class="progress-container" style="height:8px;background:rgba(0,0,0,0.05);border-radius:4px">
        <div class="progress-fill" style="width:${completionPercent}%;background:#22b45a;border-radius:4px;height:8px"></div>
      </div>
    </div>

    <div style="padding:14px;margin-bottom:12px;background:rgba(248,248,248,0.6);border:1px solid var(--border);border-radius:6px">
      <div style="font-weight:600;font-size:0.75rem;text-transform:uppercase;color:var(--muted-fg);margin-bottom:8px;letter-spacing:0.5px">Your Contribution</div>
      <p style="font-size:0.9rem;color:var(--foreground);line-height:1.5;margin:0">${summary.contribution}</p>
    </div>

    <div style="padding:14px;background:rgba(248,248,248,0.6);border:1px solid var(--border);border-radius:6px;margin-bottom:12px">
      <div style="font-weight:600;font-size:0.75rem;text-transform:uppercase;color:var(--muted-fg);margin-bottom:10px;letter-spacing:0.5px">Team</div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        ${teamAvatars}
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--muted-fg);padding-top:8px;border-top:1px solid var(--border)">
      <span style="font-size:1rem">🔒</span>
      <span>This project is archived. The workspace is read-only.</span>
    </div>
  `;

  const modal = document.getElementById("modal-contribution-summary");
  if (modal) modal.classList.add("open");
}

function closeContributionSummary(e) {
  const modal = document.getElementById("modal-contribution-summary");
  if (!modal) return;
  if (e && e.target !== modal) return;
  modal.classList.remove("open");
}
