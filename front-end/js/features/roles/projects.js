// ══════════════════════════════════════════════
//   PROJECTS
// ══════════════════════════════════════════════
function projectCardHTML(p, clickHandler = "openWorkspace", sourcePage = null) {
  const sourceArg = sourcePage ? `, '${sourcePage}'` : "";
  const dataSourceAttr = sourcePage ? ` data-source-page="${sourcePage}"` : "";
  const isOwnedByCurrentUser =
    typeof getCurrentUserName === "function" && p.owner === getCurrentUserName();
  return `<div class="project-card" data-project-id="${p.id}" data-open-handler="${clickHandler}"${dataSourceAttr} onclick="${clickHandler}('${p.id}'${sourceArg})">
    <h3 class="project-title">${p.name}</h3>
    <p class="project-desc">${p.desc}</p>
    ${
      isOwnedByCurrentUser
        ? '<div class="text-xs text-info" style="margin-top:8px;font-weight:600">You own this project</div>'
        : ""
    }
    <div class="project-skills">
      ${p.skills.map((skill) => `<span class="skill-badge">${skill}</span>`).join("")}
    </div>
    <div class="project-footer">
      <div class="progress-info">
        <span>${p.progress}% complete</span>
        <span class="collaborators">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          ${p.collaborators}
        </span>
      </div>
      <div class="progress-container">
        <div class="progress-fill" style="width: ${p.progress}%;"></div>
      </div>
      ${sourcePage === "mentored-projects" ? `
        <div style="margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px;">
          <button class="btn btn-outline btn-sm btn-full" onclick="event.stopPropagation(); openMentorResourceModal('${encodeURIComponent(p.name)}', '${p.id}')">Upload Resource</button>
        </div>
      ` : ""}
    </div>
  </div>`;
}

function bindProjectCardClicks() {
  document
    .querySelectorAll(".project-card[data-project-id]")
    .forEach((card) => {
      const projectId = card.getAttribute("data-project-id");
      const sourcePage = card.getAttribute("data-source-page");
      const handlerName =
        card.getAttribute("data-open-handler") || "openWorkspace";
      const handler =
        typeof window[handlerName] === "function"
          ? window[handlerName]
          : openWorkspace;
      if (!projectId) return;
      card.onclick = () =>
        sourcePage ? handler(projectId, sourcePage) : handler(projectId);
    });
}

let projectCardDelegationBound = false;
function setupProjectCardDelegation() {
  if (projectCardDelegationBound) return;
  projectCardDelegationBound = true;

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    const card = target.closest(".project-card[data-project-id]");
    if (!card) return;

    const projectId = card.getAttribute("data-project-id");
    const sourcePage = card.getAttribute("data-source-page");
    const handlerName =
      card.getAttribute("data-open-handler") || "openWorkspace";
    const handler =
      typeof window[handlerName] === "function"
        ? window[handlerName]
        : openWorkspace;
    if (!projectId) return;

    if (sourcePage) {
      handler(projectId, sourcePage);
    } else {
      handler(projectId);
    }
  });
}

function renderProjects() {
  setupProjectCardDelegation();
  const cardHandler =
    STATE.role === "collaborator"
      ? "openCollaboratorProjectPreview"
      : "openWorkspace";

  document.getElementById("proj-recommended-cards").innerHTML = PROJECTS.slice(
    0,
    2,
  )
    .map((p) => projectCardHTML(p, cardHandler, "projects"))
    .join("");
  document.getElementById("proj-all-cards").innerHTML = PROJECTS.slice(2)
    .map((p) => projectCardHTML(p, cardHandler, "projects"))
    .join("");
  bindProjectCardClicks();
}

function filterProjects() {
  setupProjectCardDelegation();
  const cardHandler =
    STATE.role === "collaborator"
      ? "openCollaboratorProjectPreview"
      : "openWorkspace";
  const projSearchInput = document.getElementById("proj-search");
  const q = String(projSearchInput?.value || "").toLowerCase().trim();
  const rec = document.getElementById("proj-recommended");
  const label = document.getElementById("proj-section-label");
  if (!q) {
    rec.style.display = "";
    label.textContent = "All Projects";
    document.getElementById("proj-all-cards").innerHTML = PROJECTS.slice(2)
      .map((p) => projectCardHTML(p, cardHandler))
      .join("");
    return;
  }
  rec.style.display = "none";
  const filtered = PROJECTS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.desc.toLowerCase().includes(q) ||
      p.skills.some((s) => s.toLowerCase().includes(q)) ||
      p.owner.toLowerCase().includes(q),
  );
  label.textContent = `Results (${filtered.length})`;
  document.getElementById("proj-all-cards").innerHTML = filtered.length
    ? filtered.map((p) => projectCardHTML(p, cardHandler, "projects")).join("")
    : '<p class="text-sm text-muted italic">No projects match your search.</p>';
  bindProjectCardClicks();
}

// ══════════════════════════════════════════════
//   APPLIED PROJECTS
// ══════════════════════════════════════════════
function renderApplied() {
  document.getElementById("applied-list").innerHTML = APPLIED.map((a) => {
    const cls =
      a.status === "Approved"
        ? "badge-success"
        : a.status === "Pending"
          ? "badge-warning"
          : "badge-destructive";
    const badgeCls =
      a.status === "Rejected"
        ? "background:rgba(239,68,68,.1);color:var(--destructive)"
        : "";
    return `<div style="padding:12px 20px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:2fr 1fr 1fr 1fr;align-items:center;font-size:.83rem">
      <span class="font-semibold">${a.project}</span>
      <span class="text-muted">${a.owner}</span>
      <span class="text-muted">${a.applied}</span>
      <span style="justify-self:start;display:inline-flex;">
        <span class="badge ${cls}" style="${badgeCls};width:auto;max-width:fit-content;">${a.status}</span>
      </span>
    </div>`;
  }).join("");
}
