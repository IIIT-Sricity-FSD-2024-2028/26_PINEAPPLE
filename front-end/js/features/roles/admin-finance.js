// ══════════════════════════════════════════════════════════════
//   ADMIN FINANCE CONSOLE
// ══════════════════════════════════════════════════════════════

const FINANCE_UI_STATE = {
  tab: "overview", // overview, billing, escrow, payouts
  metrics: {
    mrr: "$4,250.00",
    escrowTotal: "$12,400.00",
    payoutsMonth: "$8,100.00",
    activeOrgs: 15
  },
  billingLogs: [],
  escrowLogs: [],
  payouts: []
};

async function fetchFinanceData() {
  try {
    const headers = { "x-user-role": "Administrator" };
    // Fetch data from scaffolded backend modules
    const responses = await Promise.all([
      fetch("http://localhost:3000/billing", { headers }).catch(() => null),
      fetch("http://localhost:3000/escrow", { headers }).catch(() => null),
      fetch("http://localhost:3000/payouts", { headers }).catch(() => null)
    ]);
    
    // Fallbacks since backend modules are currently scaffolds
    FINANCE_UI_STATE.billingLogs = responses[0] && responses[0].ok ? await responses[0].json() : [];
    FINANCE_UI_STATE.escrowLogs = responses[1] && responses[1].ok ? await responses[1].json() : [];
    FINANCE_UI_STATE.payouts = responses[2] && responses[2].ok ? await responses[2].json() : [];
  } catch (e) {
    console.warn("Could not fetch finance data", e);
  }
}

function setFinanceTab(tab) {
  FINANCE_UI_STATE.tab = tab;
  renderAdminFinance();
}

async function renderAdminFinance() {
  const container = document.getElementById("admin-finance");
  if (!container) return;

  if (!container.dataset.loaded) {
    container.innerHTML = '<div class="admin-users-empty">Loading Finance Data...</div>';
    await fetchFinanceData();
    container.dataset.loaded = "true";
  }

  let tabContent = "";
  if (FINANCE_UI_STATE.tab === "overview") {
    tabContent = `
      <div class="admin-dash-grid-top mt-3">
        <div class="admin-kpi-card">
          <div class="admin-kpi-row"><div class="admin-kpi-icon info">💰</div></div>
          <div class="admin-kpi-value">${FINANCE_UI_STATE.metrics.mrr}</div>
          <div class="admin-kpi-label">Monthly Recurring Revenue</div>
        </div>
        <div class="admin-kpi-card">
          <div class="admin-kpi-row"><div class="admin-kpi-icon warning">🔒</div></div>
          <div class="admin-kpi-value">${FINANCE_UI_STATE.metrics.escrowTotal}</div>
          <div class="admin-kpi-label">Total in Escrow</div>
        </div>
        <div class="admin-kpi-card">
          <div class="admin-kpi-row"><div class="admin-kpi-icon success">💸</div></div>
          <div class="admin-kpi-value">${FINANCE_UI_STATE.metrics.payoutsMonth}</div>
          <div class="admin-kpi-label">Payouts (This Month)</div>
        </div>
        <div class="admin-kpi-card">
          <div class="admin-kpi-row"><div class="admin-kpi-icon info">🏢</div></div>
          <div class="admin-kpi-value">${FINANCE_UI_STATE.metrics.activeOrgs}</div>
          <div class="admin-kpi-label">Active Organizations</div>
        </div>
      </div>
      <div class="card mt-4">
        <h3>Recent Finance Activity</h3>
        <p class="text-sm text-muted">A summary of the latest billing and payout events.</p>
        <div class="admin-users-empty mt-3">No recent activity found.</div>
      </div>
    `;
  } else if (FINANCE_UI_STATE.tab === "billing") {
    tabContent = `
      <div class="card mt-3">
        <h3>Billing & Subscriptions</h3>
        <p class="text-sm text-muted">Manage Organization tiers and view invoice history.</p>
        <div class="admin-users-empty mt-3">No active billing alerts.</div>
      </div>
    `;
  } else if (FINANCE_UI_STATE.tab === "escrow") {
    tabContent = `
      <div class="card mt-3">
        <h3>Escrow & Disputes</h3>
        <p class="text-sm text-muted">Monitor held funds and resolve payout disputes.</p>
        <div class="admin-users-empty mt-3">All escrows are in good standing.</div>
      </div>
    `;
  } else if (FINANCE_UI_STATE.tab === "payouts") {
    tabContent = `
      <div class="card mt-3">
        <h3>Collaborator Payouts</h3>
        <p class="text-sm text-muted">Approve and process scheduled payouts for completed tasks.</p>
        <div class="admin-users-empty mt-3">No pending payouts.</div>
      </div>
    `;
  }

  container.innerHTML = `
    <h1>Finance Console</h1>
    <p class="page-subtitle mt-1">Track platform revenue, monitor escrow balances, and manage payouts.</p>
    
    <div class="tabs mt-4">
      <button class="tab ${FINANCE_UI_STATE.tab === 'overview' ? 'active' : ''}" onclick="setFinanceTab('overview')">Overview Dashboard</button>
      <button class="tab ${FINANCE_UI_STATE.tab === 'billing' ? 'active' : ''}" onclick="setFinanceTab('billing')">Billing & Subs</button>
      <button class="tab ${FINANCE_UI_STATE.tab === 'escrow' ? 'active' : ''}" onclick="setFinanceTab('escrow')">Escrow</button>
      <button class="tab ${FINANCE_UI_STATE.tab === 'payouts' ? 'active' : ''}" onclick="setFinanceTab('payouts')">Payouts</button>
    </div>
    
    ${tabContent}
  `;
}
