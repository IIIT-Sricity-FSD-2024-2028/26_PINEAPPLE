// ══════════════════════════════════════════════
//   ADMIN — PROJECTS TABLE
// ══════════════════════════════════════════════

function renderAdminProjects() {
  const list = document.getElementById("admin-projects-list");
  if (!list) return;

  const isSuperUser = STATE.portalRole === "superuser";

  list.innerHTML = `
    <table style="margin:0">
      <thead>
        <tr style="background:var(--secondary)">
          <th style="padding:12px 16px">Project</th>
          <th style="padding:12px 16px">Owner</th>
          <th style="padding:12px 16px">Difficulty</th>
          <th style="padding:12px 16px">Collaborators</th>
          <th style="padding:12px 16px">Progress</th>
          ${isSuperUser ? '<th style="padding:12px 16px;text-align:right">Actions</th>' : ""}
        </tr>
      </thead>
      <tbody>
        ${PROJECTS.map(
          (p) => `
          <tr>
            <td style="padding:10px 16px">${escapeHtml(p.name)}</td>
            <td style="padding:10px 16px">${escapeHtml(p.owner || "Unassigned")}</td>
            <td style="padding:10px 16px">${escapeHtml(p.difficulty || "—")}</td>
            <td style="padding:10px 16px">${p.collaborators ?? 0}</td>
            <td style="padding:10px 16px">${p.progress ?? 0}%</td>
            ${
              isSuperUser
                ? `<td style="padding:10px 16px;text-align:right">
                   <button class="btn btn-xs su-btn-danger"
                     onclick="suDeleteProject('${escapeHtml(String(p.id))}')">Delete</button>
                 </td>`
                : ""
            }
          </tr>
        `,
        ).join("")}
      </tbody>
    </table>
  `;
}
