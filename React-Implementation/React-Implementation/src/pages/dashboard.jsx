import { useState, useContext, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { NotificationContext } from "../context/NotificationContext";
import StatCard from "../components/common/StatCard";
import usersApi from "../services/usersApi";
import projectsApi, { isProjectActive } from "../services/projectsApi";
import mentorshipApi from "../services/mentorshipApi";
import mentorMarketplaceApi from "../services/mentorMarketplaceApi";
import leaderboardApi from "../services/leaderboardApi";
import { formatRelativeTime } from "../utils/dateUtils";
import storage from "../utils/storage";
import { useActiveRole } from "../utils/roleStore";
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

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const { notifications } = useContext(NotificationContext);
  const { activeRole } = useActiveRole();
  const userName = user?.name || "User";

  const [dashboardData, setDashboardData] = useState(null);
  const [stats, setStats] = useState({ xp: 0, rep: 0, activeProjects: 0, completedTasks: 0, badgesCount: 0 });
  const [latestBadge, setLatestBadge] = useState(null);
  const [userActions, setUserActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAbandonmentReviews, setOpenAbandonmentReviews] = useState([]);
  const [confirmingReviewId, setConfirmingReviewId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchDashboard = async () => {
      try {
        const userId = user?.id || storage.getBackendUserId();
        if (!userId) return;
        if (user?.id) {
          storage.setBackendUserId(user.id);
        }
        const userRole = activeRole || user?.role || "Collaborator";

        const isMentorAccount = String(userRole || "").toLowerCase() === "mentor" || String(user?.role || "").toLowerCase() === "mentor";
        const [userDataRes, pRes, bRes, myOpenReviewsRes] = await Promise.all([
          usersApi.getMe().catch((err) => {
            console.warn("Could not load backend user data, falling back to session user:", err);
            return user;
          }),
          projectsApi.list({}, userRole).catch((err) => {
            console.warn("Could not load projects:", err);
            return [];
          }),
          mentorshipApi.getBadges(userId).catch((err) => {
            console.warn("Could not load badges:", err);
            return [];
          }),
          isMentorAccount && typeof mentorMarketplaceApi.getMyAbandonmentReviews === "function"
            ? mentorMarketplaceApi.getMyAbandonmentReviews("mentor", userId).catch(() => [])
            : Promise.resolve([]),
        ]);

        if (!isMounted) return;
        setOpenAbandonmentReviews(Array.isArray(myOpenReviewsRes) ? myOpenReviewsRes : []);

        const userData = userDataRes || user;
        const allProjects = Array.isArray(pRes) ? pRes : Array.isArray(pRes?.data) ? pRes.data : [];
        let badgesList = Array.isArray(bRes) ? bRes : [];
        if (badgesList.length === 0 && Array.isArray(userData?.data?.mentorRecommendations)) {
          badgesList = userData.data.mentorRecommendations;
        }

        const userEmail = (user?.email || userData?.email || "").toLowerCase();
        const resolvedName = (user?.name || userData?.name || "").toLowerCase();
        const currentUserIdStr = String(userId);

        // Compute active projects where current user is owner or collaborator
        const activeProjectsCount = allProjects.filter((p) => {
          if (!isProjectActive(p)) return false;
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
          return isOwner || isCollab;
        }).length;

        const finalXp = Number(userData?.profile?.xp ?? userData?.xp ?? 0);
        const finalRep = Number(userData?.profile?.rep ?? userData?.rep ?? 0);
        const finalCompletedTasks = Number(userData?.profile?.tasksCount ?? userData?.tasksCount ?? 0);

        setStats({
          xp: finalXp,
          rep: finalRep,
          activeProjects: activeProjectsCount,
          completedTasks: finalCompletedTasks,
          badgesCount: badgesList.length,
        });
        setLatestBadge(badgesList.length > 0 ? badgesList[0] : null);
        setDashboardData(userData);

        // Build user actions for Recent Activity from recommendation badges
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
        setUserActions(actionsList);
      } catch (err) {
        console.error("Dashboard dynamic load error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDashboard();

    let lastFetchTime = Date.now();
    const throttledUpdate = () => {
      const now = Date.now();
      if (now - lastFetchTime > 10000 && !document.hidden) {
        lastFetchTime = now;
        fetchDashboard();
      }
    };

    const interval = setInterval(() => {
      if (!document.hidden) {
        lastFetchTime = Date.now();
        fetchDashboard();
      }
    }, 12000);

    const handleStopPolls = () => {
      isMounted = false;
      clearInterval(interval);
    };

    window.addEventListener("teamforge:task_updated", throttledUpdate);
    window.addEventListener("teamforge:project_updated", throttledUpdate);
    window.addEventListener("teamforge:notification_updated", throttledUpdate);
    window.addEventListener("teamforge:stop_polls", handleStopPolls);
    window.addEventListener("focus", throttledUpdate);
    document.addEventListener("visibilitychange", throttledUpdate);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("teamforge:task_updated", throttledUpdate);
      window.removeEventListener("teamforge:project_updated", throttledUpdate);
      window.removeEventListener("teamforge:notification_updated", throttledUpdate);
      window.removeEventListener("teamforge:stop_polls", handleStopPolls);
      window.removeEventListener("focus", throttledUpdate);
      document.removeEventListener("visibilitychange", throttledUpdate);
    };
  }, [user]);

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

  const rawUserName = user?.name || user?.profile?.fullName || currentActiveUser?.name || currentActiveUser?.profile?.fullName || userName;
  const displayUserName = rawUserName.replace(/\s*\([^)]*\)$/, '').trim();

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div className="dash-header">
        <h1 className="dash-title">Dashboard</h1>
        <p className="dash-subtitle">Welcome back, {displayUserName}!</p>
      </div>

      {openAbandonmentReviews.length > 0 && (
        <div data-testid="dashboard-abandonment-banner" style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
          {openAbandonmentReviews.map((rev) => (
            <div
              key={rev.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "12px 16px",
                borderRadius: "10px",
                backgroundColor: "#fef3c7",
                border: "1px solid #f59e0b",
                color: "#92400e",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.9rem" }}>
                ⚠️ <strong>Mentor Activity Check:</strong> An abandonment review is open on{" "}
                <strong>{rev.projectTitle || rev.projectId}</strong>. Confirm now to restart your 7-day clock.
              </span>
              <button
                type="button"
                data-testid={`dash-still-active-btn-${rev.id}`}
                disabled={confirmingReviewId === rev.id}
                onClick={async () => {
                  setConfirmingReviewId(rev.id);
                  try {
                    await mentorMarketplaceApi.confirmAbandonmentReview(rev.id);
                    setOpenAbandonmentReviews((prev) => prev.filter((item) => item.id !== rev.id));
                  } catch {
                    // Ignore transient failure
                  } finally {
                    setConfirmingReviewId(null);
                  }
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#059669",
                  color: "#ffffff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {confirmingReviewId === rev.id ? "Confirming..." : "Still active"}
              </button>
            </div>
          ))}
        </div>
      )}

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
          subtext="Conduct score"
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

      {/* Recent Activity */}
      <div className="dash-activity-card">
        <h3 className="dash-sub-title">Recent Activity</h3>
        <div className="dash-activity-list">
          {recentActivity.length > 0 ? (
            recentActivity.map((act) => (
              <div key={act.id} className="dash-activity-item">
                <div className={`dash-act-dot ${act.type || "info"}`}></div>
                <div className="dash-act-content">
                  <div className="dash-act-main">
                    <span className="dash-act-title">{act.title || "Notification"}</span>
                    <span className="dash-act-desc">{act.message}</span>
                  </div>
                  {act.timestamp && (
                    <span className="dash-act-time">
                      {formatRelativeTime(act.timestamp)}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="dash-act-desc">No recent activity.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
