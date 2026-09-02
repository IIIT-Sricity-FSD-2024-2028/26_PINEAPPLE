// ══════════════════════════════════════════════════════════════════════════════
//  mentors-market.js — 🎓 Mentorship Marketplace
//
//  Tabs:
//  - 🔍 Browse Mentors      — filter/sort, top mentor badges, detail view, book
//  - 📚 My Sessions         — student's booked sessions + review flow
//  - 🎓 Become a Mentor     — apply / create listing (role-gated)
//  - 🗂️  My Mentor Sessions  — mentor's assigned sessions (role: Mentor)
//  - ⚙️  Admin Panel         — start / complete / cancel sessions + revenue stats
// ══════════════════════════════════════════════════════════════════════════════

// ─── State ───────────────────────────────────────────────────────────────────
const MM_STATE = {
  tab: "browse",
  filters: { search: "", skills: [], minPrice: "", maxPrice: "", minExp: "", availability: "", minRating: "", sort: "" },
  allMentors: [],   // cached for skill-match suggestion
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function mmEsc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function mmStars(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let s = "★".repeat(full) + (half ? "½" : "") + "☆".repeat(5 - full - (half ? 1 : 0));
  return `<span style="color:#f59e0b">${s}</span>`;
}
function mmBadge(text, color = "var(--primary)", textColor = "#fff") {
  return `<span class="badge" style="background:${color};color:${textColor};margin-right:4px">${mmEsc(text)}</span>`;
}
function mmStatusBadge(status) {
  const map = {
    escrow_funded: ["🟡 Escrow Funded", "#d97706", "#fff"],
    active:        ["🟢 Active",        "#16a34a", "#fff"],
    completed:     ["✅ Completed",     "#0284c7", "#fff"],
    refunded:      ["🔴 Refunded",      "#dc2626", "#fff"],
    cancelled:     ["⛔ Cancelled",     "#6b7280", "#fff"],
  };
  const [label, bg, fg] = map[status] ?? [status, "#6b7280", "#fff"];
  return `<span class="badge" style="background:${bg};color:${fg}">${label}</span>`;
}

function mmIsAdmin() {
  const role = String(typeof getCurrentUserRole === "function" ? getCurrentUserRole() : "").toLowerCase();
  return ["admin", "superuser", "administrator", "super user"].includes(role);
}
function mmIsMentor() {
  const role = String(typeof getCurrentUserRole === "function" ? getCurrentUserRole() : "").toLowerCase();
  return role === "mentor";
}
function mmIsOwner() {
  const role = String(typeof getCurrentUserRole === "function" ? getCurrentUserRole() : "").toLowerCase();
  return role === "project-owner";
}
// Owner's own open (non-completed) projects — same source the legacy
// "Mentors" page (review2-updates.js renderMentors) uses to pick a project.
function mmOwnerProjects() {
  try {
    if (typeof PROJECTS === "undefined" || !Array.isArray(PROJECTS)) return [];
    const me = typeof getCurrentUserName === "function" ? getCurrentUserName() : "";
    return PROJECTS.filter((p) => p.owner === me && !p.isCompleted);
  } catch {
    return [];
  }
}

// ─── Tab Router ──────────────────────────────────────────────────────────────
function mmSetTab(tab) {
  MM_STATE.tab = tab;
  renderMentorMarket();
}

async function renderMentorMarket() {
  const root = document.getElementById("mentors-market-content");
  if (!root) return;

  const adminTab = mmIsAdmin()
    ? `<button class="tab ${MM_STATE.tab === "admin" ? "active" : ""}" onclick="mmSetTab('admin')">⚙️ Admin Panel</button>`
    : "";
  const mentorTab = mmIsMentor()
    ? `<button class="tab ${MM_STATE.tab === "mentor-sessions" ? "active" : ""}" onclick="mmSetTab('mentor-sessions')">🗂️ My Mentor Sessions</button>`
    : "";

  root.innerHTML = `
    <div class="tabs" style="margin-bottom:20px;flex-wrap:wrap;gap:6px">
      <button class="tab ${MM_STATE.tab === "browse"          ? "active" : ""}" onclick="mmSetTab('browse')">🔍 Browse Mentors</button>
      <button class="tab ${MM_STATE.tab === "my-sessions"     ? "active" : ""}" onclick="mmSetTab('my-sessions')">📚 My Sessions</button>
      <button class="tab ${MM_STATE.tab === "become-mentor"   ? "active" : ""}" onclick="mmSetTab('become-mentor')">🎓 Become a Mentor</button>
      ${mentorTab}
      ${adminTab}
    </div>
    <div id="mm-tab-body">Loading…</div>
  `;

  switch (MM_STATE.tab) {
    case "browse":          await mmRenderBrowse(); break;
    case "my-sessions":     await mmRenderMySessions(); break;
    case "become-mentor":   await mmRenderBecomeMentor(); break;
    case "mentor-sessions": await mmRenderMentorSessions(); break;
    case "admin":           await mmRenderAdmin(); break;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// BROWSE TAB
// ══════════════════════════════════════════════════════════════════════════════
async function mmRenderBrowse() {
  const body = document.getElementById("mm-tab-body");
  body.innerHTML = `<div class="card" style="padding:40px;text-align:center"><p class="page-subtitle">Loading mentors…</p></div>`;

  let mentors = [];
  try {
    const params = {};
    const f = MM_STATE.filters;
    if (f.search)       params.search       = f.search;
    if (f.skills.length) params.skills      = f.skills.join(",");
    if (f.minPrice)     params.minPrice     = f.minPrice;
    if (f.maxPrice)     params.maxPrice     = f.maxPrice;
    if (f.minExp)       params.minExp       = f.minExp;
    if (f.availability) params.availability = f.availability;
    if (f.minRating)    params.minRating    = f.minRating;
    if (f.sort)         params.sort         = f.sort;
    mentors = await mentorMarketApi.listMentors(params);
    if (!Array.isArray(mentors)) mentors = [];
    MM_STATE.allMentors = mentors;
  } catch { mentors = []; }

  // Smart skill-match banner (uses profile skills from localStorage)
  let matchBanner = "";
  try {
    const profileSkills = JSON.parse(localStorage.getItem("teamforge.profileSkills") || "[]");
    if (profileSkills.length > 0) {
      const matched = mentors.filter(m =>
        m.skills?.some(s => profileSkills.some(ps => s.toLowerCase().includes(ps.toLowerCase())))
      ).slice(0, 3);
      if (matched.length > 0) {
        matchBanner = `
          <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:14px 20px;border-radius:8px;color:#fff;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <div style="font-size:1.4rem">🎯</div>
            <div>
              <strong>Based on your skills (${profileSkills.slice(0,3).join(", ")}) — great matches for you:</strong>
              <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
                ${matched.map(m => `<button onclick="mmOpenDetail('${m.id}')" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:#fff;padding:4px 12px;border-radius:4px;cursor:pointer">${mmEsc(m.avatar)} ${mmEsc(m.name)}</button>`).join("")}
              </div>
            </div>
          </div>`;
      }
    }
  } catch { /* no profile skills */ }

  // Top mentors
  const topMentors = mentors.filter(m => m.rating >= 4.5 && m.totalSessions >= 10);
  const regular    = mentors.filter(m => !(m.rating >= 4.5 && m.totalSessions >= 10));

  body.innerHTML = `
    ${matchBanner}

    <!-- Filter Bar -->
    <div class="card" style="padding:16px;margin-bottom:16px">
      <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <input class="input" id="mm-search" placeholder="Search by name, skill, or bio…"
          value="${mmEsc(MM_STATE.filters.search)}"
          style="flex:1;min-width:200px"
          onkeydown="if(event.key==='Enter') mmApplySearch()">
        <button class="btn btn-primary" onclick="mmApplySearch()">Search</button>
        <button class="btn btn-outline" onclick="mmClearFilters()">Clear</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select class="input" onchange="mmSetFilter('sort', this.value)" style="min-width:140px">
          <option value=""     ${!MM_STATE.filters.sort                  ? "selected":""}>✨ Recommended</option>
          <option value="price_asc"  ${MM_STATE.filters.sort==="price_asc"  ? "selected":""}>💰 Price: Low → High</option>
          <option value="price_desc" ${MM_STATE.filters.sort==="price_desc" ? "selected":""}>💰 Price: High → Low</option>
          <option value="rating"     ${MM_STATE.filters.sort==="rating"     ? "selected":""}>⭐ Rating</option>
          <option value="sessions"   ${MM_STATE.filters.sort==="sessions"   ? "selected":""}>📊 Most Sessions</option>
        </select>
        <select class="input" onchange="mmSetFilter('minExp', this.value)" style="min-width:130px">
          <option value=""  ${!MM_STATE.filters.minExp        ? "selected":""}>🏅 Any Experience</option>
          <option value="1" ${MM_STATE.filters.minExp==="1"   ? "selected":""}>1+ years</option>
          <option value="3" ${MM_STATE.filters.minExp==="3"   ? "selected":""}>3+ years</option>
          <option value="5" ${MM_STATE.filters.minExp==="5"   ? "selected":""}>5+ years</option>
        </select>
        <select class="input" onchange="mmSetFilter('availability', this.value)" style="min-width:130px">
          <option value=""          ${!MM_STATE.filters.availability               ? "selected":""}>📅 Any Time</option>
          <option value="Weekdays"  ${MM_STATE.filters.availability==="Weekdays"   ? "selected":""}>Weekdays</option>
          <option value="Weekends"  ${MM_STATE.filters.availability==="Weekends"   ? "selected":""}>Weekends</option>
          <option value="Anytime"   ${MM_STATE.filters.availability==="Anytime"    ? "selected":""}>Anytime</option>
        </select>
        <select class="input" onchange="mmSetFilter('minRating', this.value)" style="min-width:110px">
          <option value=""    ${!MM_STATE.filters.minRating      ? "selected":""}>⭐ Any Rating</option>
          <option value="4.5" ${MM_STATE.filters.minRating==="4.5" ? "selected":""}>⭐ 4.5+</option>
          <option value="4"   ${MM_STATE.filters.minRating==="4"   ? "selected":""}>⭐ 4.0+</option>
          <option value="3"   ${MM_STATE.filters.minRating==="3"   ? "selected":""}>⭐ 3.0+</option>
        </select>
        <div style="display:flex;gap:4px;align-items:center">
          <span style="font-size:0.85rem;color:var(--muted-fg)">₹</span>
          <input class="input" type="number" placeholder="Min" value="${mmEsc(MM_STATE.filters.minPrice)}"
            style="width:70px" onchange="mmSetFilter('minPrice', this.value)">
          <span style="color:var(--muted-fg)">–</span>
          <input class="input" type="number" placeholder="Max" value="${mmEsc(MM_STATE.filters.maxPrice)}"
            style="width:70px" onchange="mmSetFilter('maxPrice', this.value)">
        </div>
      </div>

      <!-- Skill chips -->
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <span style="font-size:0.82rem;color:var(--muted-fg)">Skills:</span>
        ${["React", "Python", "NestJS", "ML", "DevOps", "Docker", "AWS", "UI/UX", "Figma", "Blockchain"].map(sk => {
          const active = MM_STATE.filters.skills.includes(sk);
          return `<button onclick="mmToggleSkill('${sk}')" style="padding:3px 10px;border-radius:20px;border:1px solid ${active?"var(--primary)":"var(--border)"};background:${active?"var(--primary)":"transparent"};color:${active?"#fff":"var(--fg)"};font-size:0.8rem;cursor:pointer">${sk}</button>`;
        }).join("")}
      </div>
    </div>

    <!-- Top Mentors -->
    ${topMentors.length > 0 ? `
      <div style="background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%);padding:20px;border-radius:8px;color:#fff;margin-bottom:20px">
        <h3 style="margin:0 0 16px 0;color:#fff">⭐ Top Mentors — Highly Rated</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">
          ${topMentors.map(m => mmTopCard(m)).join("")}
        </div>
      </div>` : ""}

    <!-- Regular Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
      ${regular.length === 0 && topMentors.length === 0
        ? `<div class="card" style="padding:40px;text-align:center;grid-column:1/-1"><p class="page-subtitle">No mentors match your filters. <button class="btn btn-outline btn-sm" onclick="mmClearFilters()">Clear Filters</button></p></div>`
        : regular.map(m => mmMentorCard(m)).join("")}
    </div>
  `;
}

function mmTopCard(m) {
  return `
    <div style="background:rgba(255,255,255,0.15);padding:14px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,0.3)" onclick="mmOpenDetail('${m.id}')">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="font-size:2rem">${m.avatar || "🧑‍🏫"}</div>
        <div>
          <div style="font-weight:600">${mmEsc(m.name)}</div>
          <div style="font-size:0.8rem;opacity:0.9">${mmEsc(m.title)}</div>
        </div>
      </div>
      <div style="font-size:0.85rem;margin-bottom:8px">⭐ ${m.rating} · ${m.totalSessions} sessions · ₹${m.sessionPrice}/session</div>
      <button style="background:white;color:#d97706;border:none;padding:5px 12px;border-radius:4px;font-weight:600;cursor:pointer;width:100%" onclick="event.stopPropagation();mmOpenDetail('${m.id}')">View & Book →</button>
    </div>`;
}

function mmMentorCard(m) {
  const isTop = m.rating >= 4.5 && m.totalSessions >= 10;
  return `
    <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div style="display:flex;gap:10px;align-items:center">
          <div style="font-size:2.4rem">${m.avatar || "🧑‍🏫"}</div>
          <div>
            <h4 style="margin:0 0 2px 0">${mmEsc(m.name)}</h4>
            <p style="margin:0;font-size:0.8rem;color:var(--muted-fg)">${mmEsc(m.title)}</p>
          </div>
        </div>
        ${isTop ? `<span class="badge" style="background:#f59e0b;color:#000">⭐ Top Mentor</span>` : ""}
      </div>

      <p style="margin:0;font-size:0.88rem;color:var(--muted-fg);line-height:1.5">${mmEsc(m.bio.substring(0, 110))}…</p>

      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${(m.skills || []).slice(0, 5).map(s => mmBadge(s, "var(--secondary)", "var(--fg)")).join("")}
        ${(m.skills || []).length > 5 ? `<span style="font-size:0.78rem;color:var(--muted-fg);align-self:center">+${m.skills.length - 5} more</span>` : ""}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.84rem">
        <div>${mmStars(m.rating)} <span style="color:var(--muted-fg)">${m.rating} (${m.totalSessions} sessions)</span></div>
        <div>⏱ ${m.sessionDuration} min session</div>
        <div>📅 ${m.availability}</div>
        <div>🌐 ${(m.languages || ["English"]).join(", ")}</div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:12px">
        <div style="font-size:1.3rem;font-weight:700;color:var(--primary)">₹${m.sessionPrice}<span style="font-size:0.8rem;font-weight:400;color:var(--muted-fg)">/session</span></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="mmOpenDetail('${m.id}')">View</button>
          <button class="btn btn-primary btn-sm" onclick="mmOpenBookModal('${m.id}','${mmEsc(m.name)}',${m.sessionPrice})">Book</button>
        </div>
      </div>
    </div>`;
}

function mmToggleSkill(skill) {
  const idx = MM_STATE.filters.skills.indexOf(skill);
  if (idx === -1) MM_STATE.filters.skills.push(skill);
  else MM_STATE.filters.skills.splice(idx, 1);
  mmRenderBrowse();
}
function mmSetFilter(key, value) { MM_STATE.filters[key] = value; mmRenderBrowse(); }
function mmApplySearch() {
  MM_STATE.filters.search = document.getElementById("mm-search")?.value.trim() || "";
  mmRenderBrowse();
}
function mmClearFilters() {
  MM_STATE.filters = { search: "", skills: [], minPrice: "", maxPrice: "", minExp: "", availability: "", minRating: "", sort: "" };
  mmRenderBrowse();
}

// ── Mentor Detail View ───────────────────────────────────────────────────────
async function mmOpenDetail(mentorId) {
  const body = document.getElementById("mm-tab-body");
  body.innerHTML = `<div class="card" style="padding:40px;text-align:center"><p class="page-subtitle">Loading…</p></div>`;
  let data = null;
  try { data = await mentorMarketApi.getMentor(mentorId); } catch { }

  if (!data?.profile) { body.innerHTML = `<p style="color:var(--destructive)">Mentor not found.</p>`; return; }
  const m = data.profile;
  const reviews = data.reviews || [];

  body.innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="mmRenderBrowse()" style="margin-bottom:16px">← Back to Browse</button>
    <div style="display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start">
      <div>
        <div class="card" style="padding:20px;margin-bottom:16px">
          <div style="display:flex;gap:16px;margin-bottom:16px;align-items:center">
            <div style="font-size:4rem">${m.avatar || "🧑‍🏫"}</div>
            <div>
              <h2 style="margin:0 0 4px 0">${mmEsc(m.name)}</h2>
              <p style="margin:0 0 8px 0;color:var(--muted-fg)">${mmEsc(m.title)}</p>
              <div>${mmStars(m.rating)} <span style="color:var(--muted-fg)">${m.rating} avg · ${m.totalSessions} sessions completed</span></div>
            </div>
          </div>
          <p style="font-size:0.95rem;line-height:1.7;margin-bottom:16px">${mmEsc(m.bio)}</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
            ${(m.skills || []).map(s => mmBadge(s, "var(--primary)")).join("")}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.88rem">
            <div>📅 <strong>Availability:</strong> ${m.availability}</div>
            <div>⏱ <strong>Duration:</strong> ${m.sessionDuration} min</div>
            <div>🏅 <strong>Experience:</strong> ${m.experienceYears} years</div>
            <div>🌐 <strong>Languages:</strong> ${(m.languages || ["English"]).join(", ")}</div>
          </div>
        </div>

        <!-- Reviews -->
        <div class="card" style="padding:20px">
          <h3 style="margin-top:0">💬 Student Reviews (${reviews.length})</h3>
          ${reviews.length === 0
            ? `<p class="page-subtitle">No reviews yet. Be the first to work with ${mmEsc(m.name)}!</p>`
            : reviews.slice(0, 5).map(r => `
              <div style="padding:12px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <div>${mmStars(r.rating)} <strong>${r.rating}/5</strong></div>
                  <div style="font-size:0.8rem;color:var(--muted-fg)">${new Date(r.createdAt).toLocaleDateString()}</div>
                </div>
                ${r.comment ? `<p style="margin:0;font-size:0.88rem;color:var(--muted-fg)">"${mmEsc(r.comment)}"</p>` : ""}
              </div>`).join("")}
        </div>
      </div>

      <!-- Sticky booking panel -->
      <div class="card" style="padding:20px;position:sticky;top:80px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:2.5rem;font-weight:800;color:var(--primary)">₹${m.sessionPrice}</div>
          <div style="color:var(--muted-fg);font-size:0.9rem">per ${m.sessionDuration}-minute session</div>
        </div>
        <div style="background:var(--secondary);padding:12px;border-radius:6px;font-size:0.85rem;margin-bottom:16px">
          <div style="margin-bottom:6px">✅ Money held in escrow — safe & secured</div>
          <div style="margin-bottom:6px">✅ Mentor paid only after you confirm completion</div>
          <div>✅ Full refund if session is cancelled</div>
        </div>
        ${!m.isAvailable
          ? `<div style="text-align:center;color:var(--muted-fg);padding:12px;background:var(--secondary);border-radius:6px">😴 Currently Unavailable</div>`
          : mmIsOwner()
            ? `<button class="btn btn-primary" style="width:100%;font-size:1rem;padding:12px" onclick="mmOpenBookModal('${m.id}','${mmEsc(m.name)}',${m.sessionPrice})">📅 Book This Mentor</button>`
            : `<div style="text-align:center;color:var(--muted-fg);padding:12px;background:var(--secondary);border-radius:6px;font-size:0.85rem">🔒 Only project owners can book a mentor</div>`}
      </div>
    </div>
  `;
}

// ── Book Modal ───────────────────────────────────────────────────────────────
function mmOpenBookModal(mentorId, mentorName, price) {
  if (!mmIsOwner()) { showToast("Only project owners can book a mentor.", "error"); return; }

  const existing = document.getElementById("mm-book-modal");
  if (existing) existing.remove();

  const myProjects = mmOwnerProjects();

  const modal = document.createElement("div");
  modal.id = "mm-book-modal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px";
  modal.innerHTML = `
    <div class="card" style="padding:24px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto">
      <h3 style="margin-top:0">📅 Book Session with ${mmEsc(mentorName)}</h3>
      <p class="page-subtitle" style="margin-bottom:16px">₹${price} will be held in escrow until the mentor accepts and your session is marked complete.</p>

      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
        <div>
          <label class="label">Which project is this for? *</label>
          ${myProjects.length
            ? `<select class="input" id="mm-book-project" style="width:100%">
                ${myProjects.map(p => `<option value="${mmEsc(p.id)}">${mmEsc(p.name)}</option>`).join("")}
              </select>`
            : `<p style="font-size:0.85rem;color:var(--destructive);margin:0">You don't own any open projects yet. Create a project first.</p>`}
        </div>
        <div>
          <label class="label">What do you need help with? *</label>
          <textarea class="input" id="mm-book-desc" rows="4" placeholder="Describe your project, goal, or specific questions you want to discuss…" style="width:100%;resize:vertical"></textarea>
        </div>
      </div>

      <!-- Mock Payment -->
      <div style="background:var(--secondary);padding:14px;border-radius:6px;margin-bottom:16px">
        <h4 style="margin:0 0 10px 0">💳 Payment (Demo Mode)</h4>
        <div style="display:flex;flex-direction:column;gap:8px">
          <input class="input" value="4242 4242 4242 4242" readonly placeholder="Card Number" style="width:100%">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <input class="input" value="12/26" readonly placeholder="MM/YY" style="width:100%">
            <input class="input" value="123" readonly placeholder="CVV" style="width:100%">
          </div>
        </div>
        <p style="font-size:0.78rem;color:var(--muted-fg);margin:8px 0 0 0">🔒 Demo mode — no real charge. Money goes to escrow.</p>
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" style="flex:1" id="mm-book-confirm-btn" ${myProjects.length ? "" : "disabled"}
          onclick="mmConfirmBook('${mentorId}', '${mmEsc(mentorName)}', ${price})">
          Pay ₹${price} & Send Request
        </button>
        <button class="btn btn-outline" onclick="document.getElementById('mm-book-modal').remove()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function mmConfirmBook(mentorId, mentorName, price) {
  const projectId = document.getElementById("mm-book-project")?.value;
  const desc = document.getElementById("mm-book-desc")?.value.trim();
  if (!projectId) { showToast("Select a project for this booking.", "error"); return; }
  if (!desc) { showToast("Please describe what you need help with.", "error"); return; }

  const btn = document.getElementById("mm-book-confirm-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Booking…"; }

  try {
    await mentorMarketApi.bookSession({ mentorId, projectId, projectDescription: desc });
    document.getElementById("mm-book-modal")?.remove();
    showToast(`✅ ₹${price} sent to escrow. Mentor request sent to ${mentorName} — they'll need to accept it.`, "success");
    MM_STATE.tab = "my-sessions";
    renderMentorMarket();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = `Pay ₹${price} & Send Request`; }
    showToast("Booking failed: " + err.message, "error");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MY SESSIONS TAB (student)
// ══════════════════════════════════════════════════════════════════════════════
async function mmRenderMySessions() {
  const body = document.getElementById("mm-tab-body");
  body.innerHTML = `<div class="card" style="padding:40px;text-align:center"><p class="page-subtitle">Loading your sessions…</p></div>`;

  let sessions = [];
  try {
    sessions = await mentorMarketApi.mySessions();
    if (!Array.isArray(sessions)) sessions = [];
  } catch { sessions = []; }

  // Enrich with mentor name from cached list
  const mentorMap = {};
  MM_STATE.allMentors.forEach(m => { mentorMap[m.id] = m; });

  body.innerHTML = `
    <div class="card" style="padding:20px">
      <h3 style="margin-top:0">📚 My Booked Sessions</h3>
      ${sessions.length === 0
        ? `<div style="text-align:center;padding:40px">
            <p class="page-subtitle">You haven't booked any sessions yet.</p>
            <button class="btn btn-primary" onclick="mmSetTab('browse')">🔍 Find a Mentor</button>
           </div>`
        : sessions.map(s => {
            const mentor = mentorMap[s.mentorId];
            const canReview = s.status === "completed";
            return `
              <div style="padding:16px;background:var(--secondary);border-radius:8px;margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
                  <div>
                    <h4 style="margin:0 0 4px 0">${mentor ? mmEsc(mentor.avatar + " " + mentor.name) : "Mentor"}</h4>
                    <p style="margin:0;font-size:0.85rem;color:var(--muted-fg)">${mentor ? mmEsc(mentor.title) : ""}</p>
                  </div>
                  ${mmStatusBadge(s.status)}
                </div>
                <p style="margin:0 0 10px 0;font-size:0.9rem">"${mmEsc(s.projectDescription.substring(0, 120))}…"</p>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;color:var(--muted-fg)">
                  <span>💰 ₹${s.agreedPrice} ${s.status === "escrow_funded" || s.status === "active" ? "in escrow" : s.status === "completed" ? "paid to mentor" : "refunded"}</span>
                  <span>📅 ${new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
                ${canReview ? `
                  <button class="btn btn-primary btn-sm" style="margin-top:10px;width:100%" onclick="mmOpenReviewModal('${s.id}')">
                    ⭐ Leave a Review
                  </button>` : ""}
                ${s.status === "active" ? `
                  <div style="margin-top:10px;background:rgba(22,163,74,0.1);border:1px solid #16a34a;border-radius:6px;padding:8px;font-size:0.85rem;color:#16a34a">
                    🟢 Session is active — work with your mentor now!
                  </div>` : ""}
              </div>`;
          }).join("")}
    </div>`;
}

// ── Review Modal ─────────────────────────────────────────────────────────────
function mmOpenReviewModal(sessionId) {
  const existing = document.getElementById("mm-review-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "mm-review-modal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px";
  modal.innerHTML = `
    <div class="card" style="padding:24px;max-width:400px;width:100%">
      <h3 style="margin-top:0">⭐ Rate Your Session</h3>
      <div style="display:flex;gap:8px;margin:12px 0;font-size:2rem;cursor:pointer" id="mm-star-row">
        ${[1,2,3,4,5].map(n => `<span onclick="mmSetRating(${n})" id="mm-star-${n}" style="color:#d1d5db">★</span>`).join("")}
      </div>
      <label class="label">Your feedback (optional)</label>
      <textarea class="input" id="mm-review-comment" rows="3" placeholder="What did you find most helpful?" style="width:100%;resize:vertical;margin-bottom:16px"></textarea>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" style="flex:1" id="mm-review-submit-btn" onclick="mmSubmitReview('${sessionId}')">Submit Review</button>
        <button class="btn btn-outline" onclick="document.getElementById('mm-review-modal').remove()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  window._mmRating = 0;
}

function mmSetRating(n) {
  window._mmRating = n;
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`mm-star-${i}`);
    if (el) el.style.color = i <= n ? "#f59e0b" : "#d1d5db";
  }
}

async function mmSubmitReview(sessionId) {
  const rating = window._mmRating || 0;
  if (!rating) { showToast("Please select a star rating.", "error"); return; }

  const comment = document.getElementById("mm-review-comment")?.value.trim();
  const btn = document.getElementById("mm-review-submit-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Submitting…"; }

  try {
    await mentorMarketApi.submitReview(sessionId, { rating, comment: comment || undefined });
    document.getElementById("mm-review-modal")?.remove();
    showToast("✅ Review submitted! +25 XP awarded.", "success");
    mmRenderMySessions();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "Submit Review"; }
    showToast("Error: " + err.message, "error");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// BECOME A MENTOR TAB
// ══════════════════════════════════════════════════════════════════════════════
async function mmRenderBecomeMentor() {
  const body = document.getElementById("mm-tab-body");
  const isMentor = mmIsMentor();

  if (isMentor) {
    body.innerHTML = `<div class="card" style="padding:40px;text-align:center"><p class="page-subtitle">Loading your listing…</p></div>`;

    let existingProfile = null;
    try { existingProfile = await mentorMarketApi.myProfile(); } catch { existingProfile = null; }
    MM_STATE.myProfile = existingProfile || null;
    const p = existingProfile || {};

    // Mentor: create or edit their listing — the listing (and its price)
    // only shows up in the public marketplace once this form is submitted.
    body.innerHTML = `
      <div class="card" style="padding:24px;max-width:600px;margin:0 auto">
        <h3 style="margin-top:0">${existingProfile ? "✏️ Edit Your Mentor Listing" : "🎓 Create Your Mentor Listing"}</h3>
        <p class="page-subtitle" style="margin-bottom:20px">${existingProfile
          ? "Update your public profile, including your session price — changes reflect in the marketplace immediately."
          : "Your role is verified ✅ — set up your public profile and price so students can find and book you."}</p>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div>
            <label class="label">Display Name *</label>
            <input class="input" id="ml-name" placeholder="Your full name" style="width:100%" value="${mmEsc(p.name || "")}">
          </div>
          <div>
            <label class="label">Professional Title *</label>
            <input class="input" id="ml-title" placeholder="e.g. Senior Full-Stack Engineer, 6 yrs" style="width:100%" value="${mmEsc(p.title || "")}">
          </div>
          <div>
            <label class="label">Emoji Avatar</label>
            <input class="input" id="ml-avatar" placeholder="🧑‍💻" style="width:100px;font-size:1.5rem" value="${mmEsc(p.avatar || "")}">
          </div>
          <div>
            <label class="label">Bio *</label>
            <textarea class="input" id="ml-bio" rows="3" placeholder="Describe your experience and what students will learn from you…" style="width:100%;resize:vertical">${mmEsc(p.bio || "")}</textarea>
          </div>
          <div>
            <label class="label">Skills (comma-separated) *</label>
            <input class="input" id="ml-skills" placeholder="React, NestJS, TypeScript, Docker" style="width:100%" value="${mmEsc((p.skills || []).join(", "))}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label class="label">Years of Experience *</label>
              <input class="input" id="ml-exp" type="number" min="0" placeholder="5" style="width:100%" value="${p.experienceYears ?? ""}">
            </div>
            <div>
              <label class="label">Session Price (₹) *</label>
              <input class="input" id="ml-price" type="number" min="99" placeholder="499" style="width:100%" value="${p.sessionPrice ?? ""}">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label class="label">Session Duration</label>
              <select class="input" id="ml-duration" style="width:100%">
                <option value="30" ${p.sessionDuration === 30 ? "selected" : ""}>30 minutes</option>
                <option value="60" ${!p.sessionDuration || p.sessionDuration === 60 ? "selected" : ""}>60 minutes</option>
                <option value="90" ${p.sessionDuration === 90 ? "selected" : ""}>90 minutes</option>
              </select>
            </div>
            <div>
              <label class="label">Availability</label>
              <select class="input" id="ml-availability" style="width:100%">
                <option value="Weekdays" ${p.availability === "Weekdays" ? "selected" : ""}>Weekdays</option>
                <option value="Weekends" ${p.availability === "Weekends" ? "selected" : ""}>Weekends</option>
                <option value="Anytime" ${!p.availability || p.availability === "Anytime" ? "selected" : ""}>Anytime</option>
              </select>
            </div>
          </div>
        </div>
        <button class="btn btn-primary" style="margin-top:20px;width:100%" id="ml-submit-btn" onclick="mmSubmitMentorProfile()">
          ${existingProfile ? "💾 Save Changes" : "🚀 Publish My Listing"}
        </button>
      </div>`;
  } else {
    // Non-mentor: apply flow
    let existingApp = null;
    try {
      const apps = await mentorApplicationsApi.list("all");
      const userId = getCurrentUserId();
      if (Array.isArray(apps)) existingApp = apps.find(a => a.userId === userId);
    } catch { /* ignore */ }

    if (existingApp) {
      const statusColor = existingApp.status === "approved" ? "#16a34a" : existingApp.status === "rejected" ? "#dc2626" : "#d97706";
      body.innerHTML = `
        <div class="card" style="padding:24px;max-width:540px;margin:0 auto;text-align:center">
          <div style="font-size:3rem;margin-bottom:16px">📋</div>
          <h3>Application ${existingApp.status === "approved" ? "Approved!" : existingApp.status === "rejected" ? "Rejected" : "Under Review"}</h3>
          <div style="padding:12px;border-radius:6px;background:var(--secondary);margin-bottom:16px">
            <strong style="color:${statusColor}">Status: ${existingApp.status.toUpperCase()}</strong>
          </div>
          ${existingApp.status === "approved"
            ? `<p>Your application is approved! An admin will upgrade your role to Mentor. Refresh the page to see your new role.</p>`
            : existingApp.status === "rejected"
            ? `<p class="page-subtitle">Your application was not approved this time. You can reach out to support for more information.</p>`
            : `<p class="page-subtitle">Your application is being reviewed by our team. You'll be notified once a decision is made.</p>`}
        </div>`;
    } else {
      body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
          <div class="card" style="padding:24px">
            <h3 style="margin-top:0">🎓 Apply to Become a Mentor</h3>
            <p class="page-subtitle" style="margin-bottom:16px">Share your expertise with students. Our team will review and approve your application.</p>
            <div style="display:flex;flex-direction:column;gap:12px">
              <div>
                <label class="label">Full Name *</label>
                <input class="input" id="ma-name" placeholder="Your name" style="width:100%">
              </div>
              <div>
                <label class="label">Email *</label>
                <input class="input" id="ma-email" type="email" placeholder="you@email.com" style="width:100%">
              </div>
              <div>
                <label class="label">Bio / Motivation *</label>
                <textarea class="input" id="ma-bio" rows="3" placeholder="Tell us about your experience and why you want to mentor…" style="width:100%;resize:vertical"></textarea>
              </div>
              <div>
                <label class="label">Years of Experience *</label>
                <input class="input" id="ma-exp" type="number" min="0" placeholder="3" style="width:100%">
              </div>
              <div>
                <label class="label">Skills (comma-separated) *</label>
                <input class="input" id="ma-skills" placeholder="React, Python, Machine Learning" style="width:100%">
              </div>
            </div>
            <button class="btn btn-primary" style="margin-top:16px;width:100%" id="ma-submit-btn" onclick="mmSubmitMentorApplication()">
              📨 Submit Application
            </button>
          </div>

          <div class="card" style="padding:24px;background:var(--secondary)">
            <h3 style="margin-top:0">💼 What Mentors Earn</h3>
            <div style="display:flex;flex-direction:column;gap:12px;font-size:0.9rem">
              <div style="padding:12px;background:white;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
                <strong>85% of session fee</strong><br>
                <span style="color:var(--muted-fg)">Platform takes only 15%. You set your own price.</span>
              </div>
              <div style="padding:12px;background:white;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
                <strong>+100 XP per session</strong><br>
                <span style="color:var(--muted-fg)">Climb the leaderboard and build your reputation.</span>
              </div>
              <div style="padding:12px;background:white;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
                <strong>Secure escrow</strong><br>
                <span style="color:var(--muted-fg)">Money is locked before the session starts. You always get paid.</span>
              </div>
              <div style="padding:12px;background:white;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
                <strong>Build your brand</strong><br>
                <span style="color:var(--muted-fg)">Public reviews and ratings build credibility over time.</span>
              </div>
            </div>
          </div>
        </div>`;
    }
  }
}

async function mmSubmitMentorApplication() {
  const name     = document.getElementById("ma-name")?.value.trim();
  const email    = document.getElementById("ma-email")?.value.trim();
  const bio      = document.getElementById("ma-bio")?.value.trim();
  const expRaw   = document.getElementById("ma-exp")?.value.trim();
  const skillsRaw= document.getElementById("ma-skills")?.value.trim();

  if (!name || !email || !bio) { showToast("Name, email and bio are required.", "error"); return; }
  const btn = document.getElementById("ma-submit-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Submitting…"; }

  try {
    await mentorApplicationsApi.create({
      userId: getCurrentUserId(),
      name, email, bio,
      experience: expRaw ? `${expRaw} years` : undefined,
      skills: skillsRaw ? skillsRaw.split(",").map(s => s.trim()).filter(Boolean) : [],
    });
    showToast("📨 Application submitted! We'll review it shortly.", "success");
    mmRenderBecomeMentor();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = "📨 Submit Application"; }
    showToast("Error: " + err.message, "error");
  }
}

async function mmSubmitMentorProfile() {
  const name    = document.getElementById("ml-name")?.value.trim();
  const title   = document.getElementById("ml-title")?.value.trim();
  const bio     = document.getElementById("ml-bio")?.value.trim();
  const skillsR = document.getElementById("ml-skills")?.value.trim();
  const exp     = parseInt(document.getElementById("ml-exp")?.value || "0");
  const price   = parseInt(document.getElementById("ml-price")?.value || "0");

  if (!name || !title || !bio || !skillsR || !price) { showToast("All required fields must be filled.", "error"); return; }
  const btn = document.getElementById("ml-submit-btn");
  const isEdit = !!MM_STATE.myProfile;
  if (btn) { btn.disabled = true; btn.textContent = isEdit ? "Saving…" : "Publishing…"; }

  const payload = {
    name, title, bio,
    avatar: document.getElementById("ml-avatar")?.value.trim() || "🧑‍🏫",
    skills: skillsR.split(",").map(s => s.trim()).filter(Boolean),
    experienceYears: exp,
    sessionPrice: price,
    sessionDuration: parseInt(document.getElementById("ml-duration")?.value || "60"),
    availability: document.getElementById("ml-availability")?.value || "Anytime",
  };

  try {
    if (isEdit) {
      await mentorMarketApi.updateProfile(payload);
      showToast("💾 Your listing has been updated.", "success");
    } else {
      await mentorMarketApi.createProfile(payload);
      showToast("🎉 Your mentor listing is live!", "success");
    }
    MM_STATE.tab = "browse";
    renderMentorMarket();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = isEdit ? "💾 Save Changes" : "🚀 Publish My Listing"; }
    showToast("Error: " + err.message, "error");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MENTOR SESSIONS TAB (mentor role only)
// ══════════════════════════════════════════════════════════════════════════════
async function mmRenderMentorSessions() {
  const body = document.getElementById("mm-tab-body");
  body.innerHTML = `<div class="card" style="padding:40px;text-align:center"><p class="page-subtitle">Loading your sessions…</p></div>`;

  let sessions = [];
  try {
    sessions = await mentorMarketApi.mentorSessions();
    if (!Array.isArray(sessions)) sessions = [];
  } catch { sessions = []; }

  body.innerHTML = `
    <div class="card" style="padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0">🗂️ My Assigned Sessions</h3>
        <button class="btn btn-outline btn-sm" onclick="mmToggleAvailability()">
          ${mmIsMentor() ? "🟢 Toggle Availability" : ""}
        </button>
      </div>
      ${sessions.length === 0
        ? `<p class="page-subtitle" style="text-align:center;padding:30px">No sessions assigned yet. Make sure your listing is published and you're marked as available.</p>`
        : sessions.map(s => `
          <div style="padding:14px;background:var(--secondary);border-radius:8px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
              <strong>Session #${s.id.slice(-6)}</strong>
              ${mmStatusBadge(s.status)}
            </div>
            <p style="margin:0 0 8px 0;font-size:0.88rem">"${mmEsc(s.projectDescription.substring(0, 150))}…"</p>
            <div style="display:flex;justify-content:space-between;font-size:0.82rem;color:var(--muted-fg)">
              <span>💰 Your payout: ₹${Math.round(s.agreedPrice * 0.85)} (85%)</span>
              <span>📅 ${new Date(s.createdAt).toLocaleDateString()}</span>
            </div>
            ${s.status === "escrow_funded" ? `
              <div style="display:flex;gap:8px;margin-top:10px">
                <button class="btn btn-primary btn-sm" style="flex:1" onclick="mmAcceptSession('${s.id}','${mmEsc(s.projectId || "")}')">✅ Accept Request</button>
                <button class="btn btn-outline btn-sm" style="flex:1" onclick="mmDeclineSession('${s.id}')">✋ Decline</button>
              </div>` : ""}
            ${s.status === "active" && s.projectId ? `
              <button class="btn btn-outline btn-sm" style="margin-top:10px;width:100%" onclick="mmOpenSessionWorkspace('${mmEsc(s.projectId)}')">🗂️ Open Project Workspace</button>` : ""}
          </div>`).join("")}
    </div>`;
}

async function mmAcceptSession(sessionId, projectId) {
  try {
    await mentorMarketApi.acceptSession(sessionId);
    // Grant workspace/proof-link/chat access via the existing project mentor-access flow.
    if (projectId && typeof window.acceptMentorRequest === "function") {
      window.acceptMentorRequest(projectId);
    }
    showToast("✅ Request accepted! You now have access to the project workspace.", "success");
    mmRenderMentorSessions();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
}

async function mmDeclineSession(sessionId) {
  try {
    await mentorMarketApi.declineSession(sessionId);
    showToast("Request declined. The escrowed amount has been refunded.", "info");
    mmRenderMentorSessions();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
}

function mmOpenSessionWorkspace(projectId) {
  if (typeof window.openWorkspace === "function") {
    window.openWorkspace(projectId, "mentors-market");
  }
}

async function mmToggleAvailability() {
  try {
    const res = await mentorMarketApi.updateAvailability(true);
    showToast("✅ Availability updated.", "success");
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ══════════════════════════════════════════════════════════════════════════════
async function mmRenderAdmin() {
  const body = document.getElementById("mm-tab-body");
  body.innerHTML = `<div class="card" style="padding:40px;text-align:center"><p class="page-subtitle">Loading admin panel…</p></div>`;

  let sessions = [], stats = null, allMentors = [];
  try { sessions  = await mentorMarketApi.allSessions();  if (!Array.isArray(sessions)) sessions = []; } catch {}
  try { stats     = await mentorMarketApi.adminStats();                                                  } catch {}
  try { allMentors = await mentorMarketApi.listMentors(); if (!Array.isArray(allMentors)) allMentors = []; } catch {}

  const mentorMap = {};
  allMentors.forEach(m => { mentorMap[m.id] = m; });

  const kpis = [
    ["📋", sessions.length,                                     "Total Sessions"],
    ["✅", sessions.filter(s => s.status === "completed").length, "Completed"],
    ["🟡", sessions.filter(s => s.status === "escrow_funded").length, "Awaiting Start"],
    ["💰", `₹${(stats?.totalProcessed || 0).toLocaleString()}`, "Total Processed"],
    ["🏦", `₹${(stats?.platformRevenue || 0).toLocaleString()}`, "Platform Revenue (15%)"],
    ["💸", `₹${(stats?.totalPayouts || 0).toLocaleString()}`,    "Mentor Payouts"],
  ];

  body.innerHTML = `
    <!-- KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">
      ${kpis.map(([icon, val, label]) => `
        <div class="card" style="padding:16px;text-align:center">
          <div style="font-size:2rem">${icon}</div>
          <div style="font-size:0.82rem;color:var(--muted-fg);margin-top:4px">${label}</div>
          <div style="font-size:1.5rem;font-weight:700;margin-top:2px">${val}</div>
        </div>`).join("")}
    </div>

    <!-- Sessions Table -->
    <div class="card" style="padding:20px">
      <h3 style="margin-top:0">⚙️ Session Management</h3>
      ${sessions.length === 0
        ? `<p class="page-subtitle">No sessions yet.</p>`
        : `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.88rem">
          <thead>
            <tr style="border-bottom:2px solid var(--border)">
              <th style="text-align:left;padding:8px">Session</th>
              <th style="text-align:left;padding:8px">Mentor</th>
              <th style="text-align:right;padding:8px">Price</th>
              <th style="text-align:center;padding:8px">Status</th>
              <th style="text-align:center;padding:8px">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${sessions.map(s => {
              const mentor = mentorMap[s.mentorId];
              return `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px">
                    <div style="font-size:0.8rem;color:var(--muted-fg)">…${s.id.slice(-8)}</div>
                    <div style="font-size:0.82rem">${mmEsc(s.projectDescription.substring(0, 50))}…</div>
                  </td>
                  <td style="padding:8px">${mentor ? mmEsc(mentor.avatar + " " + mentor.name) : s.mentorId.slice(0,8)}</td>
                  <td style="text-align:right;padding:8px">₹${s.agreedPrice}</td>
                  <td style="text-align:center;padding:8px">${mmStatusBadge(s.status)}</td>
                  <td style="text-align:center;padding:8px">
                    <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
                      ${s.status === "escrow_funded" ? `<button class="btn btn-primary btn-sm" onclick="mmAdminAction('start','${s.id}')">▶️ Start</button>` : ""}
                      ${s.status === "active" ? `<button class="btn btn-primary btn-sm" onclick="mmAdminAction('complete','${s.id}')" style="background:#16a34a">✅ Complete</button>` : ""}
                      ${(s.status === "escrow_funded" || s.status === "active") ? `<button class="btn btn-outline btn-sm" onclick="mmAdminAction('cancel','${s.id}')" style="color:#dc2626;border-color:#dc2626">🔴 Cancel</button>` : ""}
                    </div>
                  </td>
                </tr>`;
            }).join("")}
          </tbody>
        </table></div>`}
    </div>`;
}

async function mmAdminAction(action, sessionId) {
  const messages = { start: "Starting session…", complete: "Releasing escrow & paying mentor…", cancel: "Cancelling and refunding…" };
  try {
    if (action === "start")    await mentorMarketApi.startSession(sessionId);
    if (action === "complete") await mentorMarketApi.completeSession(sessionId);
    if (action === "cancel")   await mentorMarketApi.cancelSession(sessionId);
    const toastMsg = {
      start:    "🟢 Session started!",
      complete: "✅ Session complete! Escrow released, mentor paid, XP awarded.",
      cancel:   "🔴 Session cancelled. Student refunded.",
    };
    showToast(toastMsg[action], "success");
    mmRenderAdmin();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
}

// ─── Global Exports ──────────────────────────────────────────────────────────
window.renderMentorMarket     = renderMentorMarket;
window.mmSetTab               = mmSetTab;
window.mmRenderBrowse         = mmRenderBrowse;
window.mmToggleSkill          = mmToggleSkill;
window.mmSetFilter            = mmSetFilter;
window.mmApplySearch          = mmApplySearch;
window.mmClearFilters         = mmClearFilters;
window.mmOpenDetail           = mmOpenDetail;
window.mmOpenBookModal        = mmOpenBookModal;
window.mmConfirmBook          = mmConfirmBook;
window.mmRenderMySessions     = mmRenderMySessions;
window.mmOpenReviewModal      = mmOpenReviewModal;
window.mmSetRating            = mmSetRating;
window.mmSubmitReview         = mmSubmitReview;
window.mmRenderBecomeMentor   = mmRenderBecomeMentor;
window.mmSubmitMentorApplication = mmSubmitMentorApplication;
window.mmSubmitMentorProfile  = mmSubmitMentorProfile;
window.mmRenderMentorSessions = mmRenderMentorSessions;
window.mmToggleAvailability   = mmToggleAvailability;
window.mmRenderAdmin          = mmRenderAdmin;
window.mmAdminAction          = mmAdminAction;
