// ══════════════════════════════════════════════════════════════════════════════
//  hackathons.js — 🏆 Hackathons Discovery & Revenue Model v3
//
//  Features:
//  - Browse with search, filters (mode, date); API-first with demo fallback
//  - Hackathon detail view with eligibility, rules, register modal
//  - My Hackathons: joined teams, pending invites (Accept/Decline), created
//  - Host tab: real 3-step creation form (basic → rules → promotion + confirm)
//  - Promotion purchase: mock payment modal, updates sponsored/featured flags
//  - Organizer Dashboard: real API data with demo fallback
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
  filterMode: "all",
  filterDate: "all",
  hostStep: 1,
  hostFormData: {},
  selectedPlanId: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO FALLBACK DATA (used only when backend is unreachable)
// ═══════════════════════════════════════════════════════════════════════════════

const DEMO_HACKATHONS = [
  {
    id: "demo-1", name: "AI Innovation Challenge 2025", organizer: "XYZ Technologies",
    logo: "🤖", description: "Build innovative AI-powered solutions for real-world problems.",
    mode: "Online", location: null, theme: "AI, Machine Learning, GenAI", teamSize: "2–4",
    prizePool: 200000, regDeadline: "2025-09-15", eventDates: "2025-09-22 to 2025-09-24",
    status: "RegistrationOpen", eligibility: "Students worldwide",
    rules: "Standard hackathon rules apply. Max one submission per team.",
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
    eligibility: "Students aged 18+", rules: "Teams must build from scratch during the event.",
    technologies: ["React", "Node.js", "MongoDB"],
    sponsored: false, featured: true, promotionPlan: "Featured Hackathon",
    views: 8920, registrations: 892, teamMatches: 156
  },
  {
    id: "demo-3", name: "Cybersecurity Sprint", organizer: "SecureHub Labs", logo: "🔐",
    description: "Identify vulnerabilities and build secure applications.",
    mode: "Online", location: null, theme: "Cybersecurity, Bug Bounty", teamSize: "1–3",
    prizePool: 100000, regDeadline: "2025-09-10", eventDates: "2025-09-17 to 2025-09-19",
    status: "RegistrationOpen", eligibility: "Beginner Friendly",
    rules: "Ethical hacking only. Any harmful activity results in disqualification.",
    technologies: ["Python", "Bash", "Docker"], sponsored: false, featured: false,
    promotionPlan: null, views: 3450, registrations: 256, teamMatches: 89
  },
  {
    id: "demo-4", name: "FinTech Revolution", organizer: "PayFlow Systems", logo: "💰",
    description: "Design financial solutions for economic challenges.",
    mode: "Offline", location: "Mumbai, India", theme: "FinTech, Blockchain",
    teamSize: "3–5", prizePool: 300000, regDeadline: "2025-08-30",
    eventDates: "2025-09-15 to 2025-09-17", status: "Ongoing",
    eligibility: "Engineers & Finance enthusiasts",
    rules: "All projects must be deployable and functional at demo time.",
    technologies: ["Solidity", "JavaScript", "PostgreSQL"],
    sponsored: true, featured: true, promotionPlan: "Basic Promotion",
    views: 15680, registrations: 1456, teamMatches: 512
  },
  {
    id: "demo-5", name: "Cloud Native Hackathon", organizer: "CloudOps Global", logo: "☁️",
    description: "Build scalable, containerized applications on modern cloud platforms.",
    mode: "Online", location: null, theme: "Cloud, Kubernetes, DevOps", teamSize: "2–4",
    prizePool: 120000, regDeadline: "2025-09-25", eventDates: "2025-10-01 to 2025-10-03",
    status: "RegistrationOpen", eligibility: "Intermediate developers",
    rules: "Solution must run on Kubernetes. Provide a working deployment manifest.",
    technologies: ["Docker", "Kubernetes", "AWS"], sponsored: false, featured: false,
    promotionPlan: null, views: 4200, registrations: 340, teamMatches: 120
  },
];

