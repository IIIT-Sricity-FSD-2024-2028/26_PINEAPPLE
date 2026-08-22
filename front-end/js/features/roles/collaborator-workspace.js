// ══════════════════════════════════════════════
//   COLLABORATOR WORKSPACE
// ══════════════════════════════════════════════

function openWorkspace(projectId, sourcePage) {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }

  const activePage =
    sourcePage ||
    document.querySelector(".page.active")?.id?.replace("page-", "") ||
    "projects";

  STATE.selectedProject = projectId;
  STATE.workspaceMode = "collaborator";
  STATE.collaboratorWorkspaceTab = "overview";
  STATE.workspaceBackPage =
    activePage === "project-workspace" ? "my-work" : activePage;
  navigate("project-workspace");
}

function openCollaboratorProjectPreview(projectId) {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }

  STATE.selectedProject = projectId;
  STATE.workspaceMode = "collaborator-project-preview";
  STATE.workspaceBackPage = "projects";
  navigate("project-workspace");
}

function applyToPreviewProject(projectId) {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    showToast("Project not found", "error");
    return;
  }

  const currentUser = getCurrentUserName();
  if (project.owner === currentUser) {
    showToast("You already own this project", "error");
    return;
  }

  const currentUserEmail =
    typeof getCurrentUserSessionEmail === "function"
      ? getCurrentUserSessionEmail()
      : "";
  const alreadyApplied = APPLIED.some(
    (a) =>
      a.project === project.name &&
      (a.requester === currentUserEmail ||
        a.invitedEmail === currentUserEmail ||
        a.invitedUser === currentUser),
  );
  if (alreadyApplied) {
    showToast("You already applied to this project", "error");
    return;
  }

  APPLIED.unshift({
    project: project.name,
    owner: project.owner,
    requester: currentUserEmail,
    applied: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    status: "Pending",
  });

  renderApplied();
  showToast(`Application sent for ${project.name}`);
}

