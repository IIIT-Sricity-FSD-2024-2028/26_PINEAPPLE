// ══════════════════════════════════════════════
//   OWNED PROJECT WORKSPACE
// ══════════════════════════════════════════════

function openOwnedProject(projectId) {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }
  STATE.selectedProject = projectId;
  STATE.workspaceMode = "owned";
  STATE.ownedWorkspaceTab = "overview";
  STATE.summaryProjectId = null;
  STATE.workspaceBackPage = STATE.ownedProjectsView || "my-projects";
  navigate("project-workspace");
}

function renderOwnedProjectWorkspace() {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  const root = document.getElementById("page-project-workspace");
  if (!root) return;

  if (!project) {
    root.innerHTML = '<div class="card">Project not found.</div>';
    return;
  }

  STATE.ownedProjectsView = "project-workspace";
  const tab = STATE.ownedWorkspaceTab || "overview";
  const data = getOwnedWorkspaceDataset(project);

  root.innerHTML = `
    <div style="max-width:980px;margin:0 auto;display:flex;flex-direction:column;gap:12px">
      <div class="component" onclick="navigate('my-projects')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12.6673 8H3.33398" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="text">Back</div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap">
          <div style="flex:1;min-width:320px">
            <div class="flex items-center gap-2 mb-2">
              <h1>${project.name}</h1>
              <span class="badge badge-secondary">Owner</span>
            </div>
            <p class="text-muted" style="max-width:840px;line-height:1.45">${project.desc}</p>
            <div class="project-skills" style="margin-top:12px">
              ${(Array.isArray(project.skills) ? project.skills : []).map((s) => `<span class="skill-tag">${s}</span>`).join("")}
            </div>
            <p class="text-muted" style="margin-top:10px;font-size:.95rem">
              Owned by <span class="font-semibold" style="color:var(--fg)">${project.owner || "Unknown"}</span> · ${data.members.length} members
            </p>
          </div>
          <div style="min-width:260px">
            <div class="progress-info" style="margin-bottom:6px"><span>Progress</span><span class="font-bold" style="font-size:20 px;color:var(--fg)">${data.progress}%</span></div>
            <div class="progress-container" style="height:10px"><div class="progress-fill" style="width:${data.progress}%"></div></div>
            
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between" style="gap:10px;flex-wrap:wrap">
        <div class="tabs" style="margin-bottom:0">
          <button class="tab ${tab === "overview" ? "active" : ""}" onclick="setOwnedWorkspaceTab('overview')">Overview</button>
          <button class="tab ${tab === "tasks" ? "active" : ""}" onclick="setOwnedWorkspaceTab('tasks')">Tasks</button>
          <button class="tab ${tab === "members" ? "active" : ""}" onclick="setOwnedWorkspaceTab('members')">Members</button>
          <button class="tab ${tab === "mentors" ? "active" : ""}" onclick="setOwnedWorkspaceTab('mentors')">Mentors</button>
          <button class="tab ${tab === "chat" ? "active" : ""}" onclick="setOwnedWorkspaceTab('chat')">Chat</button>
        </div>
        <button class="btn btn-outline" onclick="requestOwnedMentor('${project.name}')">🛡️ Request Mentor</button>
      </div>

      ${renderOwnedWorkspaceTabContent(project, data, tab)}
    </div>
  `;
}

function setOwnedWorkspaceTab(tab) {
  STATE.ownedWorkspaceTab = tab;
  renderOwnedProjectWorkspace();
}

function requestOwnedMentor(projectName) {
  showToast(`Mentor request sent for ${projectName}`);
}

function sendOwnedChatMessage(projectName) {
  const input = document.getElementById("owned-chat-input");
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) {
    showToast("Type a message first", "error");
    return;
  }
  if (msg.length > 500) {
    showToast("Message must be 500 characters or fewer", "error");
    return;
  }

  const project =
    PROJECTS.find((p) => p.id === STATE.selectedProject) ||
    PROJECTS.find((p) => p.name === projectName);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }

  const data = getOwnedWorkspaceDataset(project);
  const chat = getOwnedWorkspaceChat(project, data);
  chat.push({
    sender: getCurrentUserName(),
    text: msg,
    time: formatCurrentTime(),
  });

  showToast(`Message sent in ${projectName}`);
  input.value = "";
  renderOwnedProjectWorkspace();
}

