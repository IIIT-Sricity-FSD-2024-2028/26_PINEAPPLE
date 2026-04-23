
const PROJECT_REPORTS = {
  EcoTracker: {
    name: "EcoTracker",
    role: "Collaborator",
    contribution: "Integrated carbon footprint API",
    duration: "Jan 2026 – Feb 2026",
    tasksCompleted: 3,
    totalTasks: 3,
    xpEarned: 120,
    repGained: 8,
    skills: ["React", "API Integration", "Charts"],
    highlights: [
      "Integrated third-party carbon footprint API with full error boundary handling",
      "All 3 tasks approved on first submission — 100% approval rate",
      "Delivered 4 days ahead of project deadline",
    ],
    outcome:
      "Project shipped successfully with 80% of core features implemented. Received positive feedback from the project owner on code quality and documentation.",
  },
  "Budget Buddy": {
    name: "Budget Buddy",
    role: "Owner",
    contribution: "Led design and backend architecture",
    duration: "Oct 2025 – Dec 2025",
    tasksCompleted: 7,
    totalTasks: 8,
    xpEarned: 340,
    repGained: 14,
    skills: ["Node.js", "PostgreSQL", "REST API", "React"],
    highlights: [
      "Architected the full backend with role-based access control",
      "Led a team of 3 collaborators across 8 tasks",
      "Maintained 88% task approval rate across the project lifecycle",
    ],
    outcome:
      "Project completed with all core financial features live. Team achieved a combined 95% on-time submission rate. Selected as a featured project on the platform homepage.",
  },
  "Study Group Finder": {
    name: "Study Group Finder",
    role: "Collaborator",
    contribution: "Implemented matching algorithm frontend",
    duration: "Nov 2025 – Jan 2026",
    tasksCompleted: 2,
    totalTasks: 3,
    xpEarned: 90,
    repGained: 6,
    skills: ["React", "Algorithms", "TypeScript"],
    highlights: [
      "Built the compatibility score UI with real-time filtering",
      "Contributed frontend implementation of the matching algorithm visualization",
      "Collaborated closely with the backend team to align API contracts",
    ],
    outcome:
      "Matching feature launched successfully, enabling 40+ student pairs in the first week. Project owner rated collaboration experience 5/5.",
  },
  "MicroService Hub": {
    name: "MicroService Hub",
    role: "Owner",
    contribution: "Led full backend architecture",
    duration: "Aug 2025 – Nov 2025",
    tasksCompleted: 10,
    totalTasks: 10,
    xpEarned: 480,
    repGained: 20,
    skills: ["Go", "Docker", "Kubernetes", "PostgreSQL"],
    highlights: [
      "Designed microservices architecture handling 10k+ requests/day",
      "100% task completion rate — all 10 tasks approved without revision",
      "Onboarded and guided 2 junior collaborators through the codebase",
    ],
    outcome:
      "Platform achieved 99.9% uptime in the first month post-launch. Cited as a model project by platform mentors.",
  },
  "Code Review Hub": {
    name: "Code Review Hub",
    role: "Owner",
    contribution: "Designed entire review interface",
    duration: "Sep 2025 – Nov 2025",
    tasksCompleted: 5,
    totalTasks: 6,
    xpEarned: 220,
    repGained: 10,
    skills: ["React", "TypeScript", "Figma", "Tailwind CSS"],
    highlights: [
      "Designed and implemented the complete PR review UI from scratch",
      "Built inline commenting system with diff highlighting",
      "Integrated live status updates via polling",
    ],
    outcome:
      "Tool adopted by 3 other teams on the platform as their default code review interface. Positive feedback on UX quality.",
  },
  "NLP Classifier": {
    name: "NLP Classifier",
    role: "Owner",
    contribution: "Fine-tuned transformer models",
    duration: "Jun 2025 – Sep 2025",
    tasksCompleted: 8,
    totalTasks: 8,
    xpEarned: 400,
    repGained: 16,
    skills: ["Python", "TensorFlow", "Hugging Face", "MLOps"],
    highlights: [
      "Fine-tuned BERT model achieving 94.2% accuracy on test set",
      "Built end-to-end MLOps pipeline with automated retraining",
      "Published model to internal registry for reuse across 2 other projects",
    ],
    outcome:
      "Classifier deployed to production and integrated into AI Research Hub. Benchmarks exceeded initial targets by 12%.",
  },
  "Predictive Analytics Tool": {
    name: "Predictive Analytics Tool",
    role: "Collaborator",
    contribution: "Built forecasting models",
    duration: "Mar 2025 – Jun 2025",
    tasksCompleted: 6,
    totalTasks: 6,
    xpEarned: 280,
    repGained: 12,
    skills: ["Python", "Pandas", "scikit-learn", "R"],
    highlights: [
      "Built ARIMA and Prophet forecasting models for time-series data",
      "All 6 tasks submitted and approved with zero revisions required",
      "Documented model selection rationale and accuracy trade-offs",
    ],
    outcome:
      "Forecasting accuracy improved by 23% over the baseline heuristics. Models now serve as reference implementations for the team.",
  },
};

