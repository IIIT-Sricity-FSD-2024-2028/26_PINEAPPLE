import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import projectsApi from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import { getCurrentUserRole } from '../../services/apiClient';
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectData, tasksData] = await Promise.all([
        projectsApi.get(id),
        tasksApi.list({ projectId: id }).catch(() => []) // Fallback to empty array if tasks fail
      ]);
      setProject(projectData);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch project details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this project?')) return;
    try {
      await projectsApi.remove(id);
      navigate('/admin/projects');
    } catch (err) {
      alert(err.message || 'Failed to delete project');
    }
  };

  const handleToggleSuspend = async () => {
    const isSuspended = project.status?.toLowerCase() === 'suspended';
    const actionText = isSuspended ? 'unsuspend' : 'suspend';
    const newStatus = isSuspended ? 'Open' : 'Suspended';

    if (!window.confirm(`Are you sure you want to ${actionText} this project?`)) return;
    try {
      await projectsApi.update(id, { status: newStatus });
      fetchData();
    } catch (err) {
      alert(err.message || `Failed to ${actionText} project`);
    }
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
            <p><strong>Status:</strong> <span className={`status-badge status-${(project.status || 'open').toLowerCase().replace(' ', '-')}`}>{project.status || 'Open'}</span></p>
            <p><strong>Difficulty:</strong> {project.difficulty || '—'}</p>
            <p><strong>Duration:</strong> {project.duration || '—'}</p>
            <p><strong>Required Skills:</strong> {Array.isArray(project.requiredSkills) ? project.requiredSkills.join(', ') : (project.requiredSkills || 'None')}</p>
            <p><strong>Owner:</strong> {project.owner?.name || project.owner || project.ownerId || 'Unassigned'}</p>
          </div>
        </div>

        <div className="card glass-card admin-project-team">
          <h2>Team Members</h2>
          <div className="team-list mt-3">
            {Array.isArray(project.collaborators) && project.collaborators.length > 0 ? (
              <ul className="collaborators-list">
                {project.collaborators.map((collab, index) => (
                  <li key={collab.id || index} className="collaborator-item">
                    <span className="collab-name">{collab.name || collab.id}</span>
                    <span className="collab-role">{collab.role || 'Member'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No team members yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card glass-card mt-4 admin-project-tasks">
        <h2>Tasks & Milestones</h2>
        <div className="overflow-x-auto mt-3">
          {tasks.length > 0 ? (
            <table className="admin-tasks-table">
              <thead>
                <tr>
                  <th>Task Title</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td>{task.title || task.name}</td>
                    <td>{task.status}</td>
                    <td>{task.assignee?.name || task.assigneeId || 'Unassigned'}</td>
                    <td>{task.dueDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted">No tasks found for this project.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProjectDetails;
