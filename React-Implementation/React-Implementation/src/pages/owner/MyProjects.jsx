import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import './myProjects.css';

/* ── Extracted SVG Sub-components ── */
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
  const [tasksMap, setTasksMap] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchOwnedProjects = async () => {
    setLoading(true);
    try {
      const currentUserId = user?.id;
      const currentUserName = user?.name || '';

      const allProjects = await projectsApi.list().catch(() => []);
      const owned = (Array.isArray(allProjects) ? allProjects : []).filter(
        (p) => p.ownerId === currentUserId || p.owner === currentUserName
      );

      setProjects(owned);

      // Fetch task stats for each project
      const projectIds = owned.map((p) => p.id);
      if (projectIds.length > 0) {
        const tasks = await tasksApi.listForProjects(projectIds);
        const mapped = {};
        tasks.forEach((t) => {
          if (!mapped[t.projectId]) mapped[t.projectId] = [];
          mapped[t.projectId].push(t);
        });
        setTasksMap(mapped);
      }
    } catch (err) {
      console.error('Failed to load owned projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOwnedProjects();
  }, [user]);

  const activeProjects = projects.filter(
    (p) => p.status !== 'Completed' && (Number(p.progress) || 0) < 100
  );
  const completedProjects = projects.filter(
    (p) => p.status === 'Completed' || (Number(p.progress) || 0) >= 100
  );

  const renderProjectCard = (p) => {
    const projectTasks = tasksMap[p.id] || [];
    const completedTasksCount = projectTasks.filter((t) => t.status === 'Completed').length;
    const totalTasksCount = projectTasks.length;
    const progress = Number(p.progress) || 0;
    const membersCount = Array.isArray(p.collaborators) ? p.collaborators.length : 0;
    const skills = p.skills || p.requiredSkills || [];

    return (
      <div
        key={p.id}
        className="tf-myproj-card"
        onClick={() => navigate(`/owner/workspace/${p.id}`)}
      >
        <div>
          <h3 className="tf-myproj-card-title">{p.title || p.name}</h3>
          <p className="tf-myproj-card-meta">
            {completedTasksCount}/{totalTasksCount} tasks completed · {membersCount} collaborators · {p.duration || 'Ongoing'}
          </p>
        </div>

        <div>
          <div className="tf-myproj-progress-info">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="tf-myproj-progress-bar">
            <div
              className="tf-myproj-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="tf-myproj-skills-wrap">
            {skills.map((s, idx) => (
              <span key={idx} className="tf-myproj-skill-badge">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

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

      {loading ? (
        <div className="tf-myproj-section">
          <p className="tf-myproj-empty">Loading your projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="tf-myproj-section">
          <div className="tf-myproj-empty">
            <FolderIcon />
            <h3>No projects created yet</h3>
            <p>Ready to start building? Create your first project to recruit collaborators!</p>
            <button
              type="button"
              className="tf-myproj-btn-primary"
              style={{ marginTop: '14px' }}
              onClick={() => navigate('/create-project')}
            >
              <PlusIcon /> Create Project
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="tf-myproj-section">
            <div className="tf-myproj-section-title">
              <FolderIcon /> Active ({activeProjects.length})
            </div>
            {activeProjects.length > 0 ? (
              <div className="tf-myproj-grid">
                {activeProjects.map((p) => renderProjectCard(p))}
              </div>
            ) : (
              <p className="tf-myproj-empty">No active projects.</p>
            )}
          </div>

          {completedProjects.length > 0 && (
            <div className="tf-myproj-section">
              <div className="tf-myproj-section-title">
                🏆 Completed & Archived ({completedProjects.length})
              </div>
              <div className="tf-myproj-grid">
                {completedProjects.map((p) => renderProjectCard(p))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MyProjects;
