// ══════════════════════════════════════════════════════════════
//  hackathons.js — 🏆 Hackathons sidebar section
//
//  Tabs: Browse (search + list), My Hackathons (teams/invites/workspace),
//  Host (create + manage own hackathons, score, close), and Verify KYC
//  (Platform Admin only). Talks to the hackathons/, teams/,
//  team-invitations/, hackathon-registrations/, organizations/ and
//  payouts/ backend modules via apiClient.js.
// ══════════════════════════════════════════════════════════════

function hackEscapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

const HACK_STATE = {
  tab: "browse",
  searchQuery: "",
};

function hackSetTab(tab) {
  HACK_STATE.tab = tab;
  renderHackathons();
}

async function renderHackathons() {
  const root = document.getElementById("hackathons-content");
  if (!root) return;

  const isAdmin =
    (typeof isSuperUser === "function" && isSuperUser()) ||
    ["administrator", "admin", "super user", "superuser"].includes(String(getCurrentUserRole()).toLowerCase());

  root.innerHTML = `
    <div class="tabs" style="margin-bottom:20px">
      <button class="tab ${HACK_STATE.tab === "browse" ? "active" : ""}" onclick="hackSetTab('browse')">Browse</button>
      <button class="tab ${HACK_STATE.tab === "mine" ? "active" : ""}" onclick="hackSetTab('mine')">My Hackathons</button>
      <button class="tab ${HACK_STATE.tab === "host" ? "active" : ""}" onclick="hackSetTab('host')">Host</button>
      ${isAdmin ? `<button class="tab ${HACK_STATE.tab === "verify" ? "active" : ""}" onclick="hackSetTab('verify')">Verify KYC</button>` : ""}
    </div>
    <div id="hack-tab-body">Loading…</div>
  `;

  try {
    switch (HACK_STATE.tab) {
      case "browse":
        await hackRenderBrowse();
        break;
      case "mine":
        await hackRenderMine();
        break;
      case "host":
        await hackRenderHost();
        break;
      case "verify":
        await hackRenderVerify();
        break;
    }
  } catch (err) {
    const body = document.getElementById("hack-tab-body");
    if (body) body.innerHTML = `<p style="color:var(--destructive)">Failed to load: ${hackEscapeHtml(err.message || String(err))}</p>`;
  }
}

function hackCard(innerHtml) {
  return `<div class="card mt-3" style="padding:16px">${innerHtml}</div>`;
}