function openOwnedTaskModal() {
  STATE.ownedTaskModalOpen = true;
  renderOwnedProjectWorkspace();
}

function closeOwnedTaskModal(event) {
  if (event && event.target && event.target !== event.currentTarget) return;
  STATE.ownedTaskModalOpen = false;
  renderOwnedProjectWorkspace();
}

// ── Kanban drag & drop + slide-over task detail ─────────────────────────────
function onKanbanDragStart(event, taskIndex) {
  try {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(taskIndex));
  } catch (e) {}
  event.currentTarget && event.currentTarget.classList.add("dragging");
}
function onKanbanDragEnd(event) {
  event.currentTarget && event.currentTarget.classList.remove("dragging");
  document.querySelectorAll(".kanban-column.drag-over").forEach(el => el.classList.remove("drag-over"));
}
function onKanbanDragOver(event) {
  event.preventDefault();
  try { event.dataTransfer.dropEffect = "move"; } catch (e) {}
  const col = event.currentTarget;
  if (col && !col.classList.contains("drag-over")) col.classList.add("drag-over");
}
function onKanbanDragLeave(event) {
  const col = event.currentTarget;
  if (col && !col.contains(event.relatedTarget)) col.classList.remove("drag-over");
}
function onKanbanDrop(event, colKey) {
  event.preventDefault();
  const col = event.currentTarget;
  col && col.classList.remove("drag-over");
  const raw = event.dataTransfer ? event.dataTransfer.getData("text/plain") : "";
  const idx = parseInt(raw, 10);
  if (Number.isNaN(idx)) return;
  const statusForKey = { todo: "Open", progress: "In Progress", review: "In Review", done: "Approved" };
  moveOwnedTask(idx, statusForKey[colKey] || "Open");
}
function moveOwnedTask(taskIndex, newStatus) {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) return;
  const data = getOwnedWorkspaceDataset(project);
  const runtime = getOwnedProjectRuntimeState(project, data.members, data.tasks);
  if (!runtime.tasks[taskIndex]) return;
  const prev = runtime.tasks[taskIndex].status;
  if (prev === newStatus) return;
  runtime.tasks[taskIndex].status = newStatus;
  showToast(`Moved "${runtime.tasks[taskIndex].title}" to ${newStatus}`);
  renderOwnedProjectWorkspace();
}
function openOwnedTaskDetail(taskIndex) {
  STATE.ownedTaskDetailIndex = taskIndex;
  renderOwnedProjectWorkspace();
}
function closeOwnedTaskDetail(event) {
  if (event && event.target && event.currentTarget && event.target !== event.currentTarget) return;
  STATE.ownedTaskDetailIndex = null;
  renderOwnedProjectWorkspace();
}

function getOwnedProjectRuntimeState(project, seedMembers, seedTasks) {
  if (!STATE.ownedProjectData || typeof STATE.ownedProjectData !== "object") {
    STATE.ownedProjectData = {};
  }

  const projectId = project.id;
  if (!STATE.ownedProjectData[projectId]) {
    STATE.ownedProjectData[projectId] = {
      members: seedMembers.map((m) => ({ ...m })),
      tasks: seedTasks.map((t) => ({ ...t })),
    };
  }

  const entry = STATE.ownedProjectData[projectId];
  if (!Array.isArray(entry.members) || !entry.members.length) {
    entry.members = seedMembers.map((m) => ({ ...m }));
  }
  if (!Array.isArray(entry.tasks) || !entry.tasks.length) {
    entry.tasks = seedTasks.map((t) => ({ ...t }));
  }

  return entry;
}

