import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import joinRequestsApi from '../../services/joinRequestsApi';
import './myWork.css';

/* ── Extracted SVG Sub-components ── */
const TrophyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1h10v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34" />
    <path d="M6 4h12a2 2 0 0 1 2 2v3a6 6 0 0 1-6 6h0a6 6 0 0 1-6-6V6a2 2 0 0 1 2-2z" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TasksListIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const MyWork = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [filter, setFilter] = useState('ongoing');
  const [projects, setProjects] = useState([]);
  const [tasksMap, setTasksMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [summaryProject, setSummaryProject] = useState(null);

  useEffect(() => {
    fetchMyWorkData();
  }, [user]);

  const fetchMyWorkData = async () => {
    setLoading(true);
    try {
      const currentUserId = user?.id;
      const currentUserName = user?.name || '';

      const [allProjects, approvedRequests] = await Promise.all([
        projectsApi.list().catch(() => []),
        joinRequestsApi.list({ userId: currentUserId, status: 'Approved' }).catch(() => []),
      ]);

      const approvedProjectIds = new Set(
        (Array.isArray(approvedRequests) ? approvedRequests : []).map((r) => r.projectId)
      );

      // Projects where user is collaborator (in project.collaborators or approved join-request)
      const collaborativeProjects = (Array.isArray(allProjects) ? allProjects : []).filter((p) => {
        const isOwner = p.owner === currentUserName || p.ownerId === currentUserId;
        if (isOwner) return false;

        const isExplicitMember =
          Array.isArray(p.collaborators) &&
          p.collaborators.some(
            (c) =>
              c === currentUserId ||
              c === currentUserName ||
              (typeof c === 'object' && (c.id === currentUserId || c.name === currentUserName))
          );

        return isExplicitMember || approvedProjectIds.has(p.id);
      });

      setProjects(collaborativeProjects);

      // Fetch tasks for these projects
      const projectIds = collaborativeProjects.map((p) => p.id);
      if (projectIds.length > 0) {
        const allTasks = await tasksApi.listForProjects(projectIds);
        const mapped = {};
        allTasks.forEach((t) => {
          if (!mapped[t.projectId]) mapped[t.projectId] = [];
          mapped[t.projectId].push(t);
        });
        setTasksMap(mapped);
      }
    } catch (err) {
      console.error('Failed to load my work data:', err);
    } finally {
      setLoading(false);
    }
  };

  const ongoingProjects = projects.filter((p) => p.status !== 'Completed' && (Number(p.progress) || 0) < 100);
  const completedProjects = projects.filter((p) => p.status === 'Completed' || (Number(p.progress) || 0) >= 100);
  const visibleProjects = filter === 'completed' ? completedProjects : ongoingProjects;

  const getTaskBadgeClass = (status) => {
    switch (status) {
      case 'Completed':
        return 'tf-mywork-badge-done';
      case 'In Progress':
        return 'tf-mywork-badge-progress';
      default:
        return 'tf-mywork-badge-pending';
    }
  };

  return (
    <div className="tf-mywork-container">
      <div className="tf-mywork-header">
        <h1 className="tf-mywork-title">My Work</h1>
        <p className="tf-mywork-subtitle">Projects where you are a collaborator.</p>
      </div>

      <div className="tf-mywork-switch">
        <button
          type="button"
          className={`tf-mywork-switch-btn ${filter === 'ongoing' ? 'active' : ''}`}
          onClick={() => setFilter('ongoing')}
        >
          Ongoing ({ongoingProjects.length})
        </button>
        <button
          type="button"
          className={`tf-mywork-switch-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed ({completedProjects.length})
        </button>
      </div>

      <div id="my-work-content">
        {loading ? (
          <div className="tf-mywork-empty-card">
            <p>Loading your work...</p>
          </div>
        ) : visibleProjects.length > 0 ? (
          <div className="tf-mywork-projects-list">
            {visibleProjects.map((project) => {
              const projectTasks = tasksMap[project.id] || [];
              const myTasks = projectTasks.filter(
                (t) => t.assigneeId === user?.id || t.assignee === user?.name
              );
              const progress = Number(project.progress) || 0;

              return (
                <div key={project.id} className="tf-mywork-project-card">
                  <div className="tf-mywork-project-header">
                    <div>
                      <h2 className="tf-mywork-card-title">{project.title || project.name}</h2>
                      <p className="tf-mywork-card-desc">{project.description || project.desc}</p>
                    </div>
                    <div className="tf-mywork-progress-box">
                      <div className="tf-mywork-progress-text">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="tf-mywork-progress-bar">
                        <div
                          className="tf-mywork-progress-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Collaborator Tasks */}
                  <div className="tf-mywork-tasks-section">
                    <div className="tf-mywork-tasks-label">
                      <TasksListIcon />
                      Your Tasks ({myTasks.length})
                    </div>
                    {myTasks.length > 0 ? (
                      <div className="tf-mywork-task-items">
                        {myTasks.map((task) => (
                          <div key={task.id} className="tf-mywork-task-row">
                            <span className="tf-mywork-task-name">{task.title}</span>
                            <div>
                              <span className="tf-mywork-task-xp">+{task.xpReward || 50} XP</span>
                              <span className={`tf-mywork-badge ${getTaskBadgeClass(task.status)}`}>
                                {task.status || 'To Do'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="tf-mywork-card-desc">No tasks currently assigned to you.</p>
                    )}
                  </div>

                  <div className="tf-mywork-card-footer">
                    <span className="tf-mywork-mentor-chip">
                      Mentor: <strong>{project.mentor || 'Not assigned'}</strong>
                    </span>

                    {filter === 'completed' ? (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {project.finishedLink ? (
                          <a
                            href={project.finishedLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tf-mywork-link"
                          >
                            Open finished project <ExternalLinkIcon />
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="tf-mywork-btn-outline"
                          onClick={() => setSummaryProject(project)}
                        >
                          Contribution Summary
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="tf-mywork-btn-primary"
                        onClick={() => navigate(`/workspace/${project.id}`)}
                      >
                        Open Workspace
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="tf-mywork-empty-card">
            <h3>No {filter} projects found</h3>
            <p>
              {filter === 'ongoing'
                ? 'Join open projects from the marketplace to start collaborating!'
                : 'Completed projects will be archived and displayed here with your achievements.'}
            </p>
            {filter === 'ongoing' && (
              <button
                type="button"
                className="tf-mywork-btn-primary"
                onClick={() => navigate('/projects')}
              >
                Browse Marketplace
              </button>
            )}
          </div>
        )}
      </div>

      {/* Contribution Summary Modal */}
      {summaryProject && (
        <div
          id="modal-contribution-summary"
          className="tf-mywork-modal-overlay"
          onClick={() => setSummaryProject(null)}
        >
          <div
            className="tf-mywork-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-mywork-modal-header">
              <h3 className="tf-mywork-modal-title">
                <TrophyIcon /> Your Contribution Summary
              </h3>
              <button
                type="button"
                className="tf-mywork-btn-outline"
                onClick={() => setSummaryProject(null)}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="tf-mywork-summary-grid">
              <div className="tf-mywork-summary-stat">
                <div className="tf-mywork-stat-val">
                  {(tasksMap[summaryProject.id] || []).filter(
                    (t) => (t.assigneeId === user?.id || t.assignee === user?.name) && t.status === 'Completed'
                  ).length}
                </div>
                <div className="tf-mywork-stat-lbl">Tasks Completed</div>
              </div>
              <div className="tf-mywork-summary-stat">
                <div className="tf-mywork-stat-val">
                  {(tasksMap[summaryProject.id] || [])
                    .filter((t) => (t.assigneeId === user?.id || t.assignee === user?.name) && t.status === 'Completed')
                    .reduce((sum, t) => sum + (t.xpReward || 50), 0)} XP
                </div>
                <div className="tf-mywork-stat-lbl">Total XP Earned</div>
              </div>
            </div>

            <p className="tf-mywork-card-desc">
              Great job! Your contributions to <strong>{summaryProject.title || summaryProject.name}</strong> were verified by the project owner and applied to your global developer score.
            </p>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="tf-mywork-btn-primary"
                onClick={() => setSummaryProject(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyWork;