const OTHER_PROFILES = {
  "Dr. Divya Krishnan": {
    name: "Dr. Divya Krishnan",
    initials: "DK",
    title: "Machine Learning Engineer",
    uni: "IIT Bombay",
    bio: "Researcher and engineer with 8+ years building production ML systems. Passionate about helping students break into AI and data science through hands-on project mentorship.",
    joined: "Jan 2023",
    xp: 4200,
    rep: 96,
    projects: 8,
    tasks: 42,
    skills: [
      "Python",
      "Machine Learning",
      "TensorFlow",
      "Data Science",
      "R",
      "Pandas",
      "MLOps",
    ],
    hasMentorBadge: false,
    projectList: [
      {
        name: "AI Research Hub",
        role: "Owner",
        status: "Active",
        contribution: "Architected the full ML pipeline",
      },
      {
        name: "Predictive Analytics Tool",
        role: "Collaborator",
        status: "Completed",
        contribution: "Built forecasting models",
      },
      {
        name: "NLP Classifier",
        role: "Owner",
        status: "Completed",
        contribution: "Fine-tuned transformer models",
      },
    ],
    activity: [
      {
        action: "Approved task 'Model Training Pipeline'",
        project: "AI Research Hub",
        time: "2 hours ago",
      },
      {
        action: "Left review on PR #31",
        project: "Predictive Analytics Tool",
        time: "1 day ago",
      },
      {
        action: "Completed 'NLP Module'",
        project: "NLP Classifier",
        time: "3 days ago",
      },
    ],
    stats: [
      { label: "Avg XP / Task", value: "100" },
      { label: "Approval Rate", value: "98%" },
      { label: "Tasks on Time", value: "95%" },
    ],
  },
  "Priya Patel": {
    name: "Priya Patel",
    initials: "PP",
    title: "Backend Engineer",
    uni: "BITS Pilani",
    bio: "Backend specialist focused on scalable systems and cloud infrastructure. Love building robust APIs and mentoring juniors on distributed systems concepts.",
    joined: "Mar 2023",
    xp: 3850,
    rep: 93,
    projects: 7,
    tasks: 38,
    skills: [
      "Java",
      "Spring Boot",
      "Kubernetes",
      "AWS",
      "PostgreSQL",
      "Go",
      "Docker",
    ],
    hasMentorBadge: true,
    projectList: [
      {
        name: "Budget Buddy",
        role: "Collaborator",
        status: "Active",
        contribution: "Designed the financial API layer",
      },
      {
        name: "MicroService Hub",
        role: "Owner",
        status: "Completed",
        contribution: "Led full backend architecture",
      },
    ],
    activity: [
      {
        action: "Submitted 'API Rate Limiting Module'",
        project: "Budget Buddy",
        time: "5 hours ago",
      },
      {
        action: "Merged PR #22",
        project: "MicroService Hub",
        time: "2 days ago",
      },
      { action: "Earned 80 XP", project: "Budget Buddy", time: "4 days ago" },
    ],
    stats: [
      { label: "Avg XP / Task", value: "101" },
      { label: "Approval Rate", value: "97%" },
      { label: "Tasks on Time", value: "92%" },
    ],
  },
  "Rohan Mehta": {
    name: "Rohan Mehta",
    initials: "RM",
    title: "Frontend Developer",
    uni: "NIT Trichy",
    bio: "Frontend engineer who cares deeply about UI quality and performance. Experienced with React, TypeScript, and design systems. Open source contributor.",
    joined: "Feb 2023",
    xp: 3400,
    rep: 89,
    projects: 6,
    tasks: 35,
    skills: ["React", "TypeScript", "Tailwind CSS", "Next.js", "Figma", "Vite"],
    hasMentorBadge: false,
    projectList: [
      {
        name: "Campus Events App",
        role: "Collaborator",
        status: "Active",
        contribution: "Built event listing and RSVP UI",
      },
      {
        name: "Code Review Hub",
        role: "Owner",
        status: "Completed",
        contribution: "Designed entire review interface",
      },
    ],
    activity: [
      {
        action: "Started 'Event Map View'",
        project: "Campus Events App",
        time: "1 hour ago",
      },
      {
        action: "Task approved 'RSVP Button'",
        project: "Campus Events App",
        time: "1 day ago",
      },
      {
        action: "Earned 40 XP",
        project: "Code Review Hub",
        time: "3 days ago",
      },
    ],
    stats: [
      { label: "Avg XP / Task", value: "97" },
      { label: "Approval Rate", value: "91%" },
      { label: "Tasks on Time", value: "89%" },
    ],
  },
  "Sneha Iyer": {
    name: "Sneha Iyer",
    initials: "SI",
    title: "Full-stack Developer",
    uni: "VIT Vellore",
    bio: "Full-stack developer passionate about health tech. I love building apps that make a real difference in people's daily lives. Always learning.",
    joined: "Apr 2023",
    xp: 2100,
    rep: 82,
    projects: 4,
    tasks: 20,
    skills: ["React", "Node.js", "MongoDB", "Express", "GraphQL", "Figma"],
    hasMentorBadge: false,
    projectList: [
      {
        name: "Health & Wellness",
        role: "Owner",
        status: "Active",
        contribution: "Led product design and backend",
      },
      {
        name: "EcoTracker",
        role: "Collaborator",
        status: "Completed",
        contribution: "Built carbon API integration",
      },
    ],
    activity: [
      {
        action: "Submitted 'Daily Check-in Feature'",
        project: "Health & Wellness",
        time: "3 hours ago",
      },
      {
        action: "Joined project",
        project: "Health & Wellness",
        time: "1 week ago",
      },
      {
        action: "Task approved 'Carbon Dashboard'",
        project: "EcoTracker",
        time: "2 weeks ago",
      },
    ],
    stats: [
      { label: "Avg XP / Task", value: "105" },
      { label: "Approval Rate", value: "90%" },
      { label: "Tasks on Time", value: "85%" },
    ],
  },
};