// ---- Browse + Search --------------------------------------------------------
async function hackRenderBrowse() {
  const body = document.getElementById("hack-tab-body");
  const hackathons = await hackathonsApi.search(HACK_STATE.searchQuery);

  body.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:16px">
      <input class="input" id="hack-search-input" placeholder="Search hackathons by title, theme, or description…"
        value="${hackEscapeHtml(HACK_STATE.searchQuery)}" style="flex:1" onkeydown="if(event.key==='Enter') hackDoSearch()">
      <button class="btn btn-primary" onclick="hackDoSearch()">Search</button>
    </div>
    <div id="hack-browse-list">
      ${
        hackathons.length === 0
          ? `<p class="page-subtitle">No hackathons found.</p>`
          : hackathons
              .map(
                (h) => `
        <div class="card mt-3" style="padding:16px;cursor:pointer" onclick="hackOpenDetail('${h.id}')">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div>
              <h3 style="margin:0">${hackEscapeHtml(h.title)}</h3>
              <p class="page-subtitle" style="margin:4px 0">${hackEscapeHtml(h.description)}</p>
              <div style="display:flex;gap:14px;font-size:.85rem;color:var(--muted-fg);margin-top:8px">
                <span>🏆 ₹${h.prizePool.toLocaleString()}</span>
                <span>👥 Team of ${h.teamSizeMin}-${h.teamSizeMax}</span>
                <span>📅 Register by ${new Date(h.registrationDeadline).toLocaleDateString()}</span>
              </div>
            </div>
            <span class="badge">${hackEscapeHtml(h.status.replace(/_/g, " "))}</span>
          </div>
        </div>`,
              )
              .join("")
      }
    </div>
  `;
}

function hackDoSearch() {
  HACK_STATE.searchQuery = document.getElementById("hack-search-input")?.value.trim() || "";
  hackRenderBrowse();
}

// ---- Detail + Register -------------------------------------------------------
async function hackOpenDetail(hackathonId) {
  const body = document.getElementById("hack-tab-body");
  const h = await hackathonsApi.get(hackathonId);
  const userId = getCurrentUserId();

  body.innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="hackRenderBrowse()">&larr; Back to Browse</button>
    ${hackCard(`
      <h2 style="margin-top:0">${hackEscapeHtml(h.title)}</h2>
      <p>${hackEscapeHtml(h.description)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0">
        <div><strong>Prize Pool</strong><br>₹${h.prizePool.toLocaleString()} (${h.prizeSplit.join("/")}% split)</div>
        <div><strong>Team Size</strong><br>${h.teamSizeMin} - ${h.teamSizeMax} members</div>
        <div><strong>Eligibility</strong><br>${hackEscapeHtml(h.eligibilityCriteria)}</div>
        <div><strong>Registration Deadline</strong><br>${new Date(h.registrationDeadline).toLocaleString()}</div>
        <div><strong>Status</strong><br><span class="badge">${hackEscapeHtml(h.status.replace(/_/g, " "))}</span></div>
        ${h.theme ? `<div><strong>Theme</strong><br>${hackEscapeHtml(h.theme)}</div>` : ""}
      </div>
      ${
        h.status === "open_for_registration"
          ? `<button class="btn btn-primary" onclick="hackShowRegisterForm('${h.id}')">Register as Team Lead</button>`
          : `<p class="page-subtitle">Registration is closed for this hackathon.</p>`
      }
      <div id="hack-register-form"></div>
    `)}
  `;
}

function hackShowRegisterForm(hackathonId) {
  const container = document.getElementById("hack-register-form");
  container.innerHTML = `
    <div class="card mt-3" style="padding:16px">
      <h4 style="margin-top:0">Register as Team Lead</h4>
      <p class="page-subtitle" style="margin-bottom:12px">You'll register your own KYC now, then invite teammates once your team exists.</p>
      <div style="display:flex;flex-direction:column;gap:10px">
        <input class="input" id="hack-reg-teamname" placeholder="Team name">
        <input class="input" id="hack-reg-fullname" placeholder="Full name (as on ID)">
        <input class="input" id="hack-reg-college" placeholder="College name">
        <input class="input" id="hack-reg-age" type="number" min="13" placeholder="Age">
        <input class="input" id="hack-reg-idcard" type="file" accept="image/*,.pdf">
        <button class="btn btn-primary" style="width:fit-content" onclick="hackSubmitRegistration('${hackathonId}')">Submit Registration</button>
      </div>
    </div>
  `;
}

async function hackUploadIdCard(file) {
  if (!file) return "no-id-provided";
  const formData = new FormData();
  formData.append("file", file);
  const backendUserId = (typeof localStorage !== "undefined" && localStorage.getItem("teamforge.backendUserId")) || "1";
  const res = await fetch(`${resolveApiBaseUrl()}/uploads/resource`, {
    method: "POST",
    headers: {
      "x-user-id": backendUserId,
      "x-user-role": typeof getCurrentUserRole === "function" ? getCurrentUserRole() : "Collaborator"
    },
    body: formData
  });
  if (!res.ok) throw new Error("ID card upload failed");
  const data = await res.json();
  // Backend returns: { message, filename, url } where url = "/uploads/filename"
  return data.url || data.path || (data.filename ? `/uploads/${data.filename}` : "no-id-provided");
}

async function hackSubmitRegistration(hackathonId) {
  const teamName = document.getElementById("hack-reg-teamname").value.trim();
  const fullName = document.getElementById("hack-reg-fullname").value.trim();
  const collegeName = document.getElementById("hack-reg-college").value.trim();
  const age = Number(document.getElementById("hack-reg-age").value);
  const fileInput = document.getElementById("hack-reg-idcard");

  if (!teamName || !fullName || !collegeName || !age) {
    showToast("All fields are required");
    return;
  }

  try {
    const idCardImageRef = await hackUploadIdCard(fileInput?.files?.[0]);
    const userId = getCurrentUserId();
    await hackathonsApi.registerLead(hackathonId, { userId, teamName, fullName, collegeName, age, idCardImageRef });
    showToast("Registered! Your KYC is pending admin verification.");
    hackSetTab("mine");
  } catch (err) {
    showToast(err.message || "Registration failed", "error");
  }
}

// ---- My Hackathons (teams, invites, workspace) -------------------------------
async function hackRenderMine() {
  const body = document.getElementById("hack-tab-body");
  const userId = getCurrentUserId();

  const [invites, allHackathons] = await Promise.all([
    teamInvitationsApi.forUser(userId),
    hackathonsApi.search(),
  ]);

  // Find every team this user belongs to across all hackathons by checking
  // each hackathon's teams for membership (small-scale demo app — fine to
  // do client-side rather than adding a dedicated "my teams" endpoint).
  const myTeamsPerHackathon = [];
  for (const h of allHackathons) {
    const hackTeams = await teamsApi.list(h.id);
    for (const t of hackTeams) {
      const members = await teamsApi.members(t.id);
      if (members.some((m) => m.userId === userId)) {
        myTeamsPerHackathon.push({ hackathon: h, team: t, isLead: t.leadUserId === userId });
      }
    }
  }

  const pendingInvites = invites.filter((i) => i.status === "pending");

  body.innerHTML = `
    ${
      pendingInvites.length > 0
        ? hackCard(`
      <h4 style="margin-top:0">Pending Team Invitations</h4>
      ${pendingInvites
        .map(
          (inv) => `
        <div class="card mt-2" style="padding:12px">
          <p>You've been invited to join a team.</p>
          <button class="btn btn-primary btn-sm" onclick="hackShowAcceptForm('${inv.id}')">Accept &amp; Submit KYC</button>
          <button class="btn btn-outline btn-sm" onclick="hackDeclineInvite('${inv.id}')">Decline</button>
          <div id="hack-accept-form-${inv.id}"></div>
        </div>`,
        )
        .join("")}
    `)
        : ""
    }
    ${
      myTeamsPerHackathon.length === 0
        ? `<p class="page-subtitle mt-3">You haven't registered for any hackathons yet — check the Browse tab.</p>`
        : myTeamsPerHackathon
            .map(
              ({ hackathon, team, isLead }) => `
      ${hackCard(`
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h4 style="margin:0">${hackEscapeHtml(hackathon.title)} — Team "${hackEscapeHtml(team.name)}"</h4>
            <p class="page-subtitle" style="margin:4px 0">${isLead ? "You are the Team Lead" : "Team Member"} &middot; Hackathon status: ${hackEscapeHtml(hackathon.status.replace(/_/g, " "))}</p>
          </div>
          ${team.score !== undefined ? `<span class="badge">Score: ${team.score}/10</span>` : ""}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          ${
            team.projectId
              ? `<button class="btn btn-primary btn-sm" onclick="hackOpenTeamWorkspace('${team.projectId}')">Open Workspace</button>`
              : `<span class="page-subtitle">Workspace opens once the host starts the hackathon.</span>`
          }
          ${
            isLead && !team.projectId
              ? `<button class="btn btn-outline btn-sm" onclick="hackShowInviteForm('${team.id}')">Invite Teammate</button>`
              : ""
          }
          ${
            isLead && team.projectId && hackathon.status === "ongoing"
              ? `<button class="btn btn-primary btn-sm" onclick="hackSubmitProject('${team.projectId}')">Submit Project</button>`
              : ""
          }
        </div>
        <div id="hack-invite-form-${team.id}"></div>
      `)}
    `,
            )
            .join("")
    }
  `;
}

function hackShowAcceptForm(inviteId) {
  const container = document.getElementById(`hack-accept-form-${inviteId}`);
  container.innerHTML = `
    <div class="mt-2" style="display:flex;flex-direction:column;gap:8px">
      <input class="input" id="hack-accept-fullname-${inviteId}" placeholder="Full name (as on ID)">
      <input class="input" id="hack-accept-college-${inviteId}" placeholder="College name">
      <input class="input" id="hack-accept-age-${inviteId}" type="number" min="13" placeholder="Age">
      <input class="input" id="hack-accept-idcard-${inviteId}" type="file" accept="image/*,.pdf">
      <button class="btn btn-primary btn-sm" style="width:fit-content" onclick="hackConfirmAccept('${inviteId}')">Confirm</button>
    </div>
  `;
}

async function hackConfirmAccept(inviteId) {
  const fullName = document.getElementById(`hack-accept-fullname-${inviteId}`).value.trim();
  const collegeName = document.getElementById(`hack-accept-college-${inviteId}`).value.trim();
  const age = Number(document.getElementById(`hack-accept-age-${inviteId}`).value);
  const fileInput = document.getElementById(`hack-accept-idcard-${inviteId}`);

  if (!fullName || !collegeName || !age) {
    showToast("All fields are required");
    return;
  }
  try {
    const idCardImageRef = await hackUploadIdCard(fileInput?.files?.[0]);
    await teamInvitationsApi.accept(inviteId, { fullName, collegeName, age, idCardImageRef });
    showToast("Joined the team! Your KYC is pending admin verification.");
    hackRenderMine();
  } catch (err) {
    showToast(err.message || "Failed to accept invitation", "error");
  }
}

async function hackDeclineInvite(inviteId) {
  try {
    await teamInvitationsApi.decline(inviteId);
    showToast("Invitation declined");
    hackRenderMine();
  } catch (err) {
    showToast(err.message || "Failed to decline", "error");
  }
}

function hackShowInviteForm(teamId) {
  const container = document.getElementById(`hack-invite-form-${teamId}`);
  container.innerHTML = `
    <div class="mt-2" style="display:flex;gap:8px">
      <input class="input" id="hack-invite-userid-${teamId}" placeholder="Teammate's user ID">
      <button class="btn btn-primary btn-sm" onclick="hackSendInvite('${teamId}')">Send Invite</button>
    </div>
  `;
}

async function hackSendInvite(teamId) {
  const invitedUserId = document.getElementById(`hack-invite-userid-${teamId}`).value.trim();
  if (!invitedUserId) {
    showToast("Enter the teammate's user ID");
    return;
  }
  try {
    await teamInvitationsApi.invite({ teamId, invitedUserId, invitedBy: getCurrentUserId() });
    showToast("Invitation sent");
    hackRenderMine();
  } catch (err) {
    showToast(err.message || "Failed to send invite", "error");
  }
}

async function hackOpenTeamWorkspace(projectId) {
  if (typeof syncProjectsFromBackend === "function") {
    await syncProjectsFromBackend();
  }
  if (typeof openWorkspace === "function") {
    openWorkspace(projectId, "hackathons");
  }
}

async function hackSubmitProject(projectId) {
  if (!confirm("Submit this project for host judging? You won't be able to make further changes.")) return;
  try {
    await apiRequest(`/projects/${projectId}/submit`, "POST", null, { role: getCurrentUserRole(), userId: getCurrentUserId() });
    showToast("Project submitted for judging!");
    hackRenderMine();
  } catch (err) {
    showToast(err.message || "Failed to submit project", "error");
  }
}

// ---- Host: create + manage hackathons ----------------------------------------
async function hackRenderHost() {
  const body = document.getElementById("hack-tab-body");
  const userId = getCurrentUserId();
  const memberships = await organizationsApi.myMemberships(userId);
  const adminOrgIds = memberships.filter((m) => m.orgRole === "org_admin").map((m) => m.orgId);

  if (adminOrgIds.length === 0) {
    body.innerHTML = `
      ${hackCard(`
        <h4 style="margin-top:0">Become a Host</h4>
        <p class="page-subtitle">Register your organization to host hackathons.</p>
        <div style="display:flex;flex-direction:column;gap:8px;max-width:420px">
          <input class="input" id="hack-org-name" placeholder="Organization name">
          <input class="input" id="hack-org-domain" placeholder="Domain, e.g. acme.com">
          <input class="input" id="hack-org-email" placeholder="Contact email">
          <button class="btn btn-primary" style="width:fit-content" onclick="hackRegisterOrg()">Register Organization</button>
        </div>
      `)}
    `;
    return;
  }

  const orgId = adminOrgIds[0];
  const myHackathons = await hackathonsApi.byOrg(orgId);

  body.innerHTML = `
    ${hackCard(`
      <h4 style="margin-top:0">Create a Hackathon</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <input class="input" id="hack-new-title" placeholder="Title" style="grid-column:span 2">
        <textarea class="input" id="hack-new-desc" placeholder="Description" style="grid-column:span 2" rows="2"></textarea>
        <input class="input" id="hack-new-theme" placeholder="Theme/tags (optional)">
        <input class="input" id="hack-new-eligibility" placeholder="Eligibility criteria">
        <input class="input" id="hack-new-teamsize-min" type="number" min="1" placeholder="Min team size">
        <input class="input" id="hack-new-teamsize-max" type="number" min="1" placeholder="Max team size">
        <input class="input" id="hack-new-prize" type="number" min="1" placeholder="Prize pool (₹)">
        <input class="input" id="hack-new-deadline" type="datetime-local" placeholder="Registration deadline">
      </div>
      <button class="btn btn-primary mt-2" onclick="hackCreateHackathon('${orgId}')">Create &amp; Fund Escrow</button>
    `)}
    <div class="mt-3">
      ${
        myHackathons.length === 0
          ? `<p class="page-subtitle">You haven't hosted any hackathons yet.</p>`
          : (await Promise.all(myHackathons.map((h) => hackRenderHostHackathon(h)))).join("")
      }
    </div>
  `;
}

async function hackRegisterOrg() {
  const name = document.getElementById("hack-org-name").value.trim();
  const domain = document.getElementById("hack-org-domain").value.trim();
  const contactEmail = document.getElementById("hack-org-email").value.trim();
  if (!name || !domain || !contactEmail) {
    showToast("All fields are required");
    return;
  }
  try {
    await organizationsApi.create({ name, domain, contactEmail, orgAdminUserId: getCurrentUserId() });
    showToast("Organization registered — you can now host hackathons");
    hackRenderHost();
  } catch (err) {
    showToast(err.message || "Failed to register organization", "error");
  }
}

async function hackCreateHackathon(orgId) {
  const title = document.getElementById("hack-new-title").value.trim();
  const description = document.getElementById("hack-new-desc").value.trim();
  const theme = document.getElementById("hack-new-theme").value.trim();
  const eligibilityCriteria = document.getElementById("hack-new-eligibility").value.trim();
  const teamSizeMin = Number(document.getElementById("hack-new-teamsize-min").value);
  const teamSizeMax = Number(document.getElementById("hack-new-teamsize-max").value);
  const prizePool = Number(document.getElementById("hack-new-prize").value);
  const registrationDeadline = document.getElementById("hack-new-deadline").value;

  if (!title || !description || !eligibilityCriteria || !teamSizeMin || !teamSizeMax || !prizePool || !registrationDeadline) {
    showToast("All fields except theme are required");
    return;
  }

  try {
    await hackathonsApi.create({
      orgId,
      createdBy: getCurrentUserId(),
      title,
      description,
      theme: theme || undefined,
      eligibilityCriteria,
      teamSizeMin,
      teamSizeMax,
      prizePool,
      registrationDeadline: new Date(registrationDeadline).toISOString(),
    });
    showToast(`Hackathon created — ₹${prizePool.toLocaleString()} funded into escrow`);
    hackRenderHost();
  } catch (err) {
    showToast(err.message || "Failed to create hackathon", "error");
  }
}

async function hackRenderHostHackathon(h) {
  const teams = await teamsApi.list(h.id);
  const leaderboard = await teamsApi.leaderboard(h.id);

  return hackCard(`
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h4 style="margin:0">${hackEscapeHtml(h.title)}</h4>
      <span class="badge">${hackEscapeHtml(h.status.replace(/_/g, " "))}</span>
    </div>
    <p class="page-subtitle">₹${h.prizePool.toLocaleString()} prize pool &middot; ${teams.length} team(s) registered</p>
    ${
      h.status === "open_for_registration"
        ? `<button class="btn btn-primary btn-sm" onclick="hackStartHackathon('${h.id}')">Start Hackathon (creates team workspaces)</button>`
        : ""
    }
    ${
      h.status === "ongoing" || h.status === "judging"
        ? `
      <table style="width:100%;margin-top:10px;border-collapse:collapse">
        <thead><tr><th style="text-align:left;padding:6px">Team</th><th style="text-align:left;padding:6px">Project Status</th><th style="text-align:left;padding:6px">Score</th><th></th></tr></thead>
        <tbody>
          ${teams
            .map(
              (t) => `
            <tr>
              <td style="padding:6px">${hackEscapeHtml(t.name)}</td>
              <td style="padding:6px">${t.projectId ? "Workspace active" : "—"}</td>
              <td style="padding:6px">${t.score !== undefined ? `${t.score}/10` : "Not scored"}</td>
              <td style="padding:6px">
                <input class="input" style="width:60px;display:inline-block" type="number" min="1" max="10" id="hack-score-input-${t.id}" placeholder="1-10">
                <button class="btn btn-outline btn-sm" onclick="hackScoreTeam('${h.id}','${t.id}')">Score</button>
              </td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <button class="btn btn-primary mt-2" onclick="hackCloseHackathon('${h.id}')" ${leaderboard.length === 0 ? "disabled title='Score at least one team first'" : ""}>
        Close Hackathon &amp; Pay Top 3
      </button>
    `
        : ""
    }
    ${
      h.status === "closed"
        ? `<p class="page-subtitle">Closed. Winning teams: ${(h.winningTeamIds || []).length}</p>`
        : ""
    }
  `);
}

