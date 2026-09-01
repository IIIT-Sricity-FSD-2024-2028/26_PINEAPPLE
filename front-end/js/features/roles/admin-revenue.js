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
        <div class="admin-kpi-card">
          <div class="admin-kpi-row"><div class="admin-kpi-icon success">🏆</div></div>
          <div class="admin-kpi-value">${REV_ADMIN_STATE.metrics.activeHackathons}</div>
          <div class="admin-kpi-label">Active Hackathons</div>
        </div>
        <div class="admin-kpi-card">
          <div class="admin-kpi-row"><div class="admin-kpi-icon" style="background:#8b5cf6;color:#fff">💸</div></div>
          <div class="admin-kpi-value">₹${REV_ADMIN_STATE.metrics.payoutsCompleted.toLocaleString()}</div>
          <div class="admin-kpi-label">Total Prize Payouts</div>
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
  } else if (REV_ADMIN_STATE.tab === "escrow") {
    const fundedEscrows = REV_ADMIN_STATE.escrows.filter(e => e.status === 'Funded');
    
    if (fundedEscrows.length === 0) {
      contentEl.innerHTML = `
        <div class="card mt-4">
          <h3>Escrowed Hackathon Prize Pools</h3>
          <p class="text-sm text-muted">Funds securely held pending hackathon completion. These are automatically released to winners upon host approval.</p>
          <div class="admin-users-empty mt-4">No active escrows currently held.</div>
        </div>
      `;
      return;
    }
    
    // Map escrows to hackathons for display
    contentEl.innerHTML = `
      <div class="card mt-4">
        <h3>Escrowed Hackathon Prize Pools</h3>
        <p class="text-sm text-muted">Funds securely held pending hackathon completion. These are automatically released to winners upon host approval.</p>
        
        <table class="admin-audit-table mt-4">
          <thead>
            <tr><th>Hackathon</th><th>Platform Fee</th><th>Prize Pool</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${fundedEscrows.map(e => {
              const hackathon = REV_ADMIN_STATE.hackathons.find(h => h.id === e.hackathonId);
              const hackathonName = hackathon ? hackathon.name : 'Unknown Hackathon';
              
              return `
                <tr>
                  <td class="font-semibold" style="color:var(--fg)">${escapeHtml(hackathonName)}</td>
                  <td>₹${(e.platformFee || 0).toLocaleString()}</td>
                  <td>₹${(e.prizeAmount || 0).toLocaleString()}</td>
                  <td><span class="admin-audit-type warning">Held in Escrow</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (REV_ADMIN_STATE.tab === "payouts") {
    if (REV_ADMIN_STATE.payouts.length === 0) {
      contentEl.innerHTML = `
        <div class="card mt-4">
          <h3>Recent Payouts</h3>
          <p class="text-sm text-muted">Prize money disbursed to winning teams via escrow release.</p>
          <div class="admin-users-empty mt-4">No recent payouts found.</div>
        </div>
      `;
      return;
    }
    
    contentEl.innerHTML = `
      <div class="card mt-4">
        <h3>Recent Payouts</h3>
        <p class="text-sm text-muted">Prize money disbursed to winning teams via escrow release.</p>
        
        <table class="admin-audit-table mt-4">
          <thead>
            <tr><th>Transaction ID</th><th>Recipient User ID</th><th>Amount</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody>
            ${REV_ADMIN_STATE.payouts.map(p => `
              <tr>
                <td class="text-xs text-muted" style="font-family:monospace">${p.id}</td>
                <td>${escapeHtml(p.payeeId)}</td>
                <td class="font-semibold">₹${(p.amount || 0).toLocaleString()}</td>
                <td><span class="admin-audit-type success">Completed</span></td>
                <td>${new Date(p.createdAt).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (REV_ADMIN_STATE.tab === "pricing") {
    // Keep pricing tiers static as before since they represent plans.
    contentEl.innerHTML = `
      <div class="card mt-4">
        <h3>Host Pricing Tiers (Unstop Model)</h3>
        <p class="text-sm text-muted">Configure the pricing plans available to organizations hosting hackathons.</p>
        
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:24px;">
          
          <div style="border:1px solid var(--border);border-radius:8px;padding:24px;display:flex;flex-direction:column">
            <h3 style="margin:0;font-size:1.2rem;color:var(--fg)">Basic Plan</h3>
            <div style="font-size:2rem;font-weight:700;margin:16px 0;color:var(--fg)">Free</div>
            <p class="text-sm text-muted" style="height:40px">For student clubs and non-profits</p>
            <ul style="margin:16px 0;padding-left:20px;font-size:0.9rem;flex:1;color:var(--fg)">
              <li style="margin-bottom:8px">Up to 100 participants</li>
              <li style="margin-bottom:8px">Standard Support</li>
              <li style="margin-bottom:8px">No platform fees</li>
            </ul>
            <button class="btn btn-outline" style="width:100%">Edit Tier</button>
          </div>
          
          <div style="border:2px solid var(--primary);border-radius:8px;padding:24px;display:flex;flex-direction:column;position:relative">
            <div style="position:absolute;top:-10px;right:16px;background:var(--primary);color:#fff;font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:12px">POPULAR</div>
            <h3 style="margin:0;font-size:1.2rem;color:var(--fg)">Pro Plan</h3>
            <div style="font-size:2rem;font-weight:700;margin:16px 0;color:var(--fg)">5% <span style="font-size:1rem;font-weight:400;color:var(--muted-fg)">of prize pool</span></div>
            <p class="text-sm text-muted" style="height:40px">For startups and mid-size companies</p>
            <ul style="margin:16px 0;padding-left:20px;font-size:0.9rem;flex:1;color:var(--fg)">
              <li style="margin-bottom:8px">Unlimited participants</li>
              <li style="margin-bottom:8px">Priority Support</li>
              <li style="margin-bottom:8px">Custom judging matrices</li>
              <li style="margin-bottom:8px">Marketing boost & featured listing</li>
            </ul>
            <button class="btn btn-primary" style="width:100%">Edit Tier</button>
          </div>
          
          <div style="border:1px solid var(--border);border-radius:8px;padding:24px;display:flex;flex-direction:column">
            <h3 style="margin:0;font-size:1.2rem;color:var(--fg)">Enterprise</h3>
            <div style="font-size:2rem;font-weight:700;margin:16px 0;color:var(--fg)">Custom</div>
            <p class="text-sm text-muted" style="height:40px">For large corporations</p>
            <ul style="margin:16px 0;padding-left:20px;font-size:0.9rem;flex:1;color:var(--fg)">
              <li style="margin-bottom:8px">Dedicated Account Manager</li>
              <li style="margin-bottom:8px">White-labeled portal</li>
              <li style="margin-bottom:8px">Advanced analytics API</li>
              <li style="margin-bottom:8px">Custom payment gateways</li>
            </ul>
            <button class="btn btn-outline" style="width:100%">Edit Tier</button>
          </div>
          
        </div>
      </div>
    `;
  }
}