function inviteOwnedTaskMember() {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }

  const emailInput = document.getElementById("owned-task-invite-email");
  const assigneeSelect = document.getElementById("owned-task-assignee");
  if (!emailInput || !assigneeSelect) return;

  const email = emailInput.value.trim().toLowerCase();
  if (!email) {
    showToast("Email is required", "error");
    return;
  }
  if (email.length > 320 || !BASIC_EMAIL_RE.test(email)) {
    showToast("Enter a valid email address", "error");
    return;
  }

  const displayName = email
    .split("@")[0]
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/[._-]+/g, " ")
    .trim();
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "NM";

  const data = getOwnedWorkspaceDataset(project);
  const runtime = getOwnedProjectRuntimeState(
    project,
    data.members,
    data.tasks,
  );

  const duplicate = runtime.members.some(
    (m) => (m.email || "").toLowerCase() === email.toLowerCase(),
  );
  if (duplicate) {
    showToast("Member already invited", "error");
    return;
  }

  runtime.members.push({
    name: displayName || "New Member",
    role: "Collaborator",
    initials,
    email,
  });

  const option = document.createElement("option");
  option.value = displayName || email;
  option.textContent = `${displayName || email} (Invited)`;
  assigneeSelect.appendChild(option);
  assigneeSelect.value = option.value;

  emailInput.value = "";
  showToast(`Invite sent to ${email}`);
}

async function createOwnedTask() {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }

  const taskNameInput = document.getElementById("owned-task-name");
  const taskDescInput = document.getElementById("owned-task-desc");
  const taskPriorityInput = document.getElementById("owned-task-priority");
  const taskDeadlineInput = document.getElementById("owned-task-deadline");
  const taskAssigneeInput = document.getElementById("owned-task-assignee");

  if (
    !taskNameInput ||
    !taskDescInput ||
    !taskPriorityInput ||
    !taskDeadlineInput ||
    !taskAssigneeInput
  ) {
    showToast("Task form is not available", "error");
    return;
  }

  const taskName = taskNameInput.value.trim();
  if (!taskName) {
    showToast("Task name is required", "error");
    return;
  }
  if (taskName.length < 3 || taskName.length > 100) {
    showToast("Task name must be 3 to 100 characters", "error");
    return;
  }
  if (!/[a-zA-Z0-9]/.test(taskName)) {
    showToast("Task name must include letters or numbers", "error");
    return;
  }

  const description = taskDescInput.value.trim();
  if (description.length > 500) {
    showToast("Task description must be 500 characters or fewer", "error");
    return;
  }

  const priority = taskPriorityInput.value || "Medium";
  const allowedPriorities = new Set(["Low", "Medium", "High"]);
  if (!allowedPriorities.has(priority)) {
    showToast("Choose a valid task priority", "error");
    return;
  }

  const dueInput = taskDeadlineInput.value.trim();
  if (dueInput.length > 60) {
    showToast("Deadline is too long", "error");
    return;
  }
  const due = dueInput || "No deadline";
  if (dueInput && Number.isNaN(Date.parse(dueInput))) {
    showToast("Enter a valid deadline date", "error");
    return;
  }

  const assignee = taskAssigneeInput.value.trim() || "Unassigned";
  const data = getOwnedWorkspaceDataset(project);
  const runtime = getOwnedProjectRuntimeState(
    project,
    data.members,
    data.tasks,
  );
  if (
    assignee !== "Unassigned" &&
    !runtime.members.some((member) => member.name === assignee)
  ) {
    showToast("Selected assignee is not in project members", "error");
    return;
  }

  try {
    if (window.tasksApi) {
      await window.tasksApi.create({
        projectId: project.id,
        title: taskName,
        description,
        assignedTo: assignee === "Unassigned" ? "" : assignee,
        due,
        priority
      });
    }
  } catch (error) {
    console.warn("Backend unavailable for tasks, falling back to local state.", error);
  }

  runtime.tasks.unshift({
    title: taskName,
    status: "Open",
    assignee,
    due,
    priority,
    description,
  });

  STATE.ownedTaskModalOpen = false;
  showToast(`Task \"${taskName}\" created`);
  renderOwnedProjectWorkspace();
}

