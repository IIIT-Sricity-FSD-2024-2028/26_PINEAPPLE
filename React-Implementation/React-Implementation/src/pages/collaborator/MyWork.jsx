import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi, { isProjectLocked } from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import joinRequestsApi from '../../services/joinRequestsApi';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import FilterTabs from '../../components/common/FilterTabs';
import ProjectCard from '../../components/features/ProjectCard';
import { calculateProjectProgress } from '../../utils/progress';
import { getTaskReward } from '../../utils/workflow';
import './myWork.css';

const MyWork = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [filter, setFilter] = useState('ongoing');
  const [projects, setProjects] = useState([]);
  const [tasksMap, setTasksMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [summaryProject, setSummaryProject] = useState(null);

  const currentUserId = user?.id;
  const currentUserName = user?.name || '';

  useEffect(() => {
    let isMounted = true;
    const loadMyWork = async () => {
      try {

        const [allProjects, myRequests] = await Promise.all([
          projectsApi.list().catch(() => []),
          joinRequestsApi.list({ userId: currentUserId }).catch(() => []),
        ]);

        const validRequestProjectIds = new Set(
          (Array.isArray(myRequests) ? myRequests : [])
            .filter((r) => {
              const st = String(r.status || '').toLowerCase();
              return st === 'approved' || st === 'completed';
            })
            .map((r) => r.projectId)
        );

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

          return isExplicitMember || validRequestProjectIds.has(p.id);
        });

        if (isMounted) {
          setProjects(collaborativeProjects);
        }

        const projectIds = collaborativeProjects.map((p) => p.id);
        if (projectIds.length > 0) {
          const allTasks = await tasksApi.listForProjects(projectIds);
          const mapped = {};
          allTasks.forEach((t) => {
            if (!mapped[t.projectId]) mapped[t.projectId] = [];
            mapped[t.projectId].push(t);
          });
          if (isMounted) {
            setTasksMap(mapped);
          }
        }
      } catch (err) {
        console.error('Failed to load my work data:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadMyWork();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, currentUserName]);

  const isCompletedProject = (p) => p.isCompleted === true || isProjectLocked(p);
  const ongoingProjects = projects.filter((p) => !isCompletedProject(p));
  const completedProjects = projects
    .filter(isCompletedProject)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
  const visibleProjects = filter === 'completed' ? completedProjects : ongoingProjects;

  return (
    <div className="tf-mywork-container">
      <div className="tf-mywork-header">
        <h1 className="tf-mywork-title">My Work</h1>
        <p className="tf-mywork-subtitle">Projects where you are a collaborator.</p>
      </div>

      <div className="tf-mywork-switch" style={{ width: 'fit-content', marginBottom: '24px' }}>
        <FilterTabs
          tabs={[
            { id: 'ongoing', label: `Ongoing (${ongoingProjects.length})` },
            { id: 'completed', label: `Completed (${completedProjects.length})` },
          ]}
          activeTab={filter}
          onChange={setFilter}
          ariaLabel="My work status filter"
        />
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
                (t) =>
                  (t.assigneeId && String(t.assigneeId) === String(currentUserId)) ||
                  (currentUserName && (
                    (t.assigneeName && t.assigneeName.toLowerCase() === currentUserName.toLowerCase()) ||
                    (t.assignee && t.assignee.toLowerCase() === currentUserName.toLowerCase())
                  ))
              );
              const progress = calculateProjectProgress(projectTasks);

              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  variant="mywork"
                  progress={progress}
                  taskCount={myTasks.length}
                  tasks={myTasks}
                  onSelect={() => navigate(`/workspace/${project.id}`)}
                  onSummary={(p) => setSummaryProject(p)}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={`No ${filter} projects found`}
            message={
              filter === 'ongoing'
                ? 'Join open projects from the marketplace to start collaborating!'
                : 'Completed projects will be archived and displayed here with your achievements.'
            }
            actionLabel={filter === 'ongoing' ? 'Browse Marketplace' : undefined}
            onAction={() => navigate('/projects')}
          />
        )}
      </div>

      {/* Contribution Summary Modal */}
      <Modal
        isOpen={Boolean(summaryProject)}
        title="Your Contribution Summary"
        onClose={() => setSummaryProject(null)}
        footer={
          <button
            type="button"
            className="tf-mywork-btn-primary"
            onClick={() => setSummaryProject(null)}
          >
            Done
          </button>
        }
      >
        {summaryProject && (
          <div>
            <div className="tf-mywork-summary-grid">
              <div className="tf-mywork-summary-stat">
                <div className="tf-mywork-stat-val">
                  {(tasksMap[summaryProject.id] || []).filter(
                    (t) =>
                      ((t.assigneeId && String(t.assigneeId) === String(currentUserId)) ||
                       (currentUserName && (
                         (t.assigneeName && t.assigneeName.toLowerCase() === currentUserName.toLowerCase()) ||
                         (t.assignee && t.assignee.toLowerCase() === currentUserName.toLowerCase())
                       ))) &&
                      (t.status === 'Completed' || String(t.status).toLowerCase() === 'completed')
                  ).length}
                </div>
                <div className="tf-mywork-stat-lbl">Tasks Completed</div>
              </div>
              <div className="tf-mywork-summary-stat">
                <div className="tf-mywork-stat-val">
                  {(tasksMap[summaryProject.id] || [])
                    .filter(
                      (t) =>
                        ((t.assigneeId && String(t.assigneeId) === String(currentUserId)) ||
                         (currentUserName && (
                           (t.assigneeName && t.assigneeName.toLowerCase() === currentUserName.toLowerCase()) ||
                           (t.assignee && t.assignee.toLowerCase() === currentUserName.toLowerCase())
                         ))) &&
                        (t.status === 'Completed' || String(t.status).toLowerCase() === 'completed')
                    )
                    .reduce((sum, t) => sum + getTaskReward(t.priority || t.difficulty).xp, 0)} XP
                </div>
                <div className="tf-mywork-stat-lbl">Total XP Earned</div>
              </div>
            </div>

            <p className="tf-mywork-card-desc">
              Great job! Your contributions to <strong>{summaryProject.title || summaryProject.name}</strong> were verified by the project owner and applied to your developer record.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MyWork;
