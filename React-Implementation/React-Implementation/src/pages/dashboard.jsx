import { useState, useContext, useEffect, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import { NotificationContext } from "../context/NotificationContext";
import StatCard from "../components/common/StatCard";
import Badge from "../components/common/Badge";
import DataTable from "../components/common/DataTable";
import usersApi from "../services/usersApi";
import projectsApi, { isProjectActive, isProjectLocked } from "../services/projectsApi";
import tasksApi from "../services/tasksApi";
import joinRequestsApi from "../services/joinRequestsApi";
import mentorshipApi from "../services/mentorshipApi";
import { formatRelativeTime } from "../utils/dateUtils";
import "./dashboard.css"; // Import page-specific stylesheet

const AwardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="7" />
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
  </svg>
);

const LightningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

const TrophyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 4h10"></path>
    <path d="M17 4v8a5 5 0 0 1-10 0V4"></path>
    <path d="M4 4h3v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h3"></path>
  </svg>
);

const FolderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const LinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dash-link-icon">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>
);

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const { notifications } = useContext(NotificationContext);
  const userName = user?.name || "User";

  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [stats, setStats] = useState({ xp: 0, rep: 0, activeProjects: 0, completedTasks: 0, badgesCount: 0 });
  const [latestBadge, setLatestBadge] = useState(null);
  const [userActions, setUserActions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const userId = localStorage.getItem("teamforge.backendUserId") || user?.id || "1";
      const userRole = localStorage.getItem("teamforge.role") || user?.role || "Collaborator";

      // 1. Fetch user data
      let userData = null;
      try {
        userData = await usersApi.get(userId);
      } catch (err) {
        console.warn("Could not load backend user data, falling back to session user:", err);
        userData = user;
      }

      // 2. Fetch projects
      let allProjects = [];
      try {
        const pRes = await projectsApi.list({}, userRole);
        allProjects = Array.isArray(pRes) ? pRes : Array.isArray(pRes?.data) ? pRes.data : [];
      } catch (err) {
        console.warn("Could not load projects:", err);
      }

      // 3. Fetch join requests
      let userJoinRequests = [];
      try {
        const jrRes = await joinRequestsApi.list({ userId }, userRole);
        userJoinRequests = Array.isArray(jrRes) ? jrRes : Array.isArray(jrRes?.data) ? jrRes.data : [];
      } catch (err) {
        console.warn("Could not load join requests:", err);
      }

      // 4. Fetch badges
      let badgesList = [];
      try {
        const bRes = await mentorshipApi.getBadges(userId);
        badgesList = Array.isArray(bRes) ? bRes : [];
      } catch (err) {
        console.warn("Could not load badges:", err);
      }
      if (badgesList.length === 0 && Array.isArray(userData?.data?.mentorRecommendations)) {
        badgesList = userData.data.mentorRecommendations;
      }

      const userEmail = (user?.email || userData?.email || "").toLowerCase();
      const resolvedName = (user?.name || userData?.name || "").toLowerCase();
      const currentUserIdStr = String(userId);

      const relevantProjectIds = new Set();
      const projectMap = new Map();

      allProjects.forEach((p) => {
        const pid = String(p.id);
        projectMap.set(pid, p);
        const isOwner = String(p.ownerId) === currentUserIdStr || (p.owner && p.owner.toLowerCase() === resolvedName);
        const memberList = Array.isArray(p.members) && p.members.length > 0 ? p.members : (Array.isArray(p.collaborators) ? p.collaborators : []);
        const isCollab = memberList.some((c) => {
          if (typeof c === "string") {
            return c === currentUserIdStr || c.toLowerCase() === resolvedName || c.toLowerCase() === userEmail;
          }
          return (
            String(c.id || c.userId) === currentUserIdStr ||
            (c.name && c.name.toLowerCase() === resolvedName) ||
            (c.email && c.email.toLowerCase() === userEmail)
          );
        });
        if (isOwner || isCollab) {
          relevantProjectIds.add(pid);
        }
      });

      userJoinRequests.forEach((req) => {
        const status = (req.status || "").toLowerCase();
        if ((status === "approved" || status === "accepted" || status === "completed") && req.projectId) {
          relevantProjectIds.add(String(req.projectId));
        }
      });

      // 4. Fetch tasks across relevant projects
      let userTasks = [];
      if (relevantProjectIds.size > 0) {
        try {
          const tasks = await tasksApi.listForProjects(Array.from(relevantProjectIds), userRole);
          userTasks = (Array.isArray(tasks) ? tasks : []).filter((t) => {
            const aId = String(t.assigneeId || "");
            const aName = (t.assignee || t.assignedTo || "").toLowerCase();
            return aId === currentUserIdStr || aName === resolvedName || aName === userEmail;
          });
        } catch (err) {
          console.warn("Could not load tasks for projects:", err);
        }
      }

      // 5. Build dynamic Contribution History list
      const contributionList = [];
      const seenKeys = new Set();

      // Priority 1: User's individual tasks (completed and submitted/in-progress)
      userTasks.forEach((t) => {
        const proj = projectMap.get(String(t.projectId));
        const projName = proj ? (proj.title || proj.name) : (t.projectName || "Project");
        const key = `task-${t.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const rawStatus = (t.status || "").toLowerCase();
          const isCompleted = rawStatus === "completed" || rawStatus === "approved" || rawStatus === "done";
          const isSubmitted = rawStatus === "submitted" || rawStatus === "in review" || rawStatus === "inreview";

          const taskPoints = t.points || (t.priority === "High" ? 40 : t.priority === "Medium" ? 20 : 10);
          contributionList.push({
            id: key,
            name: projName,
            contribution: t.title || "Task contribution",
            xp: isCompleted ? taskPoints : Math.round(taskPoints / 2),
            finalLink: t.proofLink || t.proofUrl || proj?.deliverableUrl || proj?.finalLink || "#",
            status: isCompleted ? "Completed" : isSubmitted ? "In Review" : "In Progress",
            statusLabel: isCompleted ? "Approved" : isSubmitted ? "In Review" : "In Progress",
            updatedAt: t.updatedAt || t.createdAt || new Date().toISOString(),
          });
        }
      });

      // Priority 2: Projects where user contributed or is owner
      allProjects.forEach((p) => {
        const pid = String(p.id);
        if (relevantProjectIds.has(pid)) {
          const key = `proj-${pid}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            const isCompleted = isProjectLocked(p);
            contributionList.push({
              id: key,
              name: p.title || p.name,
              contribution: p.description ? (p.description.slice(0, 50) + (p.description.length > 50 ? "..." : "")) : (p.category || "Project Member"),
              xp: isCompleted ? 100 : 50,
              finalLink: p.deliverableUrl || p.finalLink || p.repoLink || "#",
              status: isCompleted ? "Completed" : "Active",
              statusLabel: isCompleted ? "Approved" : "In Review",
              updatedAt: p.updatedAt || p.createdAt || new Date().toISOString(),
            });
          }
        }
      });

      // Priority 3: Pre-seeded or saved userData.data.projects
      if (Array.isArray(userData?.data?.projects)) {
        userData.data.projects.forEach((dp, idx) => {
          const key = `dp-${dp.name || idx}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            const isCompleted = dp.status === "Completed";
            contributionList.push({
              id: key,
              name: dp.name,
              contribution: dp.contribution || dp.role || "Contributor",
              xp: isCompleted ? (dp.xp || 40) : (dp.xp || 20),
              finalLink: dp.finalLink || "#",
              status: isCompleted ? "Completed" : "In Review",
              statusLabel: isCompleted ? "Approved" : "In Review",
              updatedAt: new Date().toISOString(),
            });
          }
        });
      }

      // Sort by newest first
      contributionList.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

      // Calculate dynamic stats
      const baseTasksCount = userData?.profile?.tasksCount || userData?.tasksCount || 0;
      const completedTasksFromList = userTasks.filter((t) => {
        const s = (t.status || "").toLowerCase();
        return s === "completed" || s === "approved" || s === "done";
      }).length;
      const finalCompletedTasks = Math.max(baseTasksCount, completedTasksFromList);

      const activeProjectsCount = Array.from(relevantProjectIds).filter((pid) => {
        const p = projectMap.get(pid);
        return isProjectActive(p);
      }).length;

      const finalXp = Number(userData?.profile?.xp ?? userData?.xp ?? 0);
      const finalRep = Number(userData?.profile?.rep ?? userData?.rep ?? 0);

      setStats({
        xp: finalXp,
        rep: finalRep,
        activeProjects: activeProjectsCount,
        completedTasks: finalCompletedTasks,
        badgesCount: badgesList.length,
      });
      setLatestBadge(badgesList.length > 0 ? badgesList[0] : null);

      setContributions(contributionList);
      setDashboardData(userData);
      setSkills(userData?.profile?.skills || userData?.skills || user?.skills || []);

      // Build user actions for Recent Activity
      const actionsList = [];

      badgesList.forEach((b) => {
        actionsList.push({
          id: `badge-${b.id || b.awardedAt}`,
          title: 'Recommendation Badge',
          message: `Awarded "${b.badgeName || b.badgeType || 'Recommendation'}" by ${b.mentorName || b.mentor || 'Mentor'} on "${b.projectTitle || b.project || 'Project'}".`,
          timestamp: b.awardedAt || b.timestamp,
          type: 'warning',
        });
      });

      userJoinRequests.forEach((req) => {
        const p = projectMap.get(String(req.projectId));
        const pName = p ? (p.title || p.name) : `Project #${req.projectId}`;
        actionsList.push({
          id: `req-${req.id}`,
          title: 'Applied to Project',
          message: `Applied to join "${pName}" as ${req.role || 'Collaborator'}.`,
          timestamp: req.createdAt,
          type: 'info',
        });
      });

      userTasks.forEach((t) => {
        const rawStatus = (t.status || '').toLowerCase();
        if (t.proofLink || rawStatus === 'inreview' || rawStatus === 'in review' || rawStatus === 'completed' || rawStatus === 'approved') {
          const p = projectMap.get(String(t.projectId));
          const pName = p ? (p.title || p.name) : 'Project';
          actionsList.push({
            id: `task-sub-${t.id}`,
            title: 'Deliverables Submitted',
            message: `Submitted deliverables for task "${t.title}" in "${pName}".`,
            timestamp: t.updatedAt || t.createdAt,
            type: 'info',
          });
        }
      });

      setUserActions(actionsList);
    } catch (err) {
      console.error("Dashboard dynamic load error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboard();

    const interval = setInterval(fetchDashboard, 6000);
    const handleUpdate = () => fetchDashboard();
    window.addEventListener("teamforge:task_updated", handleUpdate);
    window.addEventListener("teamforge:project_updated", handleUpdate);
    window.addEventListener("teamforge:notification_updated", handleUpdate);
    window.addEventListener("focus", handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener("teamforge:task_updated", handleUpdate);
      window.removeEventListener("teamforge:project_updated", handleUpdate);
      window.removeEventListener("teamforge:notification_updated", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, [fetchDashboard]);

  const handleAddSkill = async () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      const newSkills = [...skills, skillInput.trim()];
      setSkills(newSkills);
      setSkillInput("");

      try {
        const userId = localStorage.getItem("teamforge.backendUserId") || "1";
        await usersApi.update(userId, { profile: { skills: newSkills } });
      } catch (err) {
        console.error("Failed to save skill", err);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleAddSkill();
    }
  };

  const handleRemoveSkill = async (skillToRemove) => {
    const newSkills = skills.filter((s) => s !== skillToRemove);
    setSkills(newSkills);

    try {
      const userId = localStorage.getItem("teamforge.backendUserId") || "1";
      await usersApi.update(userId, { profile: { skills: newSkills } });
    } catch (err) {
      console.error("Failed to remove skill", err);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-page" style={{ textAlign: "center", marginTop: "50px" }}>
        <p style={{ color: "#6b7280", fontWeight: 600 }}>Loading dashboard...</p>
      </div>
    );
  }

  const currentActiveUser = dashboardData || user;
  // Recent activity logic combining user notifications and user actions, newest first with relative time
  const recentActivity = (() => {
    const activityMap = new Map();
    if (Array.isArray(notifications)) {
      notifications.forEach((n) => {
        const rawType = (n.type || '').toLowerCase();
        const dotType =
          rawType.includes('approved') || rawType.includes('completed') || rawType.includes('success')
            ? 'success'
            : rawType.includes('warning') || rawType.includes('suspended') || rawType.includes('rejected')
            ? 'warning'
            : 'info';
        activityMap.set(`notif-${n.id}`, {
          id: `notif-${n.id}`,
          title: n.title || 'Notification',
          message: n.message,
          timestamp: n.createdAt || n.timestamp,
          type: dotType,
        });
      });
    }

    userActions.forEach((act) => {
      if (!activityMap.has(act.id)) {
        activityMap.set(act.id, act);
      }
    });

    return Array.from(activityMap.values())
      .filter((a) => Boolean(a.timestamp))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  })();

  const displayUserName = user?.name || user?.profile?.fullName || currentActiveUser?.name || currentActiveUser?.profile?.fullName || userName;

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div className="dash-header">
        <h1 className="dash-title">Dashboard</h1>
        <p className="dash-subtitle">Welcome back, {displayUserName}!</p>
      </div>

      {latestBadge && (
        <div
          className="dash-badge-alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 18px",
            marginBottom: "20px",
            borderRadius: "12px",
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            color: "var(--fg, #1e293b)",
          }}
        >
          <span style={{ fontSize: "1.4rem" }}>🏅</span>
          <div style={{ flex: 1, fontSize: "0.92rem" }}>
            <strong>Mentor Recommendation:</strong> You received the{" "}
            <strong style={{ color: "#d97706" }}>
              {latestBadge.badgeName || latestBadge.badgeType || "Recommendation"}
            </strong>{" "}
            badge from Mentor <strong>{latestBadge.mentorName || latestBadge.mentor}</strong> on{" "}
            <em>{latestBadge.projectTitle || latestBadge.project}</em>!
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="dash-stats-grid">
        <StatCard
          icon={<LightningIcon />}
          label="XP Points"
          value={stats.xp.toLocaleString()}
          subtext="Total contributions"
        />
        <StatCard
          icon={<TrophyIcon />}
          label="Reputation"
          value={stats.rep.toLocaleString()}
          subtext="Top contributor"
        />
        <StatCard
          icon={<FolderIcon />}
          label="Active Projects"
          value={stats.activeProjects}
        />
        <StatCard
          icon={<CheckIcon />}
          label="Completed Tasks"
          value={stats.completedTasks}
        />
        <StatCard
          icon={<AwardIcon />}
          label="Recommendation Badges"
          value={stats.badgesCount}
          subtext={latestBadge ? `Latest: ${latestBadge.badgeName || latestBadge.badgeType || 'Awarded'}` : 'From mentors'}
        />
      </div>

      {/* Two Column Section */}
      <div className="dash-two-col">
        {/* Recent Activity */}
        <div className="dash-sub-card">
          <h3 className="dash-sub-title">Recent Activity</h3>
          <div className="dash-activity-list">
            {recentActivity.length > 0 ? (
              recentActivity.map((act) => (
                <div key={act.id} className="dash-activity-item">
                  <div className={`dash-act-dot ${act.type || "info"}`}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div className="dash-act-title">{act.title || "Notification"}</div>
                      {act.timestamp && (
                        <span style={{ fontSize: "0.75rem", color: "#9ca3af", marginLeft: "8px" }}>
                          {formatRelativeTime(act.timestamp)}
                        </span>
                      )}
                    </div>
                    <div className="dash-act-desc">{act.message}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="dash-act-desc">No recent activity.</div>
            )}
          </div>
        </div>

        {/* My Skills */}
        <div className="dash-sub-card">
          <h3 className="dash-sub-title-sm">My Skills</h3>
          <p className="dash-skills-desc">Add skills as tags. These appear on your profile and dashboard.</p>

          <div className="dash-skill-input-row">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. React, Python"
              className="dash-skill-input"
            />
            <button onClick={handleAddSkill} className="dash-skill-btn">+ Add</button>
          </div>

          <div className="dash-skills-wrap">
            {skills.map((skill, index) => (
              <span key={index} className="dash-skill-tag">
                {skill}
                <span onClick={() => handleRemoveSkill(skill)} className="dash-skill-remove">&times;</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Contribution Table */}
      <div className="dash-table-card">
        <h3 className="dash-sub-title-sm">Contribution History</h3>
        <div className="dash-table-desc">User | {user?.email || dashboardData?.email || "user@teamforge.io"}</div>

        <div className="dash-table-container">
          <DataTable
            columns={[
              {
                header: "Project",
                key: "name",
                className: "dash-td-proj",
                render: (proj) => proj.name,
              },
              {
                header: "Contribution",
                key: "contribution",
                className: "dash-td-desc",
                render: (proj) => proj.contribution || "Contributor",
              },
              {
                header: "Evidence",
                key: "evidence",
                render: (proj) => (
                  proj.finalLink && proj.finalLink !== "#" ? (
                    <a href={proj.finalLink} target="_blank" rel="noopener noreferrer" className="dash-link">
                      <LinkIcon /> <span className="dash-link-text">Open evidence</span>
                    </a>
                  ) : (
                    <span className="dash-link" style={{ opacity: 0.6 }}>
                      <LinkIcon /> <span className="dash-link-text">Workspace</span>
                    </span>
                  )
                ),
              },
              {
                header: "XP Earned",
                key: "xp",
                align: "right",
                render: (proj) => (
                  <span style={{ fontWeight: 600, color: "var(--primary, #2563eb)" }}>
                    +{proj.xp || 20} XP
                  </span>
                ),
              },
              {
                header: "Status",
                key: "status",
                align: "right",
                className: "dash-td-right",
                headerClassName: "dash-td-right",
                render: (proj) => (
                  <Badge variant={proj.status === "Completed" ? "completed" : "in-progress"}>
                    {proj.statusLabel || (proj.status === "Completed" ? "Approved" : "In Review")}
                  </Badge>
                ),
              },
            ]}
            data={contributions}
            loading={loading}
            loadingRows={3}
            emptyTitle="No contributions found."
            emptyMessage="Start contributing to your assigned projects to see your history here."
            tableClassName="dash-table"
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
