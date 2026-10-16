import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../../services/adminApi';
import SearchBar from '../../components/common/SearchBar';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import FilterTabs from '../../components/common/FilterTabs';
import EmptyState from '../../components/common/EmptyState';
import './AdminUsers.css';

const FlagIcon = () => (
  <span className="admin-users-flag" title="Flagged account">🏳</span>
);

const AdminUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [openMenuId, setOpenMenuId] = useState(null);
  
  const listRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (listRef.current && !listRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadUsers = async () => {
      try {
        const data = await adminApi.listUsers();
        if (isMounted) {
          setUsers(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to fetch admin users:', err);
        if (isMounted) {
          setError('Failed to load users. Please try again later.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleMenu = (id, e) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const handleAction = async (id, actionType) => {
    setOpenMenuId(null);
    try {
      if (actionType === 'warn') {
        await adminApi.warnUser(id, { reason: 'Admin warning' });
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, warnings: (u.warnings || 0) + 1, status: 'Warned' } : u));
      } else if (actionType === 'suspend') {
        await adminApi.suspendUser(id);
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: 'Suspended' } : u));
      } else if (actionType === 'activate') {
        await adminApi.updateUserStatus(id, { status: 'Active' });
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: 'Active', flags: false, flagged: false } : u));
      } else if (actionType === 'flag') {
        await adminApi.flagUser(id);
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: 'Flagged', flags: true, flagged: true } : u));
      } else if (actionType === 'unflag') {
        await adminApi.updateUserStatus(id, { status: 'Active' });
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: 'Active', flags: false, flagged: false } : u));
      }
    } catch (err) {
      console.error(`Failed to perform action ${actionType} on user ${id}`, err);
      alert(`Action failed: ${err.message || 'Unknown error'}`);
    }
  };

  const matchesStatusFilter = (user, filterId) => {
    const s = (user.status || '').toLowerCase();
    const isFlagged = user.status === 'Flagged' || user.flags === true || user.flagged === true;
    const isWarned = s === 'warned' || (user.warnings && user.warnings > 0);
    const isSuspended = s === 'suspended';
    
    if (filterId === 'all') return true;
    if (filterId === 'flagged') return isFlagged;
    if (filterId === 'warned') return isWarned;
    if (filterId === 'suspended') return isSuspended;
    if (filterId === 'active') return !isSuspended && !isFlagged && !isWarned;
    return s === filterId;
  };

  const getFilteredUsers = () => {
    return users.filter(user => {
      const q = query.trim().toLowerCase();
      const university = user.university || user.profile?.uni || user.profile?.university || '';
      const matchesQuery = !q || 
        (user.name && user.name.toLowerCase().includes(q)) || 
        (university && university.toLowerCase().includes(q));
      
      if (!matchesQuery) return false;
      return matchesStatusFilter(user, filter);
    });
  };

  const getFilterCount = (filterId) => {
    return users.filter(u => matchesStatusFilter(u, filterId)).length;
  };

  const toTitleCase = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const getStatusBadgeClass = (status) => {
    const s = status?.toLowerCase();
    if (s === 'warned') return 'status-pending';
    if (s === 'suspended') return 'status-rejected';
    return 'status-active';
  };

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'warned', label: 'Warned' },
    { id: 'suspended', label: 'Suspended' },
    { id: 'flagged', label: 'Flagged' },
  ];

  const filteredUsers = getFilteredUsers();

  return (
    <div id="admin-users" className="admin-page">
      <h1>User Management</h1>
      <p className="page-subtitle mt-1">Monitor accounts, issue warnings, and manage suspensions.</p>

      <div className="admin-users-toolbar mt-4">
        <SearchBar
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery('')}
          placeholder="Search by name or university..."
        />
        <div id="admin-users-filters" className="admin-users-filters" style={{ overflowX: 'auto' }}>
          <FilterTabs
            tabs={filters.map(f => ({
              id: f.id,
              label: `${f.label} (${getFilterCount(f.id)})`,
            }))}
            activeTab={filter}
            onChange={setFilter}
            ariaLabel="User status filters"
          />
        </div>
      </div>

      <div className="admin-users-list mt-3" ref={listRef}>
        {loading ? (
          <div className="admin-users-empty">Loading users...</div>
        ) : error ? (
          <div className="admin-users-empty" style={{ color: 'var(--destructive)' }}>{error}</div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            title="No users found"
            message={query.trim() ? `No users match "${query}". Try another search term.` : "No user accounts match the selected filter."}
          />
        ) : (
          filteredUsers.map((user, index) => {
            const isMenuOpen = openMenuId === user.id;
            const isLastRows = index >= filteredUsers.length - 2 && filteredUsers.length > 2;
            const initials = user.initials || (user.name ? user.name.substring(0, 2).toUpperCase() : 'US');
            const isFlagged = user.status === 'Flagged' || user.flags === true || user.flagged === true;
            const xp = user.xp ?? user.profile?.xp ?? 0;
            const rep = user.rep ?? user.profile?.rep ?? 0;
            const projectsCount = user.projects ?? (Array.isArray(user.data?.projects) ? user.data.projects.length : 0);
            const university = user.university || user.profile?.uni || user.profile?.university || 'Unknown University';
            
            return (
              <div key={user.id} className={`admin-user-row ${isFlagged ? 'flagged' : ''}`}>
                <div className="admin-user-left">
                  <Avatar name={user.name} initials={initials} size="md" />
                  <div>
                    <div className="admin-user-name">
                      {user.name} {isFlagged && <FlagIcon />}
                    </div>
                    <div className="admin-user-meta">{university} · {user.role || 'User'}</div>
                  </div>
                </div>

                <div className="admin-user-right">
                  <div className="admin-user-metrics">
                    <div>
                      <div className="admin-user-metric-value">{Number(xp).toLocaleString()}</div>
                      <div className="admin-user-metric-label">XP</div>
                    </div>
                    <div>
                      <div className="admin-user-metric-value">{Number(rep).toLocaleString()}</div>
                      <div className="admin-user-metric-label">Rep</div>
                    </div>
                    <div>
                      <div className="admin-user-metric-value">{Number(projectsCount).toLocaleString()}</div>
                      <div className="admin-user-metric-label">Projects</div>
                    </div>
                  </div>

                  <Badge variant={user.status} className={getStatusBadgeClass(user.status)}>
                    {toTitleCase(user.status || 'active')}
                  </Badge>
                  
                  <div className="admin-user-actions dropdown">
                    <button
                      className="admin-user-open"
                      onClick={(e) => toggleMenu(user.id, e)}
                      aria-label={`Open actions for ${user.name}`}
                      aria-expanded={isMenuOpen}
                    >
                      &#9662;
                    </button>
                    <div className={`dropdown-menu admin-user-menu ${isMenuOpen ? 'open' : ''} ${isLastRows ? 'dropup' : ''}`}>
                      <button
                        className="dropdown-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          navigate(`/admin/users/${user.id}`);
                        }}
                      >
                        View profile
                      </button>
                      <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); handleAction(user.id, 'warn'); }}>Warn user</button>
                      <button className="dropdown-item danger" onClick={(e) => { e.stopPropagation(); handleAction(user.id, 'suspend'); }}>Suspend user</button>
                      <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); handleAction(user.id, 'activate'); }}>Reactivate user</button>
                      <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); handleAction(user.id, isFlagged ? 'unflag' : 'flag'); }}>
                        {isFlagged ? 'Remove flag' : 'Flag account'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