async function hackStartHackathon(hackathonId) {
  try {
    await hackathonsApi.start(hackathonId, getCurrentUserId());
    showToast("Hackathon started — team workspaces created");
    hackRenderHost();
  } catch (err) {
    showToast(err.message || "Failed to start hackathon", "error");
  }
}

async function hackScoreTeam(hackathonId, teamId) {
  const scoreInput = document.getElementById(`hack-score-input-${teamId}`);
  const score = Number(scoreInput?.value);
  if (!score || score < 1 || score > 10) {
    showToast("Enter a score between 1 and 10");
    return;
  }
  try {
    await hackathonsApi.scoreTeam(hackathonId, teamId, { scoredBy: getCurrentUserId(), score });
    showToast("Score recorded — leaderboard updated");
    hackRenderHost();
  } catch (err) {
    showToast(err.message || "Failed to score team", "error");
  }
}

async function hackCloseHackathon(hackathonId) {
  if (!confirm("Close this hackathon? The top 3 scored teams will be paid from escrow and notified. This cannot be undone.")) return;
  try {
    await hackathonsApi.close(hackathonId, getCurrentUserId());
    showToast("Hackathon closed — top 3 teams paid and notified");
    hackRenderHost();
  } catch (err) {
    showToast(err.message || "Failed to close hackathon", "error");
  }
}

