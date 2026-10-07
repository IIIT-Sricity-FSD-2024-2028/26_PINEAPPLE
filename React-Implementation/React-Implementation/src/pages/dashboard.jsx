import { useState, useContext, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { NotificationContext } from "../context/NotificationContext";
import usersApi from "../services/usersApi";
import "./dashboard.css"; // Import page-specific stylesheet

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
  const { notifications, unreadCount } = useContext(NotificationContext);
  const userName = user?.name || "User";

  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchDashboard = async () => {
      try {
        const userId = localStorage.getItem("teamforge.backendUserId") || user?.id || "1";
        const data = await usersApi.get(userId);
        
        if (isMounted) {
          setSkills(data?.profile?.skills || data?.skills || user?.skills || []);
          setDashboardData(data);
        }
      } catch (error) {
        console.warn("Could not load backend user data, falling back to session user:", error);
        if (isMounted && user) {
          setSkills(user?.profile?.skills || user?.skills || []);
          setDashboardData(user);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchDashboard();
    return () => {
      isMounted = false;
    };
  }, [user]);

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
    const newSkills = skills.filter(s => s !== skillToRemove);
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
      <div className="dashboard-page" style={{ textAlign: 'center', marginTop: '50px' }}>
        <p style={{ color: '#6b7280', fontWeight: 600 }}>Loading dashboard...</p>
      </div>
    );
  }

  // Derive stats with fallbacks
  const currentActiveUser = dashboardData || user;
  const activeProjects = (currentActiveUser?.data?.projects || currentActiveUser?.projects || []).filter(p => p.status !== 'Completed').length;
  const completedTasks = currentActiveUser?.profile?.tasksCount || currentActiveUser?.tasksCount || 0;
  const xp = currentActiveUser?.profile?.xp || currentActiveUser?.xp || 0;
  const rep = currentActiveUser?.profile?.rep || currentActiveUser?.rep || 0;

  // Recent activity logic (take up to 3 notifications)
  const recentActivity = Array.isArray(notifications) ? notifications.slice(0, 3) : [];

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div className="dash-header">
        <h1 className="dash-title">Dashboard</h1>
        <p className="dash-subtitle">Welcome back, {currentActiveUser?.profile?.fullName || currentActiveUser?.name || userName}!</p>
      </div>

      {/* Stats Grid */}
      <div className="dash-stats-grid">
        <div className="dash-stat-card">
          <div className="dash-stat-header">
            <div className="dash-icon-box dash-icon-info">
              <LightningIcon />
            </div>
          </div>
          <div className="dash-stat-val">{unreadCount} unread updates</div>
          <div className="dash-stat-label">XP POINTS {xp.toLocaleString()}</div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-header">
            <div className="dash-icon-box dash-icon-warning">
              <TrophyIcon />
            </div>
          </div>
          <div className="dash-stat-val">Top contributor</div>
          <div className="dash-stat-label">REPUTATION {rep}</div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-header">
            <div className="dash-icon-box dash-icon-primary">
              <FolderIcon />
            </div>
          </div>
          <div className="dash-stat-val">{activeProjects}</div>
          <div className="dash-stat-label">ACTIVE PROJECTS</div>
        </div>

        <div className="dash-stat-card">
          <div className="dash-stat-header">
            <div className="dash-icon-box dash-icon-success">
              <CheckIcon />
            </div>
          </div>
          <div className="dash-stat-val">{completedTasks}</div>
          <div className="dash-stat-label">COMPLETED TASKS</div>
        </div>
      </div>

      {/* Two Column Section */}
      <div className="dash-two-col">
        
        {/* Recent Activity */}
        <div className="dash-sub-card">
          <h3 className="dash-sub-title">Recent Activity</h3>
          <div className="dash-activity-list">
            {recentActivity.length > 0 ? recentActivity.map((act) => (
              <div key={act.id} className="dash-activity-item">
                <div className={`dash-act-dot ${act.type || 'info'}`}></div>
                <div>
                  <div className="dash-act-title">{act.title || "Notification"}</div>
                  <div className="dash-act-desc">{act.message}</div>
                </div>
              </div>
            )) : <div className="dash-act-desc">No recent activity.</div>}
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
        <div className="dash-table-desc">User | {user?.email || "user@teamforge.io"}</div>
        
        <div className="dash-table-container">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Contribution</th>
                <th>Evidence</th>
                <th className="dash-td-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData?.data?.projects?.length > 0 ? dashboardData.data.projects.map((proj, idx) => (
                <tr key={idx}>
                  <td className="dash-td-proj">{proj.name}</td>
                  <td className="dash-td-desc">{proj.contribution || proj.role || "Contributor"}</td>
                  <td>
                    <a href={proj.finalLink || "#"} className="dash-link">
                      <LinkIcon /> <span className="dash-link-text">Open workspace</span>
                    </a>
                  </td>
                  <td className="dash-td-right">
                    <span className={`dash-status ${proj.status === 'Completed' ? 'success' : 'warning'}`}>
                      {proj.status === 'Completed' ? 'Approved' : 'In Review'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="dash-td-desc" style={{textAlign: "center"}}>No contributions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
