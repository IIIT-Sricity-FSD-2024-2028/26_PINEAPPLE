import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/selectors/sessionSelectors';
import { fetchMyWork } from '../../store/thunks/projectsThunks';
import { fetchTasksForProjects } from '../../store/thunks/tasksThunks';
import {
  setMyWorkFilter,
  setSummaryProjectId,
} from '../../store/slices/projectsSlice';
import {
  selectMyWorkCompletedProjects,
  selectMyWorkOngoingProjects,
  selectMyWorkStatus,
  selectProjectById,
  selectProjectSummaryCounts,
  selectProjectsWorking,
} from '../../store/selectors/projectsSelectors';
import { selectTasksMapByProject } from '../../store/selectors/tasksSelectors';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import FilterTabs from '../../components/common/FilterTabs';
import ProjectCard from '../../components/features/ProjectCard';
import { calculateProjectProgress } from '../../utils/progress';
import { getTaskReward } from '../../utils/workflow';
import './myWork.css';

const MyWorkContent = () => {
  const user = useSelector(selectCurrentUser);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const ongoingProjects = useSelector(selectMyWorkOngoingProjects);
  const completedProjects = useSelector(selectMyWorkCompletedProjects);
  const myWorkStatus = useSelector(selectMyWorkStatus);
  const summaryCounts = useSelector(selectProjectSummaryCounts);
  const working = useSelector(selectProjectsWorking);
  const filter = working.myWorkFilter || 'ongoing';
  const summaryProjectId = working.summaryProjectId;
  const summaryProject = useSelector((state) =>
    summaryProjectId ? selectProjectById(state, summaryProjectId) : null,
  );

  const tasksMap = useSelector(selectTasksMapByProject);

  const currentUserId = user?.id;
  const currentUserName = user?.name || '';
  const loading = myWorkStatus === 'loading';

  const ongoingCount =
    typeof summaryCounts.myWorkOngoingCount === 'number' &&
    (summaryCounts.myWorkOngoingCount > 0 || ongoingProjects.length === 0)
      ? summaryCounts.myWorkOngoingCount
      : ongoingProjects.length;
  const completedCount =
    typeof summaryCounts.myWorkCompletedCount === 'number' &&
    (summaryCounts.myWorkCompletedCount > 0 || completedProjects.length === 0)
      ? summaryCounts.myWorkCompletedCount
      : completedProjects.length;

  useEffect(() => {
    if (!currentUserId) return;
    dispatch(fetchMyWork({ userId: currentUserId, userName: currentUserName }));
  }, [dispatch, currentUserId, currentUserName]);

  const allWorkProjectIds = useMemo(
    () =>
      [...ongoingProjects, ...completedProjects]
        .map((p) => p.id)
        .filter(Boolean),
    [ongoingProjects, completedProjects],
  );
  const allWorkIdsKey = allWorkProjectIds.join(',');

  useEffect(() => {
    if (!allWorkIdsKey) return;
    const ids = allWorkIdsKey.split(',').filter(Boolean);
    if (ids.length === 0) return;
    dispatch(fetchTasksForProjects({ projectIds: ids, force: true }));
  }, [dispatch, allWorkIdsKey]);

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
            { id: 'ongoing', label: `Ongoing (${ongoingCount})` },
            { id: 'completed', label: `Completed (${completedCount})` },
          ]}
          activeTab={filter}
          onChange={(tab) => dispatch(setMyWorkFilter(tab))}
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
                  (currentUserName &&
                    ((t.assigneeName && t.assigneeName.toLowerCase() === currentUserName.toLowerCase()) ||
                      (t.assignee && t.assignee.toLowerCase() === currentUserName.toLowerCase()))),
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
                  onSummary={(p) => dispatch(setSummaryProjectId(p.id))}
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
        onClose={() => dispatch(setSummaryProjectId(null))}
        footer={
          <button
            type="button"
            className="tf-mywork-btn-primary"
            onClick={() => dispatch(setSummaryProjectId(null))}
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
                        (currentUserName &&
                          ((t.assigneeName && t.assigneeName.toLowerCase() === currentUserName.toLowerCase()) ||
                            (t.assignee && t.assignee.toLowerCase() === currentUserName.toLowerCase())))) &&
                      (t.status === 'Completed' || String(t.status).toLowerCase() === 'completed'),
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
                          (currentUserName &&
                            ((t.assigneeName && t.assigneeName.toLowerCase() === currentUserName.toLowerCase()) ||
                              (t.assignee && t.assignee.toLowerCase() === currentUserName.toLowerCase())))) &&
                        (t.status === 'Completed' || String(t.status).toLowerCase() === 'completed'),
                    )
                    .reduce((sum, t) => sum + getTaskReward(t.priority || t.difficulty).xp, 0)}{' '}
                  XP
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

const MyWork = MyWorkContent;
export default MyWork;
