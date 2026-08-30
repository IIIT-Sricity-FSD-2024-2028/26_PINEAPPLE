// ══════════════════════════════════════════════════════════════
//  admin-panel.js — Consolidated Admin Control Plane
// ══════════════════════════════════════════════════════════════

function renderAdminPanel(scope) {
  const container = document.getElementById("main-content");
  if (!container) return;

  // Render tabs based on scope
  let tabsHtml = '';
  
  if (scope === 'super_admin' || scope === 'finance_admin') {
    tabsHtml += `<button onclick="showAdminTab('overview')">Overview Dashboard</button>`;
  }
  if (scope === 'super_admin') {
    tabsHtml += `<button onclick="showAdminTab('roles')">User & Role Management</button>`;
  }
  if (scope === 'finance_admin') {
    tabsHtml += `<button onclick="showAdminTab('finance')">Finance Console</button>`;
  }
  if (scope === 'super_admin' || scope === 'org_success_manager') {
    tabsHtml += `<button onclick="showAdminTab('organizations')">Organization Management</button>`;
  }
  if (scope === 'org_success_manager' || scope === 'finance_admin') {
    tabsHtml += `<button onclick="showAdminTab('sponsorships')">Sponsorship & Competitions</button>`;
  }
  if (scope === 'finance_admin' || scope === 'moderation_admin') {
    tabsHtml += `<button onclick="showAdminTab('escrow')">Escrow & Disputes</button>`;
  }
  if (scope === 'moderation_admin') {
    tabsHtml += `<button onclick="showAdminTab('governance')">Governance & Moderation</button>`;
  }
  if (scope === 'support_agent' || scope === 'moderation_admin') {
    tabsHtml += `<button onclick="showAdminTab('support')">Support Console</button>`;
  }
  if (scope === 'super_admin' || scope === 'org_success_manager') {
    tabsHtml += `<button onclick="showAdminTab('broadcast')">Broadcast Announcements</button>`;
  }

  container.innerHTML = `
    <div class="admin-panel">
      <div class="admin-tabs">
        ${tabsHtml}
      </div>
      <div id="admin-tab-content">
        <!-- Content injected here based on tab selection -->
      </div>
    </div>
  `;
}

function showAdminTab(tabName) {
  const content = document.getElementById("admin-tab-content");
  content.innerHTML = `<h2>Loading ${tabName}...</h2>`;
  // Further implementation would fetch and render actual data
}
