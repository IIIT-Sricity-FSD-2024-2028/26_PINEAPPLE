"use strict";

(function () {
  const CURRENT_DATE = "Mar 31, 2026";
  const baseRenderDashboard = window.renderDashboard;
  const baseRenderNotifications = window.renderNotifications;
  const baseRenderProfile = window.renderProfile;
  const baseRenderHelp = window.renderHelp;
  const REVIEW2_RUNTIME_KEY = "teamforge.review2SharedRuntime";
  const MENTOR_REQUESTS_STORE_KEY = "teamforge.sharedMentorRequests";
  const DELETED_MENTOR_REQUESTS_KEY = "teamforge.deletedMentorRequests";
  let ownerMemberMenuCloseBound = false;

  function loadSharedMentorRequests() {
    try {
      const raw = localStorage.getItem(MENTOR_REQUESTS_STORE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveSharedMentorRequests(requests) {
    try {
      localStorage.setItem(MENTOR_REQUESTS_STORE_KEY, JSON.stringify(requests));
    } catch {
      // Ignore persistence failures.
    }
  }

  function loadDeletedMentorRequests() {
    try {
      const raw = localStorage.getItem(DELETED_MENTOR_REQUESTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveDeletedMentorRequests(entries) {
    try {
      localStorage.setItem(DELETED_MENTOR_REQUESTS_KEY, JSON.stringify(entries));
    } catch {
      // Ignore persistence failures.
    }
  }

  function buildMentorRequestKey(projectLike) {
    return `${String(projectLike?.id || "").trim()}::${String(projectLike?.name || projectLike?.project || "").trim().toLowerCase()}::${String(projectLike?.owner || projectLike?.ownerName || "").trim().toLowerCase()}`;
  }

  function isDeletedMentorRequest(projectLike) {
    return loadDeletedMentorRequests().includes(buildMentorRequestKey(projectLike));
  }

  function markMentorRequestDeleted(projectLike) {
    const key = buildMentorRequestKey(projectLike);
    const entries = loadDeletedMentorRequests();
    if (!entries.includes(key)) {
      entries.push(key);
      saveDeletedMentorRequests(entries);
    }
  }

  function clearDeletedMentorRequest(projectLike) {
    const key = buildMentorRequestKey(projectLike);
    saveDeletedMentorRequests(
      loadDeletedMentorRequests().filter((entry) => entry !== key),
    );
  }

  function getLiveTimestamp() {
    const now = new Date();
    return now.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getLiveShortDate() {
    return new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function ensureRuntimeInvites(runtime) {
    if (!runtime) return [];
    if (!Array.isArray(runtime.invites)) {
      runtime.invites = [];
    }
    return runtime.invites;
  }

  function updateMatchingNotifications(userRecord, matcher, updates) {
    if (!userRecord || typeof matcher !== "function") return;
    userRecord.data = ensureStateUserDataShape(userRecord.data);
    userRecord.data.notifications = userRecord.data.notifications.map((notification) =>
      matcher(notification)
        ? {
            ...notification,
            ...updates,
            unread:
              updates && Object.prototype.hasOwnProperty.call(updates, "unread")
                ? updates.unread
                : notification.unread,
          }
        : notification,
    );
  }

  function resolveUserIdentifier(identifier) {
    const value = String(identifier || "").trim();
    if (!value) return null;

    if (typeof findUserByIdentifier === "function") {
      const match = findUserByIdentifier(value);
      if (match) {
        return {
          email: match.email,
          user: match.user,
          username: String(match.user?.profile?.username || "").trim().toLowerCase(),
          label: match.user?.name || value,
        };
      }
    }

    const normalizedValue = value.toLowerCase();
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    const fallback = Object.entries(users).find(([email, user]) => {
      const storedUsername = String(user?.profile?.username || "")
        .trim()
        .toLowerCase();
      return email === normalizedValue || storedUsername === normalizedValue;
    });
    if (!fallback) return null;
    return {
      email: fallback[0],
      user: fallback[1],
      username: String(fallback[1]?.profile?.username || "")
        .trim()
        .toLowerCase(),
      label: fallback[1]?.name || value,
    };
  }

  function findUserByName(name) {
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    const normalizedName = String(name || "").trim().toLowerCase();
    const match = Object.entries(users).find(
      ([, user]) => String(user?.name || "").trim().toLowerCase() === normalizedName,
    );
    return match ? { email: match[0], user: match[1] } : null;
  }

  function normalizeEmailValue(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getUserRecordByName(name, users) {
    const normalizedName = String(name || "").trim().toLowerCase();
    if (!normalizedName) return null;
    const sourceUsers =
      users || (typeof getStateUsersStore === "function" ? getStateUsersStore() : {});
    const match = Object.entries(sourceUsers).find(
      ([, user]) => String(user?.name || "").trim().toLowerCase() === normalizedName,
    );
    return match ? { email: match[0], user: match[1] } : null;
  }

  function getProjectOwnerEmail(project, users) {
    const ownerRecord = getUserRecordByName(project?.owner, users);
    return ownerRecord?.email || "";
  }

  function getSeededUserScores(name) {
    const normalizedName = String(name || "").trim().toLowerCase();
    const adminMatch = Array.isArray(ADMIN_USERS)
      ? ADMIN_USERS.find(
          (user) => String(user?.name || "").trim().toLowerCase() === normalizedName,
        )
      : null;
    if (adminMatch) {
      return {
        xp: Number(adminMatch.xp || 0),
        rep: Number(adminMatch.rep || 0),
      };
    }
    const profileMatch =
      OTHER_PROFILES && typeof OTHER_PROFILES === "object"
        ? Object.values(OTHER_PROFILES).find(
            (profile) =>
              String(profile?.name || "").trim().toLowerCase() === normalizedName,
          )
        : null;
    if (profileMatch) {
      return {
        xp: Number(profileMatch.xp || 0),
        rep: Number(profileMatch.rep || 0),
      };
    }
    return { xp: 2450, rep: 87 };
  }

  function ensureUserScoreProfile(userRecord, userName) {
    if (!userRecord) return { xp: 2450, rep: 87 };
    if (!userRecord.profile || typeof userRecord.profile !== "object") {
      userRecord.profile = {};
    }
    const seeded = getSeededUserScores(userName || userRecord.name);
    if (!Number.isFinite(Number(userRecord.profile.xp))) {
      userRecord.profile.xp = seeded.xp;
    }
    if (!Number.isFinite(Number(userRecord.profile.rep))) {
      userRecord.profile.rep = seeded.rep;
    }
    return {
      xp: Number(userRecord.profile.xp || 0),
      rep: Number(userRecord.profile.rep || 0),
    };
  }

  function getTaskApprovalRewards(task) {
    const priority = String(task?.priority || "").trim().toLowerCase();
    const xpAdded =
      priority === "high" ? 40 : priority === "medium" ? 20 : 10;
    return { xpAdded, repAdded: 8 };
  }

  function getProjectMemberEmails(project, users) {
    const sourceUsers =
      users || (typeof getStateUsersStore === "function" ? getStateUsersStore() : {});
    const memberEmails = Array.isArray(project?.members)
      ? project.members
          .map((member) => getUserRecordByName(member?.name, sourceUsers)?.email || "")
          .filter(Boolean)
      : [];
    return [...new Set(memberEmails)];
  }

  function getProjectMentorEmails(project, users) {
    const sourceUsers =
      users || (typeof getStateUsersStore === "function" ? getStateUsersStore() : {});
    const runtime = project?.runtime || {};
    const mentorEmails = [];
    if (runtime.mentorRequest?.status === "approved") {
      if (runtime.mentorRequest.mentorEmail) {
        mentorEmails.push(normalizeEmailValue(runtime.mentorRequest.mentorEmail));
      } else if (runtime.mentorRequest.requestedName) {
        const mentorRecord = getUserRecordByName(
          runtime.mentorRequest.requestedName,
          sourceUsers,
        );
        if (mentorRecord?.email) mentorEmails.push(mentorRecord.email);
      }
    }
    return [...new Set(mentorEmails.filter(Boolean))];
  }

  function normalizeTaskStatusForStorage(status) {
    const value = String(status || "").trim().toLowerCase();
    if (!value || value === "open") return "pending";
    if (value === "in progress") return "in-progress";
    if (value === "in review") return "submitted";
    if (value === "approved" || value === "completed") return "approved";
    return value;
  }

  function normalizeTaskStatusForUi(status) {
    const value = normalizeTaskStatusForStorage(status);
    if (value === "pending") return "Open";
    if (value === "in-progress") return "In Progress";
    if (value === "submitted") return "In Review";
    if (value === "approved") return "Approved";
    return String(status || "Open");
  }

  function isPendingMentorRequestStatus(status) {
    const value = String(status || "").trim().toLowerCase();
    return !value || value === "requested" || value === "pending";
  }

  function buildUserProjectSnapshot(project, users) {
    const sourceUsers =
      users || (typeof getStateUsersStore === "function" ? getStateUsersStore() : {});
    const ownerEmail = getProjectOwnerEmail(project, sourceUsers);
    return ensureStateProjectShape({
      id: project.id,
      name: project.name,
      owner: ownerEmail,
      ownerName: project.owner,
      members: getProjectMemberEmails(project, sourceUsers),
      mentors: getProjectMentorEmails(project, sourceUsers),
      tasks: (project.runtime?.tasks || []).map((task) => {
        const assigneeRecord = getUserRecordByName(task.assignee, sourceUsers);
        return {
          id: task.id,
          title: task.title,
          assignedTo: assigneeRecord?.email || "",
          status: normalizeTaskStatusForStorage(task.status),
          proofLink: task.proofLink || "",
        };
      }),
      requests: Array.isArray(project.runtime?.joinRequests)
        ? project.runtime.joinRequests.map((request) => ({
            from: request.email || request.from || "",
            status: request.status || "pending",
            projectId: project.id,
          }))
        : [],
      invites: Array.isArray(project.runtime?.invites)
        ? project.runtime.invites.map((invite) => ({
            to: invite.toEmail || invite.to || "",
            from: ownerEmail,
            projectId: project.id,
            status: String(invite.status || "").toLowerCase(),
            taskId: invite.taskId || "",
          }))
        : [],
      status: project.isCompleted ? "completed" : "ongoing",
      finalLink: project.runtime?.finishedLink || "",
      completedAt: project.runtime?.finishedPublishedAt || "",
      isCompleted: Boolean(project.isCompleted),
    });
  }

  function syncProjectToUserStores(project) {
    if (!project || typeof getStateUsersStore !== "function") return;
    const users = getStateUsersStore();
    const ownerEmail = getProjectOwnerEmail(project, users);
    const memberEmails = getProjectMemberEmails(project, users);
    const mentorEmails = getProjectMentorEmails(project, users);
    const participantEmails = [...new Set([ownerEmail, ...memberEmails, ...mentorEmails])].filter(
      Boolean,
    );
    const snapshot = buildUserProjectSnapshot(project, users);

    Object.entries(users).forEach(([email, user]) => {
      const shouldHaveProject = participantEmails.includes(email);
      if (shouldHaveProject) {
        upsertUserProject(user, snapshot);
      } else {
        removeUserProject(user, project.id);
      }
    });
    saveStateUsersStore(users);
  }

  function syncAllProjectsToUserStores() {
    PROJECTS.forEach((project) => syncProjectToUserStores(project));
  }

  function ensureReview2State() {
    if (!STATE.review2) STATE.review2 = {};
    Object.assign(STATE.review2, {
      myWorkFilter: STATE.review2.myWorkFilter || "ongoing",
      ownerProjectsFilter: STATE.review2.ownerProjectsFilter || "ongoing",
      ownerMemberMenu: STATE.review2.ownerMemberMenu || "",
      pendingAssignment:
        STATE.review2.pendingAssignment || {
          projectId: "",
          memberName: "",
        },
      ownerMentorProjectId:
        STATE.review2.ownerMentorProjectId || getDefaultOwnedProjectId(),
      pendingKick:
        STATE.review2.pendingKick || {
          projectId: "",
          memberName: "",
          reason: "",
        },
    });
  }

  function getDefaultOwnedProjectId() {
    const currentUser = getCurrentUserName();
    const firstOwned = PROJECTS.find(
      (project) => project.owner === currentUser && !project.isCompleted,
    );
    return firstOwned ? firstOwned.id : "";
  }

  function hydrateReview2Runtime() {
    try {
      const raw = localStorage.getItem(REVIEW2_RUNTIME_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.projects)) {
        PROJECTS.length = 0;
        PROJECTS.push(
          ...parsed.projects.map((project) =>
            typeof normalizeProject === "function"
              ? normalizeProject(project)
              : project,
          ),
        );
      }
      if (Array.isArray(parsed?.applied)) {
        APPLIED.length = 0;
        APPLIED.push(...parsed.applied);
      }
      if (Array.isArray(parsed?.notifications)) {
        STATE.review2.notificationsBuilt = true;
        STATE.review2.notifications = parsed.notifications;
      }
    } catch {
      // Ignore runtime restore failures and continue with bundled mock data.
    }
  }

  function persistReview2Runtime() {
    try {
      localStorage.setItem(
        REVIEW2_RUNTIME_KEY,
        JSON.stringify({
          projects: PROJECTS,
          applied: APPLIED,
          notifications: Array.isArray(STATE.review2?.notifications)
            ? STATE.review2.notifications
            : [],
        }),
      );
      syncAllProjectsToUserStores();
    } catch {
      // Ignore persistence failures and keep the app usable in memory.
    }
  }

  function refreshSharedReview2Runtime() {
    hydrateReview2Runtime();
    PROJECTS.forEach((project) => {
      const runtime = getProjectRuntime(project);
      if (runtime?.tasks) {
        runtime.tasks = runtime.tasks.map((task) => ({
          ...task,
          assignee: task.assignee || task.assignedTo || "Unassigned",
          status: normalizeTaskStatusForUi(task.status),
        }));
      }
    });
  }

  function getProjectRuntime(project) {
    if (!project) return null;
    if (!project.runtime) {
      const members = Array.isArray(project.members) ? project.members : [];
      const progress = Number(project.progress) || 0;
      const isCompleted = Boolean(project.isCompleted) || progress >= 100;
      if (project.isUserCreated) {
        project.runtime = {
          tasks: [],
          joinRequests: [],
          invites: [],
          kickedUsers: [],
          mentorRequest: null,
          finishedLink: "",
          finishedPublishedAt: "",
          chat: [],
          contributionHistory: [],
          recommendations: [],
        };
        return project.runtime;
      }
      const mentorSeed =
        project.owner === "Arjun Sharma"
          ? {
              requestedName: "Dr. Divya Krishnan",
              status: "requested",
              requestedOn: CURRENT_DATE,
            }
          : project.id === "3"
            ? {
                requestedName: "Dr. Divya Krishnan",
                status: "approved",
                requestedOn: "Mar 20, 2026",
                approvedOn: "Mar 22, 2026",
              }
            : null;

      project.runtime = {
        tasks: buildSeedTasks(project, members, isCompleted),
        joinRequests:
          project.owner === "Arjun Sharma"
            ? [
                {
                  id: `${project.id}-join-1`,
                  name: "Kavya Menon",
                  initials: "KM",
                  requestedOn: CURRENT_DATE,
                  skills: ["React", "Testing"],
                  message:
                    "I can support frontend polish and test coverage for this sprint.",
                  status: "pending",
                },
              ]
            : [],
        invites: [],
        kickedUsers: [],
        mentorRequest: mentorSeed,
        finishedLink:
          isCompleted && project.id === "9"
            ? "https://teamforge-demo.example/smart-attendance-tracker"
            : "",
        finishedPublishedAt:
          isCompleted && project.id === "9" ? "Mar 28, 2026" : "",
        chat: buildSeedChat(project),
        contributionHistory: buildContributionHistory(project, members),
        recommendations: [],
      };
    }
    syncSharedMentorRequestToRuntime(project);
    syncOwnerStoredRequestsToRuntime(project);
    syncCurrentUserProjectAccess(project);
    return project.runtime;
  }

  function syncCurrentUserProjectAccess(project) {
    if (!project) return;
    const currentUserEmail =
      typeof getCurrentUserSessionEmail === "function"
        ? getCurrentUserSessionEmail()
        : "";
    const currentUserData =
      typeof getCurrentUserData === "function" ? getCurrentUserData() : null;
    const currentUserName = getCurrentUserName();
    const hasCollaboratorAccess = userHasProjectAccess(currentUserData, project.id);
    if (
      hasCollaboratorAccess &&
      currentUserName &&
      project.owner !== currentUserName &&
      !(project.members || []).some((member) => member.name === currentUserName)
    ) {
      project.members = project.members || [];
      project.members.push({
        name: currentUserName,
        initials: getInitialsFromName(currentUserName),
        role: "Collaborator",
      });
      project.collaborators = project.members.length;
    }

    const mentorRequest = project.runtime?.mentorRequest;
    if (
      mentorRequest &&
      mentorRequest.status === "approved" &&
      (mentorRequest.mentorEmail === currentUserEmail ||
        mentorRequest.requestedName === currentUserName) &&
      !(project.members || []).some(
        (member) => member.name === mentorRequest.requestedName,
      )
    ) {
      project.members = project.members || [];
      project.members.push({
        name: mentorRequest.requestedName,
        initials: getInitialsFromName(mentorRequest.requestedName),
        role: "Mentor",
      });
      project.collaborators = project.members.length;
    }
  }

  function syncSharedMentorRequestToRuntime(project) {
    if (!project || !project.runtime) return;
    if (isDeletedMentorRequest(project)) {
      project.runtime.mentorRequest = null;
      return;
    }
    const sharedRequest = loadSharedMentorRequests().find(
      (item) => item.projectId === project.id,
    );
    if (!sharedRequest) return;
    project.runtime.mentorRequest = {
      requestedName: sharedRequest.mentorName,
      mentorEmail: sharedRequest.mentorEmail || "",
      ownerEmail: sharedRequest.ownerEmail || "",
      status:
        sharedRequest.status === "approved"
          ? "approved"
          : sharedRequest.status === "declined"
            ? "declined"
            : "requested",
      requestedOn: sharedRequest.requestedOn || CURRENT_DATE,
      approvedOn: sharedRequest.approvedOn || "",
      declinedOn: sharedRequest.declinedOn || "",
    };
    if (sharedRequest.status === "approved") {
      const hasMentorMember = (project.members || []).some(
        (member) => member.name === sharedRequest.mentorName,
      );
      if (!hasMentorMember) {
        project.members = project.members || [];
        project.members.push({
          name: sharedRequest.mentorName,
          initials: getInitialsFromName(sharedRequest.mentorName),
          role: "Mentor",
        });
        project.collaborators = project.members.length;
      }
    }
  }

  function syncOwnerStoredRequestsToRuntime(project) {
    if (!project || project.owner !== getCurrentUserName()) return;
    const runtime = project.runtime;
    if (!runtime) return;
    const currentUserEmail =
      typeof getCurrentUserSessionEmail === "function"
        ? getCurrentUserSessionEmail()
        : "";
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    const ownerRecord = currentUserEmail ? users[currentUserEmail] : null;
    const storedRequests = Array.isArray(ownerRecord?.data?.requests)
      ? ownerRecord.data.requests.filter(
          (request) =>
            request.projectId === project.id || request.projectName === project.name,
        )
      : [];

    storedRequests.forEach((storedRequest) => {
      const requesterRecord = storedRequest.from ? users[storedRequest.from] : null;
      const requesterName =
        requesterRecord?.name ||
        String(storedRequest.from || "Collaborator").split("@")[0];
      const existing = runtime.joinRequests.find(
        (request) =>
          (request.projectId === storedRequest.projectId ||
            request.projectId === project.id ||
            !request.projectId) &&
          (request.from === storedRequest.from ||
            request.email === storedRequest.from ||
            request.name === requesterName),
      );
      if (existing) {
        existing.status =
          storedRequest.status === "accepted"
            ? "approved"
            : storedRequest.status === "rejected"
              ? "rejected"
              : storedRequest.status || existing.status;
        existing.requestedOn = storedRequest.time || existing.requestedOn;
        existing.name = requesterName;
        existing.initials =
          requesterRecord?.name
            ? getInitialsFromName(requesterRecord.name)
            : existing.initials;
        existing.email = storedRequest.from || existing.email;
        existing.from = storedRequest.from || existing.from;
        return;
      }
      runtime.joinRequests.unshift({
        id: `${project.id}-stored-${storedRequest.from || Date.now()}`,
        name: requesterName,
        email: storedRequest.from || "",
        from: storedRequest.from || "",
        initials: requesterRecord?.name
          ? getInitialsFromName(requesterRecord.name)
          : getInitialsFromName(requesterName),
        requestedOn: storedRequest.time || CURRENT_DATE,
        skills: Array.isArray(requesterRecord?.profile?.skills)
          ? requesterRecord.profile.skills.slice(0, 3)
          : [],
        message: "Requested to join this project.",
        status:
          storedRequest.status === "accepted"
            ? "approved"
            : storedRequest.status === "rejected"
              ? "rejected"
              : storedRequest.status || "pending",
        projectId: storedRequest.projectId || project.id,
      });
    });
  }

  function buildSeedTasks(project, members, isCompleted) {
    const currentUser = getCurrentUserName();
    const owner = project.owner || "Project Owner";
    const actualCollaborator =
      members.find((member) => member.name !== owner)?.name || "Unassigned";
    const collaborator =
      actualCollaborator;
    const secondary =
      members.find(
        (member) => member.name !== owner && member.name !== collaborator,
      )?.name || "Unassigned";

    const tasks = [
      {
        id: `${project.id}-task-1`,
        title: "Information architecture",
        description: "Define the app structure and edge states.",
        assignee: collaborator,
        due: "Apr 02",
        priority: "Medium",
        status: "Approved",
      },
      {
        id: `${project.id}-task-2`,
        title: "UI implementation",
        description: "Build the responsive workspace and dashboard flows.",
        assignee:
          project.id === "3"
            ? (members.some(m => m.name === currentUser) ? currentUser : owner)
            : secondary === "Unassigned"
              ? collaborator
              : secondary,
        due: "Apr 05",
        priority: "High",
        status: project.id === "1" ? "In Review" : "In Progress",
      },
      {
        id: `${project.id}-task-3`,
        title: "Mock data integration",
        description: "Connect role-based mock data and validation states.",
        assignee:
          project.id === "7"
            ? "Vikram Nair"
            : members.some((m) => m.name === currentUser && currentUser !== owner)
            ? currentUser
            : "Unassigned",
        due: "Apr 08",
        priority: "High",
        status: project.id === "1" ? "Open" : "Approved",
      },
      {
        id: `${project.id}-task-4`,
        title: "QA and feedback fixes",
        description: "Resolve review feedback and polish UX.",
        assignee: "Unassigned",
        due: "Apr 11",
        priority: "Medium",
        status: "Open",
      },
    ];

    if (isCompleted || project.id === "9") {
      tasks.forEach((task) => {
        task.status = "Approved";
      });
    }

    if (project.id === "9") {
      tasks[0].assignee = currentUser;
      tasks[1].assignee = "Ananya Reddy";
      tasks[2].assignee = "Vikram Nair";
      tasks[3].assignee = "Priya Patel";
    }

    return tasks;
  }

  function buildContributionHistory(project, members) {
    return [
      {
        title: "Workspace dashboard",
        by: members[1]?.name || getCurrentUserName(),
        status: "Approved",
        summary: "Delivered the main overview and state cards.",
      },
      {
        title: "Validation pass",
        by: getCurrentUserName(),
        status: project.id === "1" ? "In Review" : "Approved",
        summary: "Added client-side validation and guarded empty states.",
      },
    ];
  }

  function buildSeedChat(project) {
    return [
      {
        sender: project.owner,
        text: `Please keep ${project.name} aligned with the review feedback.`,
        time: "10:12 AM",
      },
      {
        sender: "TeamForge Bot",
        text: "Mock data synced for the latest sprint board.",
        time: "10:18 AM",
      },
    ];
  }

  function seedRuntimeData() {
    PROJECTS.forEach((project) => {
      getProjectRuntime(project);
    });

    const currentUser = getCurrentUserName();
    const inviteProject = PROJECTS.find((project) => project.id === "6");
    if (inviteProject && inviteProject.owner !== currentUser) {
      const runtime = getProjectRuntime(inviteProject);
      const alreadyMember = Array.isArray(inviteProject.members)
        ? inviteProject.members.some((member) => member.name === currentUser)
        : false;
      const hasInviteRequest = Array.isArray(runtime?.joinRequests)
        ? runtime.joinRequests.some(
            (request) =>
              request.name === currentUser && request.invitedByOwner === true,
          )
        : false;
      const hasInviteEntry = APPLIED.some(
        (item) =>
          item.projectId === inviteProject.id &&
          item.invitedUser === currentUser &&
          item.status === "Invited",
      );

      if (!alreadyMember && runtime && !hasInviteRequest) {
        runtime.joinRequests.unshift({
          id: `${inviteProject.id}-seed-invite`,
          name: currentUser,
          initials: getInitialsFromName(currentUser),
          requestedOn: CURRENT_DATE,
          skills: STATE.userSkills || [],
          message: `Invited by ${inviteProject.owner} to collaborate on ${inviteProject.name}.`,
          status: "pending",
          invitedByOwner: true,
        });
      }

      if (!alreadyMember && !hasInviteEntry) {
        APPLIED.unshift({
          projectId: inviteProject.id,
          project: inviteProject.name,
          owner: inviteProject.owner,
          applied: CURRENT_DATE,
          status: "Invited",
          invitedUser: currentUser,
          invitedByOwner: true,
        });
      }
    }

    const completedProject = PROJECTS.find((project) => project.id === "9");
    if (completedProject && Array.isArray(completedProject.members)) {
      if (!completedProject.members.some((member) => member.name === currentUser)) {
        completedProject.members.push({
          name: currentUser,
          initials: getInitialsFromName(currentUser),
          role: "Frontend Dev",
        });
      }
    }
  }

  const RECOMMENDATION_STORE_KEY = "teamforge.review2.recommendations";

  function loadStoredRecommendations() {
    try {
      const raw = localStorage.getItem(RECOMMENDATION_STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveStoredRecommendations() {
    try {
      const payload = PROJECTS.reduce((acc, project) => {
        const runtime = getProjectRuntime(project);
        if (runtime?.recommendations?.length) {
          acc[project.id] = runtime.recommendations.map((item) => ({
            userName: item.userName,
            note: item.note,
          }));
        }
        return acc;
      }, {});
      localStorage.setItem(RECOMMENDATION_STORE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage failures and keep runtime behavior intact.
    }
  }

  function hydrateStoredRecommendations() {
    const stored = loadStoredRecommendations();
    PROJECTS.forEach((project) => {
      const runtime = getProjectRuntime(project);
      const savedItems = Array.isArray(stored[project.id]) ? stored[project.id] : [];
      savedItems.forEach((savedItem) => {
        if (!runtime.recommendations.some((item) => item.userName === savedItem.userName)) {
          runtime.recommendations.push({
            userName: savedItem.userName,
            note:
              savedItem.note ||
              "Recognized by mentor for strong collaboration and delivery.",
          });
        }
        if (OTHER_PROFILES[savedItem.userName]) {
          OTHER_PROFILES[savedItem.userName].hasMentorBadge = true;
        }
      });
    });
  }

  function buildNotificationStore() {
    if (STATE.review2.notificationsBuilt) return;
    STATE.review2.notificationsBuilt = true;
    STATE.review2.notifications = [
      {
        id: "n-3",
        roleScope: ["collaborator"],
        icon: "✅",
        title: "Project Approved",
        desc: "Your request to collaborate on EcoTracker was approved.",
        time: "2 hours ago",
        unread: false,
      },
    ];
  }

  function pushNotification(notification) {
    buildNotificationStore();
    STATE.review2.notifications.unshift({
      id: `n-${Date.now()}`,
      unread: true,
      time: "Just now",
      roleScope: ["collaborator", "project-owner", "mentor"],
      ...notification,
    });
    persistReview2Runtime();
  }

  function visibleNotifications() {
    buildNotificationStore();
    const extra = STATE.review2.notifications.filter((notification) => {
      const scope = Array.isArray(notification.roleScope)
        ? notification.roleScope
        : ["collaborator", "project-owner", "mentor"];
      return scope.includes(STATE.role);
    });
    const base = Array.isArray(NOTIFICATIONS) ? NOTIFICATIONS : [];
    return [...extra, ...base];
  }

  function getProjectMentor(project) {
    const runtime = getProjectRuntime(project);
    const mentorRequest = runtime?.mentorRequest;
    if (!mentorRequest) return null;
    const mentor =
      MENTORS_DATA.find((item) => item.name === mentorRequest.requestedName) ||
      (() => {
        const matchedUser = findUserByName(mentorRequest.requestedName);
        if (!matchedUser) return null;
        return {
          name: matchedUser.user.name,
          initials: getInitialsFromName(matchedUser.user.name),
          title: "Platform Mentor",
          uni: matchedUser.user.profile?.university || "TeamForge",
          skills: Array.isArray(matchedUser.user.profile?.skills)
            ? matchedUser.user.profile.skills.slice(0, 3)
            : ["Mentorship"],
        };
      })();
    return mentor
      ? {
          ...mentor,
          status: mentorRequest.status,
          requestedOn: mentorRequest.requestedOn,
          approvedOn: mentorRequest.approvedOn || "",
        }
      : null;
  }

  function findUserProfile(name) {
    if (name === getCurrentUserName()) {
      return buildUnifiedProfile(getOwnProfile());
    }
    if (OTHER_PROFILES[name]) {
      return buildUnifiedProfile(OTHER_PROFILES[name]);
    }
    return buildUnifiedProfile({
      ...getOwnProfile(),
      name,
      initials: getInitialsFromName(name),
    });
  }

  function buildUnifiedProfile(baseProfile) {
    const recommendations = getRecommendationsForUser(baseProfile.name);
    const runtimeProjectList = PROJECTS.filter((project) => {
      const runtime = getProjectRuntime(project);
      const mentor = getProjectMentor(project);
      const isOwner = project.owner === baseProfile.name;
      const isMember = Array.isArray(project.members)
        ? project.members.some((member) => member.name === baseProfile.name)
        : false;
      const isMentor =
        mentor &&
        mentor.status === "approved" &&
        mentor.name === baseProfile.name;
      return Boolean(runtime) && (isOwner || isMember || isMentor);
    }).map((project) => {
      const mentor = getProjectMentor(project);
      const runtime = getProjectRuntime(project);
      const isOwner = project.owner === baseProfile.name;
      const isMentor =
        mentor &&
        mentor.status === "approved" &&
        mentor.name === baseProfile.name;
      return {
        name: project.name,
        role: isOwner ? "Owner" : isMentor ? "Mentor" : "Collaborator",
        status: project.isCompleted ? "Completed" : "Active",
        contribution: isOwner
          ? "Leading project delivery"
          : isMentor
            ? "Guided the team through milestones and reviews."
            : "Contributing to the team",
        finalLink: runtime?.finishedLink || "",
      };
    });
    const runtimeMentoredProjects = PROJECTS.filter((project) => {
      const mentor = getProjectMentor(project);
      return mentor && mentor.name === baseProfile.name && mentor.status === "approved";
    }).map((project) => ({
      name: project.name,
      owner: project.owner || "Project Owner",
      status: project.isCompleted ? "Completed" : "Active",
      contribution: "Guided the team through milestones and reviews.",
      completedAt: project.isCompleted
        ? project.runtime?.finishedPublishedAt || "Completed"
        : "In progress",
      finalLink: project.runtime?.finishedLink || "",
    }));

    const mentoredProjects = [];
    runtimeMentoredProjects.forEach((project) => {
      if (!mentoredProjects.some((item) => item.name === project.name)) {
        mentoredProjects.push(project);
      }
    });

    const projectList = [];
    [...runtimeProjectList, ...(baseProfile.projectList || [])].forEach((project) => {
      if (!projectList.some((item) => item.name === project.name && item.role === project.role)) {
        projectList.push(project);
      }
    });

    return {
      ...baseProfile,
      projects: projectList.length,
      hasMentorBadge:
        Boolean(baseProfile.hasMentorBadge) || recommendations.length > 0,
      recommendations,
      projectList,
      mentoredProjects,
    };
  }

  function getRecommendationsForUser(userName) {
    return PROJECTS.flatMap((project) => {
      const runtime = getProjectRuntime(project);
      const mentor = getProjectMentor(project);
      if (!runtime || !mentor || mentor.status !== "approved") return [];
      const badges = (runtime.recommendations || []).filter(
        (item) => item.userName === userName,
      );
      return badges.map((item) => ({
        mentor: mentor.name,
        project: project.name,
        note: item.note,
      }));
    });
  }

  function ensureOverlayMount() {
    if (document.getElementById("leaderboard-profile-modal")) return;
    const mount = document.createElement("div");
    mount.innerHTML = `
      <div id="leaderboard-profile-modal" class="modal-overlay" onclick="closeLeaderboardProfile(event)">
        <div class="modal-box modal-box--wide profile-popup-shell" onclick="event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-icon">👤</span>
            <h3 class="modal-title">User Profile</h3>
            <button class="modal-close" onclick="closeLeaderboardProfile()">✕</button>
          </div>
          <div id="leaderboard-profile-content" class="modal-body"></div>
        </div>
      </div>
      <div id="member-kick-modal" class="modal-overlay" onclick="closeKickMemberModal(event)">
        <div class="modal-box" onclick="event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-icon">🚫</span>
            <h3 class="modal-title">Remove Member</h3>
            <button class="modal-close" onclick="closeKickMemberModal()">✕</button>
          </div>
          <div class="modal-body">
            <p class="text-sm text-muted" style="margin-bottom:12px">Share why this collaborator is being removed. This reason will be shown to them and future join attempts will be blocked.</p>
            <textarea id="kick-member-reason" class="input" rows="4" placeholder="Explain why access is being revoked..."></textarea>
            <button class="btn btn-destructive btn-full mt-3" onclick="confirmKickMember()">Remove Member</button>
          </div>
        </div>
      </div>
      <div id="assign-task-modal" class="modal-overlay" onclick="closeAssignTaskModal(event)">
        <div class="modal-box" onclick="event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-icon">📌</span>
            <h3 class="modal-title">Assign Task</h3>
            <button class="modal-close" onclick="closeAssignTaskModal()">✕</button>
          </div>
          <div class="modal-body">
            <p class="text-sm text-muted" style="margin-bottom:12px">Choose an existing unassigned task for this collaborator.</p>
            <select id="assign-task-select" class="input"></select>
            <div class="workspace-card__actions" style="margin-top:16px">
              <button class="btn btn-primary" onclick="confirmAssignTaskSelection()">Assign Selected Task</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(mount);
  }

  function bindOwnerMemberMenuClose() {
    if (ownerMemberMenuCloseBound) return;
    document.addEventListener("click", (event) => {
      const menuRoot = event.target?.closest?.(".workspace-member-menu");
      if (!menuRoot && STATE.review2?.ownerMemberMenu) {
        STATE.review2.ownerMemberMenu = "";
        renderProjectWorkspace();
      }
    });
    ownerMemberMenuCloseBound = true;
  }

  function markProjectCompletedFromPublishedLink(project, runtime, link) {
    project.isCompleted = true;
    project.progress = 100;
    project.status = "completed";
    runtime.finishedLink = link;
    runtime.finishedPublishedAt = getLiveShortDate();
    runtime.tasks.forEach((task) => {
      task.status = "Approved";
    });
  }

  function allTasksApproved(runtime) {
    return Array.isArray(runtime?.tasks) && runtime.tasks.length > 0
      ? runtime.tasks.every((task) => task.status === "Approved")
      : false;
  }

  function canShowTaskProof(task) {
    const status = String(task?.status || "").trim().toLowerCase();
    return Boolean(task?.proofLink) && (status === "in review" || status === "submitted" || status === "approved");
  }

  function taskProofLinkHtml(task, compact) {
    if (!canShowTaskProof(task)) {
      return compact
        ? '<span class="text-xs text-muted">No proof</span>'
        : '<span class="text-xs text-muted">No proof yet</span>';
    }
    return `<a class="${compact ? "btn btn-ghost btn-sm" : "workspace-link"}" href="${escapeHtml(task.proofLink)}" target="_blank" rel="noopener noreferrer">${compact ? "View Proof" : "Proof Link ↗"}</a>`;
  }

  function taskDifficultyPill(priority) {
    const value = String(priority || "Medium").trim() || "Medium";
    const normalized = value.toLowerCase();
    const cls =
      normalized === "high"
        ? "badge-destructive"
        : normalized === "medium"
          ? "badge-warning"
          : "badge-secondary";
    return `<span class="badge ${cls}">${escapeHtml(value)}</span>`;
  }

  function currentUserInitials() {
    return getInitialsFromName(getCurrentUserName());
  }

  function normalizeUserIdentifier(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function isAppliedEntryForCurrentUser(item) {
    const currentUser = getCurrentUserName();
    const currentUsername = String(STATE.userProfile?.username || "").trim();
    const currentEmail =
      typeof getCurrentUserSessionEmail === "function"
        ? getCurrentUserSessionEmail()
        : "";
    if (!item) return false;
    if (item.invitedEmail && item.invitedEmail === currentEmail) return true;
    if (item.requester && item.requester === currentEmail) return true;
    if (item.invitedUser) {
      return (
        normalizeUserIdentifier(item.invitedUser) ===
          normalizeUserIdentifier(currentUsername) ||
        normalizeUserIdentifier(item.invitedUser) ===
          normalizeUserIdentifier(currentUser)
      );
    }
    if (item.requester) return false;
    return currentUser === "Arjun Sharma";
  }

  function formatProjectStatus(project) {
    return project.isCompleted ? "Completed" : "Ongoing";
  }

  function setMyWorkFilter(filter) {
    ensureReview2State();
    STATE.review2.myWorkFilter = filter;
    if (typeof saveViewState === "function") saveViewState();
    renderMyWork();
  }

  function setOwnerProjectsFilter(filter) {
    ensureReview2State();
    STATE.review2.ownerProjectsFilter = filter;
    if (typeof saveViewState === "function") saveViewState();
    renderMyProjects();
  }

  function getCollaborativeProjects() {
    const currentUser = getCurrentUserName();
    const currentUserData =
      typeof getCurrentUserData === "function" ? getCurrentUserData() : null;
    const approvedAppliedProjectNames = new Set(
      APPLIED.filter(
        (item) =>
          isAppliedEntryForCurrentUser(item) &&
          (item.status === "Approved" || item.status === "Completed"),
      ).map((item) => item.project),
    );
    const approvedProjectIds = new Set(userProjectIdList(currentUserData));
    return PROJECTS.filter((project) => {
      getProjectRuntime(project);
      const isMember = Array.isArray(project.members)
        ? project.members.some((member) => member.name === currentUser)
        : false;
      return (
        project.owner !== currentUser &&
        (approvedAppliedProjectNames.has(project.name) ||
          approvedProjectIds.has(project.id) ||
          isMember)
      );
    });
  }

  function renderMyWork() {
    refreshSharedReview2Runtime();
    ensureReview2State();
    const root = document.getElementById("my-work-content");
    if (!root) return;

    const filter = STATE.review2.myWorkFilter || "ongoing";
    const currentUser = getCurrentUserName();
    const projects = getCollaborativeProjects();
    const ongoing = projects.filter((project) => !project.isCompleted);
    const completed = projects.filter((project) => project.isCompleted);
    const visible = filter === "completed" ? completed : ongoing;

    root.innerHTML = `
      <div class="segmented-switch">
        <button class="segmented-switch__btn ${filter === "ongoing" ? "active" : ""}" onclick="setMyWorkFilter('ongoing')">Ongoing (${ongoing.length})</button>
        <button class="segmented-switch__btn ${filter === "completed" ? "active" : ""}" onclick="setMyWorkFilter('completed')">Completed (${completed.length})</button>
      </div>
      ${
        visible.length
          ? visible
              .map((project) => {
                const runtime = getProjectRuntime(project);
                const myTasks = runtime.tasks.filter(
                  (task) => task.assignee === currentUser,
                );
                const mentor = getProjectMentor(project);
                const summary = getMyWorkCompletedSummary(project);
                const finishedLinkBlock =
                  runtime.finishedLink && project.isCompleted
                    ? `
                    <a class="workspace-link" href="${escapeHtml(runtime.finishedLink)}" target="_blank" rel="noopener noreferrer">Open finished project ↗</a>
                  `
                    : '<span class="text-xs text-muted">Finished link will appear after the owner publishes it.</span>';

                return `
                  <div class="card mt-3 workspace-card">
                    <div class="workspace-card__top">
                      <div>
                        <div class="workspace-card__title">${escapeHtml(project.name)}</div>
                        <div class="workspace-card__meta">Owner: ${escapeHtml(project.owner)} · ${formatProjectStatus(project)} · ${myTasks.length} task${myTasks.length === 1 ? "" : "s"} assigned to you</div>
                      </div>
                      <div class="workspace-card__actions">
                        ${
                          project.isCompleted
                            ? `<button class="btn btn-outline btn-sm" onclick="openContributionSummary('${project.id}')">Summary</button>`
                            : `<button class="btn btn-outline btn-sm" onclick="openWorkspace('${project.id}','my-work')">Open Workspace</button>`
                        }
                        ${
                          !project.isCompleted
                            ? `<button class="btn btn-ghost btn-sm" onclick="leaveProject('${project.id}')">Leave Project</button>`
                            : ""
                        }
                      </div>
                    </div>
                    <div class="progress-container" style="height:8px;margin:14px 0 16px"><div class="progress-fill" style="width:${Number(project.progress) || 0}%"></div></div>
                    <div class="workspace-stat-row">
                      <span>${Number(project.progress) || 0}% progress</span>
                      <span>${mentor ? `Mentor: ${mentor.name} (${mentor.status})` : "No mentor assigned"}</span>
                    </div>
                    ${
                      project.isCompleted
                        ? `
                        <div class="workspace-summary-box">
                          <div class="workspace-summary-box__title">Your contribution</div>
                          <p>${escapeHtml(summary.contribution)}</p>
                          ${finishedLinkBlock}
                        </div>
                      `
                        : `
                        <table>
                          <thead>
                            <tr>
                              <th>Task</th>
                              <th>Status</th>
                              <th>Due</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${
                              myTasks.length
                                ? myTasks
                                    .map(
                                      (task) => `
                                      <tr>
                                        <td>${escapeHtml(task.title)}</td>
                                        <td>${collaboratorStatusPill(task.status)}</td>
                                        <td>${escapeHtml(task.due)}</td>
                                        <td><button class="btn btn-ghost btn-sm" onclick="openWorkspace('${project.id}','my-work')">View</button></td>
                                      </tr>
                                    `,
                                    )
                                    .join("")
                                : `
                                  <tr>
                                    <td colspan="4" class="text-sm text-muted">No active tasks are assigned to you right now.</td>
                                  </tr>
                                `
                            }
                          </tbody>
                        </table>
                        <div class="text-xs text-muted" style="margin-top:10px">Leaving the project will hand your unfinished tasks back to the owner as unassigned work.</div>
                      `
                    }
                  </div>
                `;
              })
              .join("")
          : '<div class="card mt-3"><p class="text-sm text-muted italic">No projects found for this filter.</p></div>'
      }
    `;
  }

  function leaveProject(projectId) {
    const project = PROJECTS.find((item) => item.id === projectId);
    if (!project) {
      showToast("Project not found", "error");
      return;
    }
    const currentUser = getCurrentUserName();
    const runtime = getProjectRuntime(project);
    runtime.tasks.forEach((task) => {
      if (
        task.assignee === currentUser &&
        task.status !== "Approved" &&
        task.status !== "Completed"
      ) {
        task.assignee = "Unassigned";
        task.status = "Open";
      }
    });
    project.members = (project.members || []).filter(
      (member) => member.name !== currentUser,
    );
    project.collaborators = project.members.length;
    const currentUserEmail =
      typeof getCurrentUserSessionEmail === "function"
        ? getCurrentUserSessionEmail()
        : "";
    const leftAt = getLiveTimestamp();
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    if (currentUserEmail && users[currentUserEmail]) {
      users[currentUserEmail].data = ensureStateUserDataShape(users[currentUserEmail].data);
      removeUserProject(users[currentUserEmail], project.id);
      const ownerEmail = getProjectOwnerEmail(project, users);
      if (ownerEmail && users[ownerEmail]) {
        pushUserNotification(users[ownerEmail], {
          type: "LEAVE",
          message: `${currentUser} left ${project.name}.`,
          projectId: project.id,
          from: currentUserEmail,
          status: "left",
          timestamp: leftAt,
          icon: "↩️",
          title: "Member Left",
          desc: `${currentUser} left ${project.name}.`,
          time: leftAt,
        });
      }
      if (typeof saveStateUsersStore === "function") {
        saveStateUsersStore(users);
      }
    }
    APPLIED.forEach((item) => {
      if (
        item.project === project.name &&
        item.owner === project.owner &&
        isAppliedEntryForCurrentUser(item)
      ) {
        item.status = "Left";
      }
    });
    pushNotification({
      roleScope: ["collaborator"],
      icon: "↩️",
      title: "Project Left",
      desc: `You left ${project.name}. Your historical contributions remain visible.`,
    });
    renderMyWork();
    renderApplied();
    renderProjects();
    renderNotifications();
    persistReview2Runtime();
    if (STATE.selectedProject === projectId) {
      STATE.selectedProject = "";
      STATE.workspaceMode = "";
      navigate("my-work");
    }
    showToast(`You left ${project.name}`);
  }

  function renderApplied() {
    refreshSharedReview2Runtime();
    const root = document.getElementById("applied-list");
    if (!root) return;
    const currentUser = getCurrentUserName();
    const currentUsername = String(STATE.userProfile?.username || "")
      .trim()
      .toLowerCase();
    const normalizeUserKey = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const currentUserKeys = new Set(
      [currentUser, currentUsername, STATE.userProfile?.fullName]
        .map((value) => normalizeUserKey(value))
        .filter(Boolean),
    );
    const visibleEntries = APPLIED.filter(
      (item) => isAppliedEntryForCurrentUser(item),
    );
    root.innerHTML = visibleEntries.length
      ? visibleEntries
          .map((item) => {
            const cls =
              item.status === "Approved" || item.status === "Completed"
                ? "badge-success"
                : item.status === "Pending" || item.status === "Invited"
                  ? "badge-warning"
                : "badge-destructive";
            const actionHtml =
              item.status === "Invited" &&
              currentUserKeys.has(normalizeUserKey(item.invitedUser))
                ? `
                  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                    <button class="btn btn-primary btn-sm" onclick="acceptOwnerInvite('${item.projectId}')">Accept</button>
                    <button class="btn btn-outline btn-sm" onclick="declineOwnerInvite('${item.projectId}')">Decline</button>
                  </div>
                `
                : item.status === "Pending"
                  ? `
                    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                      <span class="badge ${cls}">${escapeHtml(item.status)}</span>
                      <button class="btn btn-outline btn-sm" onclick="deleteJoinRequest('${item.projectId}')">Delete Request</button>
                    </div>
                  `
                : item.status === "Deleted"
                  ? `<span class="badge badge-outline">Request Deleted</span>`
                : `<span class="badge ${cls}">${escapeHtml(item.status)}</span>`;
            return `
              <div style="padding:12px 20px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:2fr 1fr 1fr 1fr;align-items:center;font-size:.83rem;gap:12px">
                <div>
                  <div class="font-semibold">${escapeHtml(item.project)}</div>
                  ${
                    item.invitedByOwner
                      ? `<div class="text-xs text-muted" style="margin-top:4px">Owner invited you to join this project.</div>`
                      : item.status === "Deleted"
                        ? `<div class="text-xs text-muted" style="margin-top:4px">Status: Request Deleted${item.deletedOn ? ` | Deleted ${escapeHtml(item.deletedOn)}` : ""}</div>`
                      : ""
                  }
                </div>
                <span class="text-muted">${escapeHtml(item.owner)}</span>
                <span class="text-muted">${escapeHtml(item.applied)}</span>
                <span style="justify-self:start;display:inline-flex;align-items:center;min-height:32px">
                  ${actionHtml}
                </span>
              </div>
            `;
          })
          .join("")
      : '<div style="padding:16px 20px" class="text-sm text-muted italic">No project applications or invites found.</div>';
  }

  function deleteJoinRequest(projectId) {
    const project = PROJECTS.find((item) => item.id === projectId);
    const runtime = getProjectRuntime(project);
    const currentUser = getCurrentUserName();
    const currentUserEmail =
      typeof getCurrentUserSessionEmail === "function"
        ? getCurrentUserSessionEmail()
        : "";
    if (!project || !runtime || project.owner === currentUser) {
      showToast("Only collaborators can delete their join request", "error");
      return;
    }
    const request = runtime.joinRequests.find(
      (item) =>
        (item.name === currentUser ||
          String(item.email || item.from || "").trim().toLowerCase() === currentUserEmail) &&
        String(item.status || "").trim().toLowerCase() === "pending",
    );
    if (!request) {
      showToast("No pending join request found", "error");
      return;
    }

    runtime.joinRequests = runtime.joinRequests.filter((item) => item !== request);
    let deletedEntryUpdated = false;
    for (let index = APPLIED.length - 1; index >= 0; index -= 1) {
      const item = APPLIED[index];
      if (
        (item.projectId === project.id ||
          (item.project === project.name && item.owner === project.owner)) &&
        (!item.requester ||
          String(item.requester || "").trim().toLowerCase() === currentUserEmail) &&
        String(item.status || "").trim().toLowerCase() === "pending"
      ) {
        item.status = "Deleted";
        item.deletedOn = getLiveTimestamp();
        deletedEntryUpdated = true;
      }
    }
    if (!deletedEntryUpdated) {
      APPLIED.unshift({
        projectId: project.id,
        project: project.name,
        owner: project.owner,
        requester: currentUserEmail,
        applied: request.requestedOn || getLiveTimestamp(),
        status: "Deleted",
        deletedOn: getLiveTimestamp(),
      });
    }

    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    const ownerEmail = getProjectOwnerEmail(project, users);
    if (ownerEmail && users[ownerEmail]) {
      users[ownerEmail].data = ensureStateUserDataShape(users[ownerEmail].data);
      users[ownerEmail].data.requests = users[ownerEmail].data.requests.filter(
        (item) =>
          !(
            item.projectId === project.id &&
            String(item.from || "").trim().toLowerCase() === currentUserEmail
          ),
      );
      users[ownerEmail].data.notifications = users[ownerEmail].data.notifications.filter(
        (notification) =>
          !(
            String(notification.projectId || "").trim() === String(project.id).trim() &&
            String(notification.from || "").trim().toLowerCase() === currentUserEmail &&
            String(notification.type || "").trim().toUpperCase() === "JOIN_REQUEST" &&
            String(notification.status || "").trim().toLowerCase() === "pending"
          ),
      );
    }
    if (typeof saveStateUsersStore === "function") {
      saveStateUsersStore(users);
    }

    persistReview2Runtime();
    renderApplied();
    renderProjectWorkspace();
    renderNotifications();
    renderDashboard?.();
    showToast("Join request deleted");
  }

  function canAccessCollaboratorProject(project) {
    const currentUser = getCurrentUserName();
    const currentUserData =
      typeof getCurrentUserData === "function" ? getCurrentUserData() : null;
    getProjectRuntime(project);
    const isMember = Array.isArray(project.members)
      ? project.members.some((member) => member.name === currentUser)
      : false;
    const hasApprovedEntry = APPLIED.some(
      (item) =>
        isAppliedEntryForCurrentUser(item) &&
        (item.projectId === project.id ||
          (item.project === project.name && item.owner === project.owner)) &&
        (item.status === "Approved" || item.status === "Completed"),
    );
    const hasStoredAccess = userHasProjectAccess(currentUserData, project.id);
    return project.owner !== currentUser && (isMember || hasApprovedEntry || hasStoredAccess);
  }

  function renderProjects() {
    refreshSharedReview2Runtime();
    if (STATE.role !== "collaborator") {
      if (typeof window.filterProjects === "function") {
        const projSearchInput = document.getElementById("proj-search");
        if (projSearchInput && !projSearchInput.value.trim()) {
          projSearchInput.value = "";
        }
      }
      const recommendedRoot = document.getElementById("proj-recommended-cards");
      const allRoot = document.getElementById("proj-all-cards");
      if (!recommendedRoot || !allRoot) return;
      recommendedRoot.innerHTML = PROJECTS.slice(0, 2)
        .map((project) => projectCardHTML(project, "openWorkspace", "projects"))
        .join("");
      allRoot.innerHTML = PROJECTS.slice(2)
        .map((project) => projectCardHTML(project, "openWorkspace", "projects"))
        .join("");
      bindProjectCardClicks();
      return;
    }

    const recommendedRoot = document.getElementById("proj-recommended-cards");
    const allRoot = document.getElementById("proj-all-cards");
    const label = document.getElementById("proj-section-label");
    const recommendedBlock = document.getElementById("proj-recommended");
    const projSearchInput = document.getElementById("proj-search");
    if (!recommendedRoot || !allRoot || !label || !recommendedBlock) return;

    const renderCard = (project) =>
      projectCardHTML(
        project,
        canAccessCollaboratorProject(project)
          ? "openWorkspace"
          : "openCollaboratorProjectPreview",
        "projects",
      );

    const query = String(projSearchInput?.value || "").trim().toLowerCase();
    if (!query) {
      recommendedBlock.style.display = "";
      label.textContent = "All Projects";
      recommendedRoot.innerHTML = PROJECTS.slice(0, 2).map(renderCard).join("");
      allRoot.innerHTML = PROJECTS.slice(2).map(renderCard).join("");
      bindProjectCardClicks();
      return;
    }

    recommendedBlock.style.display = "none";
    const filtered = PROJECTS.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.desc.toLowerCase().includes(query) ||
        project.owner.toLowerCase().includes(query) ||
        project.skills.some((skill) => skill.toLowerCase().includes(query)),
    );
    label.textContent = `Results (${filtered.length})`;
    allRoot.innerHTML = filtered.length
      ? filtered.map(renderCard).join("")
      : '<p class="text-sm text-muted italic">No projects match your search.</p>';
    bindProjectCardClicks();
  }

  function filterProjects() {
    renderProjects();
  }

  function resolveUserByUsername(username) {
    return resolveUserIdentifier(username);
  }

  function renderContributionSummary(projectId) {
    const project = PROJECTS.find((item) => item.id === projectId);
    if (!project) return;
    const runtime = getProjectRuntime(project);
    const summary = getMyWorkCompletedSummary(project);
    const currentUser = getCurrentUserName();
    const myContributions = runtime.contributionHistory.filter(
      (item) => item.by === currentUser,
    );
    const modal = document.getElementById("modal-contribution-summary");
    const title = document.getElementById("contribution-summary-title");
    const content = document.getElementById("contribution-summary-content");
    if (!modal || !title || !content) return;

    title.textContent = `${project.name} Summary`;
    content.innerHTML = `
      <div class="summary-grid">
        <div class="summary-stat"><span>XP Earned</span><strong>+${summary.xpEarned}</strong></div>
        <div class="summary-stat"><span>Reputation</span><strong>+${summary.repGained}</strong></div>
        <div class="summary-stat"><span>Task Completion</span><strong>${summary.tasksCompleted}/${summary.totalTasks}</strong></div>
      </div>
      <div class="workspace-summary-box">
        <div class="workspace-summary-box__title">Project Details</div>
        <p>${escapeHtml(project.desc || "Project details unavailable.")}</p>
      </div>
      <div class="workspace-summary-box">
        <div class="workspace-summary-box__title">Work Done By You</div>
        ${
          myContributions.length
            ? myContributions
                .map(
                  (item) => `<div class="summary-line"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.summary)}</span></div>`,
                )
                .join("")
            : `<p>${escapeHtml(summary.contribution)}</p>`
        }
      </div>
      <div class="workspace-summary-box">
        <div class="workspace-summary-box__title">Finished Project Link</div>
        ${
          runtime.finishedLink
            ? `<a class="workspace-link" href="${escapeHtml(runtime.finishedLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(runtime.finishedLink)} ↗</a>`
            : `<p class="text-sm text-muted">The owner has not published the final project link yet.</p>`
        }
      </div>
    `;
    modal.classList.add("open");
  }

  function openContributionSummary(projectId) {
    renderContributionSummary(projectId);
  }

  function acceptOwnerInvite(projectId) {
    const project = PROJECTS.find((item) => item.id === projectId);
    const runtime = getProjectRuntime(project);
    const currentUser = getCurrentUserName();
    const currentUserEmail =
      typeof getCurrentUserSessionEmail === "function"
        ? getCurrentUserSessionEmail()
        : "";
    const normalizeUserKey = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const currentUserKeys = new Set(
      [currentUser, STATE.userProfile?.fullName, STATE.userProfile?.username]
        .map((value) => normalizeUserKey(value))
        .filter(Boolean),
    );
    if (!project || !runtime) return;
    const invite = APPLIED.find(
      (item) =>
        item.projectId === projectId &&
        (
          currentUserKeys.has(normalizeUserKey(item.invitedUser)) ||
          item.invitedEmail === currentUserEmail
        ) &&
        item.status === "Invited",
    );
    if (!invite) {
      showToast("Invite not found", "error");
      return;
    }
    invite.status = "Approved";
    const runtimeInvite = ensureRuntimeInvites(runtime).find(
      (item) => item.toEmail === currentUserEmail && item.status === "pending",
    );
    if (runtimeInvite) runtimeInvite.status = "accepted";
    if (!project.members.some((member) => member.name === currentUser)) {
      project.members.push({
        name: currentUser,
        initials: getInitialsFromName(currentUser),
        role: "Collaborator",
      });
      project.collaborators = project.members.length;
    }
    const targetTaskId = invite.taskId || runtimeInvite?.taskId || "";
    const targetTask =
      runtime.tasks.find((task) => task.id === targetTaskId) ||
      runtime.tasks.find((task) => !task.assignee || task.assignee === "Unassigned");
    if (!targetTask) {
      runtime.tasks.unshift({
        id: `task-${Date.now()}`,
        title: `Welcome Task for ${currentUser}`,
        assignee: currentUser,
        status: "Open",
        due: "Next week",
        priority: "Medium",
        proofLink: "",
      });
    } else if (targetTask.assignee === "Unassigned" || !targetTask.assignee) {
      targetTask.assignee = currentUser;
    }
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    if (currentUserEmail && users[currentUserEmail]) {
      users[currentUserEmail].data = ensureStateUserDataShape(users[currentUserEmail].data);
      upsertUserProject(users[currentUserEmail], buildUserProjectSnapshot(project, users));
      pushUserNotification(users[currentUserEmail], {
        type: "INVITE",
        message: targetTask
          ? `You joined ${project.name} and "${targetTask.title}" was assigned to you.`
          : `You joined ${project.name}.`,
        projectId: project.id,
        from: getProjectOwnerEmail(project, users),
        status: "accepted",
        timestamp: CURRENT_DATE,
        icon: "✅",
        title: "Invitation Accepted",
        desc: targetTask
          ? `You joined ${project.name} and "${targetTask.title}" was assigned to you.`
          : `You joined ${project.name}.`,
        time: CURRENT_DATE,
      });
      updateMatchingNotifications(
        users[currentUserEmail],
        (notification) =>
          notification.type === "INVITE" &&
          notification.projectId === project.id &&
          notification.status === "pending",
        {
          status: "accepted",
          unread: false,
          time: getLiveTimestamp(),
          timestamp: getLiveTimestamp(),
        },
      );
      if (typeof saveStateUsersStore === "function") {
        saveStateUsersStore(users);
      }
    }
    renderApplied();
    renderMyWork();
    renderProjects();
    renderNotifications();
    persistReview2Runtime();
    showToast(`You joined ${project.name}`);
  }

  function declineOwnerInvite(projectId) {
    const currentUser = getCurrentUserName();
    const currentUserEmail =
      typeof getCurrentUserSessionEmail === "function"
        ? getCurrentUserSessionEmail()
        : "";
    const project = PROJECTS.find((item) => item.id === projectId);
    const runtime = getProjectRuntime(project);
    const normalizeUserKey = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const currentUserKeys = new Set(
      [currentUser, STATE.userProfile?.fullName, STATE.userProfile?.username]
        .map((value) => normalizeUserKey(value))
        .filter(Boolean),
    );
    const invite = APPLIED.find(
      (item) =>
        item.projectId === projectId &&
        (
          currentUserKeys.has(normalizeUserKey(item.invitedUser)) ||
          item.invitedEmail === currentUserEmail
        ) &&
        item.status === "Invited",
    );
    if (!invite) {
      showToast("Invite not found", "error");
      return;
    }
    invite.status = "Rejected";
    if (runtime) {
      const runtimeInvite = ensureRuntimeInvites(runtime).find(
        (item) => item.toEmail === currentUserEmail && item.status === "pending",
      );
      if (runtimeInvite) {
        runtimeInvite.status = "rejected";
      }
    }
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    if (currentUserEmail && users[currentUserEmail]) {
      users[currentUserEmail].data = ensureStateUserDataShape(users[currentUserEmail].data);
      updateMatchingNotifications(
        users[currentUserEmail],
        (notification) =>
          notification.type === "INVITE" &&
          notification.projectId === projectId &&
          notification.status === "pending",
        {
          status: "rejected",
          unread: false,
          time: getLiveTimestamp(),
          timestamp: getLiveTimestamp(),
        },
      );
      saveStateUsersStore(users);
    }
    renderApplied();
    renderProjects();
    renderNotifications();
    persistReview2Runtime();
    showToast(`Invite declined for ${project?.name || "project"}`);
  }

  function openProjectFromHistory(projectId) {
    const project = PROJECTS.find((item) => item.id === projectId);
    if (!project) {
      showToast("Project not found", "error");
      return;
    }
    if (project.owner === getCurrentUserName()) {
      openOwnedProject(projectId);
      return;
    }
    openWorkspace(projectId, "dashboard");
  }

  function getMyWorkCompletedSummary(project) {
    const runtime = getProjectRuntime(project);
    const currentUser = getCurrentUserName();
    const myTasks = runtime.tasks.filter((task) => task.assignee === currentUser);
    return {
      xpEarned: Math.max(40, myTasks.length * 45),
      repGained: Math.max(6, myTasks.length * 4),
      tasksCompleted: myTasks.filter((task) => task.status === "Approved").length,
      totalTasks: Math.max(1, myTasks.length),
      contribution:
        runtime.contributionHistory.find((item) => item.by === currentUser)
          ?.summary || `Delivered assigned work across ${project.name}.`,
    };
  }

  function renderMyProjects() {
    refreshSharedReview2Runtime();
    STATE.ownedProjectsView = "my-projects";
    const root = document.getElementById("page-my-projects");
    if (!root) return;
    ensureReview2State();
    const currentUser = getCurrentUserName();
    const projects = PROJECTS.filter((project) => project.owner === currentUser);
    const ongoing = projects.filter((project) => !project.isCompleted);
    const completed = projects.filter((project) => project.isCompleted);
    const filter = STATE.review2.ownerProjectsFilter || "ongoing";
    const visibleProjects = filter === "completed" ? completed : ongoing;

    root.innerHTML = `
      <h1>My Projects</h1>
      <p class="page-subtitle">Projects you own and manage, with quick access to live delivery and final outcomes.</p>
      <div class="section-stack mt-3">
        <div class="owner-projects-summary">
          <div class="owner-projects-summary__card">
            <span class="owner-projects-summary__label">Total Owned</span>
            <strong>${projects.length}</strong>
          </div>
          <div class="owner-projects-summary__card">
            <span class="owner-projects-summary__label">Active</span>
            <strong>${ongoing.length}</strong>
          </div>
          <div class="owner-projects-summary__card">
            <span class="owner-projects-summary__label">Completed</span>
            <strong>${completed.length}</strong>
          </div>
        </div>
        <div class="segmented-switch">
          <button class="segmented-switch__btn ${filter === "ongoing" ? "active" : ""}" onclick="setOwnerProjectsFilter('ongoing')">Ongoing (${ongoing.length})</button>
          <button class="segmented-switch__btn ${filter === "completed" ? "active" : ""}" onclick="setOwnerProjectsFilter('completed')">Completed (${completed.length})</button>
        </div>
        <div class="card">
          <div class="card-title">${filter === "completed" ? `Completed Projects (${completed.length})` : `Ongoing Projects (${ongoing.length})`}</div>
          ${
            visibleProjects.length
              ? visibleProjects
                  .map((project) => {
                    const runtime = getProjectRuntime(project);
                    const mentor = getProjectMentor(project);
                    const approvedTasks = runtime.tasks.filter(
                      (task) => task.status === "Approved",
                    ).length;
                    const isCompletedView = filter === "completed";
                    return `
                    <article class="owner-project-card ${isCompletedView ? "owner-project-card--completed" : ""}">
                      <div class="owner-project-card__top">
                        <div>
                          <div class="workspace-project-row__title">${escapeHtml(project.name)}</div>
                          <div class="workspace-project-row__meta">${escapeHtml(project.desc || "No description added yet.")}</div>
                        </div>
                        <span class="badge ${isCompletedView ? "badge-success" : "badge-secondary"}">${isCompletedView ? "Completed" : "Active"}</span>
                      </div>
                      <div class="progress-container owner-project-card__progress"><div class="progress-fill" style="width:${Number(project.progress) || 0}%"></div></div>
                      <div class="owner-project-card__meta">
                        <span>${Number(project.progress) || 0}% progress</span>
                        <span>${project.members.length} members</span>
                        <span>${isCompletedView ? `${approvedTasks} approved task${approvedTasks === 1 ? "" : "s"}` : `${runtime.tasks.length} task${runtime.tasks.length === 1 ? "" : "s"}`}</span>
                        <span>${isCompletedView ? (runtime.finishedPublishedAt || "Completed") : (mentor ? `Mentor: ${mentor.name} (${mentor.status})` : "No mentor assigned")}</span>
                      </div>
                      <div class="project-skills owner-project-card__skills">
                        ${project.skills.map((skill) => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join("")}
                      </div>
                      ${
                        isCompletedView
                          ? runtime.finishedLink
                            ? `<a class="workspace-link" href="${escapeHtml(runtime.finishedLink)}" target="_blank" rel="noopener noreferrer">Open final delivery ↗</a>`
                            : '<span class="text-xs text-muted">Publish the final link from workspace after all tasks are completed.</span>'
                          : ""
                      }
                      <div class="workspace-card__actions">
                        ${
                          isCompletedView
                            ? `<button class="btn btn-outline btn-sm" onclick="openOwnedSummary('${project.id}')">Summary</button>
                               <button class="btn btn-ghost btn-sm" onclick="openOwnedProject('${project.id}')">Workspace</button>
                               <button class="btn btn-ghost btn-sm" onclick="deleteOwnedProject('${project.id}')">Delete</button>`
                            : `<button class="btn btn-primary btn-sm" onclick="openOwnedProject('${project.id}')">Open Workspace</button>
                               <button class="btn btn-ghost btn-sm" onclick="deleteOwnedProject('${project.id}')">Delete</button>`
                        }
                      </div>
                    </article>
                  `;
                  })
                  .join("")
              : `<p class="text-sm text-muted italic">No ${filter} projects right now.</p>`
          }
        </div>
      </div>
    `;
  }

  function openOwnedProject(projectId) {
    const project = PROJECTS.find((item) => item.id === projectId);
    if (!project) {
      showToast("Project not found", "error");
      return;
    }
    STATE.selectedProject = projectId;
    STATE.workspaceMode = "owned";
    STATE.ownedWorkspaceTab = "overview";
    if (typeof saveViewState === "function") saveViewState();
    navigate("project-workspace");
  }

  function setOwnedWorkspaceTab(tab) {
    STATE.ownedWorkspaceTab = tab;
    if (typeof saveViewState === "function") saveViewState();
    renderProjectWorkspace();
  }

  function runtimeJoinableMembers(project) {
    const members = Array.isArray(project.members) ? project.members : [];
    const uniqueMembers = members.filter(
      (member, index, arr) =>
        member &&
        member.name &&
        arr.findIndex((item) => item?.name === member.name) === index,
    );
    const ownerName = String(project?.owner || "").trim();
    return uniqueMembers.filter(
      (member) =>
        member.name !== ownerName &&
        String(member.role || "").trim().toLowerCase() !== "mentor",
    );
  }

  function renderOwnedProjectWorkspace() {
    const project = PROJECTS.find((item) => item.id === STATE.selectedProject);
    const root = document.getElementById("page-project-workspace");
    if (!root || !project) return;
    const runtime = getProjectRuntime(project);
    const tab = STATE.ownedWorkspaceTab || "overview";
    const mentor = getProjectMentor(project);

    root.innerHTML = `
      <div class="workspace-shell">
        <div class="component" onclick="navigate('my-projects')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12.6673 8H3.33398" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="text">Back to My Projects</div>
        </div>
        <div class="card workspace-hero">
          <div>
            <div class="workspace-hero__title-row">
              <h1>${escapeHtml(project.name)}</h1>
              <span class="badge badge-secondary">Owner</span>
              ${project.isCompleted ? '<span class="badge badge-success">Completed</span>' : ""}
            </div>
            <p class="text-muted">${escapeHtml(project.desc)}</p>
            <div class="project-skills" style="margin-top:12px">${project.skills
              .map((skill) => `<span class="skill-tag">${escapeHtml(skill)}</span>`)
              .join("")}</div>
          </div>
          <div class="workspace-hero__meta">
            <div class="workspace-hero__metric">${Number(project.progress) || 0}%</div>
            <div class="text-xs text-muted">Progress</div>
          </div>
        </div>
        <div class="tabs workspace-tabs">
          <button class="tab ${tab === "overview" ? "active" : ""}" onclick="setOwnedWorkspaceTab('overview')">Overview</button>
          <button class="tab ${tab === "tasks" ? "active" : ""}" onclick="setOwnedWorkspaceTab('tasks')">Tasks</button>
          <button class="tab ${tab === "members" ? "active" : ""}" onclick="setOwnedWorkspaceTab('members')">Members</button>
          <button class="tab ${tab === "requests" ? "active" : ""}" onclick="setOwnedWorkspaceTab('requests')">Requests</button>
          <button class="tab ${tab === "mentors" ? "active" : ""}" onclick="setOwnedWorkspaceTab('mentors')">Mentor</button>
          <button class="tab ${tab === "chat" ? "active" : ""}" onclick="setOwnedWorkspaceTab('chat')">Chat</button>
        </div>
        ${renderOwnedWorkspaceTab(project, runtime, mentor, tab)}
      </div>
    `;
  }

  function renderOwnedWorkspaceTab(project, runtime, mentor, tab) {
    if (tab === "tasks") {
      const publishBox =
        !project.isCompleted && allTasksApproved(runtime)
          ? `
            <div class="workspace-summary-box mt-3">
              <div class="workspace-summary-box__title">Submit Final Project Link</div>
              <p class="text-sm text-muted" style="margin-bottom:12px">All tasks are approved. Submitting the final link will permanently mark this project as completed.</p>
              <div class="workspace-inline-form">
                <input id="finished-project-link" class="input" type="url" placeholder="https://your-final-project-link" value="${escapeHtml(runtime.finishedLink || "")}" />
                <button class="btn btn-primary" onclick="publishFinishedProjectLink('${project.id}')">Submit Final Link</button>
              </div>
            </div>
          `
          : "";
      return `
        <div class="card">
          <div class="workspace-card__top">
            <div class="card-title" style="margin:0">Task Board</div>
            <button class="btn btn-primary btn-sm" onclick="openOwnedTaskModal()">Create Task</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Assignee</th>
                <th>Status</th>
                <th>Difficulty</th>
                <th>Proof</th>
                <th>Due</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${runtime.tasks
                .map((task, index) => {
                  const canReview = task.status === "In Review" || task.status === "submitted";
                  const isAssignedToMe = task.assignee === getCurrentUserName();
                  const canStart = task.status === "Open" && isAssignedToMe;
                  const canSubmit = task.status === "In Progress" && isAssignedToMe;

                  let actionHtml = "";
                  if (canReview) {
                    actionHtml = `
                      <div class="workspace-card__actions">
                        <button class="btn btn-primary btn-sm" onclick="approveOwnedTask(${index})">Approve</button>
                        <button class="btn btn-outline btn-sm" onclick="rejectOwnedTask(${index})">Reject</button>
                        <button class="btn btn-ghost btn-sm" onclick="deleteOwnedTask(${index})">Delete</button>
                        ${
                          task.proofLink
                            ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(task.proofLink)}" target="_blank" rel="noopener noreferrer">View Proof</a>`
                            : ""
                        }
                      </div>
                    `;
                  } else if (canStart) {
                    actionHtml = `<div class="workspace-card__actions"><button class="btn btn-outline btn-sm" onclick="startCollaboratorTask(${index})">Start Work</button><button class="btn btn-ghost btn-sm" onclick="deleteOwnedTask(${index})">Delete</button></div>`;
                  } else if (canSubmit) {
                    actionHtml = `<div class="workspace-card__actions"><button class="btn btn-primary btn-sm" onclick="openCollaboratorSubmitModal(${index})">Submit Proof</button><button class="btn btn-ghost btn-sm" onclick="deleteOwnedTask(${index})">Delete</button></div>`;
                  } else {
                    actionHtml = task.proofLink
                      ? `<a class="workspace-link" href="${escapeHtml(task.proofLink)}" target="_blank" rel="noopener noreferrer">Proof Link ↗</a>`
                      : '<span class="text-xs text-muted">No action</span>';
                  }
                  if (!canReview && !canStart && !canSubmit) {
                    actionHtml = `<div class="workspace-card__actions">${actionHtml}<button class="btn btn-ghost btn-sm" onclick="deleteOwnedTask(${index})">Delete</button></div>`;
                  }
                  return `
                    <tr>
                      <td>${escapeHtml(task.title)}</td>
                      <td>
                        ${
                          (!task.assignee || task.assignee === "Unassigned")
                            ? `<select class="input input-sm" style="max-width: 140px; padding: 4px;" onchange="assignTaskFromDropdown('${project.id}', ${index}, this.value)">
                                 <option value="">Assign to...</option>
                                 <option value="${escapeHtml(project.owner)}">${escapeHtml(project.owner)} (Owner)</option>
                                 ${runtimeJoinableMembers(project).map((member) => `<option value="${escapeHtml(member.name)}">${escapeHtml(member.name)}</option>`).join("")}
                               </select>`
                            : escapeHtml(task.assignee)
                        }
                      </td>
                      <td>${collaboratorStatusPill(task.status)}</td>
                      <td>${taskDifficultyPill(task.priority)}</td>
                      <td>${taskProofLinkHtml(task, true)}</td>
                      <td>${escapeHtml(task.due)}</td>
                      <td>${actionHtml}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
          ${publishBox}
        </div>
        ${renderOwnedTaskModal(project, runtime)}
        ${typeof renderCollaboratorSubmitModal === 'function' ? renderCollaboratorSubmitModal(runtime) : ""}
      `;
    }

    if (tab === "members") {
      return `
        <div class="card">
          <div class="card-title">Members</div>
          <div class="workspace-member-list">
            ${runtimeJoinableMembers(project)
              .map((member) => {
                const encodedKey = `${project.id}:${member.name}`;
                return `
                  <div class="workspace-member-row">
                    <div class="workspace-member-row__info">
                      <div class="workspace-member-avatar">${escapeHtml(member.initials || getInitialsFromName(member.name))}</div>
                      <div>
                        <div class="font-semibold text-sm">${escapeHtml(member.name)}</div>
                        <div class="text-xs text-muted">${escapeHtml(member.role || "Collaborator")}</div>
                      </div>
                    </div>
                    ${
                      member.role === "Owner"
                        ? '<span class="badge badge-secondary">Owner</span>'
                        : `
                          <div class="workspace-member-menu">
                            <button type="button" class="btn btn-ghost btn-sm" onclick="toggleOwnerMemberMenu('${encodedKey}', event)">⋯</button>
                            ${
                              STATE.review2.ownerMemberMenu === encodedKey
                                ? `
                                  <div class="workspace-pop-menu" onclick="event.stopPropagation()">
                                    <button type="button" class="workspace-pop-menu__item" onclick="openAssignTaskModal('${project.id}','${member.name.replace(/'/g, "\\'")}', event)">Assign Task</button>
                                    <button type="button" class="workspace-pop-menu__item danger" onclick="openKickMemberModal('${project.id}','${member.name.replace(/'/g, "\\'")}', event)">Remove Member</button>
                                  </div>
                                `
                                : ""
                            }
                          </div>
                        `
                    }
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    }

    if (tab === "requests") {
      const visibleRequests = runtime.joinRequests.filter(
        (request, index, arr) =>
          !request.invitedByOwner &&
          arr.findIndex(
            (item) =>
              !item.invitedByOwner &&
              (item.email || item.from || item.name) ===
                (request.email || request.from || request.name),
          ) === index,
      );
      return `
        <div class="card">
          <div class="card-title">Join Requests</div>
          ${
            visibleRequests.length
              ? visibleRequests
                  .map(
                    (request) => `
                      <div class="workspace-request-row">
                        <div>
                          <div class="font-semibold text-sm">${escapeHtml(request.name)}</div>
                          <div class="text-xs text-muted">${escapeHtml(request.message)} · ${escapeHtml(request.requestedOn)}</div>
                        </div>
                        <div class="workspace-card__actions">
                          ${
                            request.status === "pending"
                              ? `
                                <button class="btn btn-primary btn-sm" onclick="handleJoinRequest('${project.id}','${request.id}','approve')">Approve</button>
                                <button class="btn btn-outline btn-sm" onclick="handleJoinRequest('${project.id}','${request.id}','reject')">Reject</button>
                              `
                              : `<span class="badge ${(request.status === "approved" || request.status === "accepted") ? "badge-success" : "badge-warning"}">${escapeHtml(request.status === "accepted" ? "approved" : request.status)}</span>`
                          }
                        </div>
                      </div>
                    `,
                  )
                  .join("")
              : '<p class="text-sm text-muted italic">No pending collaborator requests.</p>'
          }
        </div>
      `;
    }

    if (tab === "mentors") {
      const mentorRequest = runtime?.mentorRequest || null;
      const deletedMentorRequest = runtime?.mentorRequestDeleted || null;
      const mentorStatus = String(mentorRequest?.status || "").toLowerCase();
      const mentorStatusBadge =
        mentorStatus === "approved"
          ? "badge-success"
          : mentorStatus === "declined"
            ? "badge-destructive"
            : "badge-warning";
      const mentorStatusLabel =
        mentorStatus === "requested"
          ? "Pending"
          : mentorStatus || "Pending";
      return `
        <div class="card">
          <div class="card-title">Mentor</div>
          ${
            mentor || mentorRequest
              ? `
                <div class="workspace-request-row">
                  <div>
                    <div class="font-semibold text-sm">${escapeHtml(mentor?.name || mentorRequest?.requestedName || "Requested Mentor")}</div>
                    <div class="text-xs text-muted">${escapeHtml(mentor?.title || "Platform Mentor")}${mentor?.uni ? ` | ${escapeHtml(mentor.uni)}` : ""}</div>
                    <div class="text-xs text-muted">Status: ${escapeHtml(mentorStatusLabel)}${mentorRequest?.requestedOn ? ` | Requested ${escapeHtml(mentorRequest.requestedOn)}` : ""}${mentorRequest?.approvedOn ? ` | Accepted ${escapeHtml(mentorRequest.approvedOn)}` : ""}${mentorRequest?.declinedOn ? ` | Rejected ${escapeHtml(mentorRequest.declinedOn)}` : ""}</div>
                  </div>
                  ${
                    mentorStatus === "approved"
                      ? `<button class="btn btn-outline btn-sm" onclick="removeProjectMentor('${project.id}')">Remove Mentor</button>`
                      : isPendingMentorRequestStatus(mentorStatus)
                        ? `<div class="workspace-card__actions"><span class="badge ${mentorStatusBadge}">${escapeHtml(mentorStatusLabel)}</span><button class="btn btn-outline btn-sm" onclick="deleteMentorRequest('${project.id}')">Delete Request</button></div>`
                        : `<span class="badge ${mentorStatusBadge}">${escapeHtml(mentorStatusLabel)}</span>`
                  }
                </div>
              `
              : `
                ${
                  deletedMentorRequest
                    ? `
                      <div class="workspace-request-row">
                        <div>
                          <div class="font-semibold text-sm">${escapeHtml(deletedMentorRequest.requestedName || "Requested Mentor")}</div>
                          <div class="text-xs text-muted">Status: Request Deleted${deletedMentorRequest.deletedOn ? ` | Deleted ${escapeHtml(deletedMentorRequest.deletedOn)}` : ""}</div>
                        </div>
                        <span class="badge badge-outline">Request Deleted</span>
                      </div>
                    `
                    : `<p class="text-sm text-muted">No mentor is attached yet. Use the Mentors page to send a request. Only one mentor can be assigned at a time.</p>`
                }
              `
          }
        </div>
      `;
    }

    if (tab === "chat") {
      return renderWorkspaceChat(project, runtime.chat, false);
    }

    return `
      <div class="stat-grid" style="margin-top:0">
        <div class="stat-card"><div class="stat-value">${runtime.tasks.length}</div><div class="stat-label">Tasks</div></div>
        <div class="stat-card"><div class="stat-value">${runtimeJoinableMembers(project).length}</div><div class="stat-label">Members</div></div>
        <div class="stat-card"><div class="stat-value">${runtime.joinRequests.filter((item) => item.status === "pending").length}</div><div class="stat-label">Pending Requests</div></div>
        <div class="stat-card"><div class="stat-value">${mentor ? (mentor.status === "approved" ? "1" : "Req") : "0"}</div><div class="stat-label">Mentor</div></div>
      </div>
      <div class="card">
        <div class="workspace-card__top">
          <div class="card-title" style="margin:0">Project Controls</div>
          <button class="btn btn-ghost btn-sm" onclick="deleteOwnedProject('${project.id}')">Delete Project</button>
        </div>
        <p class="text-sm text-muted">Deleting a project removes it from your workspace and clears related collaborator applications and invites.</p>
      </div>
      <div class="card">
        <div class="card-title">Project Health</div>
        <div class="workspace-summary-box">
          <div class="workspace-summary-box__title">Completion status</div>
          <p>${allTasksApproved(runtime) ? "All tasks are approved. Publish the final link from the Tasks tab to mark the project as completed." : "Complete and approve every task before publishing the final project link."}</p>
        </div>
      </div>
    `;
  }

  function toggleOwnerMemberMenu(encodedKey, event) {
    if (event?.stopPropagation) event.stopPropagation();
    ensureReview2State();
    STATE.review2.ownerMemberMenu =
      STATE.review2.ownerMemberMenu === encodedKey ? "" : encodedKey;
    renderProjectWorkspace();
  }

  function openAssignTaskModal(projectId, memberName, event) {
    if (event?.stopPropagation) event.stopPropagation();
    ensureReview2State();
    const project = PROJECTS.find((item) => item.id === projectId);
    const runtime = getProjectRuntime(project);
    if (!project || !runtime) return;
    STATE.review2.pendingAssignment = { projectId, memberName };
    STATE.review2.ownerMemberMenu = "";
    const modal = document.getElementById("assign-task-modal");
    const select = document.getElementById("assign-task-select");
    const unassignedTasks = runtime.tasks.filter(
      (task) => task.assignee === "Unassigned",
    );
    if (select) {
      select.innerHTML = unassignedTasks.length
        ? unassignedTasks
            .map(
              (task) => `
                <option value="${escapeHtml(task.id)}">${escapeHtml(task.title)} · ${escapeHtml(task.due || "No deadline")} · ${escapeHtml(task.status || "Open")}</option>
              `,
            )
            .join("")
        : '<option value="">No unassigned tasks available</option>';
    }
    if (modal) modal.classList.add("open");
  }

  function closeAssignTaskModal(event) {
    const modal = document.getElementById("assign-task-modal");
    if (!modal) return;
    if (event && event.target !== event.currentTarget) return;
    modal.classList.remove("open");
  }

  function confirmAssignTaskSelection() {
    const { projectId, memberName } = STATE.review2.pendingAssignment || {};
    const project = PROJECTS.find((item) => item.id === projectId);
    const runtime = getProjectRuntime(project);
    const selectedTaskId = String(
      document.getElementById("assign-task-select")?.value || "",
    ).trim();
    if (!project || !runtime) return;
    if (!selectedTaskId) {
      showToast("Choose an unassigned task or create a new one", "error");
      return;
    }
    const targetTask = runtime.tasks.find((task) => task.id === selectedTaskId);
    if (!targetTask || targetTask.assignee !== "Unassigned") {
      showToast("That task is no longer available", "error");
      return;
    }
    targetTask.assignee = memberName;
    closeAssignTaskModal();
    renderProjectWorkspace();
    showToast(`${targetTask.title} assigned to ${memberName}`);
  }

  function assignTaskToMember(projectId, memberName) {
    openAssignTaskModal(projectId, memberName);
  }

  function assignTaskFromDropdown(projectId, taskIndex, memberName) {
    if (!memberName) return;
    const project = PROJECTS.find((item) => item.id === projectId);
    const runtime = getProjectRuntime(project);
    if (!project || !runtime) return;
    const task = runtime.tasks[taskIndex];
    if (task) {
      task.assignee = memberName;
      if (memberName === project.owner && !(project.members || []).some(m => m.name === memberName)) {
        project.members = project.members || [];
        project.members.push({ name: memberName, initials: getInitialsFromName(memberName), role: "Collaborator" });
        project.collaborators = project.members.length;
      }
      persistReview2Runtime();
      renderProjectWorkspace();
      showToast(`Task assigned to ${memberName}`);
    }
  }

  function openKickMemberModal(projectId, memberName, event) {
    if (event?.stopPropagation) event.stopPropagation();
    ensureOverlayMount();
    ensureReview2State();
    STATE.review2.pendingKick = {
      projectId,
      memberName,
      reason: "",
    };
    STATE.review2.ownerMemberMenu = "";
    const modal = document.getElementById("member-kick-modal");
    const input = document.getElementById("kick-member-reason");
    if (input) input.value = "";
    if (modal) modal.classList.add("open");
  }

  function closeKickMemberModal(event) {
    const modal = document.getElementById("member-kick-modal");
    if (!modal) return;
    if (event && event.target !== event.currentTarget) return;
    modal.classList.remove("open");
  }

  function confirmKickMember() {
    const { projectId, memberName } = STATE.review2.pendingKick || {};
    const input = document.getElementById("kick-member-reason");
    const reason = String(input?.value || "").trim();
    if (!reason || reason.length < 10) {
      showToast("Please share a clear removal reason", "error");
      return;
    }
    const project = PROJECTS.find((item) => item.id === projectId);
    if (!project) return;
    const runtime = getProjectRuntime(project);
    project.members = (project.members || []).filter(
      (member) => member.name !== memberName,
    );
    project.collaborators = project.members.length;
    runtime.tasks.forEach((task) => {
      if (task.assignee === memberName && task.status !== "Approved") {
        task.assignee = "Unassigned";
        task.status = "Open";
        task.proofLink = "";
      }
    });
    runtime.kickedUsers.push({
      name: memberName,
      reason,
      removedOn: CURRENT_DATE,
    });
    runtime.joinRequests = runtime.joinRequests.filter(
      (request) => request.name !== memberName,
    );
    APPLIED.forEach((item) => {
      if (item.project === project.name && item.owner === project.owner) {
        item.status = "Removed";
      }
    });
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    const removedRecord = getUserRecordByName(memberName, users);
    if (removedRecord?.user) {
      removeUserProject(removedRecord.user, project.id);
      pushUserNotification(removedRecord.user, {
        type: "REMOVED",
        message: `${project.name}: ${reason}`,
        projectId: project.id,
        from: getProjectOwnerEmail(project, users),
        status: "removed",
        timestamp: CURRENT_DATE,
        icon: "🚫",
        title: "Removed From Project",
        desc: `${project.name}: ${reason}`,
        time: CURRENT_DATE,
      });
      saveStateUsersStore(users);
    } else {
      pushNotification({
        roleScope: ["collaborator"],
        icon: "🚫",
        title: "Removed From Project",
        desc: `${project.name}: ${reason}`,
      });
    }
    closeKickMemberModal();
    persistReview2Runtime();
    renderProjectWorkspace();
    renderNotifications();
    showToast(`${memberName} removed from ${project.name}`);
  }

  function handleJoinRequest(projectId, requestId, action) {
    const project = PROJECTS.find((item) => item.id === projectId);
    const runtime = getProjectRuntime(project);
    if (!project || !runtime) return;
    const request = runtime.joinRequests.find((item) => item.id === requestId);
    if (!request) return;
    const decisionTime = getLiveTimestamp();
    request.status = action === "approve" ? "approved" : "rejected";
    const ownerEmail =
      typeof getCurrentUserSessionEmail === "function"
        ? getCurrentUserSessionEmail()
        : "";
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    if (ownerEmail && users[ownerEmail]) {
      users[ownerEmail].data = ensureStateUserDataShape(users[ownerEmail].data);
      const ownerRequest = users[ownerEmail].data.requests.find(
        (item) =>
          item.projectId === project.id &&
          item.from === (request.email || request.from || ""),
      );
      if (ownerRequest) {
        ownerRequest.status = action === "approve" ? "accepted" : "rejected";
        ownerRequest.time = decisionTime;
      }
    }

    const requesterEmail = request.email || request.from || "";
    let appliedEntry = APPLIED.find(
      (item) =>
        (item.projectId === project.id ||
          (item.project === project.name && item.owner === project.owner)) &&
        item.requester === requesterEmail,
    );
    if (!appliedEntry) {
      appliedEntry = {
        projectId: project.id,
        project: project.name,
        owner: project.owner,
        requester: requesterEmail,
        applied: decisionTime,
        status: "Pending",
      };
      APPLIED.unshift(appliedEntry);
    }
    appliedEntry.status = action === "approve" ? "Approved" : "Rejected";
    appliedEntry.applied = decisionTime;

    if (action === "approve") {
      if (!project.members.some((member) => member.name === request.name)) {
        project.members.push({
          name: request.name,
          initials: request.initials,
          role: "Collaborator",
        });
        project.collaborators = project.members.length;
      }
      pushNotification({
        roleScope: ["collaborator"],
        icon: "✅",
        title: "Request Approved",
        desc: `${request.name} was added to ${project.name}.`,
      });
      if (requesterEmail && users[requesterEmail]) {
        users[requesterEmail].data = ensureStateUserDataShape(users[requesterEmail].data);
        upsertUserProject(users[requesterEmail], buildUserProjectSnapshot(project, users));
        pushUserNotification(users[requesterEmail], {
          type: "JOIN_REQUEST",
          message: `Your request to join ${project.name} was accepted.`,
          projectId: project.id,
          from: ownerEmail,
          status: "accepted",
          timestamp: decisionTime,
          icon: "✅",
          title: "Join Request Accepted",
          desc: `Your request to join ${project.name} was accepted.`,
          time: decisionTime,
        });
      }
      if (typeof saveStateUsersStore === "function") {
        saveStateUsersStore(users);
      }
    } else {
      if (requesterEmail && users[requesterEmail]) {
        users[requesterEmail].data = ensureStateUserDataShape(users[requesterEmail].data);
        pushUserNotification(users[requesterEmail], {
          type: "JOIN_REQUEST",
          message: `Your request to join ${project.name} was rejected.`,
          projectId: project.id,
          from: ownerEmail,
          status: "rejected",
          timestamp: decisionTime,
          icon: "🚫",
          title: "Join Request Rejected",
          desc: `Your request to join ${project.name} was rejected.`,
          time: decisionTime,
        });
      }
      if (typeof saveStateUsersStore === "function") {
        saveStateUsersStore(users);
      }
    }

    renderProjectWorkspace();
    renderApplied();
    persistReview2Runtime();
    showToast(
      action === "approve"
        ? `${request.name} added to the project`
        : `${request.name}'s request rejected`,
    );
  }

  function sendProjectInvite(projectId) {
    const project = PROJECTS.find((item) => item.id === projectId);
    const runtime = getProjectRuntime(project);
    const identifier = String(
      document.getElementById("owner-invite-identifier")?.value || "",
    ).trim();
    const selectedTaskId = String(
      document.getElementById("owner-invite-task")?.value || "",
    ).trim();
    if (!project || !runtime) return;
    if (!identifier) {
      showToast("Enter a collaborator username or email", "error");
      return;
    }

    const resolved = resolveUserIdentifier(identifier);
    if (!resolved?.email || !resolved?.user) {
      showToast("No user found with that username or email", "error");
      return;
    }
    if (resolved.user.name === project.owner) {
      showToast("You already own this project", "error");
      return;
    }
    if ((project.members || []).some((member) => member.name === resolved.user.name)) {
      showToast(`${resolved.user.name} is already part of this project`, "error");
      return;
    }

    const inviteRows = ensureRuntimeInvites(runtime);
    const existingInvite = inviteRows.find(
      (invite) =>
        invite.toEmail === resolved.email &&
        (invite.status === "pending" || invite.status === "accepted"),
    );
    if (existingInvite) {
      showToast("An active invite already exists for this user", "error");
      return;
    }

    const selectedTask = runtime.tasks.find((task) => task.id === selectedTaskId) || null;
    const sentOn = getLiveTimestamp();
    inviteRows.unshift({
      id: `${project.id}-invite-${Date.now()}`,
      to: resolved.email,
      toEmail: resolved.email,
      toName: resolved.user.name,
      from:
        typeof getCurrentUserSessionEmail === "function"
          ? getCurrentUserSessionEmail()
          : "",
      fromName: getCurrentUserName(),
      taskId: selectedTask?.id || "",
      taskTitle: selectedTask?.title || "",
      status: "pending",
      sentOn,
    });

    APPLIED.unshift({
      projectId: project.id,
      project: project.name,
      owner: project.owner,
      applied: sentOn,
      status: "Invited",
      invitedUser: resolved.username || resolved.user.name,
      invitedEmail: resolved.email,
      invitedByOwner: true,
      taskId: selectedTask?.id || "",
      taskTitle: selectedTask?.title || "",
    });

    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    if (users[resolved.email]) {
      users[resolved.email].data = ensureStateUserDataShape(users[resolved.email].data);
      pushUserNotification(users[resolved.email], {
        type: "INVITE",
        message: `${project.owner} invited you to join ${project.name}.`,
        projectId: project.id,
        from:
          typeof getCurrentUserSessionEmail === "function"
            ? getCurrentUserSessionEmail()
            : "",
        status: "pending",
        timestamp: sentOn,
        icon: "📨",
        title: "Project Invitation",
        desc: selectedTask
          ? `${project.owner} invited you to join ${project.name} for "${selectedTask.title}".`
          : `${project.owner} invited you to join ${project.name}.`,
        time: sentOn,
      });
      saveStateUsersStore(users);
    }
    const identifierInput = document.getElementById("owner-invite-identifier");
    const taskSelect = document.getElementById("owner-invite-task");
    if (identifierInput) identifierInput.value = "";
    if (taskSelect) taskSelect.value = "";

    persistReview2Runtime();
    renderProjectWorkspace();
    renderNotifications();
    showToast(`Invitation sent to ${resolved.user.name}`);
  }

  function publishFinishedProjectLink(projectId) {
    const project = PROJECTS.find((item) => item.id === projectId);
    const input = document.getElementById("finished-project-link");
    const link = String(input?.value || "").trim();
    if (!project) return;
    if (project.owner !== getCurrentUserName()) {
      showToast("Only the project owner can submit the final project link", "error");
      return;
    }
    if (!link || !isValidWebUrl(link)) {
      showToast("Enter a valid final project link", "error");
      return;
    }
    const runtime = getProjectRuntime(project);
    if (!allTasksApproved(runtime)) {
      showToast("All tasks must be approved before publishing", "error");
      return;
    }
    markProjectCompletedFromPublishedLink(project, runtime, link);
    APPLIED.forEach((item) => {
      if (
        (item.projectId === project.id || item.project === project.name) &&
        item.status === "Approved"
      ) {
        item.status = "Completed";
      }
    });
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    const ownerEmail = getProjectOwnerEmail(project, users);
    const participantEmails = [
      ownerEmail,
      ...getProjectMemberEmails(project, users),
      ...getProjectMentorEmails(project, users),
    ].filter(Boolean);
    const notificationTime = getLiveTimestamp();
    [...new Set(participantEmails)].forEach((email) => {
      if (!users[email]) return;
      users[email].data = ensureStateUserDataShape(users[email].data);
      upsertUserProject(users[email], buildUserProjectSnapshot(project, users));
      pushUserNotification(users[email], {
        type: "PROJECT_COMPLETED",
        message: `${project.name} was completed and the final project link is now available.`,
        projectId: project.id,
        from: ownerEmail,
        status: "completed",
        timestamp: notificationTime,
        icon: "LINK",
        title: "Project Completed",
        desc: `${project.name} was completed and the final project link is now available.`,
        time: notificationTime,
      });
    });
    if (typeof saveStateUsersStore === "function") {
      saveStateUsersStore(users);
    }
    renderMyProjects();
    renderProjectWorkspace();
    renderNotifications();
    persistReview2Runtime();
    showToast(`${project.name} marked as completed`);
  }

  function deleteOwnedProject(projectId) {
    const index = PROJECTS.findIndex((item) => item.id === projectId);
    if (index === -1) {
      showToast("Project not found", "error");
      return;
    }
    const project = PROJECTS[index];
    if (project.owner !== getCurrentUserName()) {
      showToast("You can delete only your own projects", "error");
      return;
    }
    const runtime = getProjectRuntime(project);
    runtime.tasks.forEach((task) => {
      if (
        task.assignee !== project.owner &&
        task.assignee !== "Unassigned" &&
        task.status !== "Approved" &&
        task.status !== "Completed"
      ) {
        task.assignee = "Unassigned";
        task.status = "Open";
      }
    });
    PROJECTS.splice(index, 1);
    for (let i = APPLIED.length - 1; i >= 0; i -= 1) {
      if (APPLIED[i].project === project.name || APPLIED[i].projectId === projectId) {
        APPLIED.splice(i, 1);
      }
    }
    for (let i = MENTOR_REQUESTS.length - 1; i >= 0; i -= 1) {
      if (
        MENTOR_REQUESTS[i].projectId === projectId ||
        (MENTOR_REQUESTS[i].project === project.name &&
          MENTOR_REQUESTS[i].owner === project.owner)
      ) {
        MENTOR_REQUESTS.splice(i, 1);
      }
    }
    saveSharedMentorRequests(
      loadSharedMentorRequests().filter(
        (item) => String(item.projectId || "").trim() !== String(projectId).trim(),
      ),
    );
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    Object.values(users).forEach((userRecord) => {
      if (!userRecord) return;
      userRecord.data = ensureStateUserDataShape(userRecord.data);
      removeUserProject(userRecord, projectId);
      userRecord.data.requests = userRecord.data.requests.filter(
        (item) => String(item.projectId || "").trim() !== String(projectId).trim(),
      );
      userRecord.data.notifications = userRecord.data.notifications.filter(
        (notification) =>
          String(notification.projectId || "").trim() !== String(projectId).trim(),
      );
    });
    if (typeof saveStateUsersStore === "function") {
      saveStateUsersStore(users);
    }
    if (
      STATE.collaboratorWorkspaceData &&
      typeof STATE.collaboratorWorkspaceData === "object"
    ) {
      delete STATE.collaboratorWorkspaceData[projectId];
    }
    if (STATE.ownedProjectData && typeof STATE.ownedProjectData === "object") {
      delete STATE.ownedProjectData[projectId];
    }
    if (STATE.review2 && typeof STATE.review2 === "object") {
      if (STATE.review2.ownerMentorProjectId === projectId) {
        STATE.review2.ownerMentorProjectId = getDefaultOwnedProjectId();
      }
    }
    if (typeof saveCreatedProjects === "function") {
      saveCreatedProjects();
    }
    persistReview2Runtime();
    if (STATE.selectedProject === projectId) {
      STATE.selectedProject = "";
      STATE.workspaceMode = "";
      navigate("my-projects");
    }
    renderProjects();
    renderMyProjects();
    renderMyWork();
    renderApplied();
    renderMentors();
    renderMentorRequests();
    renderMentoredProjects();
    renderNotifications();
    showToast(`${project.name} deleted`);
  }

  function removeProjectMentor(projectId) {
    const project = PROJECTS.find((item) => item.id === projectId);
    const runtime = getProjectRuntime(project);
    if (!project || !runtime) return;
    runtime.mentorRequest = null;
    saveSharedMentorRequests(
      loadSharedMentorRequests().filter((item) => item.projectId !== projectId),
    );
    for (let index = MENTOR_REQUESTS.length - 1; index >= 0; index -= 1) {
      const item = MENTOR_REQUESTS[index];
      if (
        item.projectId === project.id ||
        (item.project === project.name && item.owner === project.owner)
      ) {
        MENTOR_REQUESTS.splice(index, 1);
      }
    }
    saveUserData();
    persistReview2Runtime();
    renderDashboard?.();
    renderMentoredProjects();
    renderProjectWorkspace();
    renderMentors();
    renderMentorRequests();
    showToast("Mentor removed from the project");
  }

  function deleteMentorRequest(projectId) {
    const project = PROJECTS.find((item) => item.id === projectId);
    const runtime = getProjectRuntime(project);
    if (!project || !runtime || project.owner !== getCurrentUserName()) {
      showToast("Only the project owner can delete this mentor request", "error");
      return;
    }
    const sharedRequest = loadSharedMentorRequests().find(
      (item) => String(item.projectId || "").trim() === String(project.id).trim(),
    );
    const runtimeStatus = String(runtime.mentorRequest?.status || "").trim().toLowerCase();
    const sharedStatus = String(sharedRequest?.status || "").trim().toLowerCase();
    const legacyRequest = MENTOR_REQUESTS.find(
      (item) =>
        item.projectId === project.id ||
        (item.project === project.name && item.owner === project.owner),
    );
    const legacyStatus = String(legacyRequest?.status || "").trim().toLowerCase();
    const isAcceptedRequest =
      runtimeStatus === "approved" ||
      sharedStatus === "approved" ||
      legacyStatus === "accepted";
    if (isAcceptedRequest) {
      showToast("Accepted mentors must be removed with Remove Mentor", "error");
      return;
    }
    runtime.mentorRequestDeleted = {
      requestedName:
        runtime.mentorRequest?.requestedName || sharedRequest?.mentorName || "",
      deletedOn: getLiveTimestamp(),
    };
    markMentorRequestDeleted(project);
    runtime.mentorRequest = null;
    saveSharedMentorRequests(
      loadSharedMentorRequests().filter((item) => item.projectId !== projectId),
    );
    for (let index = MENTOR_REQUESTS.length - 1; index >= 0; index -= 1) {
      const item = MENTOR_REQUESTS[index];
      if (
        item.projectId === project.id ||
        (item.project === project.name && item.owner === project.owner)
      ) {
        MENTOR_REQUESTS.splice(index, 1);
      }
    }
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    Object.values(users).forEach((userRecord) => {
      if (!userRecord) return;
      userRecord.data = ensureStateUserDataShape(userRecord.data);
      userRecord.data.notifications = userRecord.data.notifications.filter(
        (notification) => String(notification.projectId || "").trim() !== String(project.id).trim(),
      );
    });
    if (typeof saveStateUsersStore === "function") {
      saveStateUsersStore(users);
    }
    persistReview2Runtime();
    renderDashboard?.();
    renderMentoredProjects();
    renderProjectWorkspace();
    renderMentors();
    renderMentorRequests();
    renderNotifications();
    showToast("Mentor request deleted");
  }

  function renderOwnedTaskModal(project, runtime) {
    return `
      <div id="owned-task-modal" class="modal-overlay ${STATE.ownedTaskModalOpen ? "open" : ""}" onclick="closeOwnedTaskModal(event)">
        <div class="modal-box" onclick="event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-icon">📝</span>
            <h3 class="modal-title">Create Task</h3>
            <button class="modal-close" onclick="closeOwnedTaskModal()">✕</button>
          </div>
          <div class="modal-body">
            <input id="owned-task-name" class="input" placeholder="Task title" />
            <textarea id="owned-task-desc" class="input mt-2" rows="3" placeholder="Describe the task"></textarea>
            <div class="form-grid mt-2">
              <input id="owned-task-deadline" class="input" placeholder="Deadline (e.g. Apr 12)" />
              <select id="owned-task-priority" class="input">
                <option value="Low">Low Difficulty</option>
                <option value="Medium" selected>Medium Difficulty</option>
                <option value="High">High Difficulty</option>
              </select>
            </div>
            <div class="form-grid mt-2">
              <select id="owned-task-assignee" class="input">
                <option value="">Assign later</option>
                <option value="${escapeHtml(project.owner)}">${escapeHtml(project.owner)} (Owner)</option>
                ${runtimeJoinableMembers(project)
                  .map(
                    (member) => `<option value="${escapeHtml(member.name)}">${escapeHtml(member.name)}</option>`,
                  )
                  .join("")}
              </select>
            </div>
            <button class="btn btn-primary btn-full mt-3" onclick="createOwnedTask()">Create Task</button>
          </div>
        </div>
      </div>
    `;
  }

  function openOwnedTaskModal() {
    STATE.ownedTaskModalOpen = true;
    renderProjectWorkspace();
  }

  function closeOwnedTaskModal(event) {
    if (event && event.target !== event.currentTarget) return;
    STATE.ownedTaskModalOpen = false;
    renderProjectWorkspace();
  }

  function createOwnedTask() {
    const project = PROJECTS.find((item) => item.id === STATE.selectedProject);
    const runtime = getProjectRuntime(project);
    if (!project || !runtime) return;
    const title = String(document.getElementById("owned-task-name")?.value || "").trim();
    const description = String(document.getElementById("owned-task-desc")?.value || "").trim();
    const due = String(document.getElementById("owned-task-deadline")?.value || "").trim();
    const priority = String(document.getElementById("owned-task-priority")?.value || "Medium").trim() || "Medium";
    const assignee = String(document.getElementById("owned-task-assignee")?.value || "").trim() || "Unassigned";
    if (title.length < 3) {
      showToast("Task title must be at least 3 characters", "error");
      return;
    }
    if (!due) {
      showToast("Deadline is required", "error");
      return;
    }
    const newTask = {
      id: `${project.id}-task-${Date.now()}`,
      title,
      description,
      assignee,
      due,
      priority,
      status: "Open",
    };
    runtime.tasks.push(newTask);
    if (assignee === project.owner && !(project.members || []).some(m => m.name === assignee)) {
      project.members = project.members || [];
      project.members.push({ name: assignee, initials: getInitialsFromName(assignee), role: "Collaborator" });
      project.collaborators = project.members.length;
    }
    STATE.ownedTaskModalOpen = false;
    if (typeof saveViewState === "function") saveViewState();
    persistReview2Runtime();
    renderProjectWorkspace();
    showToast(`Task created for ${project.name}`);
  }

  function inviteOwnedTaskMember() {
    openOwnedTaskModal();
  }

  function renderMentors() {
    refreshSharedReview2Runtime();
    ensureReview2State();
    const page = document.getElementById("page-mentors");
    if (!page) return;
    const currentUser = getCurrentUserName();
    const ownerProjects = PROJECTS.filter(
      (project) => project.owner === currentUser && !project.isCompleted,
    );
    const selectedProject =
      PROJECTS.find((project) => project.id === STATE.review2.ownerMentorProjectId) ||
      ownerProjects[0] ||
      null;

    page.innerHTML = `
      <h1>Mentors</h1>
      <p class="page-subtitle">Request exactly one mentor per project. A mentor appears as assigned only after approval.</p>
      ${
        ownerProjects.length
          ? `
            <div class="card mt-3">
              <div class="card-title">Select Project</div>
              <div class="workspace-inline-form">
                <select class="input" onchange="selectOwnerMentorProject(this.value)">
                  ${ownerProjects
                    .map(
                      (project) => `
                        <option value="${escapeHtml(project.id)}" ${selectedProject && selectedProject.id === project.id ? "selected" : ""}>${escapeHtml(project.name)}</option>
                      `,
                    )
                    .join("")}
                </select>
              </div>
            </div>
          `
          : ""
      }
      <div class="three-col mt-3">
        ${
          selectedProject
            ? MENTORS_DATA.map((mentor) => {
                const runtime = getProjectRuntime(selectedProject);
                const request = runtime.mentorRequest;
                const isOwnerMentor = mentor.name === selectedProject.owner;
                const isRequested =
                  request && request.requestedName === mentor.name && request.status === "requested";
                const isAssigned =
                  request && request.requestedName === mentor.name && request.status === "approved";
                const hasApprovedMentor =
                  request &&
                  request.status === "approved" &&
                  request.requestedName !== mentor.name;
                const label = isAssigned
                  ? "Assigned"
                  : isRequested
                    ? "Requested"
                    : isOwnerMentor
                      ? "Owner cannot mentor"
                      : hasApprovedMentor
                        ? "Mentor already assigned"
                      : "Request";
                return `
                  <div class="card">
                    <div class="flex items-center gap-3 mb-3">
                      <div class="workspace-member-avatar mentor">${escapeHtml(mentor.initials)}</div>
                      <div>
                        <div class="font-semibold text-sm">${escapeHtml(mentor.name)}</div>
                        <div class="text-xs text-muted">${escapeHtml(mentor.title)} · ${escapeHtml(mentor.uni)}</div>
                      </div>
                    </div>
                    <div class="project-skills" style="margin-bottom:12px">${mentor.skills
                      .map((skill) => `<span class="skill-tag">${escapeHtml(skill)}</span>`)
                      .join("")}</div>
                    <button class="btn btn-${isAssigned ? "outline" : "primary"} btn-sm btn-full" ${isOwnerMentor || isRequested || isAssigned || hasApprovedMentor ? "disabled" : ""} onclick="requestMentorForProject('${selectedProject.id}','${mentor.name.replace(/'/g, "\\'")}')">${label}</button>
                  </div>
                `;
              }).join("")
            : '<div class="card"><p class="text-sm text-muted">Create or select an owned project to request a mentor.</p></div>'
        }
      </div>
    `;
  }

  function selectOwnerMentorProject(projectId) {
    ensureReview2State();
    STATE.review2.ownerMentorProjectId = projectId;
    if (typeof saveViewState === "function") saveViewState();
    renderMentors();
  }

  function requestMentorForProject(projectId, mentorName) {
    const project = PROJECTS.find((item) => item.id === projectId);
    const runtime = getProjectRuntime(project);
    if (!project || !runtime) return;
    if (project.owner === mentorName) {
      showToast("The project owner cannot mentor their own project", "error");
      return;
    }
    if (runtime.mentorRequest) {
      showToast("Only one mentor can be requested per project", "error");
      return;
    }
    const mentorAccount = findUserByName(mentorName);
    const requestedOn = getLiveTimestamp();
    clearDeletedMentorRequest(project);
    runtime.mentorRequestDeleted = null;
    runtime.mentorRequest = {
      requestedName: mentorName,
      mentorEmail: mentorAccount?.email || "",
      ownerEmail:
        typeof getCurrentUserSessionEmail === "function"
          ? getCurrentUserSessionEmail()
          : "",
      status: "requested",
      requestedOn,
    };
    const sharedRequests = loadSharedMentorRequests().filter(
      (item) => item.projectId !== project.id,
    );
    sharedRequests.unshift({
      projectId: project.id,
      projectName: project.name,
      ownerName: project.owner,
      ownerEmail:
        typeof getCurrentUserSessionEmail === "function"
          ? getCurrentUserSessionEmail()
          : "",
      mentorName,
      mentorEmail: mentorAccount?.email || "",
      status: "requested",
      requestedOn,
    });
    saveSharedMentorRequests(sharedRequests);
    const existingRequest = MENTOR_REQUESTS.find(
      (item) => item.project === project.name && item.owner === project.owner,
    );
    if (!existingRequest) {
      MENTOR_REQUESTS.unshift({
        project: project.name,
        owner: project.owner,
        skills: project.skills.slice(0, 3),
        members: project.members.length,
        status: "Pending",
        mentorName,
        projectId: project.id,
      });
    }
    if (mentorAccount?.email) {
      const users =
        typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
      if (users[mentorAccount.email]) {
        users[mentorAccount.email].data = ensureStateUserDataShape(users[mentorAccount.email].data);
        pushUserNotification(users[mentorAccount.email], {
          type: "MENTOR_REQUEST",
          message: `${project.owner} requested your mentorship for ${project.name}.`,
          projectId: project.id,
          from:
            typeof getCurrentUserSessionEmail === "function"
              ? getCurrentUserSessionEmail()
              : "",
          status: "pending",
          timestamp: requestedOn,
          icon: "🛡️",
          title: "Mentor Request",
          desc: `${project.owner} requested your mentorship for ${project.name}.`,
          time: requestedOn,
        });
        if (typeof saveStateUsersStore === "function") {
          saveStateUsersStore(users);
        }
      }
    } else {
      pushNotification({
        roleScope: ["mentor"],
        icon: "🛡️",
        title: "Mentor Request",
        desc: `${project.owner} requested your mentorship for ${project.name}.`,
      });
    }
    persistReview2Runtime();
    renderMentors();
    renderNotifications();
    showToast(`Mentor request sent to ${mentorName}`);
  }

  function renderMentorRequests() {
    refreshSharedReview2Runtime();
    const root = document.getElementById("mentor-requests-content");
    if (!root) return;
    const myName = getCurrentUserName();
    const myEmail =
      typeof getCurrentUserSessionEmail === "function"
        ? getCurrentUserSessionEmail()
        : "";
    const runtimeItems = PROJECTS.filter((project) => {
      const runtime = getProjectRuntime(project);
      return (
        runtime.mentorRequest &&
        (runtime.mentorRequest.requestedName === myName ||
          runtime.mentorRequest.mentorEmail === myEmail)
      );
    });

    const runtimeHtml = runtimeItems
      .map((project) => {
            const runtime = getProjectRuntime(project);
            const request = runtime.mentorRequest;
            return `
              <div class="workspace-request-row">
                <div>
                  <div class="font-semibold text-sm">${escapeHtml(project.name)}</div>
                  <div class="text-xs text-muted">Owner: ${escapeHtml(project.owner)} · ${project.members.length} members · Requested ${escapeHtml(request.requestedOn)}</div>
                </div>
                <div class="workspace-card__actions">
                  ${
                    request.status === "requested"
                      ? `
                        <button class="btn btn-primary btn-sm" onclick="acceptMentorRequest('${project.id}')">Approve</button>
                        <button class="btn btn-outline btn-sm" onclick="declineMentorRequest('${project.id}')">Reject</button>
                      `
                      : `<span class="badge ${request.status === "approved" ? "badge-success" : "badge-warning"}">${request.status}</span>`
                  }
                </div>
              </div>
            `;
          })
          .join("");

    root.innerHTML =
      runtimeHtml
        ? `<div class="space-y-3">${runtimeHtml}</div>`
        : '<p class="text-sm text-muted italic">No mentor requests for you right now.</p>';
  }

  function acceptMentorRequest(projectId) {
    if (typeof projectId === "number") {
      const request = MENTOR_REQUESTS[projectId];
      if (!request) return;
      const linkedProject = PROJECTS.find(
        (item) =>
          item.id === String(request.projectId || "").trim() ||
          (item.name === request.project && item.owner === request.owner),
      );
      if (linkedProject) {
        acceptMentorRequest(linkedProject.id);
        return;
      }
      request.status = "Accepted";
      renderMentorRequests();
      renderMentoredProjects();
      showToast(`Mentorship request accepted for ${request.project}`);
      return;
    }
    const project = PROJECTS.find((item) => item.id === projectId);
    const runtime = getProjectRuntime(project);
    if (!project || !runtime) return;
    if (!runtime.mentorRequest) {
      const users =
        typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
      runtime.mentorRequest = {
        requestedName: getCurrentUserName(),
        mentorEmail:
          typeof getCurrentUserSessionEmail === "function"
            ? getCurrentUserSessionEmail()
            : "",
        ownerEmail: getProjectOwnerEmail(project, users),
        status: "requested",
        requestedOn: getLiveTimestamp(),
      };
    }
    runtime.mentorRequest.requestedName = getCurrentUserName();
    runtime.mentorRequest.status = "approved";
    runtime.mentorRequest.approvedOn = getLiveTimestamp();
    if (!project.members.some((member) => member.name === getCurrentUserName())) {
      project.members.push({
        name: getCurrentUserName(),
        initials: getInitialsFromName(getCurrentUserName()),
        role: "Mentor",
      });
      project.collaborators = project.members.length;
    }
    const sharedRequests = loadSharedMentorRequests().map((item) =>
      item.projectId === projectId
        ? {
            ...item,
            status: "approved",
            approvedOn: runtime.mentorRequest.approvedOn,
          }
        : item,
    );
    saveSharedMentorRequests(sharedRequests);
    MENTOR_REQUESTS.forEach((item) => {
      if (
        item.projectId === project.id ||
        (item.project === project.name && item.owner === project.owner)
      ) {
        item.status = "Accepted";
      }
    });
    const mentorEmail =
      typeof getCurrentUserSessionEmail === "function"
        ? getCurrentUserSessionEmail()
        : "";
    if (mentorEmail) {
      runtime.mentorRequest.mentorEmail = mentorEmail;
    }
    if (!runtime.mentorRequest.ownerEmail) {
      const users =
        typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
      runtime.mentorRequest.ownerEmail = getProjectOwnerEmail(project, users);
    }
    const ownerEmail = runtime.mentorRequest.ownerEmail || "";
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    if (mentorEmail && users[mentorEmail]) {
      users[mentorEmail].data = ensureStateUserDataShape(users[mentorEmail].data);
      upsertUserProject(users[mentorEmail], buildUserProjectSnapshot(project, users));
    }
    if (ownerEmail && users[ownerEmail]) {
      users[ownerEmail].data = ensureStateUserDataShape(users[ownerEmail].data);
      upsertUserProject(users[ownerEmail], buildUserProjectSnapshot(project, users));
      pushUserNotification(users[ownerEmail], {
        type: "MENTOR_REQUEST",
        message: `${getCurrentUserName()} accepted your mentorship request for ${project.name}.`,
        projectId: project.id,
        from:
          typeof getCurrentUserSessionEmail === "function"
            ? getCurrentUserSessionEmail()
            : "",
        status: "accepted",
        timestamp: runtime.mentorRequest.approvedOn,
        icon: "✅",
        title: "Mentor Request Approved",
        desc: `${getCurrentUserName()} accepted your mentorship request for ${project.name}.`,
        time: runtime.mentorRequest.approvedOn,
      });
    }
    if (typeof saveStateUsersStore === "function") {
      saveStateUsersStore(users);
    }
    persistReview2Runtime();
    renderMentorRequests();
    renderMentoredProjects();
    renderProjectWorkspace();
    renderNotifications();
    showToast(`You are now mentoring ${project.name}`);
  }

  function declineMentorRequest(projectId) {
    if (typeof projectId === "number") {
      const request = MENTOR_REQUESTS[projectId];
      if (!request) return;
      const linkedProject = PROJECTS.find(
        (item) =>
          item.id === String(request.projectId || "").trim() ||
          (item.name === request.project && item.owner === request.owner),
      );
      if (linkedProject) {
        declineMentorRequest(linkedProject.id);
        return;
      }
      request.status = "Declined";
      renderMentorRequests();
      showToast(`Mentorship request declined for ${request.project}`);
      return;
    }
    const project = PROJECTS.find((item) => item.id === projectId);
    const runtime = getProjectRuntime(project);
    if (!project || !runtime) return;
    if (!runtime.mentorRequest) {
      const users =
        typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
      runtime.mentorRequest = {
        requestedName: getCurrentUserName(),
        mentorEmail:
          typeof getCurrentUserSessionEmail === "function"
            ? getCurrentUserSessionEmail()
            : "",
        ownerEmail: getProjectOwnerEmail(project, users),
        status: "requested",
        requestedOn: getLiveTimestamp(),
      };
    }
    runtime.mentorRequest.requestedName = getCurrentUserName();
    runtime.mentorRequest.status = "declined";
    runtime.mentorRequest.declinedOn = getLiveTimestamp();
    const sharedRequests = loadSharedMentorRequests().map((item) =>
      item.projectId === projectId
        ? {
            ...item,
            status: "declined",
            declinedOn: runtime.mentorRequest.declinedOn,
          }
        : item,
    );
    saveSharedMentorRequests(sharedRequests);
    MENTOR_REQUESTS.forEach((item) => {
      if (
        item.projectId === project.id ||
        (item.project === project.name && item.owner === project.owner)
      ) {
        item.status = "Declined";
      }
    });
    const ownerEmail = runtime.mentorRequest.ownerEmail || "";
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    if (ownerEmail && users[ownerEmail]) {
      users[ownerEmail].data = ensureStateUserDataShape(users[ownerEmail].data);
      pushUserNotification(users[ownerEmail], {
        type: "MENTOR_REQUEST",
        message: `${getCurrentUserName()} rejected your mentorship request for ${project.name}.`,
        projectId: project.id,
        from:
          typeof getCurrentUserSessionEmail === "function"
            ? getCurrentUserSessionEmail()
            : "",
        status: "rejected",
        timestamp: runtime.mentorRequest.declinedOn,
        icon: "🚫",
        title: "Mentor Request Rejected",
        desc: `${getCurrentUserName()} rejected your mentorship request for ${project.name}.`,
        time: runtime.mentorRequest.declinedOn,
      });
    }
    if (typeof saveStateUsersStore === "function") {
      saveStateUsersStore(users);
    }
    persistReview2Runtime();
    renderMentorRequests();
    renderMentoredProjects();
    renderProjectWorkspace();
    renderNotifications();
    showToast(`Mentor request declined for ${project.name}`);
  }

  function renderMentoredProjects() {
    refreshSharedReview2Runtime();
    const root = document.getElementById("mentored-projects-grid");
    if (!root) return;
    const myName = getCurrentUserName();
    const myEmail =
      typeof getCurrentUserSessionEmail === "function"
        ? getCurrentUserSessionEmail()
        : "";
    const runtimeItems = PROJECTS.filter((project) => {
      const mentor = getProjectMentor(project);
      return (
        mentor &&
        mentor.status === "approved" &&
        (mentor.name === myName || project.runtime?.mentorRequest?.mentorEmail === myEmail)
      );
    });
    const runtimeHtml = runtimeItems
      .map((project) => projectCardHTML(project, "openWorkspace", "mentored-projects"))
      .join("");
    root.innerHTML =
      runtimeHtml
        ? runtimeHtml
        : '<div class="card"><p class="text-sm text-muted">No mentored projects yet.</p></div>';
  }

  function applyToPreviewProject(projectId) {
    const project = PROJECTS.find((item) => item.id === projectId);
    if (!project) {
      showToast("Project not found", "error");
      return;
    }
    const currentUser = getCurrentUserName();
    const runtime = getProjectRuntime(project);
    if (project.owner === currentUser) {
      showToast("You already own this project", "error");
      return;
    }
    const kickRecord = runtime.kickedUsers.find((item) => item.name === currentUser);
    if (kickRecord) {
      showToast(`You were removed from this project and cannot rejoin: ${kickRecord.reason}`, "error");
      return;
    }
    const existingRequest = runtime.joinRequests.find((item) => item.name === currentUser);
    if (existingRequest && existingRequest.status === "pending") {
      showToast("Your join request is already pending", "error");
      renderCollaboratorProjectPreview();
      return;
    }
    const submittedOn = getLiveTimestamp();
    runtime.joinRequests.unshift({
      id: `${project.id}-join-${Date.now()}`,
      projectId: project.id,
      name: currentUser,
      email: STATE.currentUser?.email || "",
      from: STATE.currentUser?.email || "",
      initials: currentUserInitials(),
      requestedOn: submittedOn,
      skills: STATE.userSkills.slice(0, 3),
      message: "I can contribute to frontend implementation and UI validation.",
      status: "pending",
    });
    const appliedEntry = APPLIED.find(
      (item) =>
        (item.projectId === project.id ||
          (item.project === project.name && item.owner === project.owner)) &&
        item.requester === (STATE.currentUser?.email || ""),
    );
    if (appliedEntry) {
      appliedEntry.status = "Pending";
      appliedEntry.applied = submittedOn;
      delete appliedEntry.deletedOn;
    } else {
      APPLIED.unshift({
        projectId: project.id,
        project: project.name,
        owner: project.owner,
        requester: STATE.currentUser?.email || "",
        applied: submittedOn,
        status: "Pending",
      });
    }
    const users = typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    const targetEmail = Object.keys(users).find(
      (email) => users[email]?.name === project.owner,
    );
    if (targetEmail && users[targetEmail]) {
      users[targetEmail].data = ensureStateUserDataShape(users[targetEmail].data);
      users[targetEmail].data.requests = users[targetEmail].data.requests.filter(
        (item) =>
          !(
            item.projectId === project.id &&
            item.from === (STATE.currentUser?.email || "")
          ),
      );
      updateMatchingNotifications(
        users[targetEmail],
        (notification) =>
          notification.type === "JOIN_REQUEST" &&
          notification.projectId === project.id &&
          notification.from === (STATE.currentUser?.email || "") &&
          notification.status === "pending",
        { unread: false, status: "replaced" },
      );
      {
        users[targetEmail].data.requests.push({
          from: STATE.currentUser?.email || "",
          projectId: project.id,
          projectName: project.name,
          status: "pending",
          time: submittedOn,
        });
        pushUserNotification(users[targetEmail], {
          type: "JOIN_REQUEST",
          message: `${currentUser} requested to join ${project.name}.`,
          projectId: project.id,
          from: STATE.currentUser?.email || "",
          status: "pending",
          timestamp: submittedOn,
          icon: "🤝",
          title: "New Join Request",
          desc: `${currentUser} requested to join ${project.name}.`,
          time: submittedOn,
        });
      }
      if (typeof saveStateUsersStore === "function") {
        saveStateUsersStore(users);
      }
    }
    persistReview2Runtime();
    showToast(`Join request sent for ${project.name}`);
    renderApplied();
    renderCollaboratorProjectPreview();
  }

  function openWorkspace(projectId, sourcePage) {
    const project = PROJECTS.find((item) => item.id === projectId);
    if (!project) {
      showToast("Project not found", "error");
      return;
    }
    STATE.selectedProject = projectId;
    STATE.collaboratorWorkspaceTab = "overview";
    STATE.workspaceMode = STATE.role === "mentor" ? "mentor-view" : "collaborator";
    STATE.workspaceBackPage =
      sourcePage || (STATE.role === "mentor" ? "mentored-projects" : "my-work");
    if (typeof saveViewState === "function") saveViewState();
    navigate("project-workspace");
  }

  function exitProjectWorkspace(targetPage) {
    const fallbackPage =
      targetPage ||
      STATE.workspaceBackPage ||
      (STATE.role === "mentor" ? "mentored-projects" : "my-work");
    STATE.selectedProject = "";
    STATE.workspaceMode = "";
    STATE.collaboratorWorkspaceTab = "overview";
    STATE.collaboratorProofModalOpen = false;
    STATE.collaboratorProofTaskIndex = null;
    STATE.collaboratorProofLink = "";
    STATE.workspaceBackPage = fallbackPage;
    if (typeof saveViewState === "function") saveViewState();
    navigate(fallbackPage);
  }

  function renderWorkspaceChat(project, messages, mentorView) {
    const isOwnedView = STATE.workspaceMode === "owned";
    const inputId = mentorView
      ? "mentor-chat-input"
      : isOwnedView
        ? "owned-chat-input"
        : "collab-chat-input";
    const sendHandler = isOwnedView
      ? "sendOwnedChatMessage()"
      : "sendCollaboratorChatMessage()";
    return `
      <div class="card">
        <div class="card-title">Project Chat</div>
        <div class="workspace-chat-list">
          ${messages
            .map(
              (message) => `
                <div class="workspace-chat-bubble">
                  <div class="workspace-chat-bubble__meta">${escapeHtml(message.sender)} · ${escapeHtml(message.time)}</div>
                  <div>${escapeHtml(message.text)}</div>
                </div>
              `,
            )
            .join("")}
        </div>
        <div class="workspace-inline-form mt-3">
          <input id="${inputId}" class="input" placeholder="Send a message to the team" onkeydown="if(event.key==='Enter'){event.preventDefault();${sendHandler}}" />
          <button class="btn btn-primary" onclick="${sendHandler}">Send</button>
        </div>
      </div>
    `;
  }

  function renderProjectWorkspace() {
    refreshSharedReview2Runtime();
    if (STATE.workspaceMode === "owned") {
      renderOwnedProjectWorkspace();
      return;
    }
    if (STATE.workspaceMode === "collaborator-project-preview") {
      renderCollaboratorProjectPreview();
      return;
    }
    const root = document.getElementById("page-project-workspace");
    if (!root) return;
    const fallbackPage =
      STATE.workspaceBackPage ||
      (STATE.role === "mentor" ? "mentored-projects" : "my-work");
    if (!STATE.selectedProject) {
      exitProjectWorkspace(fallbackPage);
      return;
    }
    const project = PROJECTS.find((item) => item.id === STATE.selectedProject);
    if (!project) {
      exitProjectWorkspace(fallbackPage);
      return;
    }
    const runtime = getProjectRuntime(project);
    const tab = STATE.collaboratorWorkspaceTab || "overview";
    const isMentorView = STATE.workspaceMode === "mentor-view";
    const currentUser = getCurrentUserName();
    const myTasks = runtime.tasks.filter((task) => task.assignee === currentUser);

    let content = "";
    if (tab === "tasks") {
      content = `
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Assignee</th>
                <th>Status</th>
                <th>Difficulty</th>
                <th>Proof</th>
                <th>Due</th>
                <th>${isMentorView ? "Mentor Access" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              ${runtime.tasks
                .map((task, index) => {
                  const canAct = !isMentorView && task.assignee === currentUser;
                  const action = isMentorView
                    ? '<span class="text-xs text-muted">Read-only</span>'
                    : task.status === "Open" && canAct
                      ? `<button class="btn btn-outline btn-sm" onclick="startCollaboratorTask(${index})">Start</button>`
                      : task.status === "In Progress" && canAct
                        ? `<button class="btn btn-outline btn-sm" onclick="openCollaboratorSubmitModal(${index})">Submit</button>`
                        : '<span class="text-xs text-muted">No action</span>';
                  return `
                    <tr>
                      <td>${escapeHtml(task.title)}</td>
                      <td>${escapeHtml(task.assignee)}</td>
                      <td>${collaboratorStatusPill(task.status)}</td>
                      <td>${taskDifficultyPill(task.priority)}</td>
                      <td>${taskProofLinkHtml(task, true)}</td>
                      <td>${escapeHtml(task.due)}</td>
                      <td>${action}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `;
    } else if (tab === "members") {
      content = `
        <div class="card">
          <div class="card-title">Members</div>
          ${project.members
            .map((member) => {
              const recommendation = getRecommendationsForUser(member.name).find(
                (item) => item.project === project.name,
              );
              const mentorAction =
                isMentorView &&
                member.name !== project.owner &&
                member.name !== currentUser
                  ? `
                    <button class="btn btn-outline btn-sm" ${recommendation ? "disabled" : ""} onclick="awardRecommendationBadge('${project.id}','${member.name.replace(/'/g, "\\'")}')">
                      ${recommendation ? "Badge Assigned" : "Assign Badge"}
                    </button>
                  `
                  : recommendation
                    ? '<span class="badge badge-success">Badge Assigned</span>'
                    : "";
              return `
                <div class="workspace-member-row">
                  <div class="workspace-member-row__info">
                    <div class="workspace-member-avatar">${escapeHtml(member.initials || getInitialsFromName(member.name))}</div>
                    <div>
                      <div class="font-semibold text-sm">${escapeHtml(member.name)}</div>
                      <div class="text-xs text-muted">${escapeHtml(member.role || "Collaborator")}</div>
                    </div>
                  </div>
                  ${mentorAction}
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    } else if (tab === "chat") {
      content = renderWorkspaceChat(project, runtime.chat, isMentorView);
    } else {
      content = `
        <div class="stat-grid" style="margin-top:0">
          <div class="stat-card"><div class="stat-value">${myTasks.length}</div><div class="stat-label">My Tasks</div></div>
          <div class="stat-card"><div class="stat-value">${runtime.tasks.filter((task) => task.status === "Approved").length}</div><div class="stat-label">Approved</div></div>
          <div class="stat-card"><div class="stat-value">${project.members.length}</div><div class="stat-label">Team Members</div></div>
          <div class="stat-card"><div class="stat-value">${getProjectMentor(project) ? "1" : "0"}</div><div class="stat-label">Mentor</div></div>
        </div>
        <div class="card">
          <div class="card-title">${isMentorView ? "Contribution History" : "My Workstream"}</div>
          ${
            runtime.contributionHistory.length
              ? runtime.contributionHistory
                  .map(
                    (item) => `
                      <button class="workspace-history-row" onclick="openWorkspace('${project.id}','${STATE.workspaceBackPage || "my-work"}')">
                        <div>
                          <div class="font-semibold text-sm">${escapeHtml(item.title)}</div>
                          <div class="text-xs text-muted">${escapeHtml(item.summary)}</div>
                        </div>
                        <span class="badge ${item.status === "Approved" ? "badge-success" : "badge-warning"}">${escapeHtml(item.status)}</span>
                      </button>
                    `,
                  )
                  .join("")
              : '<p class="text-sm text-muted">No history entries yet.</p>'
          }
        </div>
      `;
    }

    root.innerHTML = `
      <div class="workspace-shell">
        <div class="component" onclick="exitProjectWorkspace('${fallbackPage}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12.6673 8H3.33398" stroke="#78736D" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="text">Back</div>
        </div>
        <div class="card workspace-hero">
          <div>
            <div class="workspace-hero__title-row">
              <h1>${escapeHtml(project.name)}</h1>
              <span class="badge badge-${isMentorView ? "warning" : "secondary"}">${isMentorView ? "Mentor View" : "Collaborator View"}</span>
            </div>
            <p class="text-muted">${escapeHtml(project.desc)}</p>
          </div>
          <div class="workspace-hero__meta">
            <div class="workspace-hero__metric">${Number(project.progress) || 0}%</div>
            <div class="text-xs text-muted">${project.isCompleted ? "Completed" : "In progress"}</div>
          </div>
        </div>
        <div class="tabs workspace-tabs">
          <button class="tab ${tab === "overview" ? "active" : ""}" onclick="setCollaboratorWorkspaceTab('overview')">Overview</button>
          <button class="tab ${tab === "tasks" ? "active" : ""}" onclick="setCollaboratorWorkspaceTab('tasks')">Tasks</button>
          <button class="tab ${tab === "members" ? "active" : ""}" onclick="setCollaboratorWorkspaceTab('members')">Members</button>
          <button class="tab ${tab === "chat" ? "active" : ""}" onclick="setCollaboratorWorkspaceTab('chat')">Chat</button>
        </div>
        ${content}
        ${renderCollaboratorSubmitModal(runtime)}
      </div>
    `;
  }

  function renderCollaboratorSubmitModal(runtime) {
    const isOpen = Boolean(STATE.collaboratorProofModalOpen);
    const index = Number(STATE.collaboratorProofTaskIndex);
    const task = Number.isInteger(index) ? runtime.tasks[index] : null;
    return `
      <div id="collab-submit-modal" class="modal-overlay ${isOpen ? "open" : ""}" onclick="closeCollaboratorSubmitModal(event)">
        <div class="modal-box" onclick="event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-icon">🔗</span>
            <h3 class="modal-title">Submit Work</h3>
            <button class="modal-close" onclick="closeCollaboratorSubmitModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="text-sm text-muted" style="margin-bottom:10px">${task ? escapeHtml(task.title) : "Selected task"}</div>
            <input id="collab-proof-link" class="input" type="url" placeholder="https://proof-link" value="${escapeHtml(STATE.collaboratorProofLink || "")}" oninput="updateCollaboratorProofLink(this.value)" />
            <button class="btn btn-primary btn-full mt-3" onclick="submitCollaboratorProof()">Submit For Review</button>
          </div>
        </div>
      </div>
    `;
  }

  function startCollaboratorTask(taskIndex) {
    const project = PROJECTS.find((item) => item.id === STATE.selectedProject);
    const runtime = getProjectRuntime(project);
    if (!project || !runtime) return;
    if (STATE.workspaceMode === "mentor-view" || STATE.role === "mentor") {
      showToast("Mentors have read-only task access", "error");
      return;
    }
    const task = runtime.tasks[Number(taskIndex)];
    if (!task) return;
    if (task.assignee !== getCurrentUserName()) {
      showToast("Only the assigned collaborator can start this task", "error");
      return;
    }
    task.status = "In Progress";
    if (typeof saveViewState === "function") saveViewState();
    persistReview2Runtime();
    renderProjectWorkspace();
    showToast(`Started ${task.title}`);
  }

  function openCollaboratorSubmitModal(taskIndex) {
    if (STATE.workspaceMode === "mentor-view" || STATE.role === "mentor") {
      showToast("Mentors can review work but cannot submit task proof", "error");
      return;
    }
    STATE.collaboratorProofModalOpen = true;
    STATE.collaboratorProofTaskIndex = Number(taskIndex);
    if (typeof saveViewState === "function") saveViewState();
    renderProjectWorkspace();
  }

  function closeCollaboratorSubmitModal(event) {
    if (event && event.target !== event.currentTarget) return;
    STATE.collaboratorProofModalOpen = false;
    STATE.collaboratorProofTaskIndex = null;
    STATE.collaboratorProofLink = "";
    if (typeof saveViewState === "function") saveViewState();
    renderProjectWorkspace();
  }

  function updateCollaboratorProofLink(value) {
    STATE.collaboratorProofLink = value;
    if (typeof saveViewState === "function") saveViewState();
  }

  function approveOwnedTask(taskIndex) {
    const project = PROJECTS.find((item) => item.id === STATE.selectedProject);
    const runtime = getProjectRuntime(project);
    const task = runtime?.tasks?.[Number(taskIndex)];
    if (!task) {
      showToast("Task not found", "error");
      return;
    }
    if (String(task.status || "").trim().toLowerCase() === "approved") {
      showToast("Task is already approved", "error");
      return;
    }
    task.status = "Approved";
    runtime.contributionHistory.unshift({
      title: task.title,
      by: task.assignee || project.owner,
      status: "Approved",
      summary: task.proofLink
        ? `Proof approved: ${task.proofLink}`
        : "Task approved by the owner.",
    });
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    const assigneeRecord = getUserRecordByName(task.assignee, users);
    if (assigneeRecord?.user) {
      const rewards = getTaskApprovalRewards(task);
      const currentScores = ensureUserScoreProfile(assigneeRecord.user, task.assignee);
      assigneeRecord.user.profile.xp = currentScores.xp + rewards.xpAdded;
      assigneeRecord.user.profile.rep = currentScores.rep + rewards.repAdded;
      upsertUserProject(assigneeRecord.user, buildUserProjectSnapshot(project, users));
      pushUserNotification(assigneeRecord.user, {
        type: "TASK_REVIEW",
        message: `${task.title} was approved in ${project.name}. +${rewards.xpAdded} XP, +${rewards.repAdded} rep.`,
        projectId: project.id,
        from: getProjectOwnerEmail(project, users),
        status: "approved",
        timestamp: CURRENT_DATE,
        icon: "✅",
        title: "Task Approved",
        desc: `${task.title} was approved in ${project.name}. +${rewards.xpAdded} XP, +${rewards.repAdded} rep.`,
        time: CURRENT_DATE,
      });
      saveStateUsersStore(users);
    }
    persistReview2Runtime();
    renderProjectWorkspace();
    renderNotifications();
    showToast(`${task.title} approved`);
  }

  function rejectOwnedTask(taskIndex) {
    const project = PROJECTS.find((item) => item.id === STATE.selectedProject);
    const runtime = getProjectRuntime(project);
    const task = runtime?.tasks?.[Number(taskIndex)];
    if (!task) {
      showToast("Task not found", "error");
      return;
    }
    task.status = "Open";
    runtime.contributionHistory.unshift({
      title: task.title,
      by: task.assignee || project.owner,
      status: "Open",
      summary: "Owner requested another submission.",
    });
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    const assigneeRecord = getUserRecordByName(task.assignee, users);
    if (assigneeRecord?.user) {
      upsertUserProject(assigneeRecord.user, buildUserProjectSnapshot(project, users));
      pushUserNotification(assigneeRecord.user, {
        type: "TASK_REVIEW",
        message: `${task.title} needs another submission in ${project.name}.`,
        projectId: project.id,
        from: getProjectOwnerEmail(project, users),
        status: "pending",
        timestamp: CURRENT_DATE,
        icon: "↩️",
        title: "Task Returned",
        desc: `${task.title} needs another submission in ${project.name}.`,
        time: CURRENT_DATE,
      });
      saveStateUsersStore(users);
    }
    persistReview2Runtime();
    renderProjectWorkspace();
    renderNotifications();
    showToast(`${task.title} sent back for revision`);
  }

  function deleteOwnedTask(taskIndex) {
    const project = PROJECTS.find((item) => item.id === STATE.selectedProject);
    const runtime = getProjectRuntime(project);
    const index = Number(taskIndex);
    const task = runtime?.tasks?.[index];
    if (!task) {
      showToast("Task not found", "error");
      return;
    }

    runtime.tasks.splice(index, 1);
    runtime.contributionHistory = (runtime.contributionHistory || []).filter(
      (entry) => entry.title !== task.title,
    );

    if (STATE.collaboratorProofModalOpen) {
      if (STATE.collaboratorProofTaskIndex === index) {
        STATE.collaboratorProofModalOpen = false;
        STATE.collaboratorProofTaskIndex = null;
        STATE.collaboratorProofLink = "";
      } else if (Number(STATE.collaboratorProofTaskIndex) > index) {
        STATE.collaboratorProofTaskIndex = Number(STATE.collaboratorProofTaskIndex) - 1;
      }
    }

    persistReview2Runtime();
    renderProjectWorkspace();
    renderMyWork();
    showToast(`${task.title} deleted`);
  }

  function submitCollaboratorProof() {
    const project = PROJECTS.find((item) => item.id === STATE.selectedProject);
    const runtime = getProjectRuntime(project);
    const index = Number(STATE.collaboratorProofTaskIndex);
    const task = runtime?.tasks[index];
    const link = String(
      STATE.collaboratorProofLink ||
        document.getElementById("collab-proof-link")?.value ||
        "",
    ).trim();
    if (!task) {
      showToast("Task not found", "error");
      return;
    }
    if (STATE.workspaceMode === "mentor-view" || STATE.role === "mentor") {
      showToast("Mentors can view proof links but cannot submit tasks", "error");
      return;
    }
    if (task.assignee !== getCurrentUserName()) {
      showToast("Only the assigned collaborator can submit this task", "error");
      return;
    }
    if (!isValidWebUrl(link)) {
      showToast("Please enter a valid proof link", "error");
      return;
    }
    task.status = "In Review";
    task.proofLink = link;
    runtime.contributionHistory.unshift({
      title: task.title,
      by: getCurrentUserName(),
      status: "In Review",
      summary: `Submitted work proof: ${link}`,
    });
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    const ownerEmail = getProjectOwnerEmail(project, users);
    if (ownerEmail && users[ownerEmail]) {
      users[ownerEmail].data = ensureStateUserDataShape(users[ownerEmail].data);
      pushUserNotification(users[ownerEmail], {
        type: "TASK_SUBMITTED",
        message: `${getCurrentUserName()} submitted proof for "${task.title}" in ${project.name}.`,
        projectId: project.id,
        from:
          typeof getCurrentUserSessionEmail === "function"
            ? getCurrentUserSessionEmail()
            : "",
        status: "submitted",
        timestamp: getLiveTimestamp(),
        icon: "🔗",
        title: "Task Submitted",
        desc: `${getCurrentUserName()} submitted proof for "${task.title}" in ${project.name}.`,
        time: getLiveTimestamp(),
      });
      saveStateUsersStore(users);
    }
    STATE.collaboratorProofModalOpen = false;
    STATE.collaboratorProofTaskIndex = null;
    STATE.collaboratorProofLink = "";
    if (typeof saveViewState === "function") saveViewState();
    persistReview2Runtime();
    renderProjectWorkspace();
    showToast(`${task.title} submitted for review`);
  }

  function sendCollaboratorChatMessage() {
    const project = PROJECTS.find((item) => item.id === STATE.selectedProject);
    const runtime = getProjectRuntime(project);
    if (!project || !runtime) return;
    const input =
      document.getElementById("collab-chat-input") ||
      document.getElementById("mentor-chat-input") ||
      document.getElementById("owned-chat-input");
    const text = String(input?.value || "").trim();
    if (!text) {
      showToast("Type a message first", "error");
      return;
    }
    runtime.chat.push({
      sender: getCurrentUserName(),
      text,
      time: "Now",
    });
    if (typeof saveViewState === "function") saveViewState();
    persistReview2Runtime();
    renderProjectWorkspace();
  }

  function sendOwnedChatMessage() {
    sendCollaboratorChatMessage();
  }

  function awardRecommendationBadge(projectId, userName) {
    const project = PROJECTS.find((item) => item.id === projectId);
    const runtime = getProjectRuntime(project);
    if (!project || !runtime) return;
    const mentor = getProjectMentor(project);
    if (
      STATE.workspaceMode !== "mentor-view" ||
      !mentor ||
      mentor.status !== "approved" ||
      mentor.name !== getCurrentUserName()
    ) {
      showToast("Only the assigned mentor can grant recommendation badges", "error");
      return;
    }
    if (runtime.recommendations.some((item) => item.userName === userName)) {
      showToast("Recommendation badge already granted");
      return;
    }
    runtime.recommendations.push({
      userName,
      note: "Recognized by mentor for strong collaboration and delivery.",
    });
    if (OTHER_PROFILES[userName]) {
      OTHER_PROFILES[userName].hasMentorBadge = true;
    }
    if (
      STATE.userProfile &&
      String(STATE.userProfile.fullName || "").trim() === userName
    ) {
      STATE.review2 = STATE.review2 || {};
      STATE.review2.selfMentorBadge = true;
    }
    const users =
      typeof getStateUsersStore === "function" ? getStateUsersStore() : {};
    const recipientRecord = getUserRecordByName(userName, users);
    if (recipientRecord?.user) {
      recipientRecord.user.profile = {
        ...(recipientRecord.user.profile || {}),
        hasMentorBadge: true,
      };
      pushUserNotification(recipientRecord.user, {
        type: "MENTOR_BADGE",
        message: `${getCurrentUserName()} assigned you a mentor recommendation badge in ${project.name}.`,
        projectId: project.id,
        from:
          typeof getCurrentUserSessionEmail === "function"
            ? getCurrentUserSessionEmail()
            : "",
        status: "awarded",
        timestamp: getLiveTimestamp(),
        icon: "⭐",
        title: "Recommendation Badge Assigned",
        desc: `${getCurrentUserName()} assigned you a mentor recommendation badge in ${project.name}.`,
        time: getLiveTimestamp(),
      });
      saveStateUsersStore(users);
    }
    saveStoredRecommendations();
    persistReview2Runtime();
    if (typeof saveViewState === "function") saveViewState();
    renderProjectWorkspace();
    showToast(`Recommendation badge granted to ${userName}`);
  }

  function renderHelp() {
    if (typeof baseRenderHelp === "function") {
      baseRenderHelp();
    }
    const page = document.getElementById("page-help");
    if (!page) return;
    const supportCard = page.querySelector(".card.mt-3:last-of-type");
    if (!supportCard) return;
    supportCard.innerHTML = `
      <div class="card-title">📩 Contact Support</div>
      <div class="input-group"><label class="label">Category</label>
        <select id="support-category" class="input">
          <option>Bug Report</option>
          <option>Feature Request</option>
          <option>Account Issue</option>
          <option>Report User</option>
          <option>Other</option>
        </select>
      </div>
      <div class="input-group"><label class="label">Reported Username</label><input id="support-username" class="input" placeholder="Required only for Report User"></div>
      <div class="input-group"><label class="label">Message</label><textarea id="support-message" class="input" rows="4" placeholder="Describe your issue..."></textarea></div>
      <button class="btn btn-primary btn-sm" onclick="submitSupportRequest()">Send Message</button>
    `;
  }

  function submitSupportRequest() {
    const category = String(document.getElementById("support-category")?.value || "").trim();
    const username = String(document.getElementById("support-username")?.value || "").trim();
    const message = String(document.getElementById("support-message")?.value || "").trim();
    if (!category) {
      showToast("Select a support category", "error");
      return;
    }
    if (category === "Report User") {
      if (!username || username.length < 3) {
        showToast("Enter the username you want to report", "error");
        return;
      }
      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
        showToast("Username must be 3-30 characters using letters, numbers, ., _, or -", "error");
        return;
      }
    }
    if (message.length < 20 || message.length > 1000) {
      showToast("Support message must be between 20 and 1000 characters", "error");
      return;
    }
    pushNotification({
      roleScope: ["project-owner", "collaborator", "mentor"],
      icon: "📨",
      title: "Support Request Logged",
      desc:
        category === "Report User"
          ? `Report created against @${username}. Our team will review it.`
          : `Support request submitted under ${category}.`,
    });
    document.getElementById("support-username").value = "";
    document.getElementById("support-message").value = "";
    showToast(category === "Report User" ? "User report submitted" : "Support request submitted");
  }

  function renderNotifications() {
    refreshSharedReview2Runtime();
    if (typeof baseRenderNotifications === "function") {
      baseRenderNotifications();
    }
    const list = document.getElementById("notif-list");
    if (!list) return;
    const normalizeUserKey = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const currentUserKeys = new Set(
      [
        getCurrentUserName(),
        STATE.userProfile?.fullName,
        STATE.userProfile?.username,
      ]
        .map((value) => normalizeUserKey(value))
        .filter(Boolean),
    );    const inviteNotifications = "";
    const extras = STATE.review2.notifications
      .filter((item) => {
        const scope = Array.isArray(item.roleScope)
          ? item.roleScope
          : ["collaborator", "project-owner", "mentor"];
        return scope.includes(STATE.role);
      })
      .map(
        (item) => `
          <div class="notif-item${item.unread ? " unread" : ""}">
            <div class="notif-icon">${item.icon}</div>
            <div style="flex:1;min-width:0">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-sm">${escapeHtml(item.title)}</span>
                ${item.unread ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--info);flex-shrink:0"></span>' : ""}
              </div>
              <p class="text-sm text-muted mt-1">${escapeHtml(item.desc)}</p>
            </div>
            <span class="text-xs text-muted" style="white-space:nowrap">${escapeHtml(item.time)}</span>
          </div>
          <div style="height:1px;background:var(--border)"></div>
        `,
      )
      .join("");
    if (inviteNotifications || extras) {
      const inviteSection = "";
      const updatesSection = extras
        ? `
            <div class="notif-section-label" style="padding:12px 16px 8px;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted-fg)">Notifications</div>
            ${extras}
          `
        : "";
      list.insertAdjacentHTML("afterbegin", `${inviteSection}${updatesSection}`);
    }
  }

  function buildProfileHtml(profile, isPopup) {
    const activeProjects = (profile.projectList || []).filter(
      (project) => project.status !== "Completed",
    );
    const completedProjects = (profile.projectList || []).filter(
      (project) => project.status === "Completed",
    );
    const mentorRecommendations = profile.recommendations || [];
    const mentoredProjects = profile.mentoredProjects || [];
    const showMentoredLock = mentoredProjects.length === 0;

    return `
      <div class="card">
        <div class="profile-header">
          <div class="profile-avatar">${escapeHtml(profile.initials)}</div>
          <div class="profile-info">
            <div class="profile-name">${escapeHtml(profile.name)}${profile.hasMentorBadge ? ` <span class="mentor-rec-badge">${profileIconSvg("mentor")}<span>Mentor Recommended</span></span>` : ""}</div>
            <div class="profile-title">${escapeHtml(profile.title)} · ${escapeHtml(profile.uni)}</div>
            <div class="profile-joined">Member since ${escapeHtml(profile.joined)}</div>
            <div class="profile-bio">${escapeHtml(profile.bio)}</div>
          </div>
        </div>
        <div class="profile-stats">
          <div class="stat-pill"><span class="stat-pill-icon" aria-hidden="true">${profileIconSvg("xp")}</span><div><div class="stat-pill-label">XP</div><div class="stat-pill-value">${Number(profile.xp || 0).toLocaleString()}</div></div></div>
          <div class="stat-pill"><span class="stat-pill-icon" aria-hidden="true">${profileIconSvg("reputation")}</span><div><div class="stat-pill-label">Reputation</div><div class="stat-pill-value">${profile.rep || 0}</div></div></div>
          <div class="stat-pill"><span class="stat-pill-icon" aria-hidden="true">${profileIconSvg("projects")}</span><div><div class="stat-pill-label">Projects</div><div class="stat-pill-value">${profile.projects || 0}</div></div></div>
          <div class="stat-pill"><span class="stat-pill-icon" aria-hidden="true">${profileIconSvg("tasks")}</span><div><div class="stat-pill-label">Tasks</div><div class="stat-pill-value">${profile.tasks || 0}</div></div></div>
        </div>
      </div>
      <div class="profile-grid-2 mt-3">
        <div class="card">
          <div class="card-title">Active Projects</div>
          ${
            activeProjects.length
              ? activeProjects
                  .map(
                    (project) => `
                      <div class="proj-row">
                        <div class="proj-name">${escapeHtml(project.name)}</div>
                        <div class="proj-meta">${escapeHtml(project.role)} · ${escapeHtml(project.contribution || "")}</div>
                      </div>
                    `,
                  )
                  .join("")
              : '<p class="skills-empty">No active projects.</p>'
          }
        </div>
        <div class="card">
          <div class="card-title">Skills</div>
          ${skillsHTML(profile.skills || [])}
        </div>
      </div>
      <div class="profile-grid-2 mt-3">
        <div class="card">
          <div class="card-title">Completed Projects</div>
          ${
            completedProjects.length
              ? completedProjects
                  .map(
                    (project) => `
                      <div class="proj-row">
                        <div class="proj-name">${escapeHtml(project.name)}</div>
                        <div class="proj-meta">${escapeHtml(project.role)} · ${escapeHtml(project.contribution || "")}</div>
                        ${
                          project.finalLink
                            ? `<a class="workspace-link" href="${escapeHtml(project.finalLink)}" target="_blank" rel="noopener noreferrer">Final Link</a>`
                            : ""
                        }
                      </div>
                    `,
                  )
                  .join("")
              : '<p class="skills-empty">No completed projects available.</p>'
          }
        </div>
        <div class="card">
          <div class="card-title">Mentor Recommendations</div>
          ${
            mentorRecommendations.length
              ? mentorRecommendations
                  .map(
                    (badge) => `
                      <div class="proj-row">
                        <div class="proj-name">${escapeHtml(badge.project)}</div>
                        <div class="proj-meta">Recommended by ${escapeHtml(badge.mentor)} · ${escapeHtml(badge.note)}</div>
                      </div>
                    `,
                  )
                  .join("")
              : '<p class="skills-empty">No recommendation badges yet.</p>'
          }
        </div>
      </div>
      <div class="card mt-3">
        <div class="card-title">Mentored Projects</div>
        ${
          mentoredProjects.length
            ? mentoredProjects
                .map(
                  (project) => `
                    <div class="proj-row">
                      <div class="proj-name">${escapeHtml(project.name)}</div>
                      <div class="proj-meta">Owner: ${escapeHtml(project.owner || "Project Owner")} · ${escapeHtml(project.status || project.completedAt || "Completed")}</div>
                      <div class="proj-meta">${escapeHtml(project.contribution || "")}</div>
                      ${
                        project.finalLink
                          ? `<a class="workspace-link" href="${escapeHtml(project.finalLink)}" target="_blank" rel="noopener noreferrer">Final Link</a>`
                          : ""
                      }
                    </div>
                  `,
                )
                .join("")
            : `<div class="locked-block">${showMentoredLock ? "This section is locked or empty for users without active mentoring assignments." : "No mentored projects yet."}</div>`
        }
      </div>
      ${
        isPopup
          ? ""
          : `
            <div class="card mt-3">
              <div class="card-title">Recent Activity</div>
              ${
                (profile.activity || []).length
                  ? profile.activity
                      .map(
                        (activity) => `
                          <div class="activity-row">
                            <div class="activity-icon-wrap">•</div>
                            <div>
                              <div class="activity-action">${escapeHtml(activity.action)}</div>
                              <div class="activity-meta">${escapeHtml(activity.project)} · ${escapeHtml(activity.time)}</div>
                            </div>
                          </div>
                        `,
                      )
                      .join("")
                  : '<p class="skills-empty">No recent activity to show.</p>'
              }
            </div>
          `
      }
    `;
  }

  function renderProfile(user) {
    const root = document.getElementById("profile-content");
    if (!root) return;
    const name =
      user && typeof user.name === "string" && user.name.trim()
        ? user.name.trim()
        : getCurrentUserName();
    root.innerHTML = buildProfileHtml(findUserProfile(name), false);
  }

  function viewUserProfile(name) {
    ensureOverlayMount();
    const modal = document.getElementById("leaderboard-profile-modal");
    const content = document.getElementById("leaderboard-profile-content");
    const profile = findUserProfile(name);
    if (!modal || !content) return;
    content.innerHTML = buildProfileHtml(profile, true);
    modal.classList.add("open");
  }

  function closeLeaderboardProfile(event) {
    const modal = document.getElementById("leaderboard-profile-modal");
    if (!modal) return;
    if (event && event.target !== event.currentTarget) return;
    modal.classList.remove("open");
  }

  function buildProfileHtml(profile, isPopup) {
    const activeProjects = (profile.projectList || []).filter(
      (project) => project.status !== "Completed",
    );
    const completedProjects = (profile.projectList || []).filter(
      (project) => project.status === "Completed",
    );
    const mentorRecommendations = profile.recommendations || [];
    const mentoredProjects = profile.mentoredProjects || [];
    const showMentoredLock = mentoredProjects.length === 0;
    const profileIconSvg = (name) =>
      (
        {
          xp: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M11.2 1.5 4.9 10h3.8L8.1 18.5l7-9h-4Z" fill="currentColor"/></svg>',
          reputation:
            '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m10 2.2 2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8L10 2.2Z" fill="currentColor"/></svg>',
          projects:
            '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M2.5 5.5a2 2 0 0 1 2-2h3.3l1.2 1.3H15.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-8.3Z" fill="currentColor"/></svg>',
          tasks:
            '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m7.9 13.8-3.2-3.1 1.4-1.4L8 11l5.8-5.8 1.4 1.4-7.2 7.2Z" fill="currentColor"/></svg>',
          mentor:
            '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m10 2.4 2 4 4.4.6-3.2 3.1.8 4.4-4-2.1-4 2.1.8-4.4L3.6 7l4.4-.6 2-4Z" fill="currentColor"/></svg>',
        }[name] || ""
      );

    return `
      <div class="card">
        <div class="profile-header">
          <div class="profile-avatar">${escapeHtml(profile.initials)}</div>
          <div class="profile-info">
            <div class="profile-name">${escapeHtml(profile.name)}${profile.hasMentorBadge ? ` <span class="mentor-rec-badge">${profileIconSvg("mentor")}<span>Mentor Recommended</span></span>` : ""}</div>
            <div class="profile-title">${escapeHtml(profile.title)} Â· ${escapeHtml(profile.uni)}</div>
            <div class="profile-joined">Member since ${escapeHtml(profile.joined)}</div>
            <div class="profile-bio">${escapeHtml(profile.bio)}</div>
          </div>
        </div>
        <div class="profile-stats">
          <div class="stat-pill"><span class="stat-pill-icon" aria-hidden="true">${profileIconSvg("xp")}</span><div><div class="stat-pill-label">XP</div><div class="stat-pill-value">${Number(profile.xp || 0).toLocaleString()}</div></div></div>
          <div class="stat-pill"><span class="stat-pill-icon" aria-hidden="true">${profileIconSvg("reputation")}</span><div><div class="stat-pill-label">Reputation</div><div class="stat-pill-value">${profile.rep || 0}</div></div></div>
          <div class="stat-pill"><span class="stat-pill-icon" aria-hidden="true">${profileIconSvg("projects")}</span><div><div class="stat-pill-label">Projects</div><div class="stat-pill-value">${profile.projects || 0}</div></div></div>
          <div class="stat-pill"><span class="stat-pill-icon" aria-hidden="true">${profileIconSvg("tasks")}</span><div><div class="stat-pill-label">Tasks</div><div class="stat-pill-value">${profile.tasks || 0}</div></div></div>
        </div>
      </div>
      <div class="profile-grid-2 mt-3">
        <div class="card">
          <div class="card-title">Active Projects</div>
          ${
            activeProjects.length
              ? activeProjects
                  .map(
                    (project) => `
                      <div class="proj-row">
                        <div class="proj-name">${escapeHtml(project.name)}</div>
                        <div class="proj-meta">${escapeHtml(project.role)} Â· ${escapeHtml(project.contribution || "")}</div>
                      </div>
                    `,
                  )
                  .join("")
              : '<p class="skills-empty">No active projects.</p>'
          }
        </div>
        <div class="card">
          <div class="card-title">Skills</div>
          ${skillsHTML(profile.skills || [])}
        </div>
      </div>
      <div class="profile-grid-2 mt-3">
        <div class="card">
          <div class="card-title">Completed Projects</div>
          ${
            completedProjects.length
              ? completedProjects
                  .map(
                    (project) => `
                      <div class="proj-row">
                        <div class="proj-name">${escapeHtml(project.name)}</div>
                        <div class="proj-meta">${escapeHtml(project.role)} Â· ${escapeHtml(project.contribution || "")}</div>
                        ${
                          project.finalLink
                            ? `<a class="workspace-link" href="${escapeHtml(project.finalLink)}" target="_blank" rel="noopener noreferrer">Final Link â†—</a>`
                            : ""
                        }
                      </div>
                    `,
                  )
                  .join("")
              : '<p class="skills-empty">No completed projects available.</p>'
          }
        </div>
        <div class="card">
          <div class="card-title">Mentor Recommendations</div>
          ${
            mentorRecommendations.length
              ? mentorRecommendations
                  .map(
                    (badge) => `
                      <div class="proj-row">
                        <div class="proj-name">${escapeHtml(badge.project)}</div>
                        <div class="proj-meta">Recommended by ${escapeHtml(badge.mentor)} Â· ${escapeHtml(badge.note)}</div>
                      </div>
                    `,
                  )
                  .join("")
              : '<p class="skills-empty">No recommendation badges yet.</p>'
          }
        </div>
      </div>
      <div class="card mt-3">
        <div class="card-title">Mentored Projects</div>
        ${
          mentoredProjects.length
            ? mentoredProjects
                .map(
                  (project) => `
                    <div class="proj-row">
                      <div class="proj-name">${escapeHtml(project.name)}</div>
                      <div class="proj-meta">Owner: ${escapeHtml(project.owner || "Project Owner")} Â· ${escapeHtml(project.status || project.completedAt || "Completed")}</div>
                      <div class="proj-meta">${escapeHtml(project.contribution || "")}</div>
                      ${
                        project.finalLink
                          ? `<a class="workspace-link" href="${escapeHtml(project.finalLink)}" target="_blank" rel="noopener noreferrer">Final Link â†—</a>`
                          : ""
                      }
                    </div>
                  `,
                )
                .join("")
            : `<div class="locked-block">${showMentoredLock ? "This section is locked or empty for users without active mentoring assignments." : "No mentored projects yet."}</div>`
        }
      </div>
      ${
        isPopup
          ? ""
          : `
            <div class="card mt-3">
              <div class="card-title">Recent Activity</div>
              ${
                (profile.activity || []).length
                  ? profile.activity
                      .map(
                        (activity) => `
                          <div class="activity-row">
                            <div class="activity-icon-wrap">â€¢</div>
                            <div>
                              <div class="activity-action">${escapeHtml(activity.action)}</div>
                              <div class="activity-meta">${escapeHtml(activity.project)} Â· ${escapeHtml(activity.time)}</div>
                            </div>
                          </div>
                        `,
                      )
                      .join("")
                  : '<p class="skills-empty">No recent activity.</p>'
              }
            </div>
          `
      }
    `;
  }

  function renderDashboard() {
    refreshSharedReview2Runtime();
    if (typeof baseRenderDashboard === "function") {
      baseRenderDashboard();
    }
    if (STATE.role === "mentor") return;
    const currentUser = getCurrentUserName();
    const card = document.getElementById("third-card");
    if (!card) return;
    const historyRows = PROJECTS.filter((project) => {
      const isOwner = project.owner === currentUser;
      const isMember = (project.members || []).some((member) => member.name === currentUser);
      return isOwner || isMember;
    })
      .slice(0, 5)
      .map((project) => {
        const runtime = getProjectRuntime(project);
        const latestEntry =
          runtime.contributionHistory.find((item) => item.by === currentUser) ||
          runtime.contributionHistory[0] || {
            summary: project.desc || "Open workspace to view project details.",
            status: project.isCompleted ? "Approved" : "Open",
          };
        return `
          <tr class="clickable-row" onclick="openProjectFromHistory('${project.id}')">
            <td>${escapeHtml(project.name)}</td>
            <td class="text-muted">${escapeHtml(latestEntry.summary)}</td>
            <td><span class="text-xs text-info">🔗 Open workspace</span></td>
            <td><span class="badge ${latestEntry.status === "Approved" ? "badge-success" : latestEntry.status === "In Review" ? "badge-warning" : "badge-secondary"}">${escapeHtml(latestEntry.status)}</span></td>
          </tr>
        `;
      })
      .join("");
    card.innerHTML = `
      <div class="card-title">Contribution History</div>
      <div class="overflow-x-auto">
        <table>
          <thead><tr><th>Project</th><th>Contribution</th><th>Access</th><th>Status</th></tr></thead>
          <tbody>${historyRows || '<tr><td colspan="4" class="text-sm text-muted">No contribution history available yet.</td></tr>'}</tbody>
        </table>
      </div>
    `;
  }

  function openOwnedSummary(projectId) {
    renderContributionSummary(projectId);
  }

  function closeOwnedSummary() {
    closeContributionSummary();
  }

  function refreshAllViews() {
    ensureReview2State();
    seedRuntimeData();
    buildNotificationStore();
    ensureOverlayMount();
    renderDashboard();
    renderNotifications();
    renderHelp();
    renderProfile();
    renderMentors();
    renderMentorRequests();
    renderMentoredProjects();
    renderApplied();
    renderMyWork();
    renderMyProjects();
    renderProjects();
    if (STATE.selectedProject) {
      renderProjectWorkspace();
    }
  }

  Object.assign(window, {
    setMyWorkFilter,
    setOwnerProjectsFilter,
    leaveProject,
    filterProjects,
    renderApplied,
    openContributionSummary,
    acceptOwnerInvite,
    declineOwnerInvite,
    openProjectFromHistory,
    renderMyWork,
    renderMyProjects,
    renderProjects,
    openOwnedProject,
    setOwnedWorkspaceTab,
    renderOwnedProjectWorkspace,
    toggleOwnerMemberMenu,
    openAssignTaskModal,
    closeAssignTaskModal,
    confirmAssignTaskSelection,
    assignTaskToMember,
    assignTaskFromDropdown,
    openKickMemberModal,
    closeKickMemberModal,
    confirmKickMember,
    handleJoinRequest,
    deleteJoinRequest,
    sendProjectInvite,
    publishFinishedProjectLink,
    deleteOwnedProject,
    removeProjectMentor,
    deleteMentorRequest,
    openOwnedTaskModal,
    closeOwnedTaskModal,
    createOwnedTask,
    inviteOwnedTaskMember,
    renderMentors,
    selectOwnerMentorProject,
    requestMentorForProject,
    renderMentorRequests,
    acceptMentorRequest,
    declineMentorRequest,
    renderMentoredProjects,
    applyToPreviewProject,
    openWorkspace,
    exitProjectWorkspace,
    renderProjectWorkspace,
    startCollaboratorTask,
    openCollaboratorSubmitModal,
    closeCollaboratorSubmitModal,
    updateCollaboratorProofLink,
    approveOwnedTask,
    rejectOwnedTask,
    deleteOwnedTask,
    submitCollaboratorProof,
    sendCollaboratorChatMessage,
    sendOwnedChatMessage,
    awardRecommendationBadge,
    renderHelp,
    submitSupportRequest,
    renderNotifications,
    renderProfile,
    viewUserProfile,
    closeLeaderboardProfile,
    renderDashboard,
    openOwnedSummary,
    closeOwnedSummary,
    persistReview2Runtime,
  });

  ensureReview2State();
  hydrateReview2Runtime();
  seedRuntimeData();
  hydrateStoredRecommendations();
  buildNotificationStore();
  syncAllProjectsToUserStores();
  persistReview2Runtime();
  ensureOverlayMount();
  bindOwnerMemberMenuClose();
  refreshAllViews();
})();








