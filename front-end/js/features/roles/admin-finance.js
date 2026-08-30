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
    const responses = await Promise.all([
      fetch("http://localhost:3000/billing/metrics", { headers }).catch(() => null),
      fetch("http://localhost:3000/escrow", { headers }).catch(() => null),
      fetch("http://localhost:3000/payouts", { headers }).catch(() => null)
    ]);
    
    if (responses[0] && responses[0].ok) {
      const data = await responses[0].json();
      FINANCE_UI_STATE.metrics.mrr = data.mrr;
      FINANCE_UI_STATE.metrics.activeOrgs = data.activeOrgs;
    }
    if (responses[1] && responses[1].ok) {
      const data = await responses[1].json();
      FINANCE_UI_STATE.metrics.escrowTotal = data.totalHeld;
      FINANCE_UI_STATE.escrowLogs = data.records;
    }
    if (responses[2] && responses[2].ok) {
      const data = await responses[2].json();
      FINANCE_UI_STATE.metrics.payoutsMonth = data.totalMonth;
      FINANCE_UI_STATE.payouts = data.records;
    }
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
    let escrowHtml = '<div class="admin-users-empty mt-3">All escrows are in good standing.</div>';
    if (FINANCE_UI_STATE.escrowLogs && FINANCE_UI_STATE.escrowLogs.length > 0) {
      escrowHtml = `
        <table class="admin-audit-table mt-3">
          <thead>
            <tr><th>Project</th><th>Amount</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody>
            ${FINANCE_UI_STATE.escrowLogs.map(e => `
              <tr>
                <td>${escapeHtml(e.project)}</td>
                <td>$${e.amount}</td>
                <td><span class="admin-audit-type ${e.status === 'Held' ? 'warning' : 'success'}">${e.status}</span></td>
                <td>${e.date}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    tabContent = `
      <div class="card mt-3">
        <h3>Escrow & Disputes</h3>
        <p class="text-sm text-muted">Monitor held funds and resolve payout disputes.</p>
        ${escrowHtml}
      </div>
    `;
  } else if (FINANCE_UI_STATE.tab === "payouts") {
    let payoutsHtml = '<div class="admin-users-empty mt-3">No pending payouts.</div>';
    if (FINANCE_UI_STATE.payouts && FINANCE_UI_STATE.payouts.length > 0) {
      payoutsHtml = `
        <table class="admin-audit-table mt-3">
          <thead>
            <tr><th>Collaborator</th><th>Amount</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody>
            ${FINANCE_UI_STATE.payouts.map(p => `
              <tr>
                <td>${escapeHtml(p.collaborator)}</td>
                <td>$${p.amount}</td>
                <td><span class="admin-audit-type ${p.status === 'Completed' ? 'success' : 'system'}">${p.status}</span></td>
                <td>${p.date}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    tabContent = `
      <div class="card mt-3">
        <h3>Collaborator Payouts</h3>
        <p class="text-sm text-muted">Approve and process scheduled payouts for completed tasks.</p>
        ${payoutsHtml}
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
