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
  document.getElementById("mentored-projects-grid").innerHTML = mentored
    .map((p) => projectCardHTML(p, "openWorkspace", "mentored-projects"))
    .join("");
  bindProjectCardClicks();
}
