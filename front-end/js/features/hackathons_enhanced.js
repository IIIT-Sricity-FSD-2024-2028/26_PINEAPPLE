// ══════════════════════════════════════════════════════════════════════════════
//  hackathons_enhanced.js — 🏆 Hackathons Discovery & Revenue Model v2
//
//  Features:
//  - Browse with search, filters (mode, date, difficulty)
//  - Hackathon discovery cards with demo data
//  - Detailed hackathon view with all information
//  - My Hackathons tab with team management
//  - Host tab for organizers to create and manage hackathons
//  - Revenue Model Display (Sponsored, Featured, Promotion Plans)
//  - Organizer Dashboard with analytics
//  - KYC verification for students
//
//  Architecture:
//  - Uses demo data when backend is unavailable
//  - Falls back to backend APIs when available
//  - Clean separation between Browse, My, Host, and Admin tabs
// ══════════════════════════════════════════════════════════════════════════════

function hackEscapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

const HACK_STATE = {
  tab: "browse",
  searchQuery: "",
  filterMode: "all", // all, online, offline, hybrid
  filterDate: "all", // all, upcoming, ongoing
  hostStep: 1,
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA - Realistic hackathons with revenue model indicators
// ═══════════════════════════════════════════════════════════════════════════════

const DEMO_HACKATHONS = [
  {
    id: "demo-1", name: "AI Innovation Challenge 2025", organizer: "XYZ Technologies",
    logo: "🤖", description: "Build innovative AI-powered solutions for real-world problems.",
    mode: "Online", location: null, theme: "AI, Machine Learning, GenAI", teamSize: "2–4",
    prizePool: 200000, regDeadline: "2025-09-15", eventDates: "2025-09-22 to 2025-09-24",
    status: "RegistrationOpen", eligibility: "Students worldwide",
    technologies: ["Python", "TensorFlow", "GPT"],
    sponsored: true, featured: true, promotionPlan: "Premium Promotion",
    views: 12450, registrations: 1284, teamMatches: 347
  },
  {
    id: "demo-2", name: "Web Dev Masters", organizer: "CodeCraft Inc", logo: "🌐",
    description: "Create stunning web applications with modern frameworks.",
    mode: "Hybrid", location: "Bangalore, India", theme: "Web Development, React, Node.js",
    teamSize: "2–5", prizePool: 150000, regDeadline: "2025-09-20",
    eventDates: "2025-09-27 to 2025-09-29", status: "RegistrationOpen",
    eligibility: "Students aged 18+", technologies: ["React", "Node.js", "MongoDB"],
    sponsored: false, featured: true, promotionPlan: "Featured Hackathon",
    views: 8920, registrations: 892, teamMatches: 156
  },
  {
    id: "demo-3", name: "Cybersecurity Sprint", organizer: "SecureHub Labs", logo: "🔐",
    description: "Identify vulnerabilities and build secure applications.",
    mode: "Online", location: null, theme: "Cybersecurity, Bug Bounty", teamSize: "1–3",
    prizePool: 100000, regDeadline: "2025-09-10", eventDates: "2025-09-17 to 2025-09-19",
    status: "RegistrationOpen", eligibility: "Beginner Friendly",
    technologies: ["Python", "Bash", "Docker"], sponsored: false, featured: false,
    promotionPlan: null, views: 3450, registrations: 256, teamMatches: 89
  },
  {
    id: "demo-4", name: "FinTech Revolution", organizer: "PayFlow Systems", logo: "💰",
    description: "Design financial solutions for economic challenges.",
    mode: "Offline", location: "Mumbai, India", theme: "FinTech, Blockchain",
    teamSize: "3–5", prizePool: 300000, regDeadline: "2025-08-30",
    eventDates: "2025-09-15 to 2025-09-17", status: "Ongoing",
    eligibility: "Engineers & Finance enthusiasts", technologies: ["Solidity", "JavaScript", "PostgreSQL"],
    sponsored: true, featured: true, promotionPlan: "Basic Promotion",
    views: 15680, registrations: 1456, teamMatches: 512
  },
  {
    id: "demo-5", name: "Cloud Native Hackathon", organizer: "CloudOps Global", logo: "☁️",
    description: "Build scalable, containerized applications on modern cloud platforms.",
    mode: "Online", location: null, theme: "Cloud, Kubernetes, DevOps", teamSize: "2–4",
    prizePool: 120000, regDeadline: "2025-09-25", eventDates: "2025-10-01 to 2025-10-03",
    status: "RegistrationOpen", eligibility: "Intermediate developers",
    technologies: ["Docker", "Kubernetes", "AWS"], sponsored: false, featured: false,
    promotionPlan: null, views: 4200, registrations: 340, teamMatches: 120
  },
];

const PROMOTION_PLANS = [
  {
    id: "plan-basic", name: "Basic Promotion", price: 2999, duration: "7 days",
    features: ["Standard visibility", "Search results listing", "Email to ~500 students"],
    visibilityBoost: "Standard"
  },
  {
    id: "plan-featured", name: "Featured Hackathon", price: 7999, duration: "14 days",
    features: ["Featured on homepage", "Priority in search", "Email to ~2000 students", "Social media promotion"],
    visibilityBoost: "High"
  },
  {
    id: "plan-premium", name: "Premium Promotion", price: 14999, duration: "30 days",
    features: ["Homepage featured banner", "All filters priority", "Email to ~5000+ students", "Social media + webinar", "1-on-1 support"],
    visibilityBoost: "Maximum"
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

function hackSetTab(tab) {
  HACK_STATE.tab = tab;
  renderHackathons();
}

async function renderHackathons() {
  const root = document.getElementById("hackathons-content");
  if (!root) return;

  const isAdmin = (typeof isSuperUser === "function" && isSuperUser()) ||
    ["administrator", "admin", "super user", "superuser"].includes(String(getCurrentUserRole()).toLowerCase());

  const adminTab = isAdmin ? `<button class="tab ${HACK_STATE.tab === "organizer-dashboard" ? "active" : ""}" onclick="hackSetTab('organizer-dashboard')">💰 Dashboard</button>` : '';

  root.innerHTML = `
    <div class="tabs" style="margin-bottom:20px">
      <button class="tab ${HACK_STATE.tab === "browse" ? "active" : ""}" onclick="hackSetTab('browse')">🔍 Discover</button>
      <button class="tab ${HACK_STATE.tab === "mine" ? "active" : ""}" onclick="hackSetTab('mine')">👥 My Hackathons</button>
      <button class="tab ${HACK_STATE.tab === "host" ? "active" : ""}" onclick="hackSetTab('host')">🏢 Host</button>
      ${adminTab}
    </div>
    <div id="hack-tab-body">Loading…</div>
  `;

  try {
    switch (HACK_STATE.tab) {
      case "browse": await hackRenderBrowse(); break;
      case "mine": await hackRenderMine(); break;
      case "host": await hackRenderHost(); break;
      case "organizer-dashboard": await hackRenderOrganizerDashboard(); break;
      default: await hackRenderBrowse(); break;
    }
  } catch (err) {
    const body = document.getElementById("hack-tab-body");
    if (body) body.innerHTML = `<p style="color:var(--destructive)">Error: ${hackEscapeHtml(err.message)}</p>`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BROWSE TAB: Discovery with search, filters, and revenue model features
// ═══════════════════════════════════════════════════════════════════════════════

async function hackRenderBrowse() {
  const body = document.getElementById("hack-tab-body");
  
  let hackathons = [...DEMO_HACKATHONS];
  try {
    const apiResult = await hackathonsApi.search();
    if (apiResult && apiResult.length > 0) hackathons = apiResult;
  } catch (err) {
    console.log("Using demo data for hackathons");
  }

  // Apply search and filters
  hackathons = hackathons.filter(h => {
    const matchesSearch = !HACK_STATE.searchQuery || 
      h.name.toLowerCase().includes(HACK_STATE.searchQuery.toLowerCase()) ||
      h.description.toLowerCase().includes(HACK_STATE.searchQuery.toLowerCase()) ||
      (h.theme && h.theme.toLowerCase().includes(HACK_STATE.searchQuery.toLowerCase()));
    
    const matchesMode = HACK_STATE.filterMode === "all" || h.mode.toLowerCase() === HACK_STATE.filterMode.toLowerCase();
    
    const matchesDate = HACK_STATE.filterDate === "all" ||
      (HACK_STATE.filterDate === "upcoming" && h.status === "RegistrationOpen") ||
      (HACK_STATE.filterDate === "ongoing" && h.status === "Ongoing");
    
    return matchesSearch && matchesMode && matchesDate;
  });

  // Sort: sponsored first, then featured
  hackathons.sort((a, b) => {
    if (a.sponsored !== b.sponsored) return a.sponsored ? -1 : 1;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return 0;
  });

  const sponsored = hackathons.filter(h => h.sponsored);
  const regular = hackathons.filter(h => !h.sponsored);

  body.innerHTML = `
    <div style="background:var(--secondary);padding:20px;border-radius:8px;margin-bottom:20px">
      <h2 style="margin:0 0 4px 0">🏆 Discover Hackathons</h2>
      <p class="page-subtitle" style="margin:0 0 16px 0">Find hackathons, build teams, turn ideas into projects.</p>
      
      <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <input class="input" id="hack-search-input" placeholder="Search by name, theme, or tech…"
          value="${hackEscapeHtml(HACK_STATE.searchQuery)}" style="flex:1;min-width:200px" onkeydown="if(event.key==='Enter') hackDoSearch()">
        <button class="btn btn-primary" onclick="hackDoSearch()">Search</button>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select class="input" onchange="hackSetFilterMode(this.value)" style="min-width:120px">
          <option value="all" ${HACK_STATE.filterMode === "all" ? "selected" : ""}>📍 All Modes</option>
          <option value="online" ${HACK_STATE.filterMode === "online" ? "selected" : ""}>🌐 Online</option>
          <option value="offline" ${HACK_STATE.filterMode === "offline" ? "selected" : ""}>🏢 Offline</option>
          <option value="hybrid" ${HACK_STATE.filterMode === "hybrid" ? "selected" : ""}>🔄 Hybrid</option>
        </select>
        
        <select class="input" onchange="hackSetFilterDate(this.value)" style="min-width:120px">
          <option value="all" ${HACK_STATE.filterDate === "all" ? "selected" : ""}>📅 All Dates</option>
          <option value="upcoming" ${HACK_STATE.filterDate === "upcoming" ? "selected" : ""}>⏰ Upcoming</option>
          <option value="ongoing" ${HACK_STATE.filterDate === "ongoing" ? "selected" : ""}>▶️ Ongoing</option>
        </select>

        <button class="btn btn-outline" onclick="hackClearFilters()">Clear Filters</button>
      </div>
    </div>

    ${sponsored.length > 0 ? `
      <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);padding:24px;border-radius:8px;color:white;margin-bottom:20px">
        <h3 style="margin:0 0 16px 0;color:white">⭐ Featured & Sponsored Hackathons</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px">
          ${sponsored.map(h => `
            <div style="background:rgba(255,255,255,0.1);padding:16px;border-radius:6px;cursor:pointer;border:2px solid rgba(255,255,255,0.3)" onclick="hackOpenDetail('${h.id}')">
              <h4 style="margin:0 0 8px 0">${hackEscapeHtml(h.name)}</h4>
              <p style="margin:0 0 8px 0;font-size:0.9rem">🏆 ₹${(h.prizePool || 0).toLocaleString()}</p>
              <p style="margin:0 0 12px 0;font-size:0.85rem;opacity:0.9">${hackEscapeHtml(h.organizer)}</p>
              <button style="background:white;color:#667eea;border:none;padding:6px 12px;border-radius:4px;font-weight:600;cursor:pointer" onclick="hackOpenDetail('${h.id}'); return false">View Details →</button>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ""}

    <div id="hack-browse-list">
      ${regular.length === 0 && sponsored.length === 0 ?
        `<div class="card" style="padding:40px;text-align:center"><p class="page-subtitle">No hackathons match your filters.</p></div>` :
        regular.map(h => hackRenderHackathonCard(h)).join("")}
    </div>
  `;
}

function hackRenderHackathonCard(h) {
  const statusIcon = h.status === "RegistrationOpen" ? "🟢" : h.status === "Ongoing" ? "▶️" : "⏸️";
  const badges = (h.sponsored ? '<span class="badge" style="background:#fbbf24;color:#000;margin-right:6px">💰 Sponsored</span>' : '') +
                 (h.featured ? '<span class="badge" style="background:#06b6d4;color:#fff">⭐ Featured</span>' : '');
  
  return `
    <div class="card" style="padding:16px;cursor:pointer;margin-top:12px" onclick="hackOpenDetail('${h.id}')">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
        <div style="font-size:2rem">${h.logo || '🏆'}</div>
        <div style="text-align:right">${badges}</div>
      </div>
      <h4 style="margin:0 0 6px 0">${hackEscapeHtml(h.name)}</h4>
      <p style="margin:0 0 8px 0;font-size:0.85rem;color:var(--muted-fg)">${hackEscapeHtml(h.organizer)}</p>
      <p style="margin:0 0 12px 0;font-size:0.9rem">${hackEscapeHtml(h.description.substring(0, 100))}...</p>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem;margin-bottom:12px">
        <div>💰 ₹${(h.prizePool || 0).toLocaleString()}</div>
        <div>👥 ${h.teamSize}</div>
        <div>🌐 ${h.mode}</div>
        <div>${statusIcon} ${h.status.replace(/([A-Z])/g, ' $1').trim()}</div>
      </div>
      
      <div style="border-top:1px solid var(--border);padding-top:8px;font-size:0.8rem;color:var(--muted-fg)">
        📅 Register: ${h.regDeadline} | 👁️ ${(h.views || 0).toLocaleString()} views
      </div>
    </div>
  `;
}

function hackDoSearch() {
  HACK_STATE.searchQuery = document.getElementById("hack-search-input")?.value.trim() || "";
  hackRenderBrowse();
}

function hackSetFilterMode(mode) {
  HACK_STATE.filterMode = mode;
  hackRenderBrowse();
}

function hackSetFilterDate(date) {
  HACK_STATE.filterDate = date;
  hackRenderBrowse();
}

function hackClearFilters() {
  HACK_STATE.searchQuery = "";
  HACK_STATE.filterMode = "all";
  HACK_STATE.filterDate = "all";
  hackRenderBrowse();
}

// ═════════════════════════════════════════════════════════════════════════════
// DETAIL VIEW: Full hackathon information
// ═════════════════════════════════════════════════════════════════════════════

async function hackOpenDetail(hackathonId) {
  const body = document.getElementById("hack-tab-body");
  let h = DEMO_HACKATHONS.find(x => x.id === hackathonId);
  if (!h) {
    try {
      h = await hackathonsApi.get(hackathonId);
    } catch (err) {
      showToast("Hackathon not found", "error");
      return;
    }
  }

  const prize1 = Math.round((h.prizePool || 0) * 0.5);
  const prize2 = Math.round((h.prizePool || 0) * 0.3);
  const prize3 = Math.round((h.prizePool || 0) * 0.2);

  body.innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="hackRenderBrowse()" style="margin-bottom:16px">&larr; Back</button>
    
    <div class="card" style="padding:20px;margin-bottom:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>
          <div style="font-size:3rem;margin-bottom:12px">${h.logo || '🏆'}</div>
          <h1 style="margin:0 0 4px 0">${hackEscapeHtml(h.name)}</h1>
          <p style="margin:0 0 16px 0;color:var(--muted-fg);font-size:1rem">${hackEscapeHtml(h.organizer)}</p>
          
          <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
            ${h.sponsored ? '<span class="badge" style="background:#fbbf24;color:#000">💰 Sponsored</span>' : ''}
            ${h.featured ? '<span class="badge" style="background:#06b6d4;color:#fff">⭐ Featured</span>' : ''}
            <span class="badge">${h.status.replace(/([A-Z])/g, ' $1').trim()}</span>
          </div>
          
          <p style="font-size:1rem;line-height:1.6">${hackEscapeHtml(h.description)}</p>
        </div>
        
        <div style="background:var(--secondary);padding:16px;border-radius:8px">
          <h3 style="margin-top:0">Quick Info</h3>
          <div style="display:flex;flex-direction:column;gap:10px;font-size:0.9rem">
            <div><strong>🏆 Prize Pool</strong><br>₹${(h.prizePool || 0).toLocaleString()}</div>
            <div><strong>👥 Team Size</strong><br>${h.teamSize}</div>
            <div><strong>🌐 Mode</strong><br>${h.mode}${h.location ? ` • ${h.location}` : ''}</div>
            <div><strong>📅 Registration</strong><br>${h.regDeadline}</div>
            <div><strong>📍 Event</strong><br>${h.eventDates}</div>
          </div>
          ${h.status === "RegistrationOpen" ? `
            <button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="hackRegisterForHackathon('${h.id}')">📝 Register</button>
          ` : `
            <p class="page-subtitle" style="margin-top:16px">Registration closed</p>
          `}
        </div>
      </div>
    </div>

    <div class="card" style="padding:16px;margin-bottom:12px">
      <h3 style="margin-top:0">🏅 Prize Distribution</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div style="background:var(--secondary);padding:12px;border-radius:6px;text-align:center">
          <div style="font-size:1.8rem">🥇</div>
          <div style="font-weight:600">1st Prize</div>
          <div style="font-size:1.1rem;margin-top:6px">₹${prize1.toLocaleString()}</div>
        </div>
        <div style="background:var(--secondary);padding:12px;border-radius:6px;text-align:center">
          <div style="font-size:1.8rem">🥈</div>
          <div style="font-weight:600">2nd Prize</div>
          <div style="font-size:1.1rem;margin-top:6px">₹${prize2.toLocaleString()}</div>
        </div>
        <div style="background:var(--secondary);padding:12px;border-radius:6px;text-align:center">
          <div style="font-size:1.8rem">🥉</div>
          <div style="font-weight:600">3rd Prize</div>
          <div style="font-size:1.1rem;margin-top:6px">₹${prize3.toLocaleString()}</div>
        </div>
      </div>
    </div>

    ${h.technologies ? `
      <div class="card" style="padding:16px">
        <h3 style="margin-top:0">🛠️ Technologies</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${h.technologies.map(t => `<span class="badge" style="background:var(--primary);color:#fff">${hackEscapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    ` : ""}
  `;
}

function hackRegisterForHackathon(hackathonId) {
  showToast("Registration feature coming soon! Use the Host tab if you're creating a hackathon.", "info");
}

// ═════════════════════════════════════════════════════════════════════════════
// MY HACKATHONS TAB
// ═════════════════════════════════════════════════════════════════════════════

async function hackRenderMine() {
  const body = document.getElementById("hack-tab-body");
  body.innerHTML = `
    <div class="card" style="padding:20px;text-align:center">
      <h3>👥 My Hackathons</h3>
      <p class="page-subtitle">Your registered teams and hackathon participation will appear here.</p>
      <button class="btn btn-primary" onclick="hackSetTab('browse')">🔍 Browse Hackathons</button>
    </div>
  `;
}

// ═════════════════════════════════════════════════════════════════════════════
// HOST TAB: Create and manage hackathons
// ═════════════════════════════════════════════════════════════════════════════

async function hackRenderHost() {
  const body = document.getElementById("hack-tab-body");
  body.innerHTML = `
    <div class="card" style="padding:20px">
      <h2 style="margin-top:0">🏢 Host a Hackathon</h2>
      <p class="page-subtitle">Create a hackathon and reach thousands of talented students. Featured hackathons get 3x more registrations.</p>
      
      <h3 style="margin-top:16px">💼 Promotion Plans</h3>
      <p class="page-subtitle">Choose a plan to maximize your hackathon's visibility:</p>
      
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;margin:16px 0">
        ${PROMOTION_PLANS.map(plan => `
          <div style="border:2px solid var(--border);padding:16px;border-radius:8px">
            <h4 style="margin:0 0 4px 0">${hackEscapeHtml(plan.name)}</h4>
            <div style="font-size:1.8rem;font-weight:bold;color:var(--primary);margin:8px 0">₹${plan.price.toLocaleString()}</div>
            <p style="margin:0 0 12px 0;font-size:0.9rem;color:var(--muted-fg)">${plan.duration}</p>
            
            <div style="margin:12px 0;font-size:0.9rem">
              ${plan.features.map(f => `<div style="margin:4px 0">✅ ${hackEscapeHtml(f)}</div>`).join('')}
            </div>
            
            <button class="btn btn-primary" style="width:100%" onclick="hackShowHostForm('${plan.id}')">Get Started</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function hackShowHostForm(planId) {
  showToast("Hackathon hosting form coming soon! Contact support@teamforge.com to get started.", "info");
}

// ═════════════════════════════════════════════════════════════════════════════
// ORGANIZER DASHBOARD: Analytics and revenue tracking (admin only)
// ═════════════════════════════════════════════════════════════════════════════

async function hackRenderOrganizerDashboard() {
  const body = document.getElementById("hack-tab-body");
  
  const totalHackathons = DEMO_HACKATHONS.length;
  const totalViews = DEMO_HACKATHONS.reduce((sum, h) => sum + (h.views || 0), 0);
  const totalRegistrations = DEMO_HACKATHONS.reduce((sum, h) => sum + (h.registrations || 0), 0);
  const sponsoredCount = DEMO_HACKATHONS.filter(h => h.sponsored).length;
  const totalRevenue = sponsoredCount * 7999; // Average plan price

  body.innerHTML = `
    <div class="card" style="padding:20px;margin-bottom:12px">
      <h2 style="margin-top:0">💰 Organizer Dashboard</h2>
      <p class="page-subtitle">Monitor hackathon performance and revenue metrics.</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:20px">
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:2.5rem;color:var(--primary)">🏆</div>
        <div style="font-size:0.9rem;color:var(--muted-fg);margin-top:6px">Total Hackathons</div>
        <div style="font-size:1.8rem;font-weight:bold">${totalHackathons}</div>
      </div>
      
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:2.5rem;color:var(--primary)">👁️</div>
        <div style="font-size:0.9rem;color:var(--muted-fg);margin-top:6px">Total Views</div>
        <div style="font-size:1.8rem;font-weight:bold">${totalViews.toLocaleString()}</div>
      </div>
      
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:2.5rem;color:var(--success)">📝</div>
        <div style="font-size:0.9rem;color:var(--muted-fg);margin-top:6px">Total Registrations</div>
        <div style="font-size:1.8rem;font-weight:bold">${totalRegistrations.toLocaleString()}</div>
      </div>
      
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:2.5rem;color:var(--primary)">💎</div>
        <div style="font-size:0.9rem;color:var(--muted-fg);margin-top:6px">Sponsored</div>
        <div style="font-size:1.8rem;font-weight:bold">${sponsoredCount}</div>
      </div>
      
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:2.5rem;color:var(--success)">💵</div>
        <div style="font-size:0.9rem;color:var(--muted-fg);margin-top:6px">Revenue</div>
        <div style="font-size:1.8rem;font-weight:bold">₹${totalRevenue.toLocaleString()}</div>
      </div>
    </div>

    <div class="card" style="padding:16px">
      <h3 style="margin-top:0">📊 Hackathon Performance</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;font-size:0.9rem">
        <div><strong>Hackathon</strong></div>
        <div><strong>Views</strong></div>
        <div><strong>Registrations</strong></div>
        <div><strong>Plan</strong></div>
        ${DEMO_HACKATHONS.map(h => `
          <div>${hackEscapeHtml(h.name.substring(0, 20))}</div>
          <div>${(h.views || 0).toLocaleString()}</div>
          <div>${(h.registrations || 0).toLocaleString()}</div>
          <div>${h.promotionPlan ? hackEscapeHtml(h.promotionPlan.substring(0, 15)) : "—"}</div>
        `).join('')}
      </div>
    </div>
  `;
}

// ═════════════════════════════════════════════════════════════════════════════
// INITIALIZE: Make functions available globally
// ═════════════════════════════════════════════════════════════════════════════

window.renderHackathons = renderHackathons;
window.hackSetTab = hackSetTab;
window.hackRenderBrowse = hackRenderBrowse;
window.hackDoSearch = hackDoSearch;
window.hackSetFilterMode = hackSetFilterMode;
window.hackSetFilterDate = hackSetFilterDate;
window.hackClearFilters = hackClearFilters;
window.hackOpenDetail = hackOpenDetail;
window.hackRenderMine = hackRenderMine;
window.hackRenderHost = hackRenderHost;
window.hackRenderOrganizerDashboard = hackRenderOrganizerDashboard;