function renderCollaboratorProjectPreview() {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  const root = document.getElementById("page-project-workspace");
  if (!root) return;

  if (!project) {
    root.innerHTML = '<div class="card">Project not found.</div>';
    return;
  }

  const members = Array.isArray(project.members) ? project.members : [];
  const progress = Number.isFinite(Number(project.progress))
    ? Number(project.progress)
    : 0;
  const currentUserEmail =
    typeof getCurrentUserSessionEmail === "function"
      ? getCurrentUserSessionEmail()
      : "";
  const currentUserName = getCurrentUserName();
  const alreadyApplied = APPLIED.some(
    (a) =>
      a.project === project.name &&
      (a.requester === currentUserEmail ||
        a.invitedEmail === currentUserEmail ||
        a.invitedUser === currentUserName),
  );
  const isOwner = project.owner === currentUserName;

  const applyLabel = isOwner
    ? "You Own This Project"
    : alreadyApplied
      ? "Applied"
      : "Apply to Join Project";

  root.innerHTML = `
    <div style="max-width:1120px;margin:0 auto;display:flex;flex-direction:column;gap:16px">
      <div class="component" onclick="navigate('projects')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12.6673 8H3.33398" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="text">Back to Projects</div>
      </div>

      <div class="card" style="padding:18px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div style="flex:1;min-width:320px">
            <h1 style="margin:0 0 6px 0;font-size:2.6rem;line-height:1.2">${project.name}</h1>
            <p class="text-muted" style="font-size:0.95rem;margin-bottom:10px">Owned by <span class="font-semibold" style="color:var(--fg)">${project.owner}</span></p>
            <p class="text-muted" style="font-size:0.95rem;line-height:1.45;margin-bottom:12px;max-width:700px">${project.desc}</p>
            <div class="project-skills" style="margin-bottom:10px">
              ${(Array.isArray(project.skills) ? project.skills : []).map((s) => `<span class="skill-tag">${s}</span>`).join("")}
            </div>
          </div>
        </div>

        <div style="margin:4px 0 12px 0;height:1px;background:var(--border)"></div>

        <div style="display:grid;grid-template-columns:minmax(240px,1fr) minmax(300px,1fr);gap:18px;align-items:flex-start">
          <div>
            <div style="font-size:1.1rem;font-weight:700;margin-bottom:8px">Project Progress</div>
            <div style="display:flex;align-items:center;gap:14px">
              <span style="font-size:1.8rem;font-weight:700">${progress}%</span>
              <div class="progress-container" style="height:8px;max-width:280px;width:100%">
                <div class="progress-fill" style="width:${progress}%"></div>
              </div>
            </div>
          </div>

          <div>
            <div style="font-size:1.1rem;font-weight:700;margin-bottom:8px">Team Members (${members.length})</div>
            <div style="display:flex;flex-direction:column;gap:0">
              ${members
                .map(
                  (m) => `
                <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
                  <div style="width:34px;height:34px;border-radius:50%;background:#8b5e34;color:#fff;font-size:0.9rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${m.initials}</div>
                  <div style="font-size:1.05rem;font-weight:600">${m.name}</div>
                  <div style="font-size:0.95rem;color:var(--muted-fg)">· ${m.role}</div>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        </div>

        <button
          class="btn btn-primary"
          ${isOwner || alreadyApplied ? "disabled" : ""}
          onclick="applyToPreviewProject('${project.id}')"
          style="margin-top:14px;width:100%;height:44px;border-radius:10px;background:#6a5a47;border-color:#6a5a47;font-size:1rem"
        >
          ${applyLabel}
        </button>
      </div>
    </div>
  `;
}

function setCollaboratorWorkspaceTab(tab) {
  STATE.collaboratorWorkspaceTab = tab;
  renderProjectWorkspace();
}

function getCollaboratorWorkspaceData(project) {
  const currentUser = getCurrentUserName();
  const projectKey = String(project.id);

  if (!STATE.collaboratorWorkspaceData) {
    STATE.collaboratorWorkspaceData = {};
  }

  if (STATE.collaboratorWorkspaceData[projectKey]) {
    return STATE.collaboratorWorkspaceData[projectKey];
  }

  const primaryMember =
    (Array.isArray(project.members) ? project.members : []).find(
      (m) => m.name !== currentUser,
    )?.name || "Team Member";
  const secondaryMember =
    (Array.isArray(project.members) ? project.members : []).find(
      (m) => m.name !== currentUser && m.name !== primaryMember,
    )?.name || "Unassigned";

  const seededTasks = [
    {
      title: "Set up project structure",
      difficulty: "Easy",
      assigned: `${currentUser} (owner) (you)`,
      deadline: "Mar 10",
      status: "Approved",
      action: "Approved",
    },
    {
      title: "Build authentication module",
      difficulty: "Medium",
      assigned: primaryMember,
      deadline: "Mar 15",
      status: "In Progress",
      action: "In Progress",
    },
    {
      title: "Design dashboard UI",
      difficulty: "Medium",
      assigned: secondaryMember,
      deadline: "Mar 18",
      status: "In Review",
      action: "In Review",
    },
    {
      title: "Implement API integration",
      difficulty: "Hard",
      assigned: `${currentUser} (owner) (you)`,
      deadline: "Mar 22",
      status: "Open",
      action: "Start Work",
    },
    {
      title: "Write unit tests",
      difficulty: "Easy",
      assigned: "Unassigned",
      deadline: "Mar 25",
      status: "Open",
      action: "Open",
    },
  ];

  const seededMessages = [
    {
      sender: project.owner,
      text: `Let's keep momentum on ${project.name}.`,
      time: "10:10 AM",
    },
    {
      sender: currentUser,
      text: "I will pick up API integration next.",
      time: "10:14 AM",
    },
  ];

  STATE.collaboratorWorkspaceData[projectKey] = {
    tasks: seededTasks,
    messages: seededMessages,
  };

  return STATE.collaboratorWorkspaceData[projectKey];
}

function collaboratorDifficultyPill(level) {
  if (level === "Hard") {
    return '<span class="badge badge-destructive" style="background:rgba(239,68,68,.1);color:var(--destructive)">Hard</span>';
  }
  if (level === "Medium") {
    return '<span class="badge badge-warning" style="background:rgba(245,158,11,.12);color:#e8a414">Medium</span>';
  }
  return '<span class="badge badge-success" style="background:rgba(34,197,94,.12);color:var(--success)">Easy</span>';
}

function collaboratorStatusPill(status) {
  if (status === "Approved") {
    return '<span class="badge badge-success" style="background:rgba(34,197,94,.12);color:var(--success)">Approved</span>';
  }
  if (status === "In Progress") {
    return '<span class="badge badge-info" style="background:rgba(59,130,246,.12);color:#3569c6">In Progress</span>';
  }
  if (status === "In Review") {
    return '<span class="badge badge-warning" style="background:rgba(245,158,11,.12);color:#e8a414">In Review</span>';
  }
  return '<span class="badge badge-secondary">Open</span>';
}

