import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import projectsApi from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import { getCurrentUserRole } from '../../services/apiClient';
import ConfirmModal from '../../components/common/ConfirmModal';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import './AdminProjectDetails.css';

const AdminProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const role = getCurrentUserRole();
  const isSuperUser = role === 'Super User' || role === 'superuser' || sessionStorage.getItem('teamforge.isSuperUser') === 'true' || sessionStorage.getItem('teamforge.portalRole') === 'superuser';

  useEffect(() => {
    let isMounted = true;
    const loadProject = async () => {
      try {
        const [projectData, tasksData] = await Promise.all([
          projectsApi.get(id),
          tasksApi.list({ projectId: id }).catch(() => []) // Fallback to empty array if tasks fail
        ]);
        if (isMounted) {
          setProject(projectData);
          setTasks(Array.isArray(tasksData) ? tasksData : []);
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

  const [confirmConfig, setConfirmConfig] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleDelete = () => {
    setConfirmConfig({
      type: 'delete',
      title: 'Delete Project',
      message: 'Are you sure you want to permanently delete this project? This action cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Delete Project',
      action: async () => {
        setActionLoading(true);
        try {
          await projectsApi.remove(id);
          setConfirmConfig(null);
          navigate('/admin/projects');
        } catch (err) {
          alert(err.message || 'Failed to delete project');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleToggleSuspend = () => {
    const isSuspended = project?.status?.toLowerCase() === 'suspended';
    const actionText = isSuspended ? 'unsuspend' : 'suspend';
    const newStatus = isSuspended ? 'Open' : 'Suspended';

    setConfirmConfig({
      type: 'toggleSuspend',
      title: isSuspended ? 'Unsuspend Project' : 'Suspend Project',
      message: `Are you sure you want to ${actionText} this project?`,
      variant: isSuspended ? 'primary' : 'warning',
      confirmLabel: isSuspended ? 'Unsuspend Project' : 'Suspend Project',
      action: async () => {
        setActionLoading(true);
        try {
          await projectsApi.update(id, { status: newStatus });
          setProject((prev) => (prev ? { ...prev, status: newStatus } : null));
          setConfirmConfig(null);
        } catch (err) {
          alert(err.message || `Failed to ${actionText} project`);
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="admin-page admin-project-details-page">
        <button className="btn btn-outline mb-4" onClick={() => navigate('/admin/projects')}>
          ← Back to Projects
        </button>
        <div className="admin-project-details-loading">Loading project details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page admin-project-details-page">
        <button className="btn btn-outline mb-4" onClick={() => navigate('/admin/projects')}>
          ← Back to Projects
        </button>
        <div className="admin-project-details-error text-danger">{error}</div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="admin-page admin-project-details-page">
      <div className="admin-project-details-header">
        <button className="btn btn-outline" onClick={() => navigate('/admin/projects')}>
          ← Back to Projects
        </button>
        {isSuperUser && (
          <div className="admin-project-details-actions">
            <button 
              className={`btn ${project.status?.toLowerCase() === 'suspended' ? 'btn-success' : 'btn-warning'} mr-2`} 
              onClick={handleToggleSuspend}
            >
              {project.status?.toLowerCase() === 'suspended' ? 'Unsuspend Project' : 'Suspend Project'}
            </button>
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete Project
            </button>
          </div>
        )}
      </div>

      <div className="admin-project-details-grid mt-4">
        <div className="card glass-card admin-project-meta">
          <h2>Project Meta</h2>
          <div className="meta-info mt-3">
            <p><strong>Title:</strong> {project.title || project.name || 'Untitled'}</p>
            <p><strong>Description:</strong> {project.description || 'No description provided.'}</p>
            <p><strong>Status:</strong> <Badge variant={project.isCompleted || String(project.status || '').toLowerCase() === 'completed' ? 'completed' : project.status?.toLowerCase() === 'suspended' ? 'suspended' : 'open'}>{project.isCompleted || String(project.status || '').toLowerCase() === 'completed' ? 'Completed' : (project.status || 'Open')}</Badge></p>
            <p><strong>Difficulty:</strong> {project.difficulty || '—'}</p>
            <p><strong>Duration:</strong> {project.duration || '—'}</p>
            <p><strong>Required Skills:</strong> {Array.isArray(project.requiredSkills) ? project.requiredSkills.join(', ') : (project.requiredSkills || 'None')}</p>
            <p><strong>Owner:</strong> {project.owner?.name || project.owner || project.ownerId || 'Unassigned'}</p>
          </div>
        </div>

        <div className="card glass-card admin-project-team">
          <h2>Team Members</h2>
          <div className="team-list mt-3">
            {Array.isArray(project.members) && project.members.length > 0 ? (
              <ul className="collaborators-list">
                {project.members.map((member, index) => {
                  const roleLower = String(member.role || 'Member').toLowerCase();
                  const badgeVariant =
                    roleLower === 'owner' ? 'primary' :
                    roleLower === 'mentor' ? 'purple' : 'info';
                  return (
                    <li key={member.id || index} className="collaborator-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="collab-name" style={{ fontWeight: 500 }}>{member.name || member.id}</span>
                      <Badge variant={badgeVariant}>{member.role || 'Member'}</Badge>
                    </li>
                  );
                })}
              </ul>
            ) : Array.isArray(project.collaborators) && project.collaborators.length > 0 ? (
              <ul className="collaborators-list">
                {project.collaborators.map((collab, index) => (
                  <li key={collab.id || index} className="collaborator-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="collab-name" style={{ fontWeight: 500 }}>{collab.name || collab.id}</span>
                    <Badge variant="info">{collab.role || 'Contributor'}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon="👥"
                title="No team members yet"
                message="This project currently has no assigned team members."
              />
            )}
          </div>
        </div>
      </div>

      <div className="card glass-card mt-4 admin-project-tasks">
        <h2>Tasks & Milestones</h2>
        <div className="mt-3">
          <DataTable
            columns={[
              {
                header: 'Task Title',
                key: 'title',
                render: (task) => task.title || task.name || 'Untitled Task',
              },
              {
                header: 'Status',
                key: 'status',
                render: (task) => {
                  const s = (task.status || '').toLowerCase();
                  const variant = s === 'completed' || s === 'approved' ? 'completed' : s === 'in review' ? 'in-review' : 'in-progress';
                  return <Badge variant={variant}>{task.status || 'Open'}</Badge>;
                },
              },
              {
                header: 'Assignee',
                key: 'assignee',
                render: (task) => task.assignee?.name || task.assignee || task.assigneeId || 'Unassigned',
              },
              {
                header: 'Due Date',
                key: 'dueDate',
                render: (task) => task.dueDate || '—',
              },
            ]}
            data={tasks}
            emptyTitle="No tasks found"
            emptyMessage="No tasks found for this project."
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(confirmConfig)}
        title={confirmConfig?.title || 'Confirm Action'}
        message={confirmConfig?.message}
        variant={confirmConfig?.variant || 'danger'}
        confirmLabel={confirmConfig?.confirmLabel || 'Confirm'}
        loading={actionLoading}
        onConfirm={() => confirmConfig?.action && confirmConfig.action()}
        onCancel={() => setConfirmConfig(null)}
      />
    </div>
  );
};

export default AdminProjectDetails;
