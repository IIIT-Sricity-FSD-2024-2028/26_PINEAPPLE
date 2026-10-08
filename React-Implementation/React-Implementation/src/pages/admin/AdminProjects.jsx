import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import projectsApi from '../../services/projectsApi';
import { getCurrentUserRole } from '../../services/apiClient';
import './AdminProjects.css';

const AdminProjects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await projectsApi.list();
      setProjects(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDeleteProject = async (id) => {
    if (!window.confirm(`Are you sure you want to delete this project?`)) return;
    try {
      await projectsApi.remove(id);
      fetchProjects();
    } catch (err) {
      alert(err.message || 'Failed to delete project');
    }
  };

  const role = getCurrentUserRole();
  const isSuperUser = role === 'Super User' || role === 'superuser' || sessionStorage.getItem('teamforge.isSuperUser') === 'true' || sessionStorage.getItem('teamforge.portalRole') === 'superuser';

  return (
    <div id="admin-projects" className="admin-page admin-projects-page">
      <h1>Projects</h1>
      <p className="page-subtitle mt-1">View all projects on the platform</p>
      
      {error && <div className="admin-projects-error">{error}</div>}
      
      <div className="card mt-4 admin-projects-card">
        <div id="admin-projects-list" className="overflow-x-auto">
          {loading ? (
            <div className="admin-projects-loading">Loading projects...</div>
          ) : (
            <table className="admin-projects-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Owner</th>
                  <th>Difficulty</th>
                  <th>Collaborators</th>
                  <th>Progress</th>
                  {isSuperUser && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr 
                    key={p.id} 
                    onClick={() => navigate(`/admin/projects/${p.id}`)}
                    style={{ cursor: 'pointer' }}
                    className="admin-projects-row"
                  >
                    <td>{p.title || p.name || 'Untitled'}</td>
                    <td>{p.owner?.name || p.owner || p.ownerId || 'Unassigned'}</td>
                    <td>{p.difficulty || '—'}</td>
                    <td>{Array.isArray(p.collaborators) ? p.collaborators.length : (p.collaborators ?? 0)}</td>
                    <td>{p.progress ?? 0}%</td>
                    {isSuperUser && (
                      <td className="text-right">
                        <button
                          className="btn btn-xs su-btn-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(p.id);
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={isSuperUser ? 6 : 5} className="admin-projects-empty">
                      No projects found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProjects;
