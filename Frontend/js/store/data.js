function getInitialsFromName(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function normalizeProject(project) {
  const owner = String(project.owner || "Project Owner").trim();
  const skills = Array.isArray(project.skills)
    ? project.skills.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const normalizedMembers = Array.isArray(project.members)
    ? project.members
        .map((m) => ({
          name: String(m.name || "").trim() || owner,
          initials:
            String(m.initials || "").trim() ||
            getInitialsFromName(String(m.name || owner)),
          role: String(m.role || "Contributor").trim(),
        }))
        .filter((m) => m.name)
    : [];

  const members = normalizedMembers.length
    ? normalizedMembers
    : [{ name: owner, initials: getInitialsFromName(owner), role: "Owner" }];

  const collaboratorCount = Number.parseInt(project.collaborators, 10);

  return {
    ...project,
    owner,
    skills,
    members,
    collaborators:
      Number.isFinite(collaboratorCount) && collaboratorCount > 0
        ? collaboratorCount
        : members.length,
  };
}

const CREATED_PROJECTS_KEY = "teamforge.createdProjects";

function loadCreatedProjects() {
  try {
    const raw = localStorage.getItem(CREATED_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeProject) : [];
  } catch {
    return [];
  }
}

function saveCreatedProjects() {
  try {
    const createdProjects = PROJECTS.filter((p) => p.isUserCreated === true);
    localStorage.setItem(CREATED_PROJECTS_KEY, JSON.stringify(createdProjects));
  } catch {
    // Ignore storage failures and keep app usable in memory.
  }
}

function resetCreatedProjects() {
  try {
    localStorage.removeItem(CREATED_PROJECTS_KEY);
  } catch {
    // Ignore removal failures.
  }
  const filtered = PROJECTS.filter((p) => p.isUserCreated !== true);
  PROJECTS.length = 0;
  PROJECTS.push(...filtered);
  console.log("Created projects reset. Current PROJECTS count:", PROJECTS.length);
}

let PROJECTS = [
  {
    id: "1",
    name: "AI Study Planner",
    desc: "An intelligent study scheduling app that adapts to student learning patterns.",
    skills: ["React", "Python", "ML"],
    progress: 35,
    collaborators: 4,
    owner: "Arjun Sharma",
    members: [
      { name: "Arjun Sharma", initials: "AS", role: "Owner" },
      { name: "Priya Patel", initials: "PP", role: "Developer" },
      { name: "Rohan Mehta", initials: "RM", role: "Designer" },
      { name: "Sneha Iyer", initials: "SI", role: "QA" },
    ],
  },
  {
    id: "2",
    name: "Campus Events App",
    desc: "Discover and organize campus events with real-time updates and RSVP management.",
    skills: ["React", "Node.js", "Firebase"],
    progress: 60,
    collaborators: 6,
    owner: "Vikram Nair",
    members: [
      { name: "Vikram Nair", initials: "VN", role: "Owner" },
      { name: "Ananya Reddy", initials: "AR", role: "Backend Dev" },
      { name: "Kiran Bose", initials: "KB", role: "Frontend Dev" },
      { name: "Meera Pillai", initials: "MP", role: "DevOps" },
    ],
  },
  {
    id: "3",
    name: "EcoTracker",
    desc: "Track and reduce your carbon footprint with gamified challenges.",
    skills: ["React", "API", "Charts"],
    progress: 80,
    collaborators: 5,
    owner: "Ananya Reddy",
    members: [
      { name: "Ananya Reddy", initials: "AR", role: "Owner" },
      { name: "Kiran Bose", initials: "KB", role: "Developer" },
      { name: "Meera Pillai", initials: "MP", role: "Data Analyst" },
      { name: "Rohan Mehta", initials: "RM", role: "UI/UX" },
    ],
  },
  {
    id: "4",
    name: "Budget Buddy",
    desc: "Smart personal finance tracker for students with expense categorization.",
    skills: ["TypeScript", "Supabase"],
    progress: 45,
    collaborators: 3,
    owner: "Kiran Bose",
    members: [
      { name: "Kiran Bose", initials: "KB", role: "Owner" },
      { name: "Vikram Nair", initials: "VN", role: "Developer" },
      { name: "Sneha Iyer", initials: "SI", role: "Tester" },
    ],
  },
  {
    id: "5",
    name: "Study Group Finder",
    desc: "Match with study partners based on courses, schedule, and learning style.",
    skills: ["React", "Node.js"],
    progress: 20,
    collaborators: 2,
    owner: "Priya Patel",
    members: [
      { name: "Priya Patel", initials: "PP", role: "Owner" },
      { name: "Arjun Sharma", initials: "AS", role: "Developer" },
    ],
  },
  {
    id: "6",
    name: "Code Review Hub",
    desc: "Peer code review platform for student developers with feedback scoring.",
    skills: ["React", "Git API", "Python"],
    progress: 10,
    collaborators: 1,
    owner: "Rohan Mehta",
    members: [{ name: "Rohan Mehta", initials: "RM", role: "Owner" }],
  },
  {
    id: "7",
    name: "Health & Wellness",
    desc: "Student wellness tracker with mental health resources and daily check-ins.",
    skills: ["React Native", "Firebase"],
    progress: 55,
    collaborators: 4,
    owner: "Sneha Iyer",
    members: [
      { name: "Sneha Iyer", initials: "SI", role: "Owner" },
      { name: "Ananya Reddy", initials: "AR", role: "Developer" },
      { name: "Vikram Nair", initials: "VN", role: "Designer" },
      { name: "Priya Patel", initials: "PP", role: "Advisor" },
    ],
  },
  {
    id: "8",
    name: "Research Collab",
    desc: "Collaborative research paper writing with version control and citations.",
    skills: ["React", "LaTeX", "Node.js"],
    progress: 30,
    collaborators: 3,
    owner: "Meera Pillai",
    members: [
      { name: "Meera Pillai", initials: "MP", role: "Owner" },
      { name: "Rohan Mehta", initials: "RM", role: "Researcher" },
      { name: "Kiran Bose", initials: "KB", role: "Developer" },
    ],
  },
  {
    id: "9",
    name: "Smart Attendance Tracker",
    desc: "Automated attendance capture and reporting dashboard for classes.",
    skills: ["React", "Node.js", "MongoDB"],
    progress: 100,
    collaborators: 4,
    owner: "Priya Patel",
    isCompleted: true,
    totalTasks: 6,
    completedTasks: 6,
    members: [
      { name: "Priya Patel", initials: "PP", role: "Owner" },
      { name: "Arjun Sharma", initials: "AS", role: "Frontend Dev" },
      { name: "Ananya Reddy", initials: "AR", role: "Backend Dev" },
      { name: "Vikram Nair", initials: "VN", role: "QA" },
    ],
  },
].map(normalizeProject);

const persistedProjects = loadCreatedProjects();
persistedProjects.forEach((project) => {
  const duplicate = PROJECTS.some((p) => p.id === project.id);
  if (!duplicate) PROJECTS.unshift(project);
});

function addProjectToData(projectInput) {
  const nextId = String(
    PROJECTS.reduce((max, p) => {
      const n = Number.parseInt(p.id, 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0) + 1,
  );

  const owner = String(projectInput.owner || "Project Owner").trim();
  const skills = Array.isArray(projectInput.skills)
    ? projectInput.skills.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const collaborators = Number.parseInt(projectInput.collaborators, 10);
  const members =
    Array.isArray(projectInput.members) && projectInput.members.length > 0
      ? projectInput.members.map((member) => ({
          name: String(member.name || "").trim() || owner,
          initials:
            String(member.initials || "").trim() ||
            getInitialsFromName(String(member.name || owner)),
          role: String(member.role || "Contributor").trim(),
        }))
      : [{ name: owner, initials: getInitialsFromName(owner), role: "Owner" }];

  const newProject = {
    id: nextId,
    name: String(projectInput.name || "").trim(),
    desc: String(projectInput.desc || "").trim(),
    objectives: String(projectInput.objectives || "").trim(),
    skills,
    duration: String(projectInput.duration || "").trim(),
    difficulty: String(projectInput.difficulty || "").trim(),
    progress: 0,
    collaborators:
      Number.isFinite(collaborators) && collaborators > 0
        ? collaborators
        : members.length,
    owner,
    members,
    isUserCreated: true,
  };

  PROJECTS.unshift(newProject);
  const email = localStorage.getItem("currentUser") || sessionStorage.getItem("teamforge.email");
  if (email) {
    const users = JSON.parse(localStorage.getItem("users") || "{}");
    if (users[email]) {
      if (!users[email].data) users[email].data = { projects: [], notifications: [] };
      if (!users[email].data.projects) users[email].data.projects = [];
      newProject.mentors = [];
      newProject.tasks = [];
      newProject.requests = [];
      newProject.invites = [];
      users[email].data.projects.unshift(newProject);
      localStorage.setItem("users", JSON.stringify(users));
    }
  }
  saveCreatedProjects();
  if (typeof window.persistReview2Runtime === "function") {
    window.persistReview2Runtime();
  }
  return newProject;
}
const LEADERBOARD = {
  weekly: [
    {
      rank: 1,
      user: "Rohan Mehta",
      initials: "RM",
      xp: 420,
      rep: 89,
      tasks: 7,
      projects: 2,
    },
    {
      rank: 2,
      user: "Sneha Iyer",
      initials: "SI",
      xp: 380,
      rep: 82,
      tasks: 6,
      projects: 1,
    },
    {
      rank: 3,
      user: "Priya Patel",
      initials: "PP",
      xp: 320,
      rep: 93,
      tasks: 5,
      projects: 2,
    },
    {
      rank: 4,
      user: "Arjun Sharma",
      initials: "AS",
      xp: 280,
      rep: 87,
      tasks: 4,
      projects: 1,
    },
    {
      rank: 5,
      user: "Vikram Nair",
      initials: "VN",
      xp: 220,
      rep: 78,
      tasks: 4,
      projects: 1,
    },
    {
      rank: 6,
      user: "Ananya Reddy",
      initials: "AR",
      xp: 180,
      rep: 75,
      tasks: 3,
      projects: 1,
    },
    {
      rank: 7,
      user: "Kiran Bose",
      initials: "KB",
      xp: 160,
      rep: 71,
      tasks: 2,
      projects: 1,
    },
    {
      rank: 8,
      user: "Meera Pillai",
      initials: "MP",
      xp: 120,
      rep: 68,
      tasks: 2,
      projects: 1,
    },
  ],
  monthly: [
    {
      rank: 1,
      user: "Priya Patel",
      initials: "PP",
      xp: 1540,
      rep: 93,
      tasks: 18,
      projects: 4,
    },
    {
      rank: 2,
      user: "Dr. Divya Krishnan",
      initials: "DK",
      xp: 1380,
      rep: 96,
      tasks: 16,
      projects: 5,
    },
    {
      rank: 3,
      user: "Arjun Sharma",
      initials: "AS",
      xp: 1200,
      rep: 87,
      tasks: 14,
      projects: 3,
    },
    {
      rank: 4,
      user: "Rohan Mehta",
      initials: "RM",
      xp: 1050,
      rep: 89,
      tasks: 12,
      projects: 3,
    },
    {
      rank: 5,
      user: "Sneha Iyer",
      initials: "SI",
      xp: 890,
      rep: 82,
      tasks: 10,
      projects: 2,
    },
    {
      rank: 6,
      user: "Vikram Nair",
      initials: "VN",
      xp: 760,
      rep: 78,
      tasks: 8,
      projects: 2,
    },
    {
      rank: 7,
      user: "Ananya Reddy",
      initials: "AR",
      xp: 640,
      rep: 75,
      tasks: 7,
      projects: 2,
    },
    {
      rank: 8,
      user: "Kiran Bose",
      initials: "KB",
      xp: 520,
      rep: 71,
      tasks: 5,
      projects: 1,
    },
  ],
  alltime: [
    {
      rank: 1,
      user: "Dr. Divya Krishnan",
      initials: "DK",
      xp: 4200,
      rep: 96,
      tasks: 42,
      projects: 8,
    },
    {
      rank: 2,
      user: "Priya Patel",
      initials: "PP",
      xp: 3850,
      rep: 93,
      tasks: 38,
      projects: 7,
    },
    {
      rank: 3,
      user: "Rohan Mehta",
      initials: "RM",
      xp: 3400,
      rep: 89,
      tasks: 35,
      projects: 6,
    },
    {
      rank: 4,
      user: "Arjun Sharma",
      initials: "AS",
      xp: 2450,
      rep: 87,
      tasks: 24,
      projects: 5,
    },
    {
      rank: 5,
      user: "Sneha Iyer",
      initials: "SI",
      xp: 2100,
      rep: 82,
      tasks: 20,
      projects: 4,
    },
    {
      rank: 6,
      user: "Vikram Nair",
      initials: "VN",
      xp: 1900,
      rep: 78,
      tasks: 18,
      projects: 4,
    },
    {
      rank: 7,
      user: "Ananya Reddy",
      initials: "AR",
      xp: 1750,
      rep: 75,
      tasks: 16,
      projects: 3,
    },
    {
      rank: 8,
      user: "Kiran Bose",
      initials: "KB",
      xp: 1500,
      rep: 71,
      tasks: 14,
      projects: 3,
    },
  ],
};

const ADMIN_USERS = [
  {
    name: "Arjun Sharma",
    initials: "AS",
    university: "IIT Delhi",
    role: "Owner / Collaborator",
    xp: 2450,
    rep: 87,
    projects: 5,
    status: "active",
    flagged: false,
  },
  {
    name: "Rohan Mehta",
    initials: "RM",
    university: "NIT Trichy",
    role: "Collaborator",
    xp: 3400,
    rep: 89,
    projects: 6,
    status: "active",
    flagged: false,
  },
  {
    name: "Sneha Iyer",
    initials: "SI",
    university: "VIT Vellore",
    role: "Owner / Collaborator",
    xp: 2100,
    rep: 82,
    projects: 4,
    status: "active",
    flagged: false,
  },
  {
    name: "Priya Patel",
    initials: "PP",
    university: "BITS Pilani",
    role: "Mentor / Collaborator",
    xp: 3850,
    rep: 93,
    projects: 7,
    status: "active",
    flagged: false,
  },
  {
    name: "Vikram Nair",
    initials: "VN",
    university: "IIT Madras",
    role: "Project Owner",
    xp: 1800,
    rep: 71,
    projects: 3,
    status: "warned",
    flagged: true,
  },
  {
    name: "Ananya Reddy",
    initials: "AR",
    university: "Manipal Institute of Technology",
    role: "Owner / Collaborator",
    xp: 2900,
    rep: 85,
    projects: 5,
    status: "active",
    flagged: false,
  },
  {
    name: "Kiran Bose",
    initials: "KB",
    university: "IIIT Hyderabad",
    role: "Collaborator",
    xp: 950,
    rep: 60,
    projects: 2,
    status: "suspended",
    flagged: true,
  },
  {
    name: "Meera Pillai",
    initials: "MP",
    university: "NIT Calicut",
    role: "Collaborator",
    xp: 1200,
    rep: 68,
    projects: 3,
    status: "active",
    flagged: false,
  },
];

function syncAdminSeedMetadataToUsers() {
  if (typeof getStoredUsers !== "function" || typeof saveStoredUsers !== "function") {
    return;
  }
  const users = getStoredUsers();
  let changed = false;
  ADMIN_USERS.forEach((seedUser) => {
    const matchingEntry = Object.entries(users).find(([, user]) => {
      return (
        String(user?.name || "").trim().toLowerCase() ===
        String(seedUser?.name || "").trim().toLowerCase()
      );
    });
    if (!matchingEntry) return;
    const [email, userRecord] = matchingEntry;
    const hasStoredStatus =
      userRecord.status !== undefined && String(userRecord.status).trim() !== "";
    const hasStoredFlag =
      userRecord.flagged !== undefined;
    const nextStatus = hasStoredStatus
      ? String(userRecord.status).toLowerCase()
      : String(seedUser.status || "active").toLowerCase();
    const nextFlagged = hasStoredFlag
      ? Boolean(userRecord.flagged)
      : Boolean(seedUser.flagged);
    if (userRecord.status !== nextStatus || userRecord.flagged !== nextFlagged) {
      users[email] = {
        ...userRecord,
        status: nextStatus,
        flagged: nextFlagged,
      };
      changed = true;
    }
    const nextProfile = {
      ...(userRecord.profile || {}),
      university: userRecord.profile?.university || seedUser.university || "",
      xp:
        userRecord.profile?.xp !== undefined
          ? userRecord.profile.xp
          : Number(seedUser.xp || 0),
      rep:
        userRecord.profile?.rep !== undefined
          ? userRecord.profile.rep
          : Number(seedUser.rep || 0),
    };
    if (JSON.stringify(nextProfile) !== JSON.stringify(userRecord.profile || {})) {
      users[email].profile = nextProfile;
      changed = true;
    }
  });
  if (changed) {
    saveStoredUsers(users);
  }
}

const SEED_USERS = [
  {
    name: "Arjun Sharma",
    email: "arjun.sharma@teamforge.io",
    password: "Arjun@123",
    phone: "9876543210",
    profile: { username: "arjunsharma", university: "IIT Delhi" },
  },
  {
    name: "Rohan Mehta",
    email: "rohan.mehta@teamforge.io",
    password: "Rohan@123",
    phone: "9876543211",
    profile: { username: "rohanmehta", university: "NIT Trichy" },
  },
  {
    name: "Sneha Iyer",
    email: "sneha.iyer@teamforge.io",
    password: "Sneha@123",
    phone: "9876543212",
    profile: { username: "snehaiyer", university: "VIT Vellore" },
  },
  {
    name: "Priya Patel",
    email: "priya.patel@teamforge.io",
    password: "Priya@123",
    phone: "9876543213",
    profile: { username: "priyapatel", university: "BITS Pilani" },
  },
  {
    name: "Vikram Nair",
    email: "vikram.nair@teamforge.io",
    password: "Vikram@123",
    phone: "9876543214",
    profile: { username: "vikramnair", university: "IIT Madras" },
  },
  {
    name: "Ananya Reddy",
    email: "ananya.reddy@teamforge.io",
    password: "Ananya@123",
    phone: "9876543215",
    profile: {
      username: "ananyareddy",
      university: "Manipal Institute of Technology",
    },
  },
  {
    name: "Kiran Bose",
    email: "kiran.bose@teamforge.io",
    password: "Kiran@123",
    phone: "9876543216",
    profile: { username: "kiranbose", university: "IIIT Hyderabad" },
  },
  {
    name: "Meera Pillai",
    email: "meera.pillai@teamforge.io",
    password: "Meera@123",
    phone: "9876543217",
    profile: { username: "meerapillai", university: "NIT Calicut" },
  },
];

const ADMIN_MENTOR_APPLICATIONS = [
  {
    id: "mentor-app-1",
    name: "Arjun Sharma",
    initials: "AS",
    university: "IIT Delhi",
    submittedAt: "Mar 6, 2026",
    expertise: "Full-stack Development, React, Node.js",
    specialization: "Full-stack Development",
    linkedin: "https://linkedin.com/in/arjunsharma",
    years: 5,
    motivation:
      "I want to help students navigate the challenges I faced early in my career, especially around building real production systems from scratch.",
    status: "pending",
  },
  {
    id: "mentor-app-2",
    name: "Kavya Menon",
    initials: "KM",
    university: "NIT Surathkal",
    submittedAt: "Mar 5, 2026",
    expertise: "Data Science, Python, MLOps",
    specialization: "Data Science",
    linkedin: "https://linkedin.com/in/kavyamenon",
    years: 6,
    motivation:
      "I enjoy mentoring junior developers and helping them build confidence with practical projects, especially in data-driven products.",
    status: "approved",
  },
  {
    id: "mentor-app-3",
    name: "Harsh Verma",
    initials: "HV",
    university: "IIIT Hyderabad",
    submittedAt: "Mar 4, 2026",
    expertise: "DevOps, Cloud Architecture, Kubernetes",
    specialization: "DevOps & Cloud",
    linkedin: "https://linkedin.com/in/harshverma",
    years: 3,
    motivation:
      "I want to guide teams on deployment and CI/CD. I can support projects with infrastructure and platform reliability best practices.",
    status: "rejected",
  },
  {
    id: "mentor-app-4",
    name: "Meera Pillai",
    initials: "MP",
    university: "NIT Calicut",
    submittedAt: "Mar 8, 2026",
    expertise: "Backend Engineering, PostgreSQL, System Design",
    specialization: "Backend Engineering",
    linkedin: "https://linkedin.com/in/meerapillai",
    years: 7,
    motivation:
      "I want to mentor students on building reliable backend systems and help them learn how to ship production-ready APIs and services.",
    status: "pending",
  },
  {
    id: "mentor-app-5",
    name: "Ritwik Saha",
    initials: "RS",
    university: "IIT Kharagpur",
    submittedAt: "Mar 7, 2026",
    expertise: "Frontend Architecture, React, Accessibility",
    specialization: "Frontend Engineering",
    linkedin: "https://linkedin.com/in/ritwiksaha",
    years: 4,
    motivation:
      "I enjoy helping teams improve UI architecture, accessibility, and code quality. I want to mentor contributors through real project reviews.",
    status: "approved",
  },
  {
    id: "mentor-app-6",
    name: "Nisha Rao",
    initials: "NR",
    university: "VIT Vellore",
    submittedAt: "Mar 9, 2026",
    expertise: "Data Engineering, Spark, ETL Pipelines",
    specialization: "Data Engineering",
    linkedin: "https://linkedin.com/in/nisharao",
    years: 5,
    motivation:
      "I want to support student teams working with analytics and data platforms, and help them build scalable and maintainable data workflows.",
    status: "pending",
  },
  {
    id: "mentor-app-7",
    name: "Siddharth Jain",
    initials: "SJ",
    university: "IIIT Delhi",
    submittedAt: "Mar 2, 2026",
    expertise: "Cloud Security, IAM, DevSecOps",
    specialization: "Cloud Security",
    linkedin: "https://linkedin.com/in/siddharthjain",
    years: 2,
    motivation:
      "I want to mentor on secure development practices and cloud hardening. I am eager to guide teams through practical security checklists.",
    status: "rejected",
  },
  {
    id: "mentor-app-8",
    name: "Aditi Kulkarni",
    initials: "AK",
    university: "BITS Goa",
    submittedAt: "Mar 10, 2026",
    expertise: "Product Strategy, UX Research, Agile Delivery",
    specialization: "Product & UX",
    linkedin: "https://linkedin.com/in/aditikulkarni",
    years: 6,
    motivation:
      "I want to mentor student founders on discovery, user research, and planning roadmaps so teams can build solutions that users actually need.",
    status: "approved",
  },
];

const ADMIN_AUDIT_LOG = [
  {
    id: "audit-1",
    type: "task",
    event: "Task Approved",
    actor: "Arjun Sharma",
    target: "Set up project structure",
    details: "+50 XP awarded to Arjun Sharma",
    timestamp: "Mar 8, 2026 · 10:42 AM",
  },
  {
    id: "audit-2",
    type: "mentor",
    event: "Mentor App Submitted",
    actor: "Arjun Sharma",
    target: "Mentor Application #app-1",
    details: "Awaiting admin review",
    timestamp: "Mar 8, 2026 · 09:15 AM",
  },
  {
    id: "audit-3",
    type: "warning",
    event: "Warning Issued",
    actor: "Admin",
    target: "Vikram Nair",
    details: "Suspicious task submission flagged -15 rep",
    timestamp: "Mar 7, 2026 · 04:30 PM",
  },
  {
    id: "audit-4",
    type: "xp",
    event: "XP Awarded",
    actor: "System",
    target: "Rohan Mehta",
    details: "+80 XP for task 'Event Map View'",
    timestamp: "Mar 7, 2026 · 02:11 PM",
  },
  {
    id: "audit-5",
    type: "mentor",
    event: "Mentor App Approved",
    actor: "Admin",
    target: "Priya Patel",
    details: "Mentor privileges granted",
    timestamp: "Mar 7, 2026 · 11:05 AM",
  },
  {
    id: "audit-6",
    type: "suspension",
    event: "Account Suspended",
    actor: "Admin",
    target: "Kiran Bose",
    details: "Repeated policy violations",
    timestamp: "Mar 6, 2026 · 05:48 PM",
  },
  {
    id: "audit-7",
    type: "reputation",
    event: "Reputation Updated",
    actor: "System",
    target: "Sneha Iyer",
    details: "Reputation +5 - approved task streak",
    timestamp: "Mar 6, 2026 · 03:22 PM",
  },
  {
    id: "audit-8",
    type: "mentor",
    event: "Mentor App Rejected",
    actor: "Admin",
    target: "Harsh Verma",
    details: "Insufficient experience (2 yrs, min 4 required)",
    timestamp: "Mar 6, 2026 · 09:00 AM",
  },
  {
    id: "audit-9",
    type: "task",
    event: "Task Approved",
    actor: "Ananya Reddy",
    target: "Carbon footprint tracker",
    details: "+100 XP awarded to Kiran Bose",
    timestamp: "Mar 5, 2026 · 02:14 PM",
  },
  {
    id: "audit-10",
    type: "system",
    event: "System Health Check",
    actor: "System",
    target: "Platform",
    details: "All services operational",
    timestamp: "Mar 5, 2026 · 10:30 AM",
  },
];

let NOTIFICATIONS = [
  {
    icon: "📁",
    title: "Project Invitation",
    desc: "You've been invited to join 'Campus Events App'",
    time: "10 min ago",
    unread: true,
  },
  {
    icon: "✅",
    title: "Application Approved",
    desc: "Your application to 'AI Study Planner' was approved!",
    time: "1 hour ago",
    unread: true,
  },
  {
    icon: "⭐",
    title: "Task Approved",
    desc: "Your task 'Build Auth Module' was approved by the project owner.",
    time: "3 hours ago",
    unread: false,
  },
  {
    icon: "👥",
    title: "Mentor Request",
    desc: "A project owner requested your mentorship for 'EcoTracker'.",
    time: "1 day ago",
    unread: false,
  },
  {
    icon: "💬",
    title: "New Message",
    desc: "Dr. Divya Krishnan sent a message in 'AI Study Planner' chat.",
    time: "1 day ago",
    unread: false,
  },
  {
    icon: "🔔",
    title: "Project Update",
    desc: "'Campus Events App' reached 75% completion.",
    time: "2 days ago",
    unread: false,
  },
];

const APPLIED = [
  {
    project: "AI Study Planner",
    owner: "Arjun Sharma",
    applied: "Mar 10, 2026",
    status: "Approved",
  },
  {
    project: "Campus Events App",
    owner: "Vikram Nair",
    applied: "Mar 5, 2026",
    status: "Pending",
  },
  {
    project: "EcoTracker",
    owner: "Ananya Reddy",
    applied: "Feb 28, 2026",
    status: "Approved",
  },
  {
    project: "Budget Buddy",
    owner: "Kiran Bose",
    applied: "Feb 20, 2026",
    status: "Rejected",
  },
];

const FAQS = [
  {
    category: "Getting Started",
    icon: "📖",
    items: [
      {
        q: "How do I create a project?",
        a: "Switch your role to 'Project Owner' from the role switcher in the header. Then navigate to 'Create Project' in the sidebar, fill in your project details including title, description, objectives, skills required, and estimated duration, and submit.",
      },
      {
        q: "How do I apply to join a project?",
        a: "Browse available projects from the 'Projects' section. Click on any project to view details, then click 'Apply to Join Project'. The project owner will review your application and notify you of the decision.",
      },
      {
        q: "Can I be both an owner and a collaborator?",
        a: "Yes! You can own some projects and collaborate in others simultaneously. Additionally, within your own project you can enable the 'Also work as collaborator' toggle to take on and complete tasks yourself.",
      },
    ],
  },
  {
    category: "XP & Reputation",
    icon: "⚡",
    items: [
      {
        q: "How do I earn XP?",
        a: "XP is earned when your submitted tasks are approved by the project owner. Easy tasks give 10 XP, Medium tasks 20 XP, and Hard tasks 40 XP. You also earn a +5 XP early completion bonus if you submit before the deadline.",
      },
      {
        q: "What is the Reputation Score?",
        a: "Reputation measures your reliability and trustworthiness on the platform. It increases (+8) when tasks are approved, and decreases when tasks need revision (-3), deadlines are missed (-5), or you leave a project midway (-20).",
      },
      {
        q: "Can my XP decrease?",
        a: "No — XP only ever increases once earned. However, your Reputation Score can go up or down based on your behavior and contributions.",
      },
    ],
  },
  {
    category: "Mentors",
    icon: "🛡️",
    items: [
      {
        q: "How do I request a mentor for my project?",
        a: "In your project workspace, click 'Request Mentor'. You can browse available approved mentors and send them a request. Once accepted, their status updates in real-time.",
      },
      {
        q: "How do I become a mentor?",
        a: "Navigate to 'Mentor Application' and submit your LinkedIn profile link. Administrators review applications based on professional experience (4–5+ years in a relevant field).",
      },
      {
        q: "What can mentors do?",
        a: "Mentors provide guidance, answer technical questions, suggest improvements, and issue recommendation badges to collaborators. Mentors cannot approve tasks, assign XP, or modify scores.",
      },
    ],
  },
  {
    category: "Leaderboard & Profile",
    icon: "🏆",
    items: [
      {
        q: "How is the leaderboard ranked?",
        a: "Rankings are determined strictly by total XP earned through approved tasks. Weekly, Monthly, and All-Time leaderboards are available. Only approved tasks count.",
      },
      {
        q: "Can I view other users' profiles?",
        a: "Yes — click on any user's name in the Leaderboard to view their public profile, including their skills, projects, badges, XP, and reputation.",
      },
      {
        q: "How do I hide myself from the leaderboard?",
        a: "Go to Settings → Privacy and toggle off 'Appear on Leaderboard'. This removes you from public rankings while your XP and contributions continue to accumulate.",
      },
    ],
  },
];

const MENTORS_DATA = [
  {
    name: "Dr. Divya Krishnan",
    initials: "DK",
    title: "ML Engineer",
    uni: "IIT Bombay",
    skills: ["Python", "ML", "TensorFlow"],
    xp: 4200,
    rep: 96,
  },
  {
    name: "Priya Patel",
    initials: "PP",
    title: "Backend Engineer",
    uni: "BITS Pilani",
    skills: ["Java", "Kubernetes", "AWS"],
    xp: 3850,
    rep: 93,
  },
  {
    name: "Rohan Mehta",
    initials: "RM",
    title: "Full-stack Dev",
    uni: "IIT Madras",
    skills: ["React", "Node.js", "Go"],
    xp: 3400,
    rep: 89,
  },
];



// ─────────────────────────────────────────────
//  PORTAL ACCOUNTS  (Super User & Admin logins)
// ─────────────────────────────────────────────
// portalRole: "superuser" | "admin"
const PORTAL_ACCOUNTS = [
  {
    email: "superuser@teamforge.io",
    password: "Super@123",
    portalRole: "superuser",
    displayName: "Platform Root",
  },
  {
    email: "admin@teamforge.io",
    password: "admin123",
    portalRole: "admin",
    displayName: "Admin",
  },
];

const PORTAL_STORAGE_KEYS = {
  accounts: "teamforge.portalAccounts",
  admins: "teamforge.portalAdmins",
  config: "teamforge.platformConfig",
  mentorApplications: "teamforge.mentorApplications",
  auditLog: "teamforge.portalAuditLog",
  portalSessionEmail: "teamforge.portalSessionEmail",
};

function clonePortalValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function loadPortalCollection(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return clonePortalValue(fallback);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : clonePortalValue(fallback);
  } catch {
    return clonePortalValue(fallback);
  }
}

function savePortalCollection(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}

function loadPortalObject(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return clonePortalValue(fallback);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? { ...clonePortalValue(fallback), ...parsed }
      : clonePortalValue(fallback);
  } catch {
    return clonePortalValue(fallback);
  }
}

function savePortalObject(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function replaceCollectionContents(target, nextItems) {
  target.length = 0;
  target.push(...nextItems);
}

function savePortalAccounts() {
  savePortalCollection(PORTAL_STORAGE_KEYS.accounts, PORTAL_ACCOUNTS);
}

function savePortalAdmins() {
  savePortalCollection(PORTAL_STORAGE_KEYS.admins, PORTAL_ADMINS);
}

function savePlatformConfig() {
  savePortalObject(PORTAL_STORAGE_KEYS.config, PLATFORM_CONFIG);
}

function loadPersistedPortalAuditLog() {
  return loadPortalCollection(PORTAL_STORAGE_KEYS.auditLog, []);
}

function savePersistedPortalAuditLog(entries) {
  savePortalCollection(PORTAL_STORAGE_KEYS.auditLog, entries);
}

function appendPortalAuditEntry(entry) {
  const nextEntries = loadPersistedPortalAuditLog();
  nextEntries.unshift({
    id: String(entry?.id || `audit-live-${Date.now()}`),
    type: String(entry?.type || "system").toLowerCase(),
    event: String(entry?.event || entry?.action || "Event"),
    actor: String(entry?.actor || entry?.user || "System"),
    target: String(entry?.target || "-"),
    details: String(entry?.details || entry?.action || entry?.message || ""),
    timestamp: String(entry?.timestamp || entry?.time || new Date().toISOString()),
  });
  savePersistedPortalAuditLog(nextEntries.slice(0, 250));
}

function loadPersistedMentorApplications() {
  return loadPortalCollection(
    PORTAL_STORAGE_KEYS.mentorApplications,
    ADMIN_MENTOR_APPLICATIONS,
  );
}

function savePersistedMentorApplications(applications) {
  savePortalCollection(PORTAL_STORAGE_KEYS.mentorApplications, applications);
}

function getPortalAdminByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return PORTAL_ADMINS.find((admin) => admin.email === normalized) || null;
}

function getPortalPermissionsForEmail(email) {
  const admin = getPortalAdminByEmail(email);
  return admin && Array.isArray(admin.permissions) ? admin.permissions : [];
}

function setPortalSessionEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    sessionStorage.removeItem(PORTAL_STORAGE_KEYS.portalSessionEmail);
    return;
  }
  sessionStorage.setItem(PORTAL_STORAGE_KEYS.portalSessionEmail, normalized);
}

