import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi, { isProjectLocked } from '../../services/projectsApi';
import ProjectCard from '../../components/features/ProjectCard';
import EmptyState from '../../components/common/EmptyState';
import FilterTabs from '../../components/common/FilterTabs';
import './myProjects.css';

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const FolderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const MyProjects = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadOwnedProjects = async () => {
      try {
        const currentUserId = user?.id;
        const currentUserName = user?.name || '';

        const allProjects = await projectsApi.list({ status: 'all' }).catch(() => []);
        const owned = (Array.isArray(allProjects) ? allProjects : []).filter(
          (p) => p.ownerId === currentUserId || p.owner === currentUserName
        );

        if (isMounted) {
          setProjects(owned);
        }
      } catch (err) {
        console.error('Failed to load owned projects:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadOwnedProjects();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.name]);

  const isClosedProject = (p) => String(p.status || '').toLowerCase() === 'closed';
  const isCompletedProject = (p) => !isClosedProject(p) && (p.isCompleted === true || isProjectLocked(p));
  const activeProjects = projects.filter((p) => !isClosedProject(p) && !isCompletedProject(p));
  const completedProjects = projects
    .filter(isCompletedProject)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
  const closedProjects = projects.filter(isClosedProject);

  const [nowTs] = useState(() => Date.now());
  const formatPauseCountdown = (proj) => {
    const expiresMs = proj.pendingReviewGraceExpiresAt
      ? new Date(proj.pendingReviewGraceExpiresAt).getTime()
      : new Date(proj.pausedAt).getTime() + 48 * 60 * 60 * 1000;
    const diffMs = Math.max(0, expiresMs - nowTs);
    if (diffMs === 0) return '0h remaining (closing soon)';
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${totalHours}h ${mins}m remaining`;
  };

  const pausedPendingProjects = activeProjects.filter(
    (p) => Boolean(p.pausedAt) && (p.pendingRequestsCount === undefined || p.pendingRequestsCount > 0),
  );

  return (
    <div id="page-my-projects" className="tf-myproj-container">
      <div className="tf-myproj-header">
        <div>
          <h1 className="tf-myproj-title">My Projects</h1>
          <p className="tf-myproj-subtitle">Projects you own and manage.</p>
        </div>
        <button
          type="button"
          className="tf-myproj-btn-primary"
          onClick={() => navigate('/create-project')}
        >
          <PlusIcon /> Create Project
        </button>
      </div>

      {pausedPendingProjects.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {pausedPendingProjects.map((p) => (
            <div
              key={`pause-banner-${p.id}`}
              data-testid={`myprojects-zombie-banner-${p.id}`}
              role="alert"
              style={{
                padding: '12px 18px',
                borderRadius: '8px',
                background: '#fffbeb',
                border: '1px solid #f59e0b',
                color: '#92400e',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <strong>⏳ 48-Hour Countdown Running:</strong> Project{' '}
                <strong>{p.title || p.name}</strong> has pending join requests at Day 5. Decide within{' '}
                <strong>{formatPauseCountdown(p)}</strong> or the project closes automatically.
              </div>
              <button
                type="button"
                className="tf-myproj-btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.85rem', backgroundColor: '#d97706' }}
                onClick={() => navigate(`/owner/workspace/${p.id}`)}
              >
                Decide Pending Requests →
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <FilterTabs
            tabs={[
              { id: 'all', label: 'All', count: projects.length },
              { id: 'active', label: 'Active', count: activeProjects.length },
              { id: 'completed', label: 'Completed', count: completedProjects.length },
              { id: 'closed', label: 'Closed', count: closedProjects.length }
            ]}
            activeTab={filter}
            onChange={setFilter}
          />
        </div>
      )}

      {loading ? (
        <div className="tf-myproj-section">
          <p className="tf-myproj-empty">Loading your projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects created yet"
          message="Ready to start building? Create your first project to recruit collaborators!"
          actionLabel="Create Project"
          onAction={() => navigate('/create-project')}
        />
      ) : (
        <>
          {(filter === 'all' || filter === 'active') && (
            <div className="tf-myproj-section">
              <div className="tf-myproj-section-title">
                <FolderIcon /> Active ({activeProjects.length})
              </div>
              {activeProjects.length > 0 ? (
                <div className="tf-myproj-grid">
                  {activeProjects.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      variant="owner"
                      onSelect={(proj) => navigate(`/owner/workspace/${proj.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <p className="tf-myproj-empty">No active projects.</p>
              )}
            </div>
          )}

          {(filter === 'all' || filter === 'completed') && completedProjects.length > 0 && (
            <div className="tf-myproj-section">
              <div className="tf-myproj-section-title">
                🏆 Completed & Archived ({completedProjects.length})
              </div>
              <div className="tf-myproj-grid">
                {completedProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    variant="owner"
                    onSelect={(proj) => navigate(`/owner/workspace/${proj.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {(filter === 'all' || filter === 'closed') && closedProjects.length > 0 && (
            <div className="tf-myproj-section">
              <div className="tf-myproj-section-title" style={{ color: '#b91c1c' }}>
                🛑 Closed Projects ({closedProjects.length})
              </div>
              <div className="tf-myproj-grid">
                {closedProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    variant="owner"
                    onSelect={(proj) => navigate(`/owner/workspace/${proj.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MyProjects;
