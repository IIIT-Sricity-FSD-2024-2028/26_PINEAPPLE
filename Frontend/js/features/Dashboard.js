function dashboardIcon(name) {
  const icons = {
    rocket:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 15c-1 0-2 1-2 2v2h2c1 0 2-1 2-2v-2H5Z"/><path d="M15 5c0-1 1-2 2-2h2v2c0 1-1 2-2 2h-2V5Z"/><path d="M14 10 4 20"/><path d="M12 12c-3-3-4-7-3-9 2-1 6 0 9 3s4 7 3 9c-2 1-6 0-9-3Z"/></svg>',
    users:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    star:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3.6 2.57 5.2 5.73.83-4.15 4.04.98 5.7L12 16.67 6.87 19.37l.98-5.7L3.7 9.63l5.73-.83L12 3.6Z"/></svg>',
    clock:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    bolt:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>',
    trophy:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h2a2 2 0 0 1 2 2 5 5 0 0 1-5 5"/><path d="M7 5H5a2 2 0 0 0-2 2 5 5 0 0 0 5 5"/></svg>',
    folder:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    bell:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',
    x:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    link:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 1 0-7.07-7.07L11 4"/><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 19"/></svg>',
  };
  return icons[name] || icons.bell;
}

function getDashboardActivityIcon(notification = {}) {
  const type = String(notification.type || "").trim().toUpperCase();
  const status = String(notification.status || "").trim().toLowerCase();
  if (status === "accepted" || status === "approved") return dashboardIcon("check");
  if (status === "rejected" || status === "declined" || status === "removed") return dashboardIcon("x");
  if (type === "JOIN_REQUEST" || type === "MENTOR_REQUEST") return dashboardIcon("users");
  return dashboardIcon("bell");
}