function getPortalSessionEmail() {
  return String(
    sessionStorage.getItem(PORTAL_STORAGE_KEYS.portalSessionEmail) || "",
  ).trim().toLowerCase();
}

if (typeof initializeAuthUsersFromSeed === "function") {
  initializeAuthUsersFromSeed(SEED_USERS);
  syncAdminSeedMetadataToUsers();
}

// ─────────────────────────────────────────────
//  PORTAL ADMINS  (managed by super user)
// ─────────────────────────────────────────────
const PORTAL_ADMINS = [
  {
    id: "adm-1",
    name: "Admin",
    email: "admin@teamforge.io",
    password: "admin123",
    status: "active",
    createdAt: "Mar 1, 2026",
    permissions: ["users", "projects", "mentor_apps", "audit"],
  },
  {
    id: "adm-2",
    name: "Ops Admin",
    email: "ops@teamforge.io",
    password: "Ops@2026!",
    status: "active",
    createdAt: "Mar 10, 2026",
    permissions: ["projects", "audit"],
  },
  {
    id: "adm-3",
    name: "Support Admin",
    email: "support@teamforge.io",
    password: "Support@99",
    status: "suspended",
    createdAt: "Feb 20, 2026",
    permissions: ["users", "audit"],
  },
];

// ─────────────────────────────────────────────
//  PLATFORM CONFIG  (managed by super user)
// ─────────────────────────────────────────────
const PLATFORM_CONFIG = {
  maxProjectsPerUser: 10,
  maxCollaboratorsPerProject: 20,
  mentorMinYearsExperience: 4,
  xpPerTaskCompletion: 100,
  maintenanceMode: false,
  allowNewRegistrations: true,
  platformVersion: "1.4.2",
};