async function startCollaboratorTask(taskIndex) {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) return;

  const data = getCollaboratorWorkspaceData(project);
  const idx = Number(taskIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= data.tasks.length) return;

  const task = data.tasks[idx];
  try {
    if (window.tasksApi && task.id) {
      await window.tasksApi.update(task.id, { status: "In Progress" });
    }
  } catch (error) {
    console.warn("Backend unavailable, falling back to local task state.");
  }

  task.status = "In Progress";
  task.action = "Submit";
  showToast(`Started: ${task.title}`);
  STATE.collaboratorWorkspaceTab = "tasks";
  renderProjectWorkspace();
}

function openCollaboratorSubmitModal(taskIndex) {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) return;

  const data = getCollaboratorWorkspaceData(project);
  const idx = Number(taskIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= data.tasks.length) return;

  STATE.collaboratorProofModalOpen = true;
  STATE.collaboratorProofTaskIndex = idx;
  STATE.collaboratorProofLink = "";
  renderProjectWorkspace();
}

function closeCollaboratorSubmitModal(e) {
  if (e && e.target && e.currentTarget && e.target !== e.currentTarget) return;
  STATE.collaboratorProofModalOpen = false;
  STATE.collaboratorProofTaskIndex = null;
  STATE.collaboratorProofLink = "";
  renderProjectWorkspace();
}

function updateCollaboratorProofLink(value) {
  STATE.collaboratorProofLink = value;
}

async function submitCollaboratorProof() {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) return;

  const data = getCollaboratorWorkspaceData(project);
  const idx = Number(STATE.collaboratorProofTaskIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= data.tasks.length) {
    showToast("Task not found", "error");
    return;
  }

  const input = document.getElementById("collab-proof-link");
  const proofLink = (input?.value || STATE.collaboratorProofLink || "").trim();
  if (!proofLink) {
    showToast("Proof link is required", "error");
    return;
  }
  if (!isValidWebUrl(proofLink)) {
    showToast("Please enter a valid proof link", "error");
    return;
  }

  const task = data.tasks[idx];
  try {
    if (window.tasksApi && task.id) {
      await window.tasksApi.update(task.id, { status: "In Review" });
    }
  } catch (error) {
    console.warn("Backend unavailable, falling back to local task state.");
  }

  task.proofLink = proofLink;
  task.status = "In Review";
  task.action = "In Review";

  STATE.collaboratorProofModalOpen = false;
  STATE.collaboratorProofTaskIndex = null;
  STATE.collaboratorProofLink = "";

  showToast(`Submitted for review: ${task.title}`);
  renderProjectWorkspace();
}

function sendCollaboratorChatMessage() {
  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) return;

  const input = document.getElementById("collab-chat-input");
  const text = input?.value?.trim();
  if (!text) {
    showToast("Type a message first", "error");
    return;
  }
  if (text.length > 500) {
    showToast("Message must be 500 characters or fewer", "error");
    return;
  }

  const data = getCollaboratorWorkspaceData(project);
  const now = new Date();
  const hh = String(now.getHours() % 12 || 12).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() >= 12 ? "PM" : "AM";

  data.messages.push({
    sender: getCurrentUserName(),
    text,
    time: `${hh}:${mm} ${ampm}`,
  });

  input.value = "";
  renderProjectWorkspace();
}

