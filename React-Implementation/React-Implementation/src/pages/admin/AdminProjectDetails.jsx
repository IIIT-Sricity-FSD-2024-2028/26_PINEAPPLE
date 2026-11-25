import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import projectsApi, { isProjectLocked } from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import adminApi from '../../services/adminApi';
import DeleteProjectDialog from '../../components/features/DeleteProjectDialog';
import ProjectHeader from './ProjectHeader';
import ProjectDetailsCard from './ProjectDetailsCard';
import TeamMembersCard from './TeamMembersCard';
import TasksMilestonesCard from './TasksMilestonesCard';
import EscrowFinancialsCard from './EscrowFinancialsCard';
import './AdminProjectDetails.css';

const AdminProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [closingProject, setClosingProject] = useState(false);
  const [closeError, setCloseError] = useState(null);
  const [restoringProject, setRestoringProject] = useState(false);
  const [restoreError, setRestoreError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancellingDeletion, setCancellingDeletion] = useState(false);
  const [cancelDeletionError, setCancelDeletionError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'escrow'
  const [escrowSummary, setEscrowSummary] = useState(null);

  const handleCancelDeletion = async () => {
    if (cancellingDeletion) return;
    setCancellingDeletion(true);
    setCancelDeletionError(null);
    try {
      const res = await projectsApi.cancelDeletion(id);
      if (res?.project) {
        setProject(res.project);
      } else {
        const fresh = await projectsApi.get(id);
        setProject(fresh);
      }
    } catch (err) {
      setCancelDeletionError(err?.serverMessage || err?.message || 'Failed to cancel deletion.');
    } finally {
      setCancellingDeletion(false);
    }
  };

  const handleRestoreProject = async () => {
    if (restoringProject || typeof projectsApi.restore !== 'function') return;
    setRestoringProject(true);
    setRestoreError(null);
    try {
      const res = await projectsApi.restore(id);
      if (res?.project) {
        setProject(res.project);
      } else {
        setProject((prev) => (prev ? { ...prev, deletedAt: undefined, deletedBy: undefined } : prev));
      }
    } catch (err) {
      setRestoreError(err?.serverMessage || err?.message || 'Failed to restore project.');
    } finally {
      setRestoringProject(false);
    }
  };

  const handleAdminCloseProject = async () => {
    if (closingProject || isProjectLocked(project) || typeof projectsApi.close !== 'function') return;
    setClosingProject(true);
    setCloseError(null);
    try {
      const updated = await projectsApi.close(id, 'Owner inactive');
      if (updated) {
        setProject(updated);
      }
    } catch (err) {
      setCloseError(err?.serverMessage || err?.message || 'Failed to close project.');
    } finally {
      setClosingProject(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadProject = async () => {
      try {
        const [projectData, tasksData, escrowData] = await Promise.all([
          projectsApi.get(id),
          tasksApi.list({ projectId: id }).catch(() => []),
          typeof adminApi.getProjectEscrow === 'function'
            ? adminApi.getProjectEscrow(id).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (isMounted) {
          setProject(projectData);
          setTasks(Array.isArray(tasksData) ? tasksData : []);
          setEscrowSummary(escrowData);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch project details');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProject();
    return () => {
      isMounted = false;
    };
  }, [id]);

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
        setActiveTab={setActiveTab}
        onDeleteProject={() => setDeleteDialogOpen(true)}
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
        onClose={() => setDeleteDialogOpen(false)}
        onSuccess={(result) => {
          if (result?.project) {
            setProject(result.project);
          } else {
            projectsApi.get(id).then(setProject).catch(() => {});
          }
        }}
        onCloseProject={() => {
          handleAdminCloseProject();
        }}
      />
    </div>
  );
};

export default AdminProjectDetails;
