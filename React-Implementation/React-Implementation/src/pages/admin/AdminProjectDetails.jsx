import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { isProjectLocked } from '../../utils/projectStatus';
import { fetchTasksByProject } from '../../store/thunks/tasksThunks';
import { selectTasksByProjectId } from '../../store/selectors/tasksSelectors';
import {
  cancelAdminProjectDeletion,
  closeAdminProject,
  fetchAdminProjectDetails,
  restoreAdminProject,
} from '../../store/thunks/adminProjectsThunks';
import {
  applyAdminProjectSnapshot,
  setAdminDeleteDialogOpen,
  setAdminProjectActiveTab,
} from '../../store/slices/adminProjectsSlice';
import {
  selectAdminProjectById,
  selectAdminProjectEscrowById,
  selectAdminProjectsWorking,
} from '../../store/selectors/adminProjectsSelectors';
import DeleteProjectDialog from '../../components/features/DeleteProjectDialog';
import ProjectHeader from './ProjectHeader';
import ProjectDetailsCard from './ProjectDetailsCard';
import TeamMembersCard from './TeamMembersCard';
import TasksMilestonesCard from './TasksMilestonesCard';
import EscrowFinancialsCard from './EscrowFinancialsCard';
import './AdminProjectDetails.css';

const AdminProjectDetailsContent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const project = useSelector(selectAdminProjectById(id));
  const escrowSummary = useSelector(selectAdminProjectEscrowById(id));
  const tasks = useSelector((state) => selectTasksByProjectId(state, id));
  const working = useSelector(selectAdminProjectsWorking);

  const loading = Boolean(working.detailLoading && !project);
  const error = !project ? working.detailError : null;
  const closingProject = Boolean(working.closingProject);
  const closeError = working.closeError;
  const restoringProject = Boolean(working.restoringId && String(working.restoringId) === String(id));
  const restoreError = working.restoreError;
  const deleteDialogOpen = Boolean(working.deleteDialogOpen);
  const cancellingDeletion = Boolean(working.cancellingDeletion);
  const cancelDeletionError = working.cancelDeletionError;
  const activeTab = working.activeTab || 'overview';

  const handleCancelDeletion = () => {
    if (cancellingDeletion) return;
    dispatch(cancelAdminProjectDeletion(id));
  };

  const handleRestoreProject = () => {
    if (restoringProject) return;
    dispatch(restoreAdminProject(id));
  };

  const handleAdminCloseProject = () => {
    if (closingProject || isProjectLocked(project)) return;
    dispatch(closeAdminProject({ projectId: id, reason: 'Owner inactive' }));
  };

  useEffect(() => {
    if (!id) return;
    dispatch(fetchAdminProjectDetails(id));
    dispatch(fetchTasksByProject({ projectId: id, force: true }));
  }, [dispatch, id]);

  if (loading) {
    return (
      <div className="admin-page admin-project-details-page">
        <button
          type="button"
          className="btn btn-outline admin-back-btn mb-4"
          onClick={() => navigate('/admin/projects')}
        >
          ← Back to Projects
        </button>
        <div className="admin-project-details-loading">Loading project details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page admin-project-details-page">
        <button
          type="button"
          className="btn btn-outline admin-back-btn mb-4"
          onClick={() => navigate('/admin/projects')}
        >
          ← Back to Projects
        </button>
        <div className="admin-project-details-error text-danger">{error}</div>
      </div>
    );
  }

  if (!project) return null;

  const statusLower = String(project.status || '').toLowerCase();
  const isClosed = statusLower === 'closed';
  const isCompleted = project.isCompleted || statusLower === 'completed';

  return (
    <div className="admin-page admin-project-details-page">
      <ProjectHeader
        project={project}
        isClosed={isClosed}
        isCompleted={isCompleted}
        activeTab={activeTab}
        setActiveTab={(tab) => dispatch(setAdminProjectActiveTab(tab))}
        onDeleteProject={() => dispatch(setAdminDeleteDialogOpen(true))}
        navigate={navigate}
      />

      {activeTab === 'escrow' ? (
        <EscrowFinancialsCard escrowSummary={escrowSummary} />
      ) : (
        <>
          <div className="admin-project-details-grid">
            <ProjectDetailsCard
              project={project}
              isClosed={isClosed}
              isCompleted={isCompleted}
              restoringProject={restoringProject}
              restoreError={restoreError}
              handleRestoreProject={handleRestoreProject}
              cancellingDeletion={cancellingDeletion}
              cancelDeletionError={cancelDeletionError}
              handleCancelDeletion={handleCancelDeletion}
              closingProject={closingProject}
              closeError={closeError}
              handleAdminCloseProject={handleAdminCloseProject}
            />

            <TeamMembersCard project={project} />
          </div>

          <TasksMilestonesCard tasks={tasks} project={project} />
        </>
      )}

      <DeleteProjectDialog
        isOpen={deleteDialogOpen}
        projectId={id}
        projectTitle={project?.title || project?.name}
        isAdmin={true}
        onClose={() => dispatch(setAdminDeleteDialogOpen(false))}
        onSuccess={(result) => {
          if (result?.project) {
            dispatch(applyAdminProjectSnapshot(result.project));
          } else {
            dispatch(fetchAdminProjectDetails(id));
          }
        }}
        onCloseProject={() => {
          handleAdminCloseProject();
        }}
      />
    </div>
  );
};

const AdminProjectDetails = AdminProjectDetailsContent;

export default AdminProjectDetails;
