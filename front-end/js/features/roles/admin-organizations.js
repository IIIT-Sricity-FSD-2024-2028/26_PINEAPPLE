// ══════════════════════════════════════════════════════════════
//   ADMIN ORGANIZATIONS CONSOLE
// ══════════════════════════════════════════════════════════════

const ORG_UI_STATE = {
  orgs: [],
  query: ""
};

async function fetchOrgsData() {
  try {
    const headers = { "x-user-role": "Administrator" };
    const res = await fetch("http://localhost:3000/organizations", { headers }).catch(() => null);
    if (res && res.ok) {
      ORG_UI_STATE.orgs = await res.json();
    } else {
      // Mock Data since backend is scaffolded
      ORG_UI_STATE.orgs = [
        { id: "org-1", name: "Acme Corp", tier: "Enterprise", members: 120, status: "Active" },
        { id: "org-2", name: "Global Tech", tier: "Pro", members: 45, status: "Active" },
        { id: "org-3", name: "Startup Inc", tier: "Starter", members: 8, status: "Suspended" }
      ];
    }
  } catch (e) {
    console.warn("Could not fetch orgs data", e);
  }
}

function setAdminOrgSearch(val) {
  ORG_UI_STATE.query = String(val || "").toLowerCase();
  renderAdminOrganizations();
}

async function renderAdminOrganizations() {
  const container = document.getElementById("admin-organizations");
  if (!container) return;

  if (!container.dataset.loaded) {
    container.innerHTML = '<div class="admin-users-empty">Loading Organizations...</div>';
    await fetchOrgsData();
    container.dataset.loaded = "true";
  }

  const filtered = ORG_UI_STATE.orgs.filter(o => 
    o.name.toLowerCase().includes(ORG_UI_STATE.query) || 
    o.tier.toLowerCase().includes(ORG_UI_STATE.query)
  );

  let orgsHtml = "";
  if (filtered.length === 0) {
    orgsHtml = '<div class="admin-users-empty">No organizations found.</div>';
  } else {
    orgsHtml = `
      <table class="admin-audit-table">
        <thead>
          <tr>
            <th>Organization</th>
            <th>Billing Tier</th>
            <th>Members</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(o => `
            <tr>
              <td><strong>${escapeHtml(o.name)}</strong></td>
              <td><span class="badge ${o.tier === 'Enterprise' ? 'badge-primary' : 'badge-outline'}">${escapeHtml(o.tier)}</span></td>
              <td>${o.members}</td>
              <td><span class="admin-audit-type ${o.status === 'Active' ? 'system' : 'suspension'}">${escapeHtml(o.status.toUpperCase())}</span></td>
              <td>
                <button class="btn btn-outline btn-sm" onclick="showToast('View Organization Details')">Manage</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <h1>Organizations</h1>
        <p class="page-subtitle mt-1">Manage tenant organizations, enterprise limits, and active subscriptions.</p>
      </div>
      <button class="btn btn-primary" onclick="showToast('Create Organization')">➕ New Organization</button>
    </div>

    <div class="admin-users-toolbar mt-4">
      <div class="admin-users-search-wrap">
        <span class="admin-users-search-icon">🔍</span>
        <input class="admin-users-search" type="text" placeholder="Search organizations..." value="${escapeHtml(ORG_UI_STATE.query)}" oninput="setAdminOrgSearch(this.value)" />
      </div>
    </div>
    
    <div class="card mt-4" style="padding:0; overflow:hidden;">
      ${orgsHtml}
    </div>
  `;
}
