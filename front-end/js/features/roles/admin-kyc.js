let KYC_ADMIN_STATE = {
  tab: "pending",
  teams: [],
  hackathons: []
};

function setKycAdminTab(tab) {
  KYC_ADMIN_STATE.tab = tab;
  document.querySelectorAll("#admin-kyc .tab").forEach(t => t.classList.remove("active"));
  const activeTabEl = document.getElementById(`kyc-tab-${tab}`);
  if (activeTabEl) activeTabEl.classList.add("active");
  renderAdminKycList();
}

async function renderAdminKyc() {
  const listEl = document.getElementById("admin-kyc-list");
  if (!listEl) return;
  
  listEl.innerHTML = '<div class="admin-users-empty">Loading team ID approval requests...</div>';
  
  try {
    const [pendingTeams, allHackathons, pendingRegistrations] = await Promise.all([
      window.teamsApi ? window.teamsApi.pendingApprovals().catch(() => []) : Promise.resolve([]),
      window.hackathonsApi ? window.hackathonsApi.search().catch(() => []) : Promise.resolve([]),
      window.hackathonRegistrationsApi ? window.hackathonRegistrationsApi.pending().catch(() => []) : Promise.resolve([])
    ]);
    
    KYC_ADMIN_STATE.hackathons = allHackathons || [];
    
    // Combine pending teams from teamsApi and hackathonRegistrationsApi
    const combinedTeams = [...(pendingTeams || [])];
    
    // If there are legacy registrations not yet in teams, map them
    if (Array.isArray(pendingRegistrations)) {
      pendingRegistrations.forEach(reg => {
        if (!combinedTeams.some(t => t.id === reg.id || t.leadUserId === reg.userId)) {
          combinedTeams.push({
            id: reg.id,
            name: reg.studentId || 'Team Lead Registration',
            leadUserId: reg.userId,
            hackathonId: '',
            college: reg.college,
            studentId: reg.studentId,
            idCardImage: reg.idCardImage,
            status: reg.status || 'VerificationPending',
            createdAt: reg.submittedAt || new Date().toISOString(),
            isRegistrationEntity: true
          });
        }
      });
    }

    KYC_ADMIN_STATE.teams = combinedTeams;
    renderAdminKycList();
  } catch(e) {
    listEl.innerHTML = '<div class="admin-users-empty">Failed to load team approval requests.</div>';
    console.error(e);
  }
}

function renderAdminKycList() {
  const listEl = document.getElementById("admin-kyc-list");
  if (!listEl) return;
  
  const pendingCount = KYC_ADMIN_STATE.teams.filter(t => t.status === "VerificationPending" || t.status === "Pending").length;
  const badge = document.getElementById("kyc-badge");
  if (badge) {
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  }

  let filtered = [];
  if (KYC_ADMIN_STATE.tab === 'pending') {
    filtered = KYC_ADMIN_STATE.teams.filter(t => t.status === 'VerificationPending' || t.status === 'Pending');
  } else if (KYC_ADMIN_STATE.tab === 'verified') {
    filtered = KYC_ADMIN_STATE.teams.filter(t => t.status === 'Registered' || t.status === 'Verified' || t.status === 'Active');
  } else if (KYC_ADMIN_STATE.tab === 'rejected') {
    filtered = KYC_ADMIN_STATE.teams.filter(t => t.status === 'Rejected');
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="admin-users-empty">No ${KYC_ADMIN_STATE.tab} team ID requests found.</div>`;
    return;
  }
  
  listEl.innerHTML = `
    <table class="admin-audit-table mt-3">
      <thead>
        <tr>
          <th>Team &amp; Hackathon</th>
          <th>Lead User ID &amp; Student ID</th>
          <th>College / University</th>
          <th>Student ID Document</th>
          <th>Submitted Date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(t => {
          const hackathon = KYC_ADMIN_STATE.hackathons.find(h => h.id === t.hackathonId);
          const hackathonName = hackathon ? hackathon.name : 'Hackathon';
          const idImageUrl = t.idCardImage ? (t.idCardImage.startsWith('http') ? t.idCardImage : `http://localhost:3000${t.idCardImage}`) : '';

          return `
            <tr>
              <td>
                <div class="font-semibold" style="color:var(--fg)">${escapeHtml(t.name)}</div>
                <div class="text-xs text-muted">🏆 ${escapeHtml(hackathonName)}</div>
              </td>
              <td>
                <div class="font-semibold" style="color:var(--fg)">${escapeHtml(t.studentId || 'ID Pending')}</div>
                <div class="text-xs text-muted">Lead User: ${escapeHtml(t.leadUserId || t.userId || '')}</div>
              </td>
              <td>
                <div style="color:var(--fg)">${escapeHtml(t.college || 'N/A')}</div>
              </td>
              <td>
                ${idImageUrl ? `
                  <a href="${idImageUrl}" target="_blank" class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:4px">
                    📄 View ID Card
                  </a>
                ` : '<span class="text-xs text-muted">No ID attached</span>'}
              </td>
              <td>${new Date(t.createdAt || Date.now()).toLocaleDateString()}</td>
              <td>
                ${(t.status === 'VerificationPending' || t.status === 'Pending') ? `
                  <div style="display:flex;gap:8px">
                    <button class="btn btn-primary btn-sm" onclick="adminApproveTeam('${t.id}', ${Boolean(t.isRegistrationEntity)})">Approve</button>
                    <button class="btn btn-outline btn-sm" style="color:var(--destructive);border-color:var(--destructive)" onclick="adminRejectTeam('${t.id}', ${Boolean(t.isRegistrationEntity)})">Reject</button>
                  </div>
                ` : `
                  <span class="admin-audit-type ${t.status === 'Registered' || t.status === 'Verified' ? 'success' : 'danger'}">${t.status}</span>
                `}
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

async function adminApproveTeam(id, isRegistrationEntity) {
  try {
    const adminId = window.getCurrentUserId ? window.getCurrentUserId() : "1";
    if (isRegistrationEntity && window.hackathonRegistrationsApi) {
      await window.hackathonRegistrationsApi.verify(id, adminId);
    } else if (window.teamsApi) {
      await window.teamsApi.approve(id, adminId);
    }
    showToast("Team ID approved! Team is now confirmed for the hackathon.", "success");
    renderAdminKyc();
  } catch(e) {
    showToast("Failed to approve team: " + (e.message || "Unknown error"), "error");
  }
}

async function adminRejectTeam(id, isRegistrationEntity) {
  const reason = prompt("Enter rejection reason (e.g., 'ID blurry', 'Not an eligible college'):");
  if (!reason) return;
  try {
    const adminId = window.getCurrentUserId ? window.getCurrentUserId() : "1";
    if (isRegistrationEntity && window.hackathonRegistrationsApi) {
      await window.hackathonRegistrationsApi.reject(id, adminId, reason);
    } else if (window.teamsApi) {
      await window.teamsApi.reject(id, adminId, reason);
    }
    showToast("Team registration rejected", "success");
    renderAdminKyc();
  } catch(e) {
    showToast("Failed to reject team: " + (e.message || "Unknown error"), "error");
  }
}
