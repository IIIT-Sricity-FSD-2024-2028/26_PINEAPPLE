// ══════════════════════════════════════════════
//   MENTORS
// ══════════════════════════════════════════════
const MENTOR_REQUESTS = [
  {
    project: "AI Study Planner",
    owner: "Arjun Sharma",
    skills: ["React", "ML"],
    members: 3,
    status: "Pending",
  },
  {
    project: "Code Review Hub",
    owner: "Vikram Nair",
    skills: ["Git API", "Node.js"],
    members: 2,
    status: "Pending",
  },
  {
    project: "EcoTracker",
    owner: "Ananya Reddy",
    skills: ["React", "API"],
    members: 5,
    status: "Accepted",
  },
];

function acceptMentorRequest(index) {
  const request = MENTOR_REQUESTS[index];
  if (!request) return;
  request.status = "Accepted";
  showToast(`Mentorship request accepted for ${request.project}`);
  renderMentorRequests();
  renderMentoredProjects();
}

function declineMentorRequest(index) {
  const request = MENTOR_REQUESTS[index];
  if (!request) return;
  request.status = "Declined";
  showToast(`Mentorship request declined for ${request.project}`);
  renderMentorRequests();
}

function renderMentors() {
  document.getElementById("mentors-grid").innerHTML = MENTORS_DATA.map(
    (m) => `
    <div class="card">
      <div class="flex items-center gap-3 mb-3">
        <div style="width:44px;height:44px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85rem">${m.initials}</div>
        <div>
          <div class="font-semibold text-sm">${m.name}</div>
          <div class="text-xs text-muted">${m.title} · ${m.uni}</div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">
        ${m.skills.map((s) => `<span class="skill-tag">${s}</span>`).join("")}
      </div>
      <div class="flex gap-3 text-xs text-muted mb-3">
        <span>⚡ ${m.xp.toLocaleString()} XP</span>
        <span>⭐ ${m.rep} Rep</span>
      </div>
      <button class="btn btn-primary btn-sm btn-full" onclick="showToast('Mentor request sent to ${m.name}!')">Request Mentor</button>
    </div>
  `,
  ).join("");
}
// ══════════════════════════════════════════════
//   MENTOR REQUESTS (mentor role)
// ══════════════════════════════════════════════
function renderMentorRequests() {
  document.getElementById("mentor-requests-content").innerHTML = `
    <div class="space-y-3">
      ${MENTOR_REQUESTS.map(
        (r) => `
        <div class="pending-row">
          <div>
            <div class="font-semibold text-sm">${r.project}</div>
            <div class="text-xs text-muted">by ${r.owner} · 👥 ${r.members} members</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px">
              ${r.skills.map((s) => `<span class="skill-tag">${s}</span>`).join("")}
            </div>
          </div>
          <div class="flex gap-2 items-center">
            ${
              r.status === "Pending"
                ? `
              <button class="btn btn-primary btn-sm" onclick="acceptMentorRequest(${MENTOR_REQUESTS.indexOf(r)})">Accept</button>
              <button class="btn btn-outline btn-sm" onclick="declineMentorRequest(${MENTOR_REQUESTS.indexOf(r)})">Decline</button>
            `
                : r.status === "Accepted"
                  ? `<span class="badge badge-success">Accepted</span>`
                  : `<span class="badge badge-danger">Declined</span>`
            }
          </div>
        </div>
      `,
      ).join("")}
    </div>
  `;
}

// ══════════════════════════════════════════════
//   MENTORED PROJECTS
// ══════════════════════════════════════════════
function renderMentoredProjects() {
  const mentored = PROJECTS.filter((_, i) => i === 2 || i === 4);
  const grid = document.getElementById("mentored-projects-grid");
  grid.innerHTML = mentored
    .map((p) => projectCardHTML(p, "openWorkspace", "mentored-projects"))
    .join("");
  bindProjectCardClicks();

  // Inject "Upload Resource" button into each rendered project card
  mentored.forEach((p) => {
    // Find the card element — projectCardHTML uses data-project-id or data-id attributes
    const cardEl = grid.querySelector(
      `[data-project-id="${p.id}"], [data-id="${p.id}"]`
    ) || Array.from(grid.querySelectorAll(".card")).find(
      (el) => el.textContent.includes(p.name)
    );
    if (!cardEl) return;

    const encodedName = encodeURIComponent(p.name);
    const uploadBtn = document.createElement("button");
    uploadBtn.className = "btn btn-outline btn-sm btn-full";
    uploadBtn.style.marginTop = "8px";
    uploadBtn.textContent = "📎 Upload Resource";
    uploadBtn.onclick = () => openMentorResourceModal(encodedName, p.id);
    cardEl.appendChild(uploadBtn);
  });
}

// ══════════════════════════════════════════════
//   MENTOR RESOURCE UPLOAD
// ══════════════════════════════════════════════

function openMentorResourceModal(projectName, projectId) {
  const modal = document.getElementById("modal-mentor-resource");
  const titleEl = document.getElementById("mentor-resource-project");
  const idEl = document.getElementById("mentor-resource-project-id");
  const fileInput = document.getElementById("mentor-resource-file");
  
  if (!modal || !titleEl || !idEl || !fileInput) return;
  
  titleEl.textContent = decodeURIComponent(projectName);
  idEl.value = projectId;
  fileInput.value = "";
  modal.classList.add("open");
}

function closeMentorResourceModal(e) {
  const modal = document.getElementById("modal-mentor-resource");
  if (!modal) return;
  if (e && e.target !== modal) return;
  modal.classList.remove("open");
}

async function submitMentorResource() {
  const fileInput = document.getElementById("mentor-resource-file");
  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    showToast("Please select a file to upload as a resource.", "error");
    return;
  }
  
  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append("file", file);
  
  try {
    const backendUserId = localStorage.getItem("teamforge.backendUserId") || "1";
    const response = await fetch("http://localhost:3000/uploads/resource", {
      method: "POST",
      headers: {
        "x-user-id": backendUserId
      },
      body: formData
    });
    
    if (response.ok) {
      showToast("Resource shared successfully!", "success");
      closeMentorResourceModal();
    } else {
      const err = await response.json();
      showToast("Resource upload failed: " + (err.message || "Unknown error"), "error");
    }
  } catch (e) {
    console.warn("Resource upload failed", e);
    showToast("Resource upload failed. Server unavailable.", "error");
  }
}
