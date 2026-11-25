import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import projectsApi, { isProjectLocked, isProjectActive } from '../../services/projectsApi';
import { calculateProjectProgress } from '../../utils/progress';
import Badge from '../../components/common/Badge';
import SearchBar from '../../components/common/SearchBar';
import FilterTabs from '../../components/common/FilterTabs';
import DataTable from '../../components/common/DataTable';
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
  const [restoringId, setRestoringId] = useState(null);

  const loadProjects = async () => {
    try {
      const [activeRes, deletedRes] = await Promise.all([
        Promise.resolve(projectsApi.list({ status: 'all' })).catch(() => []),
        Promise.resolve(projectsApi.list({ status: 'deleted' })).catch(() => []),
      ]);
      const combined = [
        ...(Array.isArray(activeRes) ? activeRes : []),
        ...(Array.isArray(deletedRes) ? deletedRes : []),
      ];
      const byId = new Map();
      for (const p of combined) {
        if (p && p.id) byId.set(String(p.id), p);
      }
      setProjects(Array.from(byId.values()));
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(async () => {
      if (isMounted) await loadProjects();
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRestoreProject = async (e, project) => {
    e.stopPropagation();
    if (restoringId) return;
    setRestoringId(project.id);
    try {
      await projectsApi.restore(project.id);
      await loadProjects();
    } catch (err) {
      setError(err?.serverMessage || err?.message || 'Failed to restore project.');
    } finally {
      setRestoringId(null);
    }
  };

  const isDeletedProject = (p) => Boolean(p?.deletedAt);
  const isClosedProject = (p) => !isDeletedProject(p) && String(p.status || '').toLowerCase() === 'closed';
  const isCompletedProject = (p) => !isDeletedProject(p) && !isClosedProject(p) && isProjectLocked(p);
  const deletedProjects = projects.filter(isDeletedProject);
  const activeProjects = projects.filter((p) => !isDeletedProject(p) && !isClosedProject(p) && isProjectActive(p));
  const completedProjects = projects
    .filter(isCompletedProject)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
  const closedProjects = projects.filter(isClosedProject);

  let filtered = projects.filter((p) => !isDeletedProject(p));
  if (filter === 'active') {
    filtered = activeProjects;
  } else if (filter === 'completed') {
    filtered = completedProjects;
  } else if (filter === 'closed') {
    filtered = closedProjects;
  } else if (filter === 'deleted') {
    filtered = deletedProjects;
  }

  const displayedProjects = filtered.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const title = (p.title || p.name || '').toLowerCase();
    const owner = getOwnerDisplayName(p).toLowerCase();
    return title.includes(q) || owner.includes(q);
  });

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
        if (isDeletedProject(p)) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Badge variant="danger">Deleted</Badge>
              <button
                type="button"
                data-testid={`admin-restore-btn-${p.id}`}
                className="btn btn-outline"
                style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                disabled={restoringId === p.id}
                onClick={(e) => handleRestoreProject(e, p)}
              >
                {restoringId === p.id ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          );
        }
        const isClosed = isClosedProject(p);
        const isCompleted = isCompletedProject(p);
        if (isClosed) {
          return (
            <div>
              <Badge variant="danger">Closed</Badge>
              {p.closureReason && (
                <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '2px' }}>
                  {p.closureReason}
                </div>
              )}
            </div>
          );
        }
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
            { id: 'all', label: 'All', count: projects.filter((p) => !isDeletedProject(p)).length },
            { id: 'active', label: 'Active', count: activeProjects.length },
            { id: 'completed', label: 'Completed', count: completedProjects.length },
            { id: 'closed', label: 'Closed', count: closedProjects.length },
            { id: 'deleted', label: 'Deleted', count: deletedProjects.length }
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
    </div>
  );
};

export default AdminProjects;
