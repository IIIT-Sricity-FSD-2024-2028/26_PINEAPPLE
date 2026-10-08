import React, { useState, useEffect, useCallback, useRef } from 'react';
import adminApi from '../../services/adminApi';
import './AdminUsers.css';

const SearchIcon = () => (
  <span className="admin-users-search-icon">⌕</span>
);

const FlagIcon = () => (
  <span className="admin-users-flag" title="Flagged account">🏳</span>
);

const AdminUsers = () => {
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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.listUsers();
      setUsers(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
      setError('Failed to load users. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleMenu = (id, e) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const handleAction = async (id, actionType) => {
    setOpenMenuId(null);
    try {
      if (actionType === 'warn') {
        await adminApi.warnUser(id, { reason: 'Admin warning' });
      } else if (actionType === 'suspend') {
        await adminApi.suspendUser(id);
      } else if (actionType === 'activate') {
        await adminApi.updateUserStatus(id, { status: 'Active' });
      } else if (actionType === 'flag') {
        await adminApi.flagUser(id);
      } else if (actionType === 'unflag') {
        await adminApi.updateUserStatus(id, { status: 'Active' });
      }
      
      await fetchUsers();
    } catch (err) {
      console.error(`Failed to perform action ${actionType} on user ${id}`, err);
      alert(`Action failed: ${err.message || 'Unknown error'}`);
    }
  };

  const getFilteredUsers = () => {
    return users.filter(user => {
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || 
        (user.name && user.name.toLowerCase().includes(q)) || 
        (user.university && user.university.toLowerCase().includes(q));
      
      if (!matchesQuery) return false;
      
      const userStatus = user.status?.toLowerCase() || 'active';
      const isFlagged = user.status === 'Flagged' || user.flags === true;
      
      if (filter === 'all') return true;
      if (filter === 'flagged') return isFlagged;
      return userStatus === filter;
    });
  };

  const getFilterCount = (filterId) => {
    if (filterId === 'all') return users.length;
    if (filterId === 'flagged') return users.filter(u => u.status === 'Flagged' || u.flags === true).length;
    return users.filter(u => (u.status?.toLowerCase() || 'active') === filterId).length;
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
        <div className="admin-users-search-wrap">
          <SearchIcon />
          <input 
            id="admin-users-search" 
            className="admin-users-search" 
            type="text"
            placeholder="Search by name or university..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div id="admin-users-filters" className="admin-users-filters">
          {filters.map(f => (
            <button
              key={f.id}
              className={`admin-users-filter-chip ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label} ({getFilterCount(f.id)})
            </button>
          ))}
        </div>
      </div>

      <div className="admin-users-list mt-3" ref={listRef}>
        {loading ? (
          <div className="admin-users-empty">Loading users...</div>
        ) : error ? (
          <div className="admin-users-empty" style={{ color: 'var(--destructive)' }}>{error}</div>
        ) : filteredUsers.length === 0 ? (
          <div className="admin-users-empty">No users found for the selected filter.</div>
        ) : (
          filteredUsers.map((user) => {
            const isMenuOpen = openMenuId === user.id;
            const initials = user.initials || (user.name ? user.name.substring(0, 2).toUpperCase() : 'US');
            const isFlagged = user.status === 'Flagged' || user.flags === true;
            
            return (
              <div key={user.id} className={`admin-user-row ${isFlagged ? 'flagged' : ''}`}>
                <div className="admin-user-left">
                  <div className="admin-user-avatar">{initials}</div>
                  <div>
                    <div className="admin-user-name">
                      {user.name} {isFlagged && <FlagIcon />}
                    </div>
                    <div className="admin-user-meta">{user.university || 'Unknown University'} · {user.role || 'User'}</div>
                  </div>
                </div>

                <div className="admin-user-right">
                  <div className="admin-user-metrics">
                    <div>
                      <div className="admin-user-metric-value">{Number(user.xp || 0).toLocaleString()}</div>
                      <div className="admin-user-metric-label">XP</div>
                    </div>
                    <div>
                      <div className="admin-user-metric-value">{Number(user.rep || 0).toLocaleString()}</div>
                      <div className="admin-user-metric-label">Rep</div>
                    </div>
                    <div>
                      <div className="admin-user-metric-value">{Number(user.projects || 0).toLocaleString()}</div>
                      <div className="admin-user-metric-label">Projects</div>
                    </div>
                  </div>

                  <span className={`status-badge ${getStatusBadgeClass(user.status)}`}>
                    {toTitleCase(user.status || 'active')}
                  </span>
                  
                  <div className="admin-user-actions dropdown">
                    <button
                      className="admin-user-open"
                      onClick={(e) => toggleMenu(user.id, e)}
                      aria-label={`Open actions for ${user.name}`}
                      aria-expanded={isMenuOpen}
                    >
                      &#9662;
                    </button>
                    <div className={`dropdown-menu admin-user-menu ${isMenuOpen ? 'open' : ''}`}>
                      <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}>View profile</button>
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