function getOwnedWorkspaceDataset(project) {
  const progress = Number.isFinite(Number(project.progress))
    ? Number(project.progress)
    : 0;
  const targetTasks = Number.isFinite(Number(project.tasks))
    ? Number(project.tasks)
    : 5;
  const fallbackCompleted = Number.isFinite(Number(project.completedTasks))
    ? Number(project.completedTasks)
    : Math.max(1, Math.round((progress / 100) * targetTasks));
  const fallbackInProgress = Math.max(
    0,
    Math.min(2, targetTasks - fallbackCompleted),
  );
  const fallbackInReview = Math.max(
    0,
    targetTasks - fallbackCompleted - fallbackInProgress > 0 ? 1 : 0,
  );

  const members =
    Array.isArray(project.members) && project.members.length
      ? project.members
      : [
          {
            name: project.owner || "Project Owner",
            role: "Owner",
            initials: "PO",
          },
        ];

  const mentors = (MENTORS_DATA || []).slice(0, 3).map((m) => ({
    name: m.name,
    title: m.title,
    expertise: (m.skills || []).slice(0, 2).join(", "),
  }));

  const tasks = [
    {
      title: "Design system setup",
      status: fallbackCompleted > 0 ? "Approved" : "Open",
      assignee: members[0]?.name || "Unassigned",
      due: "Mar 28",
    },
    {
      title: "API integration",
      status: fallbackInReview > 0 ? "In Review" : "Open",
      assignee: members[1]?.name || members[0]?.name || "Unassigned",
      due: "Apr 02",
    },
    {
      title: "Task board automation",
      status: fallbackInProgress > 0 ? "In Progress" : "Open",
      assignee: members[2]?.name || members[0]?.name || "Unassigned",
      due: "Apr 05",
    },
    {
      title: "QA and deployment",
      status: "Open",
      assignee: "Unassigned",
      due: "Apr 10",
    },
    {
      title: "Documentation",
      status: fallbackCompleted > 1 ? "Approved" : "Open",
      assignee: members[0]?.name || "Unassigned",
      due: "Apr 12",
    },
  ].slice(0, targetTasks);

  const runtime = getOwnedProjectRuntimeState(project, members, tasks);
  const runtimeTasks = runtime.tasks;
  const runtimeMembers = runtime.members;

  const totalTasks = runtimeTasks.length;
  const completed = runtimeTasks.filter((t) => t.status === "Approved").length;
  const inProgress = runtimeTasks.filter(
    (t) => t.status === "In Progress",
  ).length;
  const inReview = runtimeTasks.filter((t) => t.status === "In Review").length;
  const open = Math.max(0, totalTasks - completed - inProgress - inReview);

  return {
    progress,
    totalTasks,
    completed,
    inProgress,
    inReview,
    open,
    members: runtimeMembers,
    mentors,
    tasks: runtimeTasks,
  };
}