const MENTORED_PROJECTS = [];

function getOwnProfile() {
  const fullName = String(STATE?.userProfile?.fullName || STATE?.currentUser?.name || "Arjun Sharma").trim() || "Arjun Sharma";
  const currentRecord =
    typeof getCurrentUserRecord === "function" ? getCurrentUserRecord() : null;
  const xpScore = Number(currentRecord?.profile?.xp ?? 0);
  const repScore = Number(currentRecord?.profile?.rep ?? 0);
  const bio = String(STATE?.userProfile?.bio || currentRecord?.profile?.bio || "").trim();

  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "AS";

  const projectList = PROJECTS.filter((project) => {
    const isOwner = project.owner === fullName;
    const isMember = Array.isArray(project.members)
      ? project.members.some((member) => member.name === fullName)
      : false;
    return isOwner || isMember;
  }).map((project) => ({
    name: project.name,
    role: project.owner === fullName ? "Owner" : "Collaborator",
    status: project.isCompleted ? "Completed" : "Active",
    contribution:
      project.owner === fullName
        ? "Leading project delivery"
        : "Contributing to the team",
  }));
  const assignedTasks = PROJECTS.reduce((count, project) => {
    const runtime =
      typeof getProjectRuntime === "function" ? getProjectRuntime(project) : project.runtime;
    const tasks = Array.isArray(runtime?.tasks) ? runtime.tasks : [];
    return (
      count +
      tasks.filter((task) => String(task.assignee || "").trim() === fullName).length
    );
  }, 0);
  const notifications = Array.isArray(currentRecord?.data?.notifications)
    ? currentRecord.data.notifications
    : [];
  const activity = notifications.slice(0, 4).map((notification) => ({
    action: notification.title || notification.type || "Update",
    project: notification.desc || notification.message || "",
    time: notification.time || notification.timestamp || "Just now",
  }));
  const approvedTasks = notifications.filter(
    (notification) => String(notification.status || "").trim().toLowerCase() === "approved",
  ).length;
  const avgXpPerTask =
    assignedTasks > 0 ? Math.round(xpScore / Math.max(assignedTasks, 1)) : 0;
  const joinedDate = String(currentRecord?.profile?.createdAt || "").trim() || "Just now";

  return {
    name: fullName,
    initials,
    title: String(currentRecord?.profile?.title || "").trim(),
    uni: String(currentRecord?.profile?.university || "").trim(),
    bio,
    joined: joinedDate,
    xp: xpScore,
    rep: repScore,
    projects: projectList.length,
    tasks: assignedTasks,
    skills: STATE.userSkills,
    hasMentorBadge: Boolean(currentRecord?.profile?.hasMentorBadge),
    projectList,
    activity,
    stats: [
      { label: "Avg XP / Task", value: String(avgXpPerTask) },
      {
        label: "Approval Rate",
        value: assignedTasks > 0 ? `${Math.round((approvedTasks / assignedTasks) * 100)}%` : "0%",
      },
      { label: "Tasks on Time", value: assignedTasks > 0 ? "0%" : "0%" },
    ],
  };
}