const DEMO_PROMOTION_PLANS = [
  {
    id: "plan-basic", name: "Basic Promotion", price: 2999, duration: "7 days",
    features: ["Standard visibility", "Search results listing", "Email to ~500 students"],
    visibilityBoost: "Standard", estimatedReach: 500
  },
  {
    id: "plan-featured", name: "Featured Hackathon", price: 7999, duration: "14 days",
    features: ["Featured on homepage", "Priority in search", "Email to ~2000 students", "Social media promotion"],
    visibilityBoost: "High", estimatedReach: 2000
  },
  {
    id: "plan-premium", name: "Premium Promotion", price: 14999, duration: "30 days",
    features: ["Homepage featured banner", "All filters priority", "Email to ~5000+ students", "Social media + webinar", "1-on-1 support"],
    visibilityBoost: "Maximum", estimatedReach: 5000
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Normalize an API hackathon record to the flat shape the frontend uses
// (the backend returns nested prizes, dates, teamSizeLimits etc.)
// ─────────────────────────────────────────────────────────────────────────────
function hackNormalize(h) {
  if (!h) return h;
  return {
    ...h,
    prizePool: h.prizePool ?? h.prizes?.totalPool ?? 0,
    teamSize: h.teamSize ?? (h.teamSizeLimits ? `${h.teamSizeLimits.min}–${h.teamSizeLimits.max}` : "?"),
    regDeadline: h.regDeadline ?? h.dates?.registrationClose?.slice(0, 10) ?? "",
    eventDates: h.eventDates ?? (h.dates ? `${h.dates.start?.slice(0, 10)} to ${h.dates.end?.slice(0, 10)}` : ""),
    organizer: h.organizer ?? h.hostId ?? "Unknown",
    logo: h.logo ?? "🏆",
    sponsored: h.sponsored ?? false,
    featured: h.featured ?? false,
    technologies: h.technologies ?? [],
    eligibility: h.eligibility ?? "Open to all",
    rules: h.rules ?? "",
  };
}

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

  const adminTab = isAdmin
    ? `<button class="tab ${HACK_STATE.tab === "organizer-dashboard" ? "active" : ""}" onclick="hackSetTab('organizer-dashboard')">💰 Dashboard</button>`
    : "";

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
      case "host": hackRenderHost(); break;
      case "organizer-dashboard": await hackRenderOrganizerDashboard(); break;
      default: await hackRenderBrowse(); break;
    }
  } catch (err) {
    const body = document.getElementById("hack-tab-body");
    if (body) body.innerHTML = `<p style="color:var(--destructive)">Error: ${hackEscapeHtml(err.message)}</p>`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BROWSE TAB — API-first, demo fallback, normalize, filter, sort
// ═══════════════════════════════════════════════════════════════════════════════

async function hackRenderBrowse() {
  const body = document.getElementById("hack-tab-body");
  body.innerHTML = `<div class="card" style="padding:40px;text-align:center"><p class="page-subtitle">Loading hackathons…</p></div>`;

  let hackathons = [];
  try {
    const apiResult = await hackathonsApi.search(HACK_STATE.searchQuery || undefined);
    if (Array.isArray(apiResult) && apiResult.length > 0) {
      hackathons = apiResult.map(hackNormalize);
    }
  } catch {
    /* network down — fall through to demo */
  }
  if (hackathons.length === 0) {
    hackathons = [...DEMO_HACKATHONS];
  }

  // Apply filters
  hackathons = hackathons.filter(h => {
    const q = HACK_STATE.searchQuery.toLowerCase();
    const matchesSearch = !q ||
      (h.name || "").toLowerCase().includes(q) ||
      (h.description || "").toLowerCase().includes(q) ||
      (h.theme || "").toLowerCase().includes(q);

    const matchesMode = HACK_STATE.filterMode === "all" ||
      (h.mode || "").toLowerCase() === HACK_STATE.filterMode.toLowerCase();

    const matchesDate = HACK_STATE.filterDate === "all" ||
      (HACK_STATE.filterDate === "upcoming" && h.status === "RegistrationOpen") ||
      (HACK_STATE.filterDate === "ongoing" && h.status === "Ongoing");

    return matchesSearch && matchesMode && matchesDate;
  });

  // Sort: sponsored → featured → rest
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
          value="${hackEscapeHtml(HACK_STATE.searchQuery)}" style="flex:1;min-width:200px"
          onkeydown="if(event.key==='Enter') hackDoSearch()">
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
      <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:24px;border-radius:8px;color:white;margin-bottom:20px">
        <h3 style="margin:0 0 16px 0;color:white">⭐ Featured &amp; Sponsored Hackathons</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
          ${sponsored.map(h => `
            <div style="background:rgba(255,255,255,0.1);padding:16px;border-radius:6px;cursor:pointer;border:2px solid rgba(255,255,255,0.3)" onclick="hackOpenDetail('${h.id}')">
              <h4 style="margin:0 0 8px 0">${hackEscapeHtml(h.name)}</h4>
              <p style="margin:0 0 8px 0;font-size:0.9rem">🏆 ₹${(h.prizePool || 0).toLocaleString()}</p>
              <p style="margin:0 0 12px 0;font-size:0.85rem;opacity:0.9">${hackEscapeHtml(h.organizer)}</p>
              <button style="background:white;color:#667eea;border:none;padding:6px 12px;border-radius:4px;font-weight:600;cursor:pointer">View Details →</button>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ""}

    <div id="hack-browse-list">
      ${regular.length === 0 && sponsored.length === 0
        ? `<div class="card" style="padding:40px;text-align:center"><p class="page-subtitle">No hackathons match your filters.</p></div>`
        : regular.map(h => hackRenderHackathonCard(h)).join("")}
    </div>
  `;
}

function hackRenderHackathonCard(h) {
  const statusIcon = h.status === "RegistrationOpen" ? "🟢" : h.status === "Ongoing" ? "▶️" : "⏸️";
  const badges = (h.sponsored ? '<span class="badge" style="background:#fbbf24;color:#000;margin-right:6px">💰 Sponsored</span>' : "") +
    (h.featured ? '<span class="badge" style="background:#06b6d4;color:#fff">⭐ Featured</span>' : "");

  return `
    <div class="card" style="padding:16px;cursor:pointer;margin-top:12px" onclick="hackOpenDetail('${h.id}')">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
        <div style="font-size:2rem">${h.logo || "🏆"}</div>
        <div style="text-align:right">${badges}</div>
      </div>
      <h4 style="margin:0 0 6px 0">${hackEscapeHtml(h.name)}</h4>
      <p style="margin:0 0 8px 0;font-size:0.85rem;color:var(--muted-fg)">${hackEscapeHtml(h.organizer)}</p>
      <p style="margin:0 0 12px 0;font-size:0.9rem">${hackEscapeHtml((h.description || "").substring(0, 100))}…</p>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem;margin-bottom:12px">
        <div>💰 ₹${(h.prizePool || 0).toLocaleString()}</div>
        <div>👥 ${h.teamSize || "?"}</div>
        <div>🌐 ${h.mode || "Online"}</div>
        <div>${statusIcon} ${(h.status || "").replace(/([A-Z])/g, " $1").trim()}</div>
      </div>
      
      <div style="border-top:1px solid var(--border);padding-top:8px;font-size:0.8rem;color:var(--muted-fg)">
        📅 Register: ${h.regDeadline || "—"} | 👁️ ${(h.views || 0).toLocaleString()} views
      </div>
    </div>
  `;
}

function hackDoSearch() {
  HACK_STATE.searchQuery = document.getElementById("hack-search-input")?.value.trim() || "";
  hackRenderBrowse();
}
function hackSetFilterMode(mode) { HACK_STATE.filterMode = mode; hackRenderBrowse(); }
function hackSetFilterDate(date) { HACK_STATE.filterDate = date; hackRenderBrowse(); }
function hackClearFilters() {
  HACK_STATE.searchQuery = ""; HACK_STATE.filterMode = "all"; HACK_STATE.filterDate = "all";
  hackRenderBrowse();
}

// ═════════════════════════════════════════════════════════════════════════════
// DETAIL VIEW — API-first, demo fallback, full fields + register modal
// ═════════════════════════════════════════════════════════════════════════════

async function hackOpenDetail(hackathonId) {
  const body = document.getElementById("hack-tab-body");
  body.innerHTML = `<div class="card" style="padding:40px;text-align:center"><p class="page-subtitle">Loading…</p></div>`;

  let h = null;
  try {
    h = hackNormalize(await hackathonsApi.get(hackathonId));
  } catch {
    h = DEMO_HACKATHONS.find(x => x.id === hackathonId) || null;
  }

  if (!h) {
    body.innerHTML = `<p style="color:var(--destructive)">Hackathon not found.</p>`;
    return;
  }

  const prize1 = Math.round((h.prizePool || 0) * 0.5);
  const prize2 = Math.round((h.prizePool || 0) * 0.3);
  const prize3 = Math.round((h.prizePool || 0) * 0.2);

  body.innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="hackRenderBrowse()" style="margin-bottom:16px">&larr; Back</button>
    
    <div class="card" style="padding:20px;margin-bottom:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>
          <div style="font-size:3rem;margin-bottom:12px">${h.logo}</div>
          <h1 style="margin:0 0 4px 0">${hackEscapeHtml(h.name)}</h1>
          <p style="margin:0 0 16px 0;color:var(--muted-fg)">${hackEscapeHtml(h.organizer)}</p>
          
          <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
            ${h.sponsored ? '<span class="badge" style="background:#fbbf24;color:#000">💰 Sponsored</span>' : ""}
            ${h.featured ? '<span class="badge" style="background:#06b6d4;color:#fff">⭐ Featured</span>' : ""}
            <span class="badge">${(h.status || "").replace(/([A-Z])/g, " $1").trim()}</span>
          </div>
          
          <p style="font-size:1rem;line-height:1.6">${hackEscapeHtml(h.description)}</p>

          ${h.eligibility ? `
            <div style="margin-top:12px">
              <strong>✅ Eligibility:</strong>
              <p style="margin:4px 0 0 0;color:var(--muted-fg)">${hackEscapeHtml(h.eligibility)}</p>
            </div>` : ""}

          ${h.rules ? `
            <div style="margin-top:12px">
              <strong>📋 Rules:</strong>
              <p style="margin:4px 0 0 0;color:var(--muted-fg)">${hackEscapeHtml(h.rules)}</p>
            </div>` : ""}
        </div>
        
        <div style="background:var(--secondary);padding:16px;border-radius:8px">
          <h3 style="margin-top:0">Quick Info</h3>
          <div style="display:flex;flex-direction:column;gap:10px;font-size:0.9rem">
            <div><strong>🏆 Prize Pool</strong><br>₹${(h.prizePool || 0).toLocaleString()}</div>
            <div><strong>👥 Team Size</strong><br>${h.teamSize || "?"}</div>
            <div><strong>🌐 Mode</strong><br>${h.mode}${h.location ? ` • ${h.location}` : ""}</div>
            <div><strong>📅 Registration</strong><br>${h.regDeadline || "—"}</div>
            <div><strong>📍 Event</strong><br>${h.eventDates || "—"}</div>
            ${h.views ? `<div><strong>👁️ Views</strong><br>${h.views.toLocaleString()}</div>` : ""}
          </div>
          ${h.status === "RegistrationOpen"
            ? `<button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="hackShowRegisterModal('${h.id}')">📝 Register Your Team</button>`
            : `<p class="page-subtitle" style="margin-top:16px">Registration closed</p>`}
        </div>
      </div>
    </div>

    <div class="card" style="padding:16px;margin-bottom:12px">
      <h3 style="margin-top:0">🏅 Prize Distribution</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        ${["🥇", "🥈", "🥉"].map((medal, i) => `
          <div style="background:var(--secondary);padding:12px;border-radius:6px;text-align:center">
            <div style="font-size:1.8rem">${medal}</div>
            <div style="font-weight:600">${i + 1}${["st", "nd", "rd"][i]} Prize</div>
            <div style="font-size:1.1rem;margin-top:6px">₹${[prize1, prize2, prize3][i].toLocaleString()}</div>
          </div>`).join("")}
      </div>
    </div>

    ${h.technologies && h.technologies.length > 0 ? `
      <div class="card" style="padding:16px">
        <h3 style="margin-top:0">🛠️ Technologies</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${h.technologies.map(t => `<span class="badge" style="background:var(--primary);color:#fff">${hackEscapeHtml(t)}</span>`).join("")}
        </div>
      </div>` : ""}

    <!-- Register Modal (hidden by default) -->
    <div id="hack-register-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center">
      <div class="card" style="padding:24px;max-width:480px;width:90%;max-height:90vh;overflow-y:auto">
        <h3 style="margin-top:0">📝 Register for ${hackEscapeHtml(h.name)}</h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label class="label">Team Name *</label>
            <input class="input" id="reg-team-name" placeholder="My Awesome Team" style="width:100%">
          </div>
          <div>
            <label class="label">Your College / Institute</label>
            <input class="input" id="reg-college" placeholder="IIT Delhi" style="width:100%">
          </div>
          <div>
            <label class="label">Student ID</label>
            <input class="input" id="reg-student-id" placeholder="2021CS001" style="width:100%">
          </div>
          <p class="page-subtitle" style="font-size:0.82rem;margin:0">You will be the Team Lead. You can invite teammates after registration.</p>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-primary" style="flex:1" onclick="hackSubmitRegister('${h.id}')">Register</button>
          <button class="btn btn-outline" onclick="hackCloseRegisterModal()">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

function hackShowRegisterModal(hackathonId) {
  const modal = document.getElementById("hack-register-modal");
  if (modal) modal.style.display = "flex";
}
function hackCloseRegisterModal() {
  const modal = document.getElementById("hack-register-modal");
  if (modal) modal.style.display = "none";
}

async function hackSubmitRegister(hackathonId) {
  const teamName = document.getElementById("reg-team-name")?.value.trim();
  const college = document.getElementById("reg-college")?.value.trim();
  const studentId = document.getElementById("reg-student-id")?.value.trim();

  if (!teamName) { showToast("Team name is required.", "error"); return; }

  const userId = getCurrentUserId();
  try {
    await hackathonsApi.registerLead(hackathonId, {
      userId,
      teamName,
      college: college || undefined,
      studentId: studentId || undefined,
    });
    hackCloseRegisterModal();
    showToast(`✅ Registered as team lead of "${teamName}"!`, "success");
  } catch (err) {
    showToast("Registration failed: " + err.message, "error");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MY HACKATHONS TAB — joined teams, pending invites, created hackathons
// ═════════════════════════════════════════════════════════════════════════════

async function hackRenderMine() {
  const body = document.getElementById("hack-tab-body");
  body.innerHTML = `<div class="card" style="padding:40px;text-align:center"><p class="page-subtitle">Loading your hackathons…</p></div>`;

  const userId = getCurrentUserId();
  let joinedHackathons = [];
  let invites = [];
  let createdHackathons = [];

  // Fetch joined hackathons (where user has a team)
  try {
    const result = await hackathonsApi.byUser(userId);
    if (Array.isArray(result)) joinedHackathons = result.map(hackNormalize);
  } catch { /* backend down */ }

  // Fetch pending team invitations
  try {
    const result = await teamInvitationsApi.forUser(userId);
    if (Array.isArray(result)) invites = result.filter(i => i.status === "pending");
  } catch { /* backend down */ }

  // Fetch created hackathons (using userId as orgId fallback)
  try {
    const result = await hackathonsApi.byOrg(userId);
    if (Array.isArray(result)) createdHackathons = result.map(hackNormalize);
  } catch { /* backend down */ }

  body.innerHTML = `
    <!-- Pending Invites -->
    ${invites.length > 0 ? `
      <div class="card" style="padding:20px;margin-bottom:16px;border-left:4px solid var(--primary)">
        <h3 style="margin-top:0">📨 Pending Team Invites (${invites.length})</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${invites.map(inv => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--secondary);border-radius:6px">
              <div>
                <strong>Team ID:</strong> ${hackEscapeHtml(inv.teamId)}<br>
                <span style="font-size:0.85rem;color:var(--muted-fg)">Invited by: ${hackEscapeHtml(inv.invitedBy)}</span>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-primary btn-sm" onclick="hackAcceptInvite('${inv.id}')">✅ Accept</button>
                <button class="btn btn-outline btn-sm" onclick="hackDeclineInvite('${inv.id}')">❌ Decline</button>
              </div>
            </div>`).join("")}
        </div>
      </div>` : ""}

    <!-- Joined Hackathons -->
    <div class="card" style="padding:20px;margin-bottom:16px">
      <h3 style="margin-top:0">🎯 My Registered Hackathons</h3>
      ${joinedHackathons.length === 0
        ? `<p class="page-subtitle">You haven't registered for any hackathon yet. <button class="btn btn-primary btn-sm" onclick="hackSetTab('browse')">Browse Hackathons</button></p>`
        : joinedHackathons.map(h => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--secondary);border-radius:6px;margin-bottom:8px">
            <div>
              <div style="font-size:1.2rem;display:inline">${h.logo} </div>
              <strong>${hackEscapeHtml(h.name)}</strong>
              <div style="font-size:0.85rem;color:var(--muted-fg);margin-top:2px">
                ${h.mode} • ${(h.status || "").replace(/([A-Z])/g, " $1").trim()}
              </div>
            </div>
            <button class="btn btn-outline btn-sm" onclick="hackOpenDetail('${h.id}')">View</button>
          </div>`).join("")}
    </div>

    <!-- Created Hackathons -->
    <div class="card" style="padding:20px">
      <h3 style="margin-top:0">🏢 Hackathons I Created</h3>
      ${createdHackathons.length === 0
        ? `<p class="page-subtitle">You haven't hosted a hackathon yet. <button class="btn btn-primary btn-sm" onclick="hackSetTab('host')">Host One →</button></p>`
        : createdHackathons.map(h => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--secondary);border-radius:6px;margin-bottom:8px">
            <div>
              <div style="font-size:1.2rem;display:inline">${h.logo} </div>
              <strong>${hackEscapeHtml(h.name)}</strong>
              <div style="font-size:0.85rem;color:var(--muted-fg);margin-top:2px">
                ${(h.status || "").replace(/([A-Z])/g, " $1").trim()} • ${h.registrations || 0} registrations
                ${h.promotionPlan ? ` • 💎 ${hackEscapeHtml(h.promotionPlan)}` : ""}
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-outline btn-sm" onclick="hackOpenDetail('${h.id}')">View</button>
              ${!h.promotionPlan ? `<button class="btn btn-primary btn-sm" onclick="hackSetTab('host')">Promote</button>` : ""}
            </div>
          </div>`).join("")}
    </div>
  `;
}

async function hackAcceptInvite(inviteId) {
  const college = window.prompt("Enter your college name for student verification:");
  if (college === null) return; // cancelled
  try {
    await teamInvitationsApi.accept(inviteId, { collegeName: college || "Unknown", age: 20 });
    showToast("✅ Invite accepted! You've joined the team.", "success");
    hackRenderMine();
  } catch (err) {
    showToast("Failed: " + err.message, "error");
  }
}

async function hackDeclineInvite(inviteId) {
  try {
    await teamInvitationsApi.decline(inviteId);
    showToast("Invite declined.", "info");
    hackRenderMine();
  } catch (err) {
    showToast("Failed: " + err.message, "error");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// HOST TAB — 3-step form: Basic Info → Rules & Details → Promotion + Confirm
// ═════════════════════════════════════════════════════════════════════════════

function hackRenderHost() {
  const body = document.getElementById("hack-tab-body");
  switch (HACK_STATE.hostStep) {
    case 1: hackRenderHostStep1(body); break;
    case 2: hackRenderHostStep2(body); break;
    case 3: hackRenderHostStep3(body); break;
    default: hackRenderHostStep1(body); break;
  }
}

function hackRenderHostStep1(body) {
  const d = HACK_STATE.hostFormData;
  body.innerHTML = `
    <div class="card" style="padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <h2 style="margin:0">🏢 Host a Hackathon</h2>
        <span class="badge" style="background:var(--primary);color:#fff">Step 1 of 3</span>
      </div>
      <p class="page-subtitle" style="margin-bottom:20px">Basic information about your hackathon</p>

      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label class="label">Hackathon Name *</label>
          <input class="input" id="host-name" placeholder="e.g. AI Innovation Challenge 2025" value="${hackEscapeHtml(d.name || "")}" style="width:100%">
        </div>
        <div>
          <label class="label">Description *</label>
          <textarea class="input" id="host-desc" placeholder="What is this hackathon about?" rows="3" style="width:100%;resize:vertical">${hackEscapeHtml(d.description || "")}</textarea>
        </div>
        <div>
          <label class="label">Theme / Tags</label>
          <input class="input" id="host-theme" placeholder="e.g. AI, FinTech, Web3" value="${hackEscapeHtml(d.theme || "")}" style="width:100%">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label class="label">Emoji Logo</label>
            <input class="input" id="host-logo" placeholder="🏆" value="${hackEscapeHtml(d.logo || "")}" style="width:100%;font-size:1.4rem">
          </div>
          <div>
            <label class="label">Organizer / Company Name</label>
            <input class="input" id="host-organizer" placeholder="Your Company Ltd." value="${hackEscapeHtml(d.organizer || "")}" style="width:100%">
          </div>
        </div>
        <div>
          <label class="label">Technologies (comma-separated)</label>
          <input class="input" id="host-tech" placeholder="Python, React, Docker" value="${hackEscapeHtml((d.technologies || []).join(", "))}" style="width:100%">
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;margin-top:20px">
        <button class="btn btn-primary" onclick="hackNextStep()">Next: Rules &amp; Details →</button>
      </div>
    </div>
  `;
}

function hackRenderHostStep2(body) {
  const d = HACK_STATE.hostFormData;
  body.innerHTML = `
    <div class="card" style="padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <h2 style="margin:0">📋 Rules &amp; Details</h2>
        <span class="badge" style="background:var(--primary);color:#fff">Step 2 of 3</span>
      </div>
      <p class="page-subtitle" style="margin-bottom:20px">Logistics, eligibility, prize pool and dates</p>

      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label class="label">Mode *</label>
            <select class="input" id="host-mode" style="width:100%">
              <option value="Online" ${d.mode === "Online" ? "selected" : ""}>🌐 Online</option>
              <option value="Offline" ${d.mode === "Offline" ? "selected" : ""}>🏢 Offline</option>
              <option value="Hybrid" ${d.mode === "Hybrid" ? "selected" : ""}>🔄 Hybrid</option>
            </select>
          </div>
          <div>
            <label class="label">Location (if Offline/Hybrid)</label>
            <input class="input" id="host-location" placeholder="Mumbai, India" value="${hackEscapeHtml(d.location || "")}" style="width:100%">
          </div>
        </div>
        <div>
          <label class="label">Eligibility</label>
          <input class="input" id="host-eligibility" placeholder="Open to all students" value="${hackEscapeHtml(d.eligibility || "")}" style="width:100%">
        </div>
        <div>
          <label class="label">Rules</label>
          <textarea class="input" id="host-rules" placeholder="Describe the rules and judging criteria…" rows="3" style="width:100%;resize:vertical">${hackEscapeHtml(d.rules || "")}</textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div>
            <label class="label">Min Team Size *</label>
            <input class="input" id="host-min-team" type="number" min="1" max="10" value="${d.minTeamSize || 2}" style="width:100%">
          </div>
          <div>
            <label class="label">Max Team Size *</label>
            <input class="input" id="host-max-team" type="number" min="1" max="20" value="${d.maxTeamSize || 4}" style="width:100%">
          </div>
          <div>
            <label class="label">Prize Pool (₹) *</label>
            <input class="input" id="host-prize" type="number" min="1000" value="${d.totalPrizePool || ""}" placeholder="50000" style="width:100%">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div>
            <label class="label">Registration Close *</label>
            <input class="input" id="host-reg-close" type="date" value="${d.registrationClose || ""}" style="width:100%">
          </div>
          <div>
            <label class="label">Event Start</label>
            <input class="input" id="host-event-start" type="date" value="${d.eventStart || ""}" style="width:100%">
          </div>
          <div>
            <label class="label">Event End</label>
            <input class="input" id="host-event-end" type="date" value="${d.eventEnd || ""}" style="width:100%">
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;margin-top:20px">
        <button class="btn btn-outline" onclick="hackPrevStep()">← Back</button>
        <button class="btn btn-primary" onclick="hackNextStep()">Next: Choose Promotion →</button>
      </div>
    </div>
  `;
}

async function hackRenderHostStep3(body) {
  body.innerHTML = `<div class="card" style="padding:40px;text-align:center"><p class="page-subtitle">Loading promotion plans…</p></div>`;

  let plans = [];
  try {
    const result = await promotionsApi.getPlans();
    if (Array.isArray(result) && result.length > 0) plans = result;
  } catch { /* backend down */ }
  if (plans.length === 0) plans = DEMO_PROMOTION_PLANS;

  const d = HACK_STATE.hostFormData;

  body.innerHTML = `
    <div class="card" style="padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <h2 style="margin:0">💎 Promotion &amp; Confirm</h2>
        <span class="badge" style="background:var(--primary);color:#fff">Step 3 of 3</span>
      </div>
      <p class="page-subtitle" style="margin-bottom:20px">Optionally boost your hackathon's visibility, then create it.</p>

      <!-- Summary -->
      <div style="background:var(--secondary);padding:16px;border-radius:8px;margin-bottom:20px;font-size:0.9rem">
        <h4 style="margin:0 0 10px 0">📋 Summary</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div><strong>Name:</strong> ${hackEscapeHtml(d.name)}</div>
          <div><strong>Mode:</strong> ${hackEscapeHtml(d.mode || "Online")}</div>
          <div><strong>Prize Pool:</strong> ₹${(Number(d.totalPrizePool) || 0).toLocaleString()}</div>
          <div><strong>Team Size:</strong> ${d.minTeamSize}–${d.maxTeamSize}</div>
          <div><strong>Reg. Close:</strong> ${d.registrationClose || "—"}</div>
          <div><strong>Event:</strong> ${d.eventStart || "—"} to ${d.eventEnd || "—"}</div>
        </div>
      </div>

      <!-- Promotion Plan Cards -->
      <h3 style="margin-top:0">💼 Promotion Plans (optional)</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:20px">
        <div id="plan-card-none" style="border:2px solid ${!HACK_STATE.selectedPlanId ? "var(--primary)" : "var(--border)"};padding:16px;border-radius:8px;cursor:pointer" onclick="hackSelectPlan(null)">
          <h4 style="margin:0 0 4px 0">No Promotion</h4>
          <div style="font-size:1.5rem;font-weight:bold;color:var(--muted-fg);margin:8px 0">Free</div>
          <p style="font-size:0.85rem;color:var(--muted-fg);margin:0">Standard listing only</p>
        </div>
        ${plans.map(plan => `
          <div id="plan-card-${plan.id}" style="border:2px solid ${HACK_STATE.selectedPlanId === plan.id ? "var(--primary)" : "var(--border)"};padding:16px;border-radius:8px;cursor:pointer" onclick="hackSelectPlan('${plan.id}')">
            <h4 style="margin:0 0 4px 0">${hackEscapeHtml(plan.name)}</h4>
            <div style="font-size:1.5rem;font-weight:bold;color:var(--primary);margin:8px 0">₹${(plan.price || 0).toLocaleString()}</div>
            <p style="margin:0 0 8px 0;font-size:0.85rem;color:var(--muted-fg)">${plan.duration} days</p>
            <div style="font-size:0.85rem">
              ${(plan.features || []).map(f => `<div style="margin:3px 0">✅ ${hackEscapeHtml(f)}</div>`).join("")}
            </div>
          </div>`).join("")}
      </div>

      <div style="display:flex;justify-content:space-between;margin-top:20px">
        <button class="btn btn-outline" onclick="hackPrevStep()">← Back</button>
        <button class="btn btn-primary" onclick="hackSubmitHostForm()" id="host-submit-btn">
          🚀 Create Hackathon${HACK_STATE.selectedPlanId ? " + Purchase Promotion" : ""}
        </button>
      </div>
    </div>
  `;
}

function hackSelectPlan(planId) {
  HACK_STATE.selectedPlanId = planId;
  hackRenderHostStep3(document.getElementById("hack-tab-body"));
}

function hackNextStep() {
  if (HACK_STATE.hostStep === 1) {
    const name = document.getElementById("host-name")?.value.trim();
    const desc = document.getElementById("host-desc")?.value.trim();
    if (!name || !desc) { showToast("Name and description are required.", "error"); return; }
    const techRaw = document.getElementById("host-tech")?.value.trim() || "";
    HACK_STATE.hostFormData = {
      ...HACK_STATE.hostFormData,
      name,
      description: desc,
      theme: document.getElementById("host-theme")?.value.trim() || undefined,
      logo: document.getElementById("host-logo")?.value.trim() || "🏆",
      organizer: document.getElementById("host-organizer")?.value.trim() || undefined,
      technologies: techRaw ? techRaw.split(",").map(s => s.trim()).filter(Boolean) : undefined,
    };
  } else if (HACK_STATE.hostStep === 2) {
    const minTeam = parseInt(document.getElementById("host-min-team")?.value || "2");
    const maxTeam = parseInt(document.getElementById("host-max-team")?.value || "4");
    const prize = parseFloat(document.getElementById("host-prize")?.value || "0");
    const regClose = document.getElementById("host-reg-close")?.value;

    if (!regClose) { showToast("Registration close date is required.", "error"); return; }
    if (prize <= 0) { showToast("Prize pool must be greater than 0.", "error"); return; }
    if (maxTeam < minTeam) { showToast("Max team size must be ≥ min team size.", "error"); return; }

    const eventStart = document.getElementById("host-event-start")?.value;
    const eventEnd = document.getElementById("host-event-end")?.value;

    HACK_STATE.hostFormData = {
      ...HACK_STATE.hostFormData,
      mode: document.getElementById("host-mode")?.value || "Online",
      location: document.getElementById("host-location")?.value.trim() || undefined,
      eligibility: document.getElementById("host-eligibility")?.value.trim() || undefined,
      rules: document.getElementById("host-rules")?.value.trim() || undefined,
      minTeamSize: minTeam,
      maxTeamSize: maxTeam,
      totalPrizePool: prize,
      registrationClose: new Date(regClose).toISOString(),
      eventStart: eventStart ? new Date(eventStart).toISOString() : undefined,
      eventEnd: eventEnd ? new Date(eventEnd).toISOString() : undefined,
    };
  }
  HACK_STATE.hostStep++;
  hackRenderHost();
}

function hackPrevStep() {
  HACK_STATE.hostStep = Math.max(1, HACK_STATE.hostStep - 1);
  hackRenderHost();
}

async function hackSubmitHostForm() {
  const btn = document.getElementById("host-submit-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Creating…"; }

  const userId = getCurrentUserId();
  const dto = {
    ...HACK_STATE.hostFormData,
    orgId: userId,
  };

  try {
    const hackathon = await hackathonsApi.create(dto);

    if (HACK_STATE.selectedPlanId) {
      await hackPurchasePromotion(hackathon.id, HACK_STATE.selectedPlanId, true);
    }

    showToast(`🎉 Hackathon "${hackathon.name}" created successfully!`, "success");

    // Reset form state
    HACK_STATE.hostStep = 1;
    HACK_STATE.hostFormData = {};
    HACK_STATE.selectedPlanId = null;

    // Switch to My Hackathons so they can see it
    HACK_STATE.tab = "mine";
    renderHackathons();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "🚀 Create Hackathon"; }
    showToast("Error creating hackathon: " + err.message, "error");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PROMOTION PURCHASE — mock payment modal
// ═════════════════════════════════════════════════════════════════════════════

async function hackPurchasePromotion(hackathonId, planId, skipModal = false) {
  if (skipModal) {
    // Called from the host form — no payment UI, just call the API
    const userId = getCurrentUserId();
    await promotionsApi.purchasePromotion({ hackathonId, planId, purchasedBy: userId });
    return;
  }

  // Standalone purchase flow (from dashboard / manage view)
  let plans = [];
  try { const r = await promotionsApi.getPlans(); if (Array.isArray(r)) plans = r; } catch { plans = DEMO_PROMOTION_PLANS; }
  const plan = plans.find(p => p.id === planId) || DEMO_PROMOTION_PLANS.find(p => p.id === planId);
  if (!plan) { showToast("Plan not found.", "error"); return; }

  // Inject mock payment modal
  const existing = document.getElementById("hack-payment-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "hack-payment-modal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2000;display:flex;align-items:center;justify-content:center";
  modal.innerHTML = `
    <div class="card" style="padding:24px;max-width:400px;width:90%">
      <h3 style="margin-top:0">💳 Purchase: ${hackEscapeHtml(plan.name)}</h3>
      <p class="page-subtitle">Amount: <strong>₹${(plan.price || 0).toLocaleString()}</strong></p>
      <div style="display:flex;flex-direction:column;gap:10px;margin:12px 0">
        <input class="input" placeholder="Card Number (demo)" value="4242 4242 4242 4242" readonly style="width:100%">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <input class="input" placeholder="MM/YY" value="12/26" readonly style="width:100%">
          <input class="input" placeholder="CVV" value="123" readonly style="width:100%">
        </div>
        <p style="font-size:0.8rem;color:var(--muted-fg);margin:0">🔒 Demo mode — no real charge will occur.</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" style="flex:1" id="pay-confirm-btn" onclick="hackConfirmPayment('${hackathonId}','${planId}')">Pay ₹${(plan.price || 0).toLocaleString()}</button>
        <button class="btn btn-outline" onclick="document.getElementById('hack-payment-modal').remove()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function hackConfirmPayment(hackathonId, planId) {
  const btn = document.getElementById("pay-confirm-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Processing…"; }
  const userId = getCurrentUserId();
  try {
    await promotionsApi.purchasePromotion({ hackathonId, planId, purchasedBy: userId });
    document.getElementById("hack-payment-modal")?.remove();
    showToast("🎉 Promotion purchased! Your hackathon is now featured.", "success");
    hackRenderBrowse();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "Retry"; }
    showToast("Payment failed: " + err.message, "error");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ORGANIZER DASHBOARD — real API data, demo fallback
// ═════════════════════════════════════════════════════════════════════════════

async function hackRenderOrganizerDashboard() {
  const body = document.getElementById("hack-tab-body");
  body.innerHTML = `<div class="card" style="padding:40px;text-align:center"><p class="page-subtitle">Loading dashboard…</p></div>`;

  const userId = getCurrentUserId();
  let summary = null;
  let allHackathons = [];

  try {
    summary = await promotionsApi.getOrganizerRevenueSummary(userId);
  } catch { /* use demo calcs */ }

  try {
    const res = await hackathonsApi.search();
    if (Array.isArray(res) && res.length > 0) allHackathons = res.map(hackNormalize);
  } catch { allHackathons = [...DEMO_HACKATHONS]; }

  if (!allHackathons.length) allHackathons = [...DEMO_HACKATHONS];

  const totalViews = allHackathons.reduce((s, h) => s + (h.views || 0), 0);
  const totalRegistrations = allHackathons.reduce((s, h) => s + (h.registrations || 0), 0);
  const sponsoredCount = allHackathons.filter(h => h.sponsored).length;
  const totalRevenue = summary?.totalSpent ?? sponsoredCount * 7999;
  const activePromotions = summary?.activePromotions ?? sponsoredCount;

  body.innerHTML = `
    <div class="card" style="padding:20px;margin-bottom:12px">
      <h2 style="margin-top:0">💰 Organizer Dashboard</h2>
      <p class="page-subtitle">Monitor hackathon performance and revenue metrics.</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px">
      ${[
        ["🏆", allHackathons.length, "Total Hackathons"],
        ["👁️", totalViews.toLocaleString(), "Total Views"],
        ["📝", totalRegistrations.toLocaleString(), "Registrations"],
        ["💎", activePromotions, "Active Promotions"],
        ["💵", "₹" + totalRevenue.toLocaleString(), "Revenue"],
      ].map(([icon, val, label]) => `
        <div class="card" style="padding:16px;text-align:center">
          <div style="font-size:2.2rem;color:var(--primary)">${icon}</div>
          <div style="font-size:0.85rem;color:var(--muted-fg);margin-top:4px">${label}</div>
          <div style="font-size:1.6rem;font-weight:bold;margin-top:2px">${val}</div>
        </div>`).join("")}
    </div>

    ${summary?.plans && summary.plans.length > 0 ? `
      <div class="card" style="padding:16px;margin-bottom:12px">
        <h3 style="margin-top:0">💎 My Active Promotions</h3>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${summary.plans.map(p => `
            <div style="display:flex;justify-content:space-between;padding:10px;background:var(--secondary);border-radius:6px;font-size:0.9rem">
              <div><strong>${hackEscapeHtml(p.planName)}</strong> — Hackathon: ${hackEscapeHtml(p.hackathonId.slice(0, 16))}</div>
              <div>${p.status} · Expires: ${p.endDate?.slice(0, 10)}</div>
            </div>`).join("")}
        </div>
      </div>` : ""}

    <div class="card" style="padding:16px">
      <h3 style="margin-top:0">📊 Hackathon Performance</h3>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
          <thead>
            <tr style="border-bottom:2px solid var(--border)">
              <th style="text-align:left;padding:8px">Hackathon</th>
              <th style="text-align:right;padding:8px">Views</th>
              <th style="text-align:right;padding:8px">Registrations</th>
              <th style="text-align:center;padding:8px">Status</th>
              <th style="text-align:center;padding:8px">Plan</th>
            </tr>
          </thead>
          <tbody>
            ${allHackathons.map(h => `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:8px">${h.logo || "🏆"} ${hackEscapeHtml((h.name || "").substring(0, 28))}</td>
                <td style="text-align:right;padding:8px">${(h.views || 0).toLocaleString()}</td>
                <td style="text-align:right;padding:8px">${(h.registrations || 0).toLocaleString()}</td>
                <td style="text-align:center;padding:8px">
                  <span class="badge">${(h.status || "").replace(/([A-Z])/g, " $1").trim()}</span>
                </td>
                <td style="text-align:center;padding:8px">
                  ${h.promotionPlan
                    ? `<span class="badge" style="background:var(--primary);color:#fff">💎 ${hackEscapeHtml(h.promotionPlan.substring(0, 12))}</span>`
                    : "—"}
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ═════════════════════════════════════════════════════════════════════════════
// GLOBAL EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

window.renderHackathons = renderHackathons;
window.hackSetTab = hackSetTab;
window.hackRenderBrowse = hackRenderBrowse;
window.hackDoSearch = hackDoSearch;
window.hackSetFilterMode = hackSetFilterMode;
window.hackSetFilterDate = hackSetFilterDate;
window.hackClearFilters = hackClearFilters;
window.hackOpenDetail = hackOpenDetail;
window.hackShowRegisterModal = hackShowRegisterModal;
window.hackCloseRegisterModal = hackCloseRegisterModal;
window.hackSubmitRegister = hackSubmitRegister;
window.hackRenderMine = hackRenderMine;
window.hackAcceptInvite = hackAcceptInvite;
window.hackDeclineInvite = hackDeclineInvite;
window.hackRenderHost = hackRenderHost;
window.hackNextStep = hackNextStep;
window.hackPrevStep = hackPrevStep;
window.hackSelectPlan = hackSelectPlan;
window.hackSubmitHostForm = hackSubmitHostForm;
window.hackPurchasePromotion = hackPurchasePromotion;
window.hackConfirmPayment = hackConfirmPayment;
window.hackRenderOrganizerDashboard = hackRenderOrganizerDashboard;
