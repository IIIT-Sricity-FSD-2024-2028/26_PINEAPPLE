// ══════════════════════════════════════════════
//   MY PROJECTS (owner)
// ══════════════════════════════════════════════
function renderMyProjects() {
  STATE.ownedProjectsView = "my-projects";
  renderOwnedProjectsPanel("page-my-projects", false);
}

function renderOwnedProjectsPanel(targetPageId, showBackLink) {
  const root = document.getElementById(targetPageId);
  if (!root) return;

  const currentOwner = getCurrentUserName();
  const ownedProjects = PROJECTS.filter((p) => p.owner === currentOwner).map(
    (p) => {
      const progress = Number.isFinite(Number(p.progress))
        ? Number(p.progress)
        : 0;
      const totalTasks = Number.isFinite(Number(p.tasks)) ? Number(p.tasks) : 5;
      const completedTasks = Number.isFinite(Number(p.completedTasks))
        ? Number(p.completedTasks)
        : Math.round((progress / 100) * totalTasks);
      const isCompleted = Boolean(p.isCompleted) || progress >= 100;
      const members = Number.isFinite(Number(p.collaborators))
        ? Number(p.collaborators)
        : Array.isArray(p.members)
          ? p.members.length
          : 0;
      const totalXp = Number.isFinite(Number(p.totalXp))
        ? Number(p.totalXp)
        : completedTasks * 20;
      const repGained = Number.isFinite(Number(p.repGained))
        ? Number(p.repGained)
        : Math.round(totalXp / 25);

      return {
        ...p,
        progress,
        totalTasks,
        completedTasks,
        isCompleted,
        members,
        totalXp,
        repGained,
        duration: p.duration || "Ongoing",
        highlights:
          Array.isArray(p.highlights) && p.highlights.length
            ? p.highlights
            : isCompleted
              ? [
                  `All ${completedTasks}/${totalTasks} tasks completed`,
                  `${members} members collaborated successfully`,
                  "Project archived after successful completion",
                ]
              : [],
      };
    },
  );

  const activeProjects = ownedProjects.filter((p) => !p.isCompleted);
  const completedProjects = ownedProjects.filter((p) => p.isCompleted);
  const summaryProject = ownedProjects.find(
    (p) => p.id === STATE.summaryProjectId,
  );

  root.innerHTML = `
    <div style="max-width:980px;margin:0 auto;display:flex;flex-direction:column;gap:16px">
      ${
        showBackLink
          ? `
      <div class="component" onclick="navigate('my-projects')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12.6673 8H3.33398" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="text">Back to My Projects</div>
      </div>
      `
          : ""
      }

      <div>
        <h1>My Projects</h1>
        <p class="page-subtitle">Projects you own and manage.</p>
      </div>

      <div class="card">
        <div class="card-title">📂 Active (${activeProjects.length})</div>
        ${
          activeProjects.length
            ? activeProjects
                .map(
                  (p) => `
              <div class="project-card" style="margin-bottom:12px" onclick="openOwnedProject('${p.id}')">
                <h3 class="project-title">${p.name}</h3>
                <p class="project-desc">${p.completedTasks}/${p.totalTasks} tasks completed · ${p.members} members · ${p.duration}</p>
                <div class="progress-info"><span class="text-sm">Progress</span><span>${p.progress}%</span></div>
                <div class="progress-container"><div class="progress-fill" style="width:${p.progress}%"></div></div>
                <div class="project-skills" style="margin-top:10px">
                  ${(Array.isArray(p.skills) ? p.skills : []).map((s) => `<span class="skill-tag">${s}</span>`).join("")}
                </div>
              </div>
            `,
                )
                .join("")
            : '<p class="text-sm text-muted italic">No active owned projects yet.</p>'
        }
      </div>

      <div class="card">
        <div class="card-title">📦 Completed (${completedProjects.length})</div>
        ${
          completedProjects.length
            ? completedProjects
                .map(
                  (p) => `
              <div class="project-card" style="margin-bottom:12px;opacity:.95;cursor:default">
                <div class="flex items-center justify-between" style="margin-bottom:8px">
                  <div>
                    <h3 class="project-title">${p.name}</h3>
                    <p class="project-desc">${p.completedTasks}/${p.totalTasks} tasks · ${p.members} members · ${p.duration}</p>
                  </div>
                  <span class="badge badge-success">✅ Completed</span>
                </div>
                <div class="progress-container"><div class="progress-fill" style="width:100%"></div></div>
                <div class="project-skills" style="margin-top:10px">
                  ${(Array.isArray(p.skills) ? p.skills : []).map((s) => `<span class="skill-tag">${s}</span>`).join("")}
                </div>
                <div class="flex gap-2 mt-2">
                  <button class="btn btn-outline btn-sm" onclick="openOwnedSummary('${p.id}')">🏆 View Summary</button>
                  <button class="btn btn-ghost btn-sm" onclick="openOwnedProject('${p.id}')">↗ Workspace</button>
                </div>
                <div class="text-xs text-muted mt-2">🔒 Archived — workspace is read-only</div>
              </div>
            `,
                )
                .join("")
            : '<p class="text-sm text-muted italic">No completed projects yet.</p>'
        }
      </div>

      <div id="owned-summary-modal" class="modal-overlay ${summaryProject ? "open" : ""}" onclick="closeOwnedSummary(event)">
        <div class="modal" style="max-width:620px" onclick="event.stopPropagation()">
          ${
            summaryProject
              ? `
            <div class="modal-title" style="display:flex;align-items:center;justify-content:space-between">
              <span>🏆 Project Completed</span>
              <button class="btn btn-ghost btn-sm" onclick="closeOwnedSummary()">✕</button>
            </div>
            <p class="page-subtitle" style="margin-bottom:12px">Final summary for ${summaryProject.name}</p>

            <div class="stat-grid" style="margin:0 0 12px 0">
              <div class="stat-card"><div class="stat-label">XP Earned</div><div class="stat-value">+${summaryProject.totalXp}</div></div>
              <div class="stat-card"><div class="stat-label">Rep Gained</div><div class="stat-value">+${summaryProject.repGained}</div></div>
              <div class="stat-card"><div class="stat-label">Tasks Done</div><div class="stat-value">${summaryProject.completedTasks}/${summaryProject.totalTasks}</div></div>
            </div>

            <div class="card" style="padding:12px;margin-bottom:12px">
              <div class="progress-info"><span class="font-semibold">Task Completion</span><span class="text-success">100%</span></div>
              <div class="progress-container"><div class="progress-fill" style="width:100%"></div></div>
            </div>

            <div class="text-sm text-muted" style="margin-bottom:10px">⏱ ${summaryProject.duration} · 👥 ${summaryProject.members} members</div>

            <div class="card" style="padding:12px;margin-bottom:10px">
              <div class="font-semibold text-sm" style="margin-bottom:8px">Highlights</div>
              <ul>
                ${summaryProject.highlights.map((h) => `<li class="text-sm text-muted" style="margin-bottom:4px">✓ ${h}</li>`).join("")}
              </ul>
            </div>

            <div class="project-skills" style="margin-bottom:10px">
              ${(Array.isArray(summaryProject.skills) ? summaryProject.skills : []).map((s) => `<span class="skill-tag">${s}</span>`).join("")}
            </div>

            <div class="text-xs text-muted">🔒 This project is archived. The workspace is read-only.</div>
          `
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function getCurrentUserName() {
  const stateName = String(
    STATE?.userProfile?.fullName || STATE?.currentUser?.name || "",
  ).trim();
  if (stateName) {
    return stateName;
  }

  const currentRecord =
    typeof getCurrentUserRecord === "function" ? getCurrentUserRecord() : null;
  const recordName = String(currentRecord?.name || "").trim();
  if (recordName) {
    return recordName;
  }

  const currentEmail =
    typeof getCurrentUserSessionEmail === "function"
      ? String(getCurrentUserSessionEmail() || "").trim()
      : "";
  if (currentEmail.includes("@")) {
    return currentEmail.split("@")[0];
  }

  const avatarName = document.querySelector(".avatar-name");
  const domName = avatarName?.textContent?.trim();
  return domName || "TeamForge User";
}

function createProject() {
  if (STATE.role !== "project-owner") {
    showToast("Switch to Project Owner role to create projects", "error");
    return;
  }

  const titleInput = document.getElementById("create-project-title");
  const descInput = document.getElementById("create-project-desc");
  const objectivesInput = document.getElementById("create-project-objectives");
  const skillsInput = document.getElementById("create-project-skills");
  const durationInput = document.getElementById("create-project-duration");
  const maxCollaboratorsInput = document.getElementById(
    "create-project-collaborators",
  );
  const difficultyInput = document.getElementById("create-project-difficulty");

  if (
    !titleInput ||
    !descInput ||
    !objectivesInput ||
    !skillsInput ||
    !durationInput ||
    !maxCollaboratorsInput ||
    !difficultyInput
  ) {
    showToast("Create Project form is unavailable", "error");
    return;
  }

  const title = titleInput.value.trim();
  const desc = descInput.value.trim();
  const objectives = objectivesInput.value.trim();
  const skillCandidates = skillsInput.value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const skills = [
    ...new Set(skillCandidates.map((s) => s.replace(/\s+/g, " "))),
  ];
  const duration = durationInput.value.trim();
  const difficulty = difficultyInput.value.trim();
  const collaborators = Number.parseInt(maxCollaboratorsInput.value, 10);

  if (!title) {
    showToast("Project title is required");
    return;
  }
  if (title.length < 3 || title.length > 80) {
    showToast("Project title must be 3 to 80 characters");
    return;
  }
  if (!/[a-zA-Z0-9]/.test(title)) {
    showToast("Project title must include letters or numbers");
    return;
  }

  if (!desc) {
    showToast("Project description is required");
    return;
  }
  if (desc.length < 20 || desc.length > 800) {
    showToast("Description must be 20 to 800 characters");
    return;
  }

  if (!objectives) {
    showToast("Project objectives are required");
    return;
  }
  if (objectives.length < 10 || objectives.length > 500) {
    showToast("Objectives must be 10 to 500 characters");
    return;
  }

  if (skills.length === 0) {
    showToast("Add at least one required skill");
    return;
  }
  if (skills.length > 12) {
    showToast("Use up to 12 skills only");
    return;
  }
  if (skills.some((skill) => skill.length < 2 || skill.length > 40)) {
    showToast("Each skill must be 2 to 40 characters");
    return;
  }

  const allowedDurations = new Set([
    "1 month",
    "2 months",
    "3 months",
    "6 months",
  ]);
  if (!allowedDurations.has(duration)) {
    showToast("Select a valid project duration");
    return;
  }

  const allowedDifficulties = new Set(["Beginner", "Intermediate", "Advanced"]);
  if (!allowedDifficulties.has(difficulty)) {
    showToast("Select a valid project difficulty");
    return;
  }

  if (
    !Number.isFinite(collaborators) ||
    collaborators < 1 ||
    collaborators > 20
  ) {
    showToast("Max collaborators must be between 1 and 20");
    return;
  }

  const owner = getCurrentUserName();
  const createdProject = addProjectToData({
    name: title,
    desc,
    objectives,
    skills,
    duration,
    difficulty,
    collaborators,
    owner,
    members: [{ name: owner, role: "Owner" }],
  });

  // ── Backend Integration: Sync project creation to NestJS ──
  const DIFFICULTY_MAP = {
    "Beginner": "Easy",
    "Intermediate": "Medium",
    "Advanced": "Hard",
  };
  const backendUserId = localStorage.getItem("teamforge.backendUserId") || "unknown";
  const backendPayload = {
    title: title,
    description: desc,
    difficulty: DIFFICULTY_MAP[difficulty] || "Medium",
    requiredSkills: skills,
    duration: duration,
  };
  try {
    fetch(`${backendBaseUrl}/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": backendUserId,
        "x-user-role": "Project Owner",
      },
      body: JSON.stringify(backendPayload),
    })
      .then((res) => {
        if (!res.ok) {
          console.warn("Backend project creation failed:", res.status);
        } else {
          return res.json();
        }
      })
      .then((data) => {
        if (data) {
          console.log("✅ Project synced to backend:", data.id);
        }
      })
      .catch((err) => {
        console.warn("Backend unreachable for project sync:", err.message);
      });
  } catch (e) {
    console.warn("Backend sync error:", e);
  }
  // ── End Backend Integration ──

  titleInput.value = "";
  descInput.value = "";
  objectivesInput.value = "";
  skillsInput.value = "";
  durationInput.selectedIndex = 0;
  maxCollaboratorsInput.value = "5";
  difficultyInput.selectedIndex = 0;

  renderProjects();
  renderMyProjects();
  showToast(`Project \"${createdProject.name}\" created successfully!`);
  navigate("my-projects");
}