function badgeHTML(text, cls) {
  return `<span class="badge ${cls || "badge-secondary"}">${text}</span>`;
}

function skillsHTML(skills) {
  if (!skills || !skills.length)
    return '<p class="skills-empty">No skills added yet.</p>';
  return `<div style="display:flex;flex-wrap:wrap;gap:7px">${skills.map((s) => badgeHTML(s)).join("")}</div>`;
}

function profileIconSVG(name) {
  const icons = {
    xp: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M11.2 1.5 4.9 10h3.8L8.1 18.5l7-9h-4Z" fill="currentColor"/></svg>',
    reputation:
      '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m10 2.2 2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8L10 2.2Z" fill="currentColor"/></svg>',
    projects:
      '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M2.5 5.5a2 2 0 0 1 2-2h3.3l1.2 1.3H15.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-8.3Z" fill="currentColor"/></svg>',
    tasks:
      '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m7.9 13.8-3.2-3.1 1.4-1.4L8 11l5.8-5.8 1.4 1.4-7.2 7.2Z" fill="currentColor"/></svg>',
    mentor:
      '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m10 2.4 2 4 4.4.6-3.2 3.1.8 4.4-4-2.1-4 2.1.8-4.4L3.6 7l4.4-.6 2-4Z" fill="currentColor"/></svg>',
  };
  return icons[name] || "";
}

function statPillHTML(icon, label, value) {
  return `
    <div class="stat-pill">
      <span class="stat-pill-icon" aria-hidden="true">${icon}</span>
      <div>
        <div class="stat-pill-label">${label}</div>
        <div class="stat-pill-value">${value}</div>
      </div>
    </div>`;
}

let _archiveProjects = []; // store current completed projects for back-nav

function normalizeArchiveProjects(projects) {
  if (!Array.isArray(projects) || !projects.length) return [];
  return projects.map((proj) => ({
    name: proj.name || "Untitled Project",
    role: proj.role || "Collaborator",
    contribution: proj.contribution || "Contribution details unavailable",
  }));
}

function openArchiveModal(completedProjects = PROFILE_STATE.completedProjects) {
  const sourceProjects =
    Array.isArray(completedProjects) && completedProjects.length
      ? completedProjects
      : PROFILE_STATE.completedProjects;
  _archiveProjects = normalizeArchiveProjects(sourceProjects);

  const list = document.getElementById("archive-list");
  if (!list) return;

  if (!_archiveProjects.length) {
    list.innerHTML =
      '<div class="report-no-data"><span>📦</span><p>No archived projects found.</p></div>';
  } else {
    list.innerHTML = _archiveProjects
    .map(
      (proj, idx) => `
    <button class="archive-item" onclick="openReportModal(${idx})">
      <div class="archive-item-main">
        <div class="archive-item-name">${proj.name}</div>
        <div class="archive-item-meta">${proj.role} · ${proj.contribution}</div>
      </div>
      <div class="archive-item-right">
        <span class="badge-completed">Completed</span>
        <span class="archive-item-chevron">›</span>
      </div>
    </button>`,
    )
    .join("");
  }

  const modal = document.getElementById("modal-archive");
  if (!modal) return;
  modal.classList.add("open");
}