replaceCollectionContents(
  PORTAL_ACCOUNTS,
  loadPortalCollection(PORTAL_STORAGE_KEYS.accounts, PORTAL_ACCOUNTS),
);
replaceCollectionContents(
  PORTAL_ADMINS,
  loadPortalCollection(PORTAL_STORAGE_KEYS.admins, PORTAL_ADMINS),
);
Object.assign(
  PLATFORM_CONFIG,
  loadPortalObject(PORTAL_STORAGE_KEYS.config, PLATFORM_CONFIG),
);
savePortalAccounts();
savePortalAdmins();
savePlatformConfig();

// --- MULTI-USER COLLABORATION LIVE SYNC ---
let lastUsersHash = "";
function syncRoleData() {
  const email = localStorage.getItem("currentUser") || sessionStorage.getItem("teamforge.email");
  if (!email) return;
  const users = JSON.parse(localStorage.getItem("users") || "{}");
  if (!users[email]) return;
  
  if (!users[email].data) users[email].data = { projects: [], notifications: [] };
  
  if (!localStorage.getItem("teamforge.seededProjects")) {
     // Seed legacy static projects into the proper user data
     PROJECTS.forEach(proj => {
        const ownerEmail = (proj.owner || "").toLowerCase().replace(" ", ".") + "@teamforge.io";
        if (users[ownerEmail]) {
           if (!users[ownerEmail].data) users[ownerEmail].data = { projects: [], notifications: [] };
           proj.tasks = []; proj.mentors = []; proj.requests = []; proj.invites = [];
           users[ownerEmail].data.projects.push(proj);
        }
     });
     localStorage.setItem("users", JSON.stringify(users));
     localStorage.setItem("teamforge.seededProjects", "true");
  }

  // Sync globally created projects reliably
  const persistedProjects = loadCreatedProjects();
  persistedProjects.forEach((project) => {
    if (!PROJECTS.some((p) => p.id === project.id)) {
      PROJECTS.unshift(project);
    }
  });
  
  NOTIFICATIONS = users[email].data.notifications || [];
  
  if (typeof renderDashboard === "function" && document.getElementById("dashboard") && document.getElementById("dashboard").style.display !== "none") renderDashboard();
  if (typeof renderNotifications === "function" && document.getElementById("notif-list")) renderNotifications();
  if (typeof renderOwnedProjects === "function") renderOwnedProjects();
  if (typeof renderProjectsList === "function") renderProjectsList();
}

setInterval(() => {
  const usersRaw = localStorage.getItem("users") || "{}";
  if (usersRaw !== lastUsersHash) {
     lastUsersHash = usersRaw;
     syncRoleData();
  }
}, 2000);