function renderOwnedWorkspaceTabContent(project, data, tab) {
  if (tab === "tasks") {
    const KANBAN_COLUMNS = [
      { key: "todo",     label: "To Do",       statuses: ["Open", "To Do", "Todo"] },
      { key: "progress", label: "In Progress", statuses: ["In Progress"] },
      { key: "review",   label: "In Review",   statuses: ["In Review"] },
      { key: "done",     label: "Done",        statuses: ["Approved", "Done", "Completed"] },
    ];
    const priorityBadge = (p) => {
      const cls = p === "High" ? "badge-warning" : p === "Low" ? "badge-secondary" : "badge-info";
      return `<span class="badge ${cls}">${p || "Medium"}</span>`;
    };
    const initialsOf = (name) => {
      if (!name || name === "Unassigned") return "?";
      return name.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
    };
    const bucketFor = (status) => {
      for (const col of KANBAN_COLUMNS) if (col.statuses.includes(status)) return col.key;
      return "todo";
    };
    const grouped = KANBAN_COLUMNS.reduce((acc, c) => (acc[c.key] = [], acc), {});
    data.tasks.forEach((t, index) => grouped[bucketFor(t.status)].push({ ...t, __index: index }));

    return `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap">
          <div>
            <div class="card-title" style="margin:0">Task Board</div>
            <div class="page-subtitle" style="font-size:.82rem;margin-top:2px">Drag cards between columns to update status</div>
          </div>
          <button class="btn btn-primary" onclick="openOwnedTaskModal()">＋ Create Task</button>
        </div>

        <div class="kanban-board">
          ${KANBAN_COLUMNS.map(col => `
            <div class="kanban-column" data-status="${col.key}"
                 ondragover="onKanbanDragOver(event)"
                 ondragleave="onKanbanDragLeave(event)"
                 ondrop="onKanbanDrop(event, '${col.key}')">
              <div class="kanban-header">
                <span>${col.label}</span>
                <span class="count">${grouped[col.key].length}</span>
              </div>
              <div class="kanban-list">
                ${grouped[col.key].map(t => `
                  <div class="kanban-card"
                       draggable="true"
                       data-index="${t.__index}"
                       ondragstart="onKanbanDragStart(event, ${t.__index})"
                       ondragend="onKanbanDragEnd(event)"
                       onclick="openOwnedTaskDetail(${t.__index})">
                    <div class="kanban-card-header">
                      <div class="kanban-card-title">${escapeHtml(t.title)}</div>
                      ${priorityBadge(t.priority)}
                    </div>
                    ${t.description ? `<div class="kanban-card-desc">${escapeHtml(t.description)}</div>` : ""}
                    <div class="kanban-card-footer">
                      <div class="kanban-card-assignee" title="${escapeHtml(t.assignee || "Unassigned")}">
                        <span class="kanban-avatar">${initialsOf(t.assignee)}</span>
                        <span>${escapeHtml(t.assignee || "Unassigned")}</span>
                      </div>
                      <div class="kanban-card-due">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>${escapeHtml(t.due || "No date")}</span>
                      </div>
                    </div>
                  </div>
                `).join("") || `<div class="kanban-empty">Drop tasks here</div>`}
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <div id="owned-task-detail-overlay" class="task-detail-overlay ${STATE.ownedTaskDetailIndex != null ? "open" : ""}" onclick="closeOwnedTaskDetail(event)"></div>
      <div id="owned-task-detail-panel" class="task-detail-panel ${STATE.ownedTaskDetailIndex != null ? "open" : ""}">
        ${(() => {
          if (STATE.ownedTaskDetailIndex == null) return "";
          const t = data.tasks[STATE.ownedTaskDetailIndex];
          if (!t) return "";
          return `
            <div class="task-detail-header">
              <div>
                <div class="task-detail-title">${escapeHtml(t.title)}</div>
                <div style="margin-top:6px">${priorityBadge(t.priority)}</div>
              </div>
              <button class="task-detail-close" onclick="closeOwnedTaskDetail()" aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="task-detail-section">
              <div class="task-detail-label">Status</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${KANBAN_COLUMNS.map(c => `
                  <button class="tab ${bucketFor(t.status) === c.key ? "active" : ""}" onclick="moveOwnedTask(${STATE.ownedTaskDetailIndex}, '${c.statuses[0]}')">${c.label}</button>
                `).join("")}
              </div>
            </div>
            <div class="task-detail-section">
              <div class="task-detail-label">Assignee</div>
              <div class="task-detail-value">${escapeHtml(t.assignee || "Unassigned")}</div>
            </div>
            <div class="task-detail-section">
              <div class="task-detail-label">Due date</div>
              <div class="task-detail-value">${escapeHtml(t.due || "No date")}</div>
            </div>
            ${t.description ? `
              <div class="task-detail-section">
                <div class="task-detail-label">Description</div>
                <div class="task-detail-value">${escapeHtml(t.description)}</div>
              </div>` : ""}
          `;
        })()}
      </div>

      <div id="owned-task-modal" class="modal-overlay ${STATE.ownedTaskModalOpen ? "open" : ""}" onclick="closeOwnedTaskModal(event)">
        <div class="modal" style="max-width:620px" onclick="event.stopPropagation()">
          <div class="modal-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Create New Task</span>
            <button class="btn btn-ghost btn-sm" onclick="closeOwnedTaskModal()">✕</button>
          </div>
          <p class="page-subtitle" style="margin-bottom:12px">Add a new task to the project.</p>

          <div class="space-y-3">
            <input id="owned-task-name" class="input" placeholder="Task name">
            <textarea id="owned-task-desc" class="input" placeholder="Description (optional)" rows="4" style="resize:vertical"></textarea>

            <div class="flex gap-2" style="flex-wrap:wrap">
              <select id="owned-task-priority" class="input" style="flex:1;min-width:170px">
                <option>Low</option>
                <option selected>Medium</option>
                <option>High</option>
              </select>
              <input id="owned-task-deadline" class="input" placeholder="Deadline (e.g. Mar 30)" style="flex:1;min-width:220px">
            </div>

            <div style="padding-top:4px;border-top:1px solid var(--border)">
              <div class="font-semibold text-sm" style="margin:8px 0">Assign to Member</div>
              <select id="owned-task-assignee" class="input">
                <option value="">Assign to (optional)</option>
                ${data.members
                  .map(
                    (m) =>
                      `<option value="${m.name}">${m.name}${m.role ? ` (${m.role})` : ""}</option>`,
                  )
                  .join("")}
              </select>
            </div>

            <div>
              <div class="font-semibold text-sm" style="margin:8px 0">Or Invite New Member via Email</div>
              <div class="flex gap-2">
                <input id="owned-task-invite-email" class="input" placeholder="colleague@example.com" style="flex:1">
                <button class="btn btn-outline" onclick="inviteOwnedTaskMember()">Invite</button>
              </div>
            </div>
          </div>

          <button class="btn btn-primary btn-full" style="margin-top:14px" onclick="createOwnedTask()">Create Task</button>
        </div>
      </div>
    `;
  }

  if (tab === "members") {
    return `
      <div class="card">
        <div class="card-title">Members</div>
        <div class="space-y-3">
          ${data.members
            .map(
              (m) => `
            <div class="pending-row">
              <div class="flex items-center gap-3">
                <div class="div-h"><div class="text-wrapper-5">${m.initials || "??"}</div></div>
                <div>
                  <div class="font-semibold text-sm">${m.name}</div>
                  <div class="text-xs text-muted">${m.role || "Collaborator"}</div>
                </div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="showToast('Viewing ${m.name}')">View</button>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  if (tab === "mentors") {
    return `
      <div class="card">
        <div class="card-title">Mentors</div>
        ${
          data.mentors.length
            ? `
          <div class="space-y-3">
            ${data.mentors
              .map(
                (m) => `
              <div class="pending-row">
                <div>
                  <div class="font-semibold text-sm">${m.name}</div>
                  <div class="text-xs text-muted">${m.title} · ${m.expertise}</div>
                </div>
                <button class="btn btn-outline btn-sm" onclick="showToast('Mentor ${m.name} assigned')">Assign</button>
              </div>
            `,
              )
              .join("")}
          </div>
        `
            : '<p class="text-sm text-muted italic">No mentors connected yet.</p>'
        }
      </div>
    `;
  }

  if (tab === "chat") {
    const chatMessages = getOwnedWorkspaceChat(project, data);
    return `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px">
          <div class="card-title" style="margin:0">Team Chat</div>
          <div style="display:flex;align-items:center;gap:8px;color:var(--muted-fg);font-size:.82rem">
            <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;background:var(--secondary);border:1px solid var(--border)">● Live</span>
            <span>${chatMessages.length} message${chatMessages.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;max-height:280px;overflow:auto;padding-right:4px">
          ${chatMessages
            .map((msg) => {
              const mine = msg.sender === getCurrentUserName();
              return `
              <div style="align-self:${mine ? "flex-end" : "flex-start"};max-width:74%;padding:10px 12px;border-radius:12px;background:${mine ? "var(--secondary)" : "var(--card-bg)"};border:1px solid var(--border)">
                <div style="font-size:0.75rem;color:var(--muted-fg);margin-bottom:4px">${escapeHtml(msg.sender)} · ${escapeHtml(msg.time || "")}</div>
                <div style="font-size:0.92rem;line-height:1.4">${escapeHtml(msg.text)}</div>
              </div>
            `;
            })
            .join("")}
        </div>
        <div class="flex gap-2">
          <input id="owned-chat-input" class="input" placeholder="Type a message..." style="flex:1" onkeydown="if(event.key==='Enter'){event.preventDefault();sendOwnedChatMessage('${project.name.replace(/'/g, "\\'")}')}") />
          <button class="btn btn-primary" onclick="sendOwnedChatMessage('${project.name.replace(/'/g, "\\'")}')">Send</button>
        </div>
        <div style="margin-top:8px;font-size:.78rem;color:var(--muted-fg)">Press Enter to send quickly.</div>
      </div>
    `;
  }

  return `
    <div class="stat-grid" style="margin-top:0">
      <div class="stat-card"><div class="stat-value">${data.totalTasks}</div><div class="stat-label">Total Tasks</div></div>
      <div class="stat-card"><div class="stat-value text-success">${data.completed}</div><div class="stat-label">Completed</div></div>
      <div class="stat-card"><div class="stat-value text-info">${data.inProgress}</div><div class="stat-label">In Progress</div></div>
      <div class="stat-card"><div class="stat-value text-accent">${Math.max(0, data.members.length - 1)}</div><div class="stat-label">Active Collaborators</div></div>
    </div>
    <div class="card" style="padding:16px">
      <div class="card-title" style="margin-bottom:10px">Task Completion Statistics</div>
      <div class="space-y-3">
        <div class="checkin-row"><span class="badge badge-success">Approved</span><div style="flex:1;margin:0 10px" class="progress-container"><div class="progress-fill" style="width:${Math.min(100, (data.completed / Math.max(1, data.totalTasks)) * 100)}%"></div></div><span>${data.completed}</span></div>
        <div class="checkin-row"><span class="badge badge-warning">In Review</span><div style="flex:1;margin:0 10px" class="progress-container"><div class="progress-fill" style="width:${Math.min(100, (data.inReview / Math.max(1, data.totalTasks)) * 100)}%"></div></div><span>${data.inReview}</span></div>
        <div class="checkin-row"><span class="badge badge-info">In Progress</span><div style="flex:1;margin:0 10px" class="progress-container"><div class="progress-fill" style="width:${Math.min(100, (data.inProgress / Math.max(1, data.totalTasks)) * 100)}%"></div></div><span>${data.inProgress}</span></div>
        <div class="checkin-row"><span class="badge badge-secondary">Open</span><div style="flex:1;margin:0 10px" class="progress-container"><div class="progress-fill" style="width:${Math.min(100, (data.open / Math.max(1, data.totalTasks)) * 100)}%"></div></div><span>${data.open}</span></div>
      </div>
    </div>
  `;
}

function openOwnedSummary(projectId) {
  STATE.summaryProjectId = projectId;
  if (STATE.ownedProjectsView === "my-projects") {
    renderMyProjects();
    return;
  }
  renderOwnedProjectWorkspace();
}

function closeOwnedSummary(event) {
  if (event && event.target && event.target !== event.currentTarget) return;
  STATE.summaryProjectId = null;
  if (STATE.ownedProjectsView === "my-projects") {
    renderMyProjects();
    return;
  }
  renderOwnedProjectWorkspace();
}