function closeArchiveModal(e) {
  const modal = document.getElementById("modal-archive");
  if (!modal) return;
  if (e && e.target !== modal) return;
  modal.classList.remove("open");
}

function openReportModal(projectRef, role, contribution) {
  const archiveModal = document.getElementById("modal-archive");
  const reportModal = document.getElementById("modal-report");
  if (!reportModal) return;

  const parsedIndex =
    Number.isInteger(projectRef) || /^[0-9]+$/.test(String(projectRef))
      ? Number(projectRef)
      : null;

  const project =
    parsedIndex !== null && _archiveProjects[parsedIndex]
      ? _archiveProjects[parsedIndex]
      : _archiveProjects.find((p) => p.name === projectRef) || {
          name: projectRef || "Project Report",
          role: role || "Collaborator",
          contribution: contribution || "Contribution details unavailable",
        };

  if (archiveModal) archiveModal.classList.remove("open");
  const title = document.getElementById("report-modal-title");
  if (title) title.textContent = project.name;

  const report = PROJECT_REPORTS[project.name];
  const content = document.getElementById("report-content");
  if (!content) return;

  if (!report) {
    content.innerHTML = `
      <div class="report-no-data">
        <span>📄</span>
        <p>Report not yet generated for this project.</p>
      </div>`;
  } else {
    const pct = Math.round((report.tasksCompleted / report.totalTasks) * 100);
    content.innerHTML = `
      <div class="report-stat-grid">
        ${[
          { icon: "👤", label: "Role", value: report.role },
          { icon: "📅", label: "Duration", value: report.duration },
          { icon: "⚡", label: "XP Earned", value: "+" + report.xpEarned },
          { icon: "⭐", label: "Rep Gained", value: "+" + report.repGained },
        ]
          .map(
            (s) => `
          <div class="report-stat-cell">
            <div class="report-stat-icon">${s.icon}</div>
            <div class="report-stat-label">${s.label}</div>
            <div class="report-stat-value">${s.value}</div>
          </div>`,
          )
          .join("")}
      </div>
      <div class="report-section">
        <div class="report-completion-row">
          <h4 style="margin:0">📊 Task Completion</h4>
          <span class="report-completion-val">${report.tasksCompleted}/${report.totalTasks} tasks</span>
        </div>
        <div class="report-progress-wrap">
          <div class="report-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="report-completion-pct">${pct}% completion rate</div>
      </div>
      <div class="report-section">
        <h4>Your Contribution</h4>
        <p>${project.contribution || report.contribution}</p>
      </div>
      <div class="report-section">
        <h4>✅ Key Highlights</h4>
        ${report.highlights
          .map(
            (h) => `
          <div class="report-highlight-item">
            <span class="report-highlight-check">✓</span>
            <span>${h}</span>
          </div>`,
          )
          .join("")}
      </div>
      <div class="report-section">
        <h4>Skills Applied</h4>
        <div style="display:flex;flex-wrap:wrap;gap:7px">
          ${report.skills.map((s) => badgeHTML(s)).join("")}
        </div>
      </div>
      <div class="report-section">
        <h4>Project Outcome</h4>
        <p>${report.outcome}</p>
      </div>`;
  }

  reportModal.classList.add("open");
}

function closeReportModal(e) {
  const modal = document.getElementById("modal-report");
  if (!modal) return;
  if (e && e.target !== modal) return;
  modal.classList.remove("open");
}

function backToArchive() {
  const reportModal = document.getElementById("modal-report");
  if (reportModal) reportModal.classList.remove("open");
  openArchiveModal(_archiveProjects);
}