function renderProjectWorkspace() {
  if (STATE.workspaceMode === "owned") {
    renderOwnedProjectWorkspace();
    return;
  }

  if (STATE.workspaceMode === "collaborator-project-preview") {
    renderCollaboratorProjectPreview();
    return;
  }

  const project = PROJECTS.find((p) => p.id === STATE.selectedProject);
  if (!project) {
    document.getElementById("page-project-workspace").innerHTML =
      '<div class="card">Project not found.</div>';
    return;
  }

  const currentUser = getCurrentUserName();
  const tab = STATE.collaboratorWorkspaceTab || "overview";
  const members = Array.isArray(project.members) ? project.members : [];
  const workspaceData = getCollaboratorWorkspaceData(project);
  const tasks = Array.isArray(workspaceData.tasks) ? workspaceData.tasks : [];
  const isProofModalOpen = Boolean(STATE.collaboratorProofModalOpen);
  const proofTaskIndex = Number(STATE.collaboratorProofTaskIndex);
  const proofTask =
    Number.isInteger(proofTaskIndex) &&
    proofTaskIndex >= 0 &&
    proofTaskIndex < tasks.length
      ? tasks[proofTaskIndex]
      : null;

  const totalTasks = tasks.length;
  const completedCount = tasks.filter((t) => t.status === "Approved").length;
  const inProgressCount = tasks.filter(
    (t) => t.status === "In Progress",
  ).length;
  const userAssignedTasks = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => String(task.assigned).includes(currentUser));

  const backPage =
    STATE.workspaceBackPage ||
    (STATE.role === "mentor" ? "mentored-projects" : "my-projects");

  let tabContent = "";

  if (tab === "overview") {
    tabContent = `
      <div style="display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:16px;margin-bottom:16px">
        <div class="card" style="padding:16px;text-align:center">
          <div style="font-size:2rem;font-weight:700;line-height:1.1">${totalTasks}</div>
          <div style="font-size:0.95rem;color:var(--muted-fg)">Total Tasks</div>
        </div>
        <div class="card" style="padding:16px;text-align:center">
          <div style="font-size:2rem;font-weight:700;color:var(--success);line-height:1.1">${completedCount}</div>
          <div style="font-size:0.95rem;color:var(--muted-fg)">Completed</div>
        </div>
        <div class="card" style="padding:16px;text-align:center">
          <div style="font-size:2rem;font-weight:700;color:#3569c6;line-height:1.1">${inProgressCount}</div>
          <div style="font-size:0.95rem;color:var(--muted-fg)">In Progress</div>
        </div>
      </div>

      <div class="card" style="padding:16px">
        <div style="font-size:1.55rem;font-weight:700;margin-bottom:12px">Your Assigned Tasks</div>
        ${
          userAssignedTasks.length
            ? userAssignedTasks
                .map(({ task, index }, idx) => {
                  const actionHtml =
                    task.action === "Start Work"
                      ? `<button class="btn btn-outline btn-sm" onclick="startCollaboratorTask(${index})">▷ Start Work</button>`
                      : task.action === "Submit"
                        ? `<button class="btn btn-outline btn-sm" onclick="openCollaboratorSubmitModal(${index})">✈ Submit</button>`
                        : task.action === "Approved"
                          ? '<span style="font-size:0.95rem;color:var(--success)">✓ Approved</span>'
                          : collaboratorStatusPill(task.action);

                  return `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--secondary);margin-bottom:${idx === userAssignedTasks.length - 1 ? 0 : 10}px">
                      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                        <span style="font-size:1rem;font-weight:600">${task.title}</span>
                        ${collaboratorDifficultyPill(task.difficulty)}
                      </div>
                      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end">
                        ${collaboratorStatusPill(task.status)}
                        ${actionHtml}
                      </div>
                    </div>
                    `;
                })
                .join("")
            : '<p class="text-sm text-muted">No tasks assigned to you yet.</p>'
        }
      </div>
    `;
  } else if (tab === "tasks") {
    tabContent = `
      <div class="card" style="padding:0;overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:920px">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">Task</th>
              <th style="text-align:left;padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">Difficulty</th>
              <th style="text-align:left;padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">Assigned</th>
              <th style="text-align:left;padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">Deadline</th>
              <th style="text-align:left;padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">Status</th>
              <th style="text-align:left;padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tasks
              .map((task, idx) => {
                const actionHtml =
                  task.action === "Start Work"
                    ? `<button class="btn btn-outline btn-sm" onclick="startCollaboratorTask(${idx})">▷ Start Work</button>`
                    : task.action === "Submit"
                      ? `<button class="btn btn-outline btn-sm" onclick="openCollaboratorSubmitModal(${idx})">✈ Submit</button>`
                      : task.action === "Approved"
                        ? '<span style="font-size:0.95rem;color:var(--success)">✓Approved</span>'
                        : collaboratorStatusPill(task.action);

                return `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:14px 16px;font-size:1rem;font-weight:600">${task.title}</td>
                  <td style="padding:14px 16px">${collaboratorDifficultyPill(task.difficulty)}</td>
                  <td style="padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">${task.assigned}</td>
                  <td style="padding:14px 16px;font-size:0.95rem;color:var(--muted-fg)">${task.deadline}</td>
                  <td style="padding:14px 16px">${collaboratorStatusPill(task.status)}</td>
                  <td style="padding:14px 16px">${actionHtml}</td>
                </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  } else if (tab === "members") {
    tabContent = `
      <div class="card" style="padding:16px">
        <div style="font-size:1.1rem;font-weight:700;margin-bottom:12px">Team Members</div>
        ${members
          .map(
            (m) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="width:34px;height:34px;border-radius:50%;background:var(--secondary);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700">${m.initials}</div>
            <div style="font-size:0.95rem;font-weight:600">${m.name}</div>
            <div style="font-size:0.85rem;color:var(--muted-fg)">· ${m.role}</div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  } else {
    const chatMessages = Array.isArray(workspaceData.messages)
      ? workspaceData.messages
      : [];
    tabContent = `
      <div class="card" style="padding:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px">
          <div style="font-size:1.1rem;font-weight:700">Project Chat</div>
          <div style="display:flex;align-items:center;gap:8px;color:var(--muted-fg);font-size:.82rem">
            <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;background:var(--secondary);border:1px solid var(--border)">● Live</span>
            <span>${chatMessages.length} message${chatMessages.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;max-height:280px;overflow:auto;padding-right:4px">
          ${
            chatMessages.length
              ? chatMessages
                  .map((msg) => {
                    const mine = msg.sender === currentUser;
                    return `
              <div style="align-self:${mine ? "flex-end" : "flex-start"};max-width:74%;padding:10px 12px;border-radius:12px;background:${mine ? "var(--secondary)" : "var(--card-bg)"};border:1px solid var(--border)">
                <div style="font-size:0.75rem;color:var(--muted-fg);margin-bottom:4px">${escapeHtml(msg.sender)} · ${escapeHtml(msg.time || "")}</div>
                <div style="font-size:0.92rem;line-height:1.4">${escapeHtml(msg.text)}</div>
              </div>
            `;
                  })
                  .join("")
              : '<div style="padding:14px;border:1px dashed var(--border);border-radius:10px;color:var(--muted-fg);font-size:0.9rem">No messages yet. Start the conversation with your team.</div>'
          }
        </div>
        <div style="display:flex;gap:10px">
          <input id="collab-chat-input" type="text" placeholder="Type a message..." style="flex:1;border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--card-bg)" onkeydown="if(event.key==='Enter'){event.preventDefault();sendCollaboratorChatMessage()}" />
          <button class="btn btn-primary" onclick="sendCollaboratorChatMessage()">Send</button>
        </div>
        <div style="margin-top:8px;font-size:.78rem;color:var(--muted-fg)">Press Enter to send quickly.</div>
      </div>
    `;
  }

  const ownedBackPage = STATE.workspaceBackPage || "my-projects";

  document.getElementById("page-project-workspace").innerHTML = `
    <div style="max-width:100%;margin:0 auto;display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;align-items:center;gap:8px;cursor:pointer;color:var(--muted-fg)" onclick="navigate('${ownedBackPage}')">
        <span style="font-size:1rem">←</span>
        <span style="font-size:0.95rem">Back</span>
      </div>

      <div class="card" style="padding:20px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap">
          <div style="flex:1;min-width:320px">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
              <h2 style="font-size:2.5rem;font-weight:700;line-height:1.1;margin:0">${project.name}</h2>
              <span class="badge badge-secondary">Collaborator</span>
            </div>
            <p style="margin:0 0 10px;color:var(--muted-fg);font-size:0.95rem;line-height:1.45">${project.desc}</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
              ${(Array.isArray(project.skills) ? project.skills : [])
                .map((s) => `<span class="skill-tag">${s}</span>`)
                .join("")}
            </div>
            <div style="font-size:0.9rem;color:var(--muted-fg)">
              Owned by <span style="color:var(--fg);font-weight:600">${project.owner}</span>
              <span style="padding:0 8px">·</span>
              ${members.length} members
              <span style="padding:0 8px">·</span>
              You are <span style="color:var(--fg);font-weight:600">${currentUser}</span>
            </div>
          </div>

          <div style="min-width:220px;display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-start">
            <div style="font-size:1rem;color:var(--muted-fg);margin-bottom:2px">Progress</div>
            <div style="font-size:2.2rem;font-weight:700;margin-bottom:8px">${Number(project.progress) || 0}%</div>
            <div class="progress-container" style="width:180px;height:8px">
              <div class="progress-fill" style="width:${Number(project.progress) || 0}%"></div>
            </div>
          </div>
        </div>
      </div>

      <div style="display:inline-flex;align-items:center;gap:4px;padding:6px;background:rgba(15,23,42,.06);border:1px solid rgba(15,23,42,.08);border-radius:12px;width:fit-content">
        <button
          onclick="setCollaboratorWorkspaceTab('overview')"
          style="height:36px;padding:0 16px;border-radius:9px;border:${tab === "overview" ? "1px solid rgba(15,23,42,.08)" : "1px solid transparent"};background:${tab === "overview" ? "#ffffff" : "transparent"};color:${tab === "overview" ? "#111827" : "#6b7280"};font-size:0.95rem;font-weight:${tab === "overview" ? "600" : "500"};cursor:pointer;box-shadow:${tab === "overview" ? "0 1px 2px rgba(0,0,0,.08)" : "none"}">
          Overview
        </button>
        <button
          onclick="setCollaboratorWorkspaceTab('tasks')"
          style="height:36px;padding:0 16px;border-radius:9px;border:${tab === "tasks" ? "1px solid rgba(15,23,42,.08)" : "1px solid transparent"};background:${tab === "tasks" ? "#ffffff" : "transparent"};color:${tab === "tasks" ? "#111827" : "#6b7280"};font-size:0.95rem;font-weight:${tab === "tasks" ? "600" : "500"};cursor:pointer;box-shadow:${tab === "tasks" ? "0 1px 2px rgba(0,0,0,.08)" : "none"}">
          Tasks
        </button>
        <button
          onclick="setCollaboratorWorkspaceTab('members')"
          style="height:36px;padding:0 16px;border-radius:9px;border:${tab === "members" ? "1px solid rgba(15,23,42,.08)" : "1px solid transparent"};background:${tab === "members" ? "#ffffff" : "transparent"};color:${tab === "members" ? "#111827" : "#6b7280"};font-size:0.95rem;font-weight:${tab === "members" ? "600" : "500"};cursor:pointer;box-shadow:${tab === "members" ? "0 1px 2px rgba(0,0,0,.08)" : "none"}">
          Members
        </button>
        <button
          onclick="setCollaboratorWorkspaceTab('chat')"
          style="height:36px;padding:0 16px;border-radius:9px;border:${tab === "chat" ? "1px solid rgba(15,23,42,.08)" : "1px solid transparent"};background:${tab === "chat" ? "#ffffff" : "transparent"};color:${tab === "chat" ? "#111827" : "#6b7280"};font-size:0.95rem;font-weight:${tab === "chat" ? "600" : "500"};cursor:pointer;box-shadow:${tab === "chat" ? "0 1px 2px rgba(0,0,0,.08)" : "none"}">
          Chat
        </button>
      </div>

      ${tabContent}

      <div id="collab-submit-modal" class="modal-overlay ${isProofModalOpen ? "open" : ""}" onclick="closeCollaboratorSubmitModal(event)">
        <div class="modal-box" onclick="event.stopPropagation()" style="max-width:560px">
          <div class="modal-header" style="align-items:flex-start">
            <div>
              <h3 class="modal-title" style="margin-bottom:2px">Submit Proof of Work</h3>
              <div style="font-size:0.95rem;color:var(--muted-fg)">
                Paste a link to your proof (GitHub PR, Figma, Google Doc, etc.) before submitting for review.
              </div>
            </div>
            <button class="modal-close" onclick="closeCollaboratorSubmitModal()">✕</button>
          </div>
          <div class="modal-body" style="padding-top:0">
            <div style="font-size:0.85rem;color:var(--muted-fg);margin-bottom:8px">${proofTask ? proofTask.title : "Selected task"}</div>
            <input
              id="collab-proof-link"
              type="url"
              placeholder="https://github.com/..."
              value="${STATE.collaboratorProofLink || ""}"
              oninput="updateCollaboratorProofLink(this.value)"
              style="width:100%;height:52px;border:2px solid #6a5a47;border-radius:14px;padding:0 14px;font-size:0.95rem;outline:none;background:var(--card-bg);margin-bottom:14px"
            />
            <button class="btn" onclick="submitCollaboratorProof()" style="width:100%;height:44px;border-radius:12px;background:#6a5a47;color:#fff;border:1px solid #6a5a47;font-weight:600">
              ✈ Submit for Review
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
