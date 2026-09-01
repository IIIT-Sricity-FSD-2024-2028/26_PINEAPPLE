let HACK_ADMIN_STATE = {
  tab: "all",
  hackathons: []
};

function setHackAdminTab(tab) {
  HACK_ADMIN_STATE.tab = tab;
  document.querySelectorAll("#admin-hackathons .tab").forEach(t => t.classList.remove("active"));
  document.getElementById(`hack-admin-tab-${tab}`).classList.add("active");
  renderAdminHackathonsList();
}

async function renderAdminHackathons() {
  const listEl = document.getElementById("admin-hackathons-list");
  if (!listEl) return;
  
  listEl.innerHTML = '<div class="admin-users-empty">Loading hackathons...</div>';
  
  try {
    const res = await window.hackathonsApi.search();
    HACK_ADMIN_STATE.hackathons = res || [];
    renderAdminHackathonsList();
  } catch(e) {
    listEl.innerHTML = `<div class="admin-users-empty">Failed to load hackathons: ${e.message}</div>`;
    console.error("Hackathon fetch error:", e);
  }
}

function renderAdminHackathonsList() {
  const listEl = document.getElementById("admin-hackathons-list");
  
  let filtered = HACK_ADMIN_STATE.hackathons;
  if (HACK_ADMIN_STATE.tab === "active") {
    filtered = filtered.filter(h => ["Published", "RegistrationOpen", "Ongoing", "Judging"].includes(h.status));
  } else if (HACK_ADMIN_STATE.tab === "closed") {
    filtered = filtered.filter(h => ["Closed", "Completed"].includes(h.status));
  }
  
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="admin-users-empty mt-4">No hackathons found in this category.</div>`;
    return;
  }
  
  listEl.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(340px, 1fr));gap:16px;" class="mt-4">
      ${filtered.map(h => `
        <div class="card" style="display:flex;flex-direction:column;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <h3 style="margin:0;font-size:1.1rem;color:var(--fg)">${escapeHtml(h.name)}</h3>
            <span class="admin-audit-type ${h.status === 'Closed' ? '' : 'success'}">${h.status}</span>
          </div>
          <p class="text-sm text-muted mt-2" style="flex:1">${escapeHtml(h.description).substring(0, 100)}...</p>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;font-size:0.85rem;background:var(--bg);padding:12px;border-radius:8px">
            <div>
              <div class="text-muted text-xs uppercase" style="letter-spacing:0.5px">Prize Pool</div>
              <div class="font-semibold mt-1" style="color:var(--fg)">₹${(h.prizes?.totalPool || 0).toLocaleString()}</div>
            </div>
            <div>
              <div class="text-muted text-xs uppercase" style="letter-spacing:0.5px">Host Org</div>
              <div class="font-semibold mt-1" style="color:var(--fg)">${escapeHtml(h.hostId)}</div>
            </div>
            <div>
              <div class="text-muted text-xs uppercase" style="letter-spacing:0.5px">Mode</div>
              <div class="font-semibold mt-1" style="color:var(--fg)">${h.mode}</div>
            </div>
            <div>
              <div class="text-muted text-xs uppercase" style="letter-spacing:0.5px">Team Size</div>
              <div class="font-semibold mt-1" style="color:var(--fg)">${h.teamSizeLimits?.min}-${h.teamSizeLimits?.max}</div>
            </div>
          </div>
          
          <div class="mt-3" style="padding-top:16px;border-top:1px solid var(--border);display:flex;gap:8px">
            <button class="btn btn-outline btn-sm" style="flex:1" onclick="showToast('Hackathon dashboard details available in pro version', 'info')">View Dashboard</button>
            ${h.status !== 'Closed' && h.status !== 'Completed' ? `
              <button class="btn btn-outline btn-sm" style="color:var(--destructive);border-color:var(--destructive)" onclick="adminCancelHackathon('${h.id}')" title="Cancel and Refund">Cancel</button>
            ` : ''}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

async function adminCancelHackathon(id) {
  if (!confirm("Are you sure you want to cancel this hackathon? The escrowed prize pool will be refunded and teams notified.")) return;
  try {
    await window.hackathonsApi.cancel(id, window.getCurrentUserId());
    showToast("Hackathon cancelled successfully", "success");
    renderAdminHackathons();
  } catch(e) {
    showToast("Failed to cancel hackathon", "error");
  }
}
