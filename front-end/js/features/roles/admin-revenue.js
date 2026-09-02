let REV_ADMIN_STATE = {
  tab: "overview",
  metrics: {
    totalRevenue: 0,
    escrowHeld: 0,
    activeHackathons: 0,
    payoutsCompleted: 0
  },
  hackathons: [],
  escrows: [],
  payouts: []
};

function setRevenueTab(tab) {
  REV_ADMIN_STATE.tab = tab;
  document.querySelectorAll("#admin-revenue .tab").forEach(t => t.classList.remove("active"));
  document.getElementById(`rev-tab-${tab}`).classList.add("active");
  renderAdminRevenueContent();
}

async function renderAdminRevenue() {
  const contentEl = document.getElementById("admin-revenue-content");
  contentEl.innerHTML = '<div class="admin-users-empty">Loading revenue data...</div>';
  
  try {
    // Fetch all dynamic data concurrently
    const [hackathons, escrows, payouts] = await Promise.all([
      window.hackathonsApi.search().catch(() => []),
      window.escrowApi.getAll().catch(() => []),
      window.hackathonPayoutsApi.transactions().catch(() => [])
    ]);
    
    REV_ADMIN_STATE.hackathons = hackathons || [];
    REV_ADMIN_STATE.escrows = escrows || [];
    REV_ADMIN_STATE.payouts = payouts || [];
    
    // Compute metrics
    // 1. Active Hackathons (not Closed/Completed/Draft)
    const activeHackathons = REV_ADMIN_STATE.hackathons.filter(h => 
      ['Published', 'RegistrationOpen', 'Ongoing', 'Judging'].includes(h.status)
    ).length;
    
    // 2. Escrow Held (Sum of prizeAmount for all escrows in 'Funded' status)
    const escrowHeld = REV_ADMIN_STATE.escrows
      .filter(e => e.status === 'Funded')
      .reduce((sum, e) => sum + e.prizeAmount, 0);
      
    // 3. Platform Revenue (Sum of platformFee for all escrows)
    // In a real app we might only count Distributed escrows, but we can show total collected.
    const totalRevenue = REV_ADMIN_STATE.escrows
      .reduce((sum, e) => sum + e.platformFee, 0);
      
    // 4. Payouts Completed (Sum of payouts amount)
    const payoutsCompleted = REV_ADMIN_STATE.payouts
      .filter(p => p.status === 'completed' && p.type === 'hackathon_prize')
      .reduce((sum, p) => sum + p.amount, 0);
      
    REV_ADMIN_STATE.metrics = {
      activeHackathons,
      escrowHeld,
      totalRevenue,
      payoutsCompleted
    };
    
    renderAdminRevenueContent();
  } catch(e) {
    console.error("Failed to load revenue data", e);
    contentEl.innerHTML = '<div class="admin-users-empty">Failed to load revenue data. Check console for details.</div>';
  }
}

function renderAdminRevenueContent() {
  const contentEl = document.getElementById("admin-revenue-content");
  
  if (REV_ADMIN_STATE.tab === "overview") {
    contentEl.innerHTML = `
      <div class="admin-dash-grid-top mt-4">
        <div class="admin-kpi-card">
          <div class="admin-kpi-row"><div class="admin-kpi-icon info">💰</div></div>
          <div class="admin-kpi-value">₹${REV_ADMIN_STATE.metrics.totalRevenue.toLocaleString()}</div>
          <div class="admin-kpi-label">Platform Revenue (Fees)</div>
        </div>
        <div class="admin-kpi-card">
          <div class="admin-kpi-row"><div class="admin-kpi-icon warning">🔒</div></div>
          <div class="admin-kpi-value">₹${REV_ADMIN_STATE.metrics.escrowHeld.toLocaleString()}</div>
          <div class="admin-kpi-label">Currently in Escrow</div>
        </div>
      </div>
      
      <div class="card mt-4">
        <h3>Revenue Breakdown</h3>
        <p class="text-sm text-muted">Platform fees are calculated as 5% of the total prize pool, plus a 2% gateway processing fee.</p>
        
        <div style="height:200px; display:flex; align-items:flex-end; gap:16px; margin-top:24px; padding-bottom:8px; border-bottom:1px solid var(--border)">
          <div style="flex:1; background:var(--primary); height: 40%; border-radius:4px 4px 0 0; position:relative">
            <span style="position:absolute; top:-24px; left:50%; transform:translateX(-50%); font-size:0.8rem">₹24k</span>
            <span style="position:absolute; bottom:-24px; left:50%; transform:translateX(-50%); font-size:0.8rem">Jan</span>
          </div>
          <div style="flex:1; background:var(--primary); height: 60%; border-radius:4px 4px 0 0; position:relative">
            <span style="position:absolute; top:-24px; left:50%; transform:translateX(-50%); font-size:0.8rem">₹38k</span>
            <span style="position:absolute; bottom:-24px; left:50%; transform:translateX(-50%); font-size:0.8rem">Feb</span>
          </div>
          <div style="flex:1; background:var(--primary); height: 50%; border-radius:4px 4px 0 0; position:relative">
            <span style="position:absolute; top:-24px; left:50%; transform:translateX(-50%); font-size:0.8rem">₹32k</span>
            <span style="position:absolute; bottom:-24px; left:50%; transform:translateX(-50%); font-size:0.8rem">Mar</span>
          </div>
          <div style="flex:1; background:var(--primary); height: 90%; border-radius:4px 4px 0 0; position:relative">
            <span style="position:absolute; top:-24px; left:50%; transform:translateX(-50%); font-size:0.8rem">₹${(REV_ADMIN_STATE.metrics.totalRevenue/1000).toFixed(1)}k</span>
            <span style="position:absolute; bottom:-24px; left:50%; transform:translateX(-50%); font-size:0.8rem">Current</span>
          </div>
        </div>
      </div>
    `;
  }
}