function renderProfileHeader(p, isOther) {
  const avatarClass = p.hasMentorBadge
    ? "profile-avatar mentor-av"
    : "profile-avatar";
  const mentorBadge = p.hasMentorBadge
    ? `<span class="mentor-rec-badge">${profileIconSVG("mentor")}<span>Mentor Recommended</span></span>`
    : "";
  const editBtn = !isOther
    ? `<button class="btn btn-outline btn-sm" onclick="navigate('settings')">Edit Profile</button>`
    : "";
  const backBtn = isOther
    ? `<button class="btn btn-outline btn-sm" onclick="history.back()">← Back</button>`
    : "";

  return `
    <div class="flex items-center justify-between mb-4" style="flex-wrap:wrap;gap:10px">
      <h1>${isOther ? "User Profile" : "My Profile"}</h1>
      ${editBtn}${backBtn}
    </div>
    <div class="card">
      <div class="profile-header">
        <div class="${avatarClass}">${p.initials}</div>
        <div class="profile-info">
          <div class="profile-name">
            ${p.name} ${mentorBadge}
          </div>
          <div class="profile-title">${p.title} · ${p.uni}</div>
          <div class="profile-joined">Member since ${p.joined}</div>
          <div class="profile-bio">${p.bio}</div>
        </div>
      </div>
      <div class="profile-stats">
        ${statPillHTML(profileIconSVG("xp"), "XP Points", p.xp.toLocaleString())}
        ${statPillHTML(profileIconSVG("reputation"), "Reputation", p.rep)}
        ${statPillHTML(profileIconSVG("projects"), "Projects", p.projects)}
        ${statPillHTML(profileIconSVG("tasks"), "Tasks Done", p.tasks)}
      </div>
    </div>`;
}

function renderPerformanceAndSkills(p, skills) {
  const perfRows = [
    ...p.stats.map(
      (s) => `
      <div class="perf-row">
        <span class="perf-label">${s.label}</span>
        <span class="perf-value">${s.value}</span>
      </div>`,
    ),
    `<div class="perf-row">
       <span class="perf-label">Total Projects</span>
       <span class="perf-value">${p.projects}</span>
     </div>`,
    `<div class="perf-row">
       <span class="perf-label">Total Tasks Completed</span>
       <span class="perf-value">${p.tasks}</span>
     </div>`,
  ].join("");

  return `
    <div class="profile-grid-2 mt-3">
      <div class="card">
        <div class="card-title">� Performance</div>
        ${perfRows}
      </div>
      <div class="card">
        <div class="card-title">Skills</div>
        ${skillsHTML(skills)}
      </div>
    </div>`;
}

function renderActiveProjectsAndActivity(p) {
  const active = p.projectList.filter((proj) => proj.status === "Active");
  const activeProjHTML =
    active.length === 0
      ? '<p class="skills-empty">No active projects.</p>'
      : active
          .map(
            (proj) => `
        <div class="proj-row">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
            <span class="proj-name">${proj.name}</span>
            <span class="badge-active">Active</span>
          </div>
          <div class="proj-meta">${proj.role} · ${proj.contribution}</div>
        </div>`,
          )
          .join("");

  const activityHTML = p.activity
    .map(
      (a) => `
    <div class="activity-row">
      <div class="activity-icon-wrap">�</div>
      <div class="flex-1">
        <div class="activity-action">${a.action}</div>
        <div class="activity-meta">${a.project} · ${a.time}</div>
      </div>
    </div>`,
    )
    .join("");

  return `
    <div class="profile-grid-2 mt-3">
      <div class="card">
        <div class="card-title">🔀 Active Projects</div>
        ${activeProjHTML}
      </div>
      <div class="card">
        <div class="card-title">� Recent Activity</div>
        ${activityHTML}
      </div>
    </div>`;
}

function renderMentorBadgeEarned() {
  return `
    <div class="card mt-3 mentor-rec-card">
      <div class="card-title">Mentor Recommendation</div>
      <p>Awarded by a platform mentor who directly worked with this user.</p>
      <span class="mentor-rec-badge">${profileIconSVG("mentor")}<span>Mentor Recommended</span></span>
    </div>`;
}

function renderArchivedProjectsCard(completedProjects) {
  if (!completedProjects.length) return "";
  const pills = completedProjects
    .map(
      (proj) => `
      <span class="badge-completed">
        <span class="pill-check">◌</span>
        ${proj.name}
      </span>
    `,
    )
    .join("");
  return `
    <div class="card mt-3 archive-card" onclick="openArchiveModal()">
      <div class="archive-card-left">
        <div class="archive-icon-wrap">▣</div>
        <div>
          <div class="archive-title">Archived Projects</div>
          <div class="archive-sub">${completedProjects.length} completed project${completedProjects.length !== 1 ? "s" : ""}</div>
        </div>
      </div>
      <span class="archive-chevron">›</span>
      <div class="archive-pills w-full" style="margin-top:12px">${pills}</div>
    </div>`;
}

