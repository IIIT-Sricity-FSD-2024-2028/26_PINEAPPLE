import React, { useState, useEffect } from 'react';
import adminApi from '../../services/adminApi';
import './AuditLog.css';

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getAuditLog();
      const entries = Array.isArray(data) ? data : (data?.data || []);
      const formatted = entries.map((e, index) => {
        let type = 'system';
        const action = (e.action || e.event || '').toLowerCase();
        if (action.includes('task')) type = 'task';
        else if (action.includes('xp')) type = 'xp';
        else if (action.includes('rep')) type = 'reputation';
        else if (action.includes('warn')) type = 'warning';
        else if (action.includes('suspend')) type = 'suspension';
        else if (action.includes('mentor')) type = 'mentor';

        return {
          id: e.id || `audit-${index}`,
          type,
          event: e.action || e.event || 'System Action',
          actor: e.performedBy || e.actor || e.user || 'System',
          target: e.entityId ? `${e.entityType || 'Entity'} #${e.entityId}` : (e.target || '-'),
          details: e.details ? (typeof e.details === 'object' ? JSON.stringify(e.details) : e.details) : '-',
          timestamp: e.timestamp ? new Date(e.timestamp).toLocaleString() : new Date().toLocaleString()
        };
      });
      setLogs(formatted);
    } catch (err) {
      console.warn('Could not fetch audit log from backend:', err);
      // Fallback empty list
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const types = ['all', ...Array.from(new Set(logs.map(l => l.type)))];

  const filteredLogs = logs.filter(item => {
    const matchesFilter = filter === 'all' || item.type === filter;
    if (!matchesFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.event.toLowerCase().includes(q) ||
      item.actor.toLowerCase().includes(q) ||
      item.target.toLowerCase().includes(q) ||
      item.details.toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-audit-container">
      <div className="admin-audit-head-row">
        <div>
          <h1>Audit Log</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0', color: 'var(--muted-fg, #6b7280)' }}>
            Immutable record of all significant platform events.
          </p>
        </div>
        <span className="admin-audit-readonly">Read-only · Cannot be modified</span>
      </div>

      <div className="admin-audit-toolbar" style={{ marginTop: '20px' }}>
        <div className="admin-audit-search-wrap">
          <span className="admin-audit-search-icon">🔍</span>
          <input
            className="admin-audit-search"
            type="text"
            placeholder="Search events, actors, targets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="admin-audit-filters">
          {types.map(t => {
            const count = t === 'all' ? logs.length : logs.filter(l => l.type === t).length;
            return (
              <button
                key={t}
                className={`admin-audit-filter-chip ${filter === t ? 'active' : ''}`}
                onClick={() => setFilter(t)}
              >
                {t.toUpperCase()} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="admin-audit-count" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{filteredLogs.length} event{filteredLogs.length === 1 ? '' : 's'} shown</span>
        <span>·</span>
        <button
          onClick={fetchLogs}
          style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#6366f1', textDecoration: 'underline', padding: 0 }}
        >
          Refresh
        </button>
      </div>

      <div className="admin-audit-table-wrap" style={{ marginTop: '16px' }}>
        {loading ? (
          <div className="admin-audit-empty">Loading audit events...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="admin-audit-empty">No audit events found.</div>
        ) : (
          <table className="admin-audit-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(entry => (
                <tr key={entry.id}>
                  <td>
                    <span className={`admin-audit-type ${entry.type}`}>
                      {entry.type}
                    </span>
                  </td>
                  <td>
                    <div className="admin-audit-event">{entry.event}</div>
                    <div className="admin-audit-time">{entry.timestamp}</div>
                  </td>
                  <td>{entry.actor}</td>
                  <td>{entry.target}</td>
                  <td>{entry.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