function renderDashboard() {
  const isMentor = STATE.role === "mentor";
  const currentUserName = STATE.currentUser?.name || "TeamForge User";
  const currentUserEmail = STATE.currentUser?.email || "";
  const currentUserRecord =
    typeof getCurrentUserRecord === "function" ? getCurrentUserRecord() : null;
  const currentXp = Number(currentUserRecord?.profile?.xp ?? 0);
  const currentRep = Number(currentUserRecord?.profile?.rep ?? 0);
  const currentUserData =
    (typeof getCurrentUserData === "function" && getCurrentUserData()) ||
    { projects: [], requests: [], notifications: [] };
  const mentorRequests = isMentor && Array.isArray(PROJECTS)
    ? PROJECTS
        .map((project) => {
          const runtime =
            typeof getProjectRuntime === "function"
              ? getProjectRuntime(project)
              : project?.runtime;
          const request = runtime?.mentorRequest;
          if (!request) return null;
          if (
            request.requestedName !== currentUserName &&
            request.mentorEmail !== currentUserEmail
          ) {
            return null;
          }
          return {
            projectId: project.id,
            projectName: project.name,
            owner: project.owner,
            requestedOn: request.requestedOn || "Just now",
            status: String(request.status || "requested").toLowerCase(),
          };
        })
        .filter(Boolean)
    : [];
  const visibleProjects = PROJECTS.filter((project) => {
    const isOwner = project.owner === currentUserName;
    const isMember = Array.isArray(project.members)
      ? project.members.some((member) => member.name === currentUserName)
      : false;
    return isOwner || isMember;
  });
  const activeProjectCount = visibleProjects.filter((project) => !project.isCompleted).length;
  const pendingRequests = isMentor
    ? mentorRequests.filter((request) => request.status === "requested")
    : currentUserData.requests.filter((request) => request.status === "pending");
  const mentorAcceptedProjects = isMentor
    ? mentorRequests.filter((request) => request.status === "approved")
    : [];
  const mentorBadgesAwarded = isMentor && Array.isArray(PROJECTS)
    ? PROJECTS.reduce((count, project) => {
        const runtime =
          typeof getProjectRuntime === "function"
            ? getProjectRuntime(project)
            : project?.runtime;
        const request = runtime?.mentorRequest;
        if (!request) return count;
        if (
          request.status !== "approved" ||
          (request.requestedName !== currentUserName &&
            request.mentorEmail !== currentUserEmail)
        ) {
          return count;
        }
        return count + (Array.isArray(runtime?.recommendations) ? runtime.recommendations.length : 0);
      }, 0)
    : 0;
  const unreadNotifications = currentUserData.notifications.filter(
    (notification) => notification.unread,
  );

  document.getElementById("mentor-dash-btns").style.display = isMentor
    ? "flex"
    : "none";
  document.getElementById("mentor-badge-header").style.display = isMentor
    ? "inline"
    : "none";

  const stats = isMentor
    ? [
        {
          label: "Projects Mentored",
          value: String(mentorAcceptedProjects.length),
          icon: dashboardIcon("rocket"),
          color: "accent",
        },
        {
          label: "Pending Requests",
          value: String(pendingRequests.length),
          icon: dashboardIcon("clock"),
          color: "warning",
          trend: pendingRequests.length
            ? `${pendingRequests.length} awaiting response`
            : "No pending requests",
        },
        {
          label: "Badges Awarded",
          value: String(mentorBadgesAwarded),
          icon: dashboardIcon("star"),
          color: "success",
        },
        { label: "Team Members", value: String(activeProjectCount), icon: dashboardIcon("users"), color: "primary" },
      ]
    : [
        {
          label: "XP Points",
          value: currentXp.toLocaleString(),
          icon: dashboardIcon("bolt"),
          color: "accent",
          trend: unreadNotifications.length
            ? `${unreadNotifications.length} unread updates`
            : "+120 this week",
        },
        {
          label: "Reputation",
          value: String(currentRep),
          icon: dashboardIcon("trophy"),
          color: "primary",
          trend: "Top contributor",
        },
        {
          label: "Active Projects",
          value: String(activeProjectCount),
          icon: dashboardIcon("folder"),
          color: "info",
        },
        { label: "Completed Tasks", value: "24", icon: dashboardIcon("check"), color: "success" },
      ];

  document.getElementById("stat-grid").innerHTML = stats
    .map(
      (s) => `
    <div class="stat-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="stat-icon ${s.color}">${s.icon}</div>
        ${s.trend ? `<span class="text-xs text-success font-semibold">${s.trend}</span>` : ""}
      </div>
      <div class="stat-value mt-2">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `,
    )
    .join("");

  const collabAct = currentUserData.notifications.slice(0, 4).map((notification) => ({
    icon: getDashboardActivityIcon(notification),
    action: notification.title,
    project: notification.desc,
    time: notification.time || "Just now",
  }));
  const mentorAct = mentorRequests.slice(0, 4).map((request) => ({
    icon:
      request.status === "approved"
        ? dashboardIcon("check")
        : request.status === "declined"
          ? dashboardIcon("x")
          : dashboardIcon("users"),
    action:
      request.status === "approved"
        ? `Accepted mentorship for ${request.projectName}`
        : request.status === "declined"
          ? `Rejected mentorship for ${request.projectName}`
          : `Mentorship request from ${request.owner}`,
    project: request.projectName || request.projectId,
    time: request.requestedOn || "Just now",
  }));
  const actData = isMentor
        ? mentorAct
        : collabAct.length
      ? collabAct
      : [
          {
            icon: dashboardIcon("bell"),
            action: "Signed in",
            project: `${currentUserName} | ${currentUserEmail}`,
            time: "Now",
          },
        ];

  document.getElementById("activity-list").innerHTML = actData
    .map(
      (a) => `
    <div class="activity-item">
      <div class="activity-icon ${isMentor ? "accent-bg" : ""}">${a.icon}</div>
      <div class="activity-text">
        <div class="activity-title">${a.action}</div>
        <div class="activity-sub">${a.project}</div>
      </div>
      <div class="activity-time">${a.time}</div>
    </div>
  `,
    )
    .join("");

  const sc = document.getElementById("second-card");
  if (isMentor) {
    sc.innerHTML = `<div class="card-title">Mentor Requests</div>
      <div class="space-y-3">
        ${
          mentorRequests.length
            ? mentorRequests
                .map(
                  (request) => `
          <div class="checkin-row">
            <div>
              <div class="font-semibold text-sm">${request.projectName || request.projectId}</div>
              <div class="text-xs text-muted">Owner: ${request.owner}</div>
            </div>
            <span class="badge ${
              request.status === "approved"
                ? "badge-success"
                : request.status === "declined"
                  ? "badge-destructive"
                  : "badge-warning"
            }">${request.status === "requested" ? "pending" : request.status}</span>
          </div>
        `,
                )
                .join("")
            : '<p class="text-sm text-muted italic">No mentor requests for this account.</p>'
        }
      </div>`;
  } else {
    const skills = STATE.userSkills;
    sc.innerHTML = `<div class="card-title">My Skills</div>
      ${
        skills.length === 0
          ? '<p class="text-sm text-muted italic">No skills added yet. Add them in Settings | Profile.</p>'
          : `<div style="display:flex;flex-wrap:wrap;gap:7px">${skills.map((s) => `<span class="badge badge-secondary">${s}</span>`).join("")}</div>`
      }`;
  }

  const tc = document.getElementById("third-card");
  if (isMentor) {
    tc.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="card-title mb-0">Pending Mentor Requests</div>
        <button class="btn btn-outline btn-sm" onclick="navigate('mentor-requests')">See All</button>
      </div>
      <div class="space-y-3">
        ${
          pendingRequests.length
            ? pendingRequests
                .map(
                  (request) => `
          <div class="pending-row">
            <div>
              <div class="font-semibold text-sm">${request.projectName || request.projectId}</div>
              <div class="text-xs text-muted">from ${request.owner}</div>
            </div>
            <div class="flex gap-2 items-center">
              <span class="badge badge-secondary">${currentUserEmail}</span>
              <span class="badge badge-warning">pending</span>
            </div>
          </div>
        `,
                )
                .join("")
            : '<p class="text-sm text-muted italic">No pending mentor requests.</p>'
        }
      </div>`;
  } else {
    const contributions = visibleProjects.slice(0, 3).map((project) => ({
      project: project.name,
      contrib:
        project.owner === currentUserName
          ? "Owning and coordinating delivery"
          : "Working as a contributor",
      evidence: "Open workspace",
      status: project.isCompleted ? "Approved" : "In Review",
    }));

    tc.innerHTML = `<div class="card-title">Contribution History</div>
      <div class="text-xs text-muted mb-2">${currentUserName} | ${currentUserEmail}</div>
      <div class="overflow-x-auto">
        <table>
          <thead><tr><th>Project</th><th>Contribution</th><th>Evidence</th><th>Status</th></tr></thead>
          <tbody>${
            contributions.length
              ? contributions
                  .map(
                    (c) => `
            <tr>
              <td>${c.project}</td>
              <td class="text-muted">${c.contrib}</td>
              <td><span class="text-xs text-info">${dashboardIcon("link")} ${c.evidence}</span></td>
              <td><span class="badge ${c.status === "Approved" ? "badge-success" : "badge-warning"}">${c.status}</span></td>
            </tr>
          `,
                  )
                  .join("")
              : '<tr><td colspan="4" class="text-sm text-muted">No projects for this account yet.</td></tr>'
          }</tbody>
        </table>
      </div>`;
  }
}

function submitMentorApp() {
  const nameInput = document.getElementById("mentor-app-name");
  const linkedinInput = document.getElementById("mentor-app-linkedin");
  const expertiseInput = document.getElementById("mentor-app-expertise");
  const yearsInput = document.getElementById("mentor-app-years");
  const reasonInput =
    document.getElementById("mentor-app-reason") ||
    document.getElementById("mentor-app-motivation");

  if (
    !nameInput ||
    !linkedinInput ||
    !expertiseInput ||
    !yearsInput ||
    !reasonInput
  ) {
    showToast("Mentor application form is unavailable");
    return;
  }

  if (typeof ensureMentorApplicationsSeeded === "function") {
    ensureMentorApplicationsSeeded();
  }

  const currentEmail =
    typeof getCurrentUserSessionEmail === "function"
      ? getCurrentUserSessionEmail()
      : "";
  const currentUserRecord =
    typeof getCurrentUserRecord === "function" ? getCurrentUserRecord() : null;
  const typedName = nameInput.value.trim().replace(/\s+/g, " ");
  const name = String(
    currentUserRecord?.name || STATE.currentUser?.name || typedName,
  ).trim();
  const linkedin = linkedinInput.value.trim();
  const expertise = expertiseInput.value.trim();
  const years = Number.parseInt(yearsInput.value, 10);
  const reason = reasonInput.value.trim();

  if (!name) {
    showToast("Full name is required");
    return;
  }
  if (name.length < 2 || name.length > 60 || !/^[a-zA-Z][a-zA-Z\s.'-]*$/.test(name)) {
    showToast("Enter a valid full name (2-60 characters)");
    return;
  }

  if (!linkedin) {
    showToast("LinkedIn profile URL is required");
    return;
  }
  let parsedLinkedin;
  try {
    parsedLinkedin = new URL(linkedin);
  } catch {
    showToast("Enter a valid LinkedIn URL");
    return;
  }
  if (
    !(parsedLinkedin.protocol === "http:" || parsedLinkedin.protocol === "https:") ||
    !/linkedin\.com$/i.test(parsedLinkedin.hostname.replace(/^www\./i, ""))
  ) {
    showToast("LinkedIn URL must be on linkedin.com");
    return;
  }

  if (!expertise) {
    showToast("Area of expertise is required");
    return;
  }
  if (expertise.length < 3 || expertise.length > 80) {
    showToast("Area of expertise must be 3 to 80 characters");
    return;
  }

  if (!Number.isInteger(years) || years < 1 || years > 50) {
    showToast("Years of experience must be between 1 and 50");
    return;
  }

  if (!reason) {
    showToast("Please share why you want to mentor");
    return;
  }
  if (reason.length < 20 || reason.length > 1000) {
    showToast("Mentor motivation must be 20 to 1000 characters");
    return;
  }

  const existingApp = Array.isArray(STATE.mentorApplications)
    ? STATE.mentorApplications.find((app) => {
        const appEmail = String(app?.email || "").trim().toLowerCase();
        const appName = String(app?.name || "").trim().toLowerCase();
        return (
          (currentEmail && appEmail === currentEmail) ||
          appName === name.toLowerCase()
        );
      })
    : null;
  if (existingApp) {
    const status = String(existingApp.status || "pending").toLowerCase();
    if (status === "approved") {
      showToast("You are already an approved mentor");
      return;
    }
    if (status === "rejected") {
      showToast("Your previous mentor application was rejected");
      return;
    }
    showToast("You already have a pending mentor application");
    return;
  }

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const newApplication = {
    id: `mentor-app-${Date.now()}`,
    name,
    email: currentEmail,
    initials: initials || "US",
    university: String(
      currentUserRecord?.profile?.university || "Unknown University",
    ).trim(),
    submittedAt: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    expertise,
    specialization: expertise.split(",")[0].trim() || expertise,
    linkedin,
    years,
    motivation: reason,
    status: "pending",
  };

  STATE.mentorApplications = Array.isArray(STATE.mentorApplications)
    ? [newApplication, ...STATE.mentorApplications]
    : [newApplication];
  STATE.mentorApplicationId = newApplication.id;

  if (currentEmail && currentUserRecord && typeof getStateUsersStore === "function") {
    const users = getStateUsersStore();
    if (users[currentEmail]) {
      users[currentEmail].profile = {
        ...(users[currentEmail].profile || {}),
        linkedin,
      };
      saveStateUsersStore(users);
    }
  }

  if (typeof savePersistedMentorApplications === "function") {
    savePersistedMentorApplications(STATE.mentorApplications);
  }
  if (typeof saveUserRuntime === "function") saveUserRuntime();
  if (typeof recordPortalAuditEntry === "function") {
    recordPortalAuditEntry({
      action: `New mentor application submitted: ${name}`,
      actor: "System",
      target: newApplication.id,
      type: "mentor",
      details: `${name} (${years} years) - ${expertise}`,
      timestamp: new Date().toISOString(),
    });
  }

  showToast("Application submitted! Awaiting admin review.");
  nameInput.value = name;
  linkedinInput.value = "";
  expertiseInput.value = "";
  yearsInput.value = "";
  reasonInput.value = "";
}