function renderMentorRecommendationPlaceholder() {
  return `
    <div class="card mt-3">
      <div class="card-title">⭐ Mentor Recommendation</div>
      <p class="mentor-placeholder">You haven't received a mentor recommendation yet. Work with a mentor on a project to earn this badge.</p>
    </div>`;
}

function renderMentoredProjects() {
  const currentMentorName = String(
    STATE?.userProfile?.fullName || STATE?.currentUser?.name || "",
  ).trim();
  const currentMentorEmail =
    typeof getCurrentUserSessionEmail === "function"
      ? getCurrentUserSessionEmail()
      : "";
  const mentoredProjects = PROJECTS.filter((project) => {
    const runtime =
      typeof getProjectRuntime === "function" ? getProjectRuntime(project) : project.runtime;
    const mentorRequest = runtime?.mentorRequest;
    if (!mentorRequest || String(mentorRequest.status || "").toLowerCase() !== "approved") {
      return false;
    }
    return (
      String(mentorRequest.requestedName || "").trim() === currentMentorName ||
      String(mentorRequest.mentorEmail || "").trim().toLowerCase() ===
        String(currentMentorEmail || "").trim().toLowerCase()
    );
  });

  const cards = mentoredProjects
    .map((proj) => {
      const members = Array.isArray(proj.members) ? proj.members : [];
      const avatarStack = members
        .map((m) => `<div class="av" title="${m.name}">${m.initials}</div>`)
        .join("");
      const skills = (Array.isArray(proj.skills) ? proj.skills : [])
        .map((s) => badgeHTML(s, "badge-secondary"))
        .join("");
      const runtime =
        typeof getProjectRuntime === "function" ? getProjectRuntime(proj) : proj.runtime;
      const approvedOn = String(runtime?.mentorRequest?.approvedOn || "").trim();
      const projectStatus = proj.isCompleted ? "Completed" : "Active";
      return `
      <div class="card mentored-card">
        <div class="mentored-header">
          <div class="flex-1">
            <div class="mentored-name-row">
              <span class="mentored-name">${proj.name}</span>
              <span class="badge-completed">${projectStatus}</span>
            </div>
            <div class="mentored-owner">Owner: ${proj.owner}${approvedOn ? ` | Accepted ${approvedOn}` : ""}</div>
            <div class="mentored-desc">${proj.desc || ""}</div>
          </div>
          <span class="mentored-pct">${proj.progress || 0}%</span>
        </div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${proj.progress || 0}%"></div></div>
        <div class="mentored-skills">${skills}</div>
        <div class="mentored-team">
          <span class="mentored-team-label">Team:</span>
          <div class="avatar-stack">${avatarStack}</div>
          <span class="mentored-team-count">${members.length} members</span>
        </div>
      </div>`;
    })
    .join("");

  return `
    <div class="mt-3">
      <div class="mentored-section-title">Projects Mentored</div>
      ${
        cards ||
        '<div class="card"><p class="mentor-placeholder">No mentored projects yet.</p></div>'
      }
    </div>`;
}


const PROFILE_STATE = { completedProjects: [] };

function renderProfile(user) {
  const ownProfileName = getOwnProfile().name;
  const isOther = user && user.name !== ownProfileName;
  const isMentor = STATE.role === "mentor" && !isOther;

  let p;
  if (isOther && OTHER_PROFILES[user.name]) {
    p = { ...OTHER_PROFILES[user.name] };
  } else {
    p = getOwnProfile();
    p.skills = STATE.userSkills;
  }

  const completedProjects = p.projectList.filter(
    (proj) => proj.status === "Completed",
  );
  PROFILE_STATE.completedProjects = completedProjects;
  _archiveProjects = normalizeArchiveProjects(completedProjects);

  let html = "";
  html += renderProfileHeader(p, isOther);
  html += renderPerformanceAndSkills(p, p.skills);

  if (isMentor) {
    html += renderMentoredProjects();
  } else {
    html += renderActiveProjectsAndActivity(p);
    if (p.hasMentorBadge) html += renderMentorBadgeEarned();
    if (completedProjects.length)
      html += renderArchivedProjectsCard(completedProjects);
    if (!isOther && !p.hasMentorBadge)
      html += renderMentorRecommendationPlaceholder();
  }

  document.getElementById("profile-content").innerHTML = html;
}



