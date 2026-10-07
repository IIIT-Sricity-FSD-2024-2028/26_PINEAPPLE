import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import joinRequestsApi from '../../services/joinRequestsApi';
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
  const navigate = useNavigate();

  const [ownedProjects, setOwnedProjects] = useState([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [totalCollaborators, setTotalCollaborators] = useState(0);
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDashboardMetrics = async () => {
    setLoading(true);
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
      setOwnedProjects(owned);

      const ownedIds = new Set(owned.map((p) => p.id));

      // Calculate pending join requests for owned projects
      const pendingReqs = (Array.isArray(allRequests) ? allRequests : []).filter(
        (r) => ownedIds.has(r.projectId) && r.status === 'Pending'
      );
      setPendingRequestsCount(pendingReqs.length);

      // Calculate unique collaborators
      let collabCount = 0;
      owned.forEach((p) => {
        if (Array.isArray(p.collaborators)) collabCount += p.collaborators.length;
      });
      setTotalCollaborators(collabCount);

      // Fetch task stats
      if (owned.length > 0) {
        const tasks = await tasksApi.listForProjects(Array.from(ownedIds));
        setTotalTasksCount(tasks.length);
      }
    } catch (err) {
      console.error('Failed to load owner dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();
  }, [user]);

  const displayName = user?.name || 'Project Owner';

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
        <div className="tf-owner-dash-stat-card">
          <div className="tf-owner-dash-stat-label">Active Projects</div>
          <div className="tf-owner-dash-stat-value">{ownedProjects.length}</div>
        </div>
        <div className="tf-owner-dash-stat-card">
          <div className="tf-owner-dash-stat-label">Total Collaborators</div>
          <div className="tf-owner-dash-stat-value">{totalCollaborators}</div>
        </div>
        <div className="tf-owner-dash-stat-card">
          <div className="tf-owner-dash-stat-label">Pending Join Requests</div>
          <div className="tf-owner-dash-stat-value" style={{ color: pendingRequestsCount > 0 ? '#b45309' : undefined }}>
            {pendingRequestsCount}
          </div>
        </div>
        <div className="tf-owner-dash-stat-card">
          <div className="tf-owner-dash-stat-label">Total Tasks</div>
          <div className="tf-owner-dash-stat-value">{totalTasksCount}</div>
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
              const progress = Number(p.progress) || 0;
              return (
                <div
                  key={p.id}
                  className="tf-owner-dash-project-card"
                  onClick={() => navigate(`/owner/workspace/${p.id}`)}
                >
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: '#111827' }}>
                      {p.title || p.name}
                    </h3>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.84rem', color: '#6b7280' }}>
                      {p.description || p.desc}
                    </p>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span>Progress</span>
                      <strong>{progress}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: '#5f513f' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#6b7280' }}>
            <p>You haven't created any projects yet.</p>
            <button
              type="button"
              className="tf-owner-dash-btn-primary"
              style={{ marginTop: '10px' }}
              onClick={() => navigate('/create-project')}
            >
              <PlusIcon /> Create Your First Project
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerDashboard;
