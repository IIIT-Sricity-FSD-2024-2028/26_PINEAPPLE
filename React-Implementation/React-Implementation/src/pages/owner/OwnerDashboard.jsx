import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { NotificationContext } from '../../context/NotificationContext';
import StatCard from '../../components/common/StatCard';
import EmptyState from '../../components/common/EmptyState';
import ProjectCard from '../../components/features/ProjectCard';
import projectsApi, { isProjectActive } from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import joinRequestsApi from '../../services/joinRequestsApi';
import { calculateProjectProgress } from '../../utils/progress';
import { formatRelativeTime } from '../../utils/dateUtils';
import './ownerDashboard.css';

/* ── Extracted SVG Sub-components ── */
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const OwnerDashboard = () => {
  const { user } = useContext(AuthContext);
  const { notifications } = useContext(NotificationContext) || {};
  const navigate = useNavigate();

  const [ownedProjects, setOwnedProjects] = useState([]);
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [tasksByProject, setTasksByProject] = useState({});
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [totalCollaborators, setTotalCollaborators] = useState(0);
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const [ownerActions, setOwnerActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadDashboardMetrics = async () => {
      try {
        const currentUserId = user?.id;
        const currentUserName = user?.name || '';

        const [allProjects, allRequests] = await Promise.all([
          projectsApi.list().catch(() => []),
          joinRequestsApi.list().catch(() => []),
        ]);

        const owned = (Array.isArray(allProjects) ? allProjects : []).filter(
          (p) => p.ownerId === currentUserId || p.owner === currentUserName
        );

        // Canonical Sync: Filter active projects to exclude completed projects from stat cards
        const activeOwned = owned.filter(isProjectActive);
        const activeOwnedIds = new Set(activeOwned.map((p) => String(p.id)));

        // Calculate pending join requests strictly for active owned projects
        const pendingReqs = (Array.isArray(allRequests) ? allRequests : []).filter(
          (r) => activeOwnedIds.has(String(r.projectId)) && r.status === 'Pending'
        );

        // Calculate unique collaborators across active owned projects
        const uniqueCollabIds = new Set();
        activeOwned.forEach((p) => {
          const members = Array.isArray(p.members) && p.members.length > 0
            ? p.members.filter((m) => m.role !== 'Owner')
            : (Array.isArray(p.collaborators) ? p.collaborators : []);
          members.forEach((c) => {
            const cid = typeof c === 'object' ? (c.id || c.userId || c.name) : c;
            if (cid) uniqueCollabIds.add(String(cid));
          });
        });

        let taskCount = 0;
        let tasks = [];
        const tasksMap = {};
        const ownedIds = new Set(owned.map((p) => String(p.id)));
        if (owned.length > 0) {
          tasks = (await tasksApi.listForProjects(Array.from(ownedIds))) || [];
          // Total Tasks stat card counts tasks on ACTIVE projects
          taskCount = tasks.filter((t) => activeOwnedIds.has(String(t.projectId))).length;
          tasks.forEach((t) => {
            const pid = String(t.projectId);
            if (!tasksMap[pid]) tasksMap[pid] = [];
            tasksMap[pid].push(t);
          });
        }

        // Build owner actions for Recent Activity
        const actions = [];
        owned.forEach((p) => {
          if (p.createdAt) {
            actions.push({
              id: `proj-create-${p.id}`,
              title: 'Project Created',
              message: `You created project "${p.title || p.name}".`,
              timestamp: p.createdAt,
              type: 'info',
            });
          }
        });

        (Array.isArray(allRequests) ? allRequests : []).forEach((r) => {
          if (ownedIds.has(r.projectId) && (r.status === 'Approved' || r.status === 'Rejected')) {
            const p = owned.find((proj) => proj.id === r.projectId);
            const pName = p ? (p.title || p.name) : `Project #${r.projectId}`;
            actions.push({
              id: `req-res-${r.id}`,
              title: r.status === 'Approved' ? 'Join Request Approved' : 'Join Request Declined',
              message: `You ${r.status === 'Approved' ? 'accepted' : 'declined'} ${r.userName || 'applicant'} for "${pName}".`,
              timestamp: r.updatedAt || r.createdAt,
              type: r.status === 'Approved' ? 'success' : 'info',
            });
          }
        });

        (tasks || []).forEach((t) => {
          const rawStatus = (t.status || '').toLowerCase();
          if (rawStatus === 'completed' || rawStatus === 'approved') {
            const p = owned.find((proj) => proj.id === t.projectId);
            const pName = p ? (p.title || p.name) : 'Project';
            actions.push({
              id: `task-app-${t.id}`,
              title: 'Task Approved',
              message: `You approved task "${t.title}" for ${t.assignee || 'collaborator'} in "${pName}".`,
              timestamp: t.updatedAt || t.createdAt,
              type: 'success',
            });
          }
        });

        if (isMounted) {
          setOwnedProjects(owned);
          setActiveProjectsCount(activeOwned.length);
          setTasksByProject(tasksMap);
          setPendingRequestsCount(pendingReqs.length);
          setTotalCollaborators(uniqueCollabIds.size);
          setTotalTasksCount(taskCount);
          setOwnerActions(actions);
        }
      } catch (err) {
        console.error('Failed to load owner dashboard metrics:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDashboardMetrics();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.name]);

  const displayName = user?.name || 'Project Owner';

  const recentActivity = (() => {
    const activityMap = new Map();
    if (Array.isArray(notifications)) {
      notifications.forEach((n) => {
        const rawType = (n.type || '').toLowerCase();
        const dotType =
          rawType.includes('approved') || rawType.includes('completed') || rawType.includes('success')
            ? 'success'
            : rawType.includes('warning') || rawType.includes('declined') || rawType.includes('rejected')
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

    ownerActions.forEach((act) => {
      if (!activityMap.has(act.id)) {
        activityMap.set(act.id, act);
      }
    });

    return Array.from(activityMap.values())
      .filter((a) => Boolean(a.timestamp))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  })();

  return (
    <div className="tf-owner-dash-container">
      <div className="tf-owner-dash-header">
        <div>
          <h1 className="tf-owner-dash-title">Owner Dashboard</h1>
          <p className="tf-owner-dash-subtitle">Welcome back, {displayName}! Manage your projects and team pipeline.</p>
        </div>
        <button
          type="button"
          className="tf-owner-dash-btn-primary"
          onClick={() => navigate('/create-project')}
        >
          <PlusIcon /> New Project
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="tf-owner-dash-stats-grid">
        <StatCard
          icon="📁"
          label="Active Projects"
          value={activeProjectsCount}
        />
        <StatCard
          icon="👥"
          label="Total Collaborators"
          value={totalCollaborators}
        />
        <StatCard
          icon="⏳"
          label="Pending Join Requests"
          value={pendingRequestsCount}
          subtext={pendingRequestsCount > 0 ? "Requires attention" : "All clear"}
        />
        <StatCard
          icon="✅"
          label="Total Tasks"
          value={totalTasksCount}
        />
      </div>

      {/* Recent Activity */}
      <div className="tf-owner-dash-section">
        <div className="tf-owner-dash-section-header">
          <h2 className="tf-owner-dash-section-title">Recent Activity</h2>
        </div>
        <div className="tf-owner-dash-activity-list">
          {recentActivity.length > 0 ? (
            recentActivity.map((act) => (
              <div key={act.id} className="tf-owner-dash-activity-item">
                <div className={`tf-owner-dash-act-dot ${act.type || 'info'}`}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="tf-owner-dash-act-title">{act.title}</span>
                    {act.timestamp && (
                      <span className="tf-owner-dash-act-time">
                        {formatRelativeTime(act.timestamp)}
                      </span>
                    )}
                  </div>
                  <div className="tf-owner-dash-act-desc">{act.message}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="tf-owner-dash-act-empty">No recent activity.</div>
          )}
        </div>
      </div>

      {/* Recent Owned Projects */}
      <div className="tf-owner-dash-section">
        <div className="tf-owner-dash-section-header">
          <h2 className="tf-owner-dash-section-title">Your Projects</h2>
          <span className="tf-owner-dash-link" onClick={() => navigate('/my-projects')}>
            View All ({ownedProjects.length}) →
          </span>
        </div>

        {loading ? (
          <p>Loading projects...</p>
        ) : ownedProjects.length > 0 ? (
          <div className="tf-owner-dash-projects-grid">
            {ownedProjects.slice(0, 3).map((p) => {
              const projectTasks = tasksByProject[String(p.id)];
              const progress = projectTasks ? calculateProjectProgress(projectTasks) : (Number(p.progress) || 0);
              return (
                <ProjectCard
                  key={p.id}
                  project={p}
                  variant="owner"
                  progress={progress}
                  onSelect={() => navigate(`/owner/workspace/${p.id}`)}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon="📁"
            title="No projects yet"
            message="You haven't created any projects yet."
            actionLabel="Create Your First Project"
            onAction={() => navigate('/create-project')}
          />
        )}
      </div>
    </div>
  );
};

export default OwnerDashboard;