// ---- Verify KYC (Platform Admin) ---------------------------------------------
async function hackRenderVerify() {
  const body = document.getElementById("hack-tab-body");
  const pending = await hackathonRegistrationsApi.pending();

  body.innerHTML = `
    ${
      pending.length === 0
        ? `<p class="page-subtitle">No pending KYC registrations.</p>`
        : pending
            .map(
              (r) => `
      ${hackCard(`
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <h4 style="margin:0">${hackEscapeHtml(r.fullName)} <span class="page-subtitle">(${hackEscapeHtml(r.role)})</span></h4>
            <p class="page-subtitle" style="margin:4px 0">${hackEscapeHtml(r.collegeName)} &middot; Age ${r.age}</p>
            <p style="margin:4px 0"><a href="${hackEscapeHtml(r.idCardImageRef)}" target="_blank" rel="noopener">View ID Card</a></p>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary btn-sm" onclick="hackVerifyRegistration('${r.id}')">Verify</button>
            <button class="btn btn-outline btn-sm" onclick="hackRejectRegistration('${r.id}')">Reject</button>
          </div>
        </div>
      `)}
    `,
            )
            .join("")
    }
  `;
}

async function hackVerifyRegistration(id) {
  try {
    await hackathonRegistrationsApi.verify(id, getCurrentUserId());
    showToast("Registration verified");
    hackRenderVerify();
  } catch (err) {
    showToast(err.message || "Failed to verify", "error");
  }
}

async function hackRejectRegistration(id) {
  const reason = prompt("Reason for rejection (optional):") || undefined;
  try {
    await hackathonRegistrationsApi.reject(id, getCurrentUserId(), reason);
    showToast("Registration rejected");
    hackRenderVerify();
  } catch (err) {
    showToast(err.message || "Failed to reject", "error");
  }
}
