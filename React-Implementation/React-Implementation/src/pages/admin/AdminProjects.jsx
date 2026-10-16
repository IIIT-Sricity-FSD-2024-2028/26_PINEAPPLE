import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import projectsApi, { isProjectLocked, isProjectActive } from '../../services/projectsApi';
import { calculateProjectProgress } from '../../utils/progress';
import { getCurrentUserRole } from '../../services/apiClient';
import Badge from '../../components/common/Badge';
import SearchBar from '../../components/common/SearchBar';
import FilterTabs from '../../components/common/FilterTabs';
import DataTable from '../../components/common/DataTable';
import ConfirmModal from '../../components/common/ConfirmModal';
import './AdminProjects.css';

const OWNER_NAMES = {
  '1': 'Priya Patel',
  '2': 'Arjun Sharma',
  '3': 'Kavya Nair',
  '4': 'Rohan Iyer'
};

const getOwnerDisplayName = (p) => {
  if (p.owner && typeof p.owner === 'object' && p.owner.name) return p.owner.name;
  if (typeof p.owner === 'string' && p.owner.trim() && !/^\d+$/.test(p.owner)) return p.owner;
  const id = String(p.ownerId || (typeof p.owner === 'string' ? p.owner : ''));
  if (id && OWNER_NAMES[id]) return OWNER_NAMES[id];
  if (p.ownerName) return p.ownerName;
  return id ? `User #${id}` : 'Unassigned';
};

const getCollaboratorInfo = (p) => {
  let list = [];
  if (Array.isArray(p.collaborators)) {
    list = p.collaborators;
  } else if (Array.isArray(p.members)) {
    list = p.members.filter(m => m.role !== 'Owner');
  }
  const count = list.length;
  const names = list.map(c => (typeof c === 'object' ? (c.name || c.username || c.id) : c)).join(', ');
  return { count, title: names || 'No collaborators assigned' };
};

const AdminProjects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadProjects = async () => {
      try {
        const data = await projectsApi.list();
        if (isMounted) {
          setProjects(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch projects');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProjects();

    return () => {
      isMounted = false;
    };
  }, []);

  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    try {
      await projectsApi.remove(projectToDelete.id);
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      setProjectToDelete(null);
    } catch (err) {
      alert(err.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  const isCompletedProject = (p) => isProjectLocked(p);
  const activeProjects = projects.filter(isProjectActive);
  const completedProjects = projects
    .filter(isCompletedProject)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

  let filtered = projects;
  if (filter === 'active') {
    filtered = activeProjects;
  } else if (filter === 'completed') {
    filtered = completedProjects;
  }

  const displayedProjects = filtered.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const title = (p.title || p.name || '').toLowerCase();
    const owner = getOwnerDisplayName(p).toLowerCase();
    return title.includes(q) || owner.includes(q);
  });

  const role = getCurrentUserRole();
  const isSuperUser = role === 'Super User' || role === 'superuser' || sessionStorage.getItem('teamforge.isSuperUser') === 'true' || sessionStorage.getItem('teamforge.portalRole') === 'superuser';

  const columns = [
    {
      key: 'title',
      label: 'Project',
      render: (p) => p.title || p.name || 'Untitled',
    },
    {
      key: 'owner',
      label: 'Owner',
      render: (p) => getOwnerDisplayName(p),
    },
    {
      key: 'difficulty',
      label: 'Difficulty',
      render: (p) => p.difficulty || '—',
    },
    {
      key: 'collaborators',
      label: 'Collaborators',
      render: (p) => {
        const collabInfo = getCollaboratorInfo(p);
        return (
          <div title={collabInfo.title} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>{collabInfo.count}</span>
            {collabInfo.count > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#6b7280', cursor: 'help' }}>ℹ️</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (p) => {
        const isCompleted = isCompletedProject(p);
        return (
          <Badge variant={isCompleted ? 'locked' : (p.status?.toLowerCase() || 'active')}>
            {isCompleted ? 'Completed (Locked)' : (p.status || 'Active')}
          </Badge>
        );
      },
    },
    {
      key: 'progress',
      label: 'Progress',
      render: (p) => {
        const progress = p.progress !== undefined && p.progress !== null
          ? p.progress
          : calculateProjectProgress(p.tasks);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden', minWidth: '50px' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#10b981' : '#6366f1', borderRadius: '999px' }} />
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '32px' }}>{progress}%</span>
          </div>
        );
      },
    },
    ...(isSuperUser
      ? [
          {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            render: (p) => (
              <button
                className="btn btn-xs su-btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setProjectToDelete(p);
                }}
              >
                Delete
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div id="admin-projects" className="admin-page admin-projects-page">
      <h1>Projects</h1>
      <p className="page-subtitle mt-1">View all projects on the platform</p>
      
      {error && <div className="admin-projects-error">{error}</div>}

      <div className="admin-projects-toolbar mt-3" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <SearchBar
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search projects or owners..."
        />
        <FilterTabs
          tabs={[
            { id: 'all', label: 'All', count: projects.length },
            { id: 'active', label: 'Active', count: activeProjects.length },
            { id: 'completed', label: 'Completed', count: completedProjects.length }
          ]}
          activeTab={filter}
          onChange={setFilter}
        />
      </div>
      
      <div className="card mt-2 admin-projects-card">
        <div id="admin-projects-list" className="overflow-x-auto">
          <DataTable
            columns={columns}
            data={displayedProjects}
            loading={loading}
            loadingText="Loading projects..."
            emptyTitle="No projects found."
            emptyMessage="No platform projects match your current filter and search."
            onRowClick={(p) => navigate(`/admin/projects/${p.id}`)}
            tableClassName="admin-projects-table"
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(projectToDelete)}
        title="Delete Project"
        message={`Are you sure you want to delete project "${projectToDelete?.title || projectToDelete?.name || ''}"? This action cannot be undone.`}
        confirmLabel="Delete Project"
        variant="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setProjectToDelete(null)}
      />
    </div>
  );
};

export default AdminProjects;
