// ══════════════════════════════════════════════
//   MENTORS
// ══════════════════════════════════════════════
const MENTOR_REQUESTS = [
  {
    project: "AI Study Planner",
    owner: "Alice Smith",
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

function acceptMentorRequest(idOrIndex, isDynamic) {
  if (isDynamic) {
    const raw = localStorage.getItem("teamforge.sharedMentorRequests");
    if (raw) {
      const sharedRequests = JSON.parse(raw);
      const req = sharedRequests.find(r => r.id === idOrIndex);
      if (req) {
        req.status = "approved";
        req.approvedOn = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        localStorage.setItem("teamforge.sharedMentorRequests", JSON.stringify(sharedRequests));
        
        if (typeof PROJECTS !== "undefined") {
          const proj = PROJECTS.find(p => p.id === req.projectId);
          if (proj) {
            if (proj.runtime && proj.runtime.mentorRequest) {
              proj.runtime.mentorRequest.status = "approved";
              proj.runtime.mentorRequest.approvedOn = req.approvedOn;
            }
            if (!Array.isArray(proj.members)) proj.members = [];
            if (!proj.members.some(m => m.name === req.mentorName || (m.email && m.email === req.mentorEmail))) {
              const mentorInitials = req.mentorName ? req.mentorName.split(" ").slice(0, 2).map(n => n[0].toUpperCase()).join("") : "M";
              const newMember = {
                name: req.mentorName,
                role: "Mentor",
                email: req.mentorEmail,
                initials: mentorInitials
              };
              proj.members.push(newMember);
              
              // Persist to user record so the owner sees it upon reload
              if (req.ownerEmail) {
                 try {
                   const usersStore = JSON.parse(localStorage.getItem("users") || "{}");
                   const ownerRecord = usersStore[req.ownerEmail];
                   if (ownerRecord && ownerRecord.data && Array.isArray(ownerRecord.data.projects)) {
                     const ownerProj = ownerRecord.data.projects.find(p => p.id === req.projectId);
                     if (ownerProj) {
                       if (!Array.isArray(ownerProj.members)) ownerProj.members = [];
                       ownerProj.members.push(newMember);
                       localStorage.setItem("users", JSON.stringify(usersStore));
                     }
                   }
                 } catch(e) { console.warn("Failed to persist mentor to owner record", e); }
              }
            }
          }
        }
        showToast(`Mentorship request accepted for ${req.projectName}`);
      }
    }
  } else {
    const request = MENTOR_REQUESTS[idOrIndex];
    if (!request) return;
    request.status = "Accepted";
    showToast(`Mentorship request accepted for ${request.project}`);
  }
  renderMentorRequests();
  if (typeof renderMentoredProjects === "function") renderMentoredProjects();
}

function declineMentorRequest(idOrIndex, isDynamic) {
  if (isDynamic) {
    const raw = localStorage.getItem("teamforge.sharedMentorRequests");
    if (raw) {
      const sharedRequests = JSON.parse(raw);
      const req = sharedRequests.find(r => r.id === idOrIndex);
      if (req) {
        req.status = "rejected";
        localStorage.setItem("teamforge.sharedMentorRequests", JSON.stringify(sharedRequests));
        
        if (typeof PROJECTS !== "undefined") {
          const proj = PROJECTS.find(p => p.id === req.projectId);
          if (proj && proj.runtime && proj.runtime.mentorRequest) {
            proj.runtime.mentorRequest.status = "rejected";
          }
        }
        showToast(`Mentorship request declined for ${req.projectName}`);
      }
    }
  } else {
    const request = MENTOR_REQUESTS[idOrIndex];
    if (!request) return;
    request.status = "Declined";
    showToast(`Mentorship request declined for ${request.project}`);
  }
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
  const currentEmail = typeof getCurrentUserSessionEmail === "function" ? getCurrentUserSessionEmail() : "";
  const currentName = typeof getCurrentUserName === "function" ? getCurrentUserName() : "";
  
  const raw = localStorage.getItem("teamforge.sharedMentorRequests");
  const sharedRequests = raw ? JSON.parse(raw) : [];
  
  const myDynamicRequests = sharedRequests
    .filter(req => req.mentorEmail === currentEmail || req.mentorName === currentName)
    .map(req => ({
      id: req.id,
      projectId: req.projectId,
      project: req.projectName,
      owner: req.ownerName,
      skills: [],
      members: 1,
      status: req.status === "requested" ? "Pending" : req.status === "approved" ? "Accepted" : req.status === "rejected" ? "Declined" : "Pending",
      isDynamic: true
    }));

  let allRequests = [...myDynamicRequests];
  if (allRequests.length === 0) {
    allRequests = [...MENTOR_REQUESTS];
  }
  
  document.getElementById("mentor-requests-content").innerHTML = `
    <div class="space-y-3">
      ${allRequests.length === 0 ? '<div class="text-muted text-sm">No mentor requests pending.</div>' : allRequests.map(
        (r, idx) => `
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
              <button class="btn btn-primary btn-sm" onclick="acceptMentorRequest('${r.isDynamic ? r.id : idx}', ${r.isDynamic ? 'true' : 'false'})">Accept</button>
              <button class="btn btn-outline btn-sm" onclick="declineMentorRequest('${r.isDynamic ? r.id : idx}', ${r.isDynamic ? 'true' : 'false'})">Decline</button>
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
  const currentEmail = typeof getCurrentUserSessionEmail === "function" ? getCurrentUserSessionEmail() : "";
  const currentName = typeof getCurrentUserName === "function" ? getCurrentUserName() : "";
  
  const raw = localStorage.getItem("teamforge.sharedMentorRequests");
  const sharedRequests = raw ? JSON.parse(raw) : [];
  
  const dynamicMentoredProjectIds = sharedRequests
    .filter(req => (req.mentorEmail === currentEmail || req.mentorName === currentName) && req.status === "approved")
    .map(req => req.projectId);

  let mentored = PROJECTS.filter(p => dynamicMentoredProjectIds.includes(p.id));

  document.getElementById("mentored-projects-grid").innerHTML = mentored.length
    ? mentored.map((p) => projectCardHTML(p, "openWorkspace", "mentored-projects")).join("")
    : '<div class="text-muted text-sm">You are not mentoring any projects yet.</div>';
    
  bindProjectCardClicks();
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
    const apiBase = typeof resolveApiBaseUrl === "function" ? resolveApiBaseUrl() : "http://localhost:3000";
    const response = await fetch(`${apiBase}/uploads/resource`, {
      method: "POST",
      headers: {
        "x-user-id": backendUserId,
        "x-user-role": getCurrentUserRole ? getCurrentUserRole() : "Collaborator"
      },
      body: formData
    });
    
    if (response.ok) {
      const data = await response.json();
      // Backend returns: { message, filename, url } where url = "/uploads/filename"
      const resourceUrl = data.url || data.path || (data.filename ? `/uploads/${data.filename}` : null);
      const projectId = document.getElementById("mentor-resource-project-id")?.value;

      // Post the resource as a project message so it's visible to the team
      if (projectId && resourceUrl && window.communicationsApi) {
        try {
          await window.communicationsApi?.create?.({
            projectId,
            senderId: backendUserId,
            content: `📎 Mentor shared a resource: ${file.name}`,
            attachmentUrl: resourceUrl,
            type: "resource"
          }, getCurrentUserRole ? getCurrentUserRole() : "Collaborator");
        } catch (apiErr) {
          console.warn("Resource message post failed (backend may be offline):", apiErr.message);
        }
      }

      showToast(`Resource "${file.name}" shared successfully!`, "success");
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
