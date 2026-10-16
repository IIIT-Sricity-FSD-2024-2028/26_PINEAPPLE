import { useState, useEffect } from 'react';
import adminApi from '../../services/adminApi';
import SearchBar from '../../components/common/SearchBar';
import DataTable from '../../components/common/DataTable';
import FilterTabs from '../../components/common/FilterTabs';
import './AuditLog.css';

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadLogs = async () => {
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
        if (isMounted) {
          setLogs(formatted);
        }
      } catch (err) {
        console.warn('Could not fetch audit log from backend:', err);
        if (isMounted) {
          setLogs([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadLogs();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const types = ['all', ...Array.from(new Set(logs.map(l => l.type)))];

  const filteredLogs = logs.filter((item) => {
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

  const columns = [
    {
      header: 'Type',
      accessor: 'type',
      sortable: true,
      width: '100px',
      render: (entry) => (
        <span className={`admin-audit-type ${entry.type}`}>
          {entry.type}
        </span>
      ),
    },
    {
      header: 'Event',
      accessor: 'event',
      sortable: true,
      render: (entry) => (
        <div>
          <div className="admin-audit-event">{entry.event}</div>
          <div className="admin-audit-time">{entry.timestamp}</div>
        </div>
      ),
    },
    {
      header: 'Actor',
      accessor: 'actor',
      sortable: true,
    },
    {
      header: 'Target',
      accessor: 'target',
      sortable: true,
    },
    {
      header: 'Details',
      render: (entry) => {
        if (!entry.details) return '—';
        if (typeof entry.details === 'object') {
          try {
            return JSON.stringify(entry.details);
          } catch {
            return String(entry.details);
          }
        }
        return String(entry.details);
      },
    },
  ];

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
        <SearchBar
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search events, actors, targets..."
        />
        <div className="admin-audit-filters">
          <FilterTabs
            tabs={types.map((t) => ({
              id: t,
              label: t.toUpperCase(),
              count: t === 'all' ? logs.length : logs.filter((l) => l.type === t).length,
            }))}
            activeTab={filter}
            onChange={setFilter}
            ariaLabel="Audit event type filters"
          />
        </div>
      </div>

      <div className="admin-audit-count" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{filteredLogs.length} event{filteredLogs.length === 1 ? '' : 's'} shown</span>
        <span>·</span>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#6366f1', textDecoration: 'underline', padding: 0 }}
        >
          Refresh
        </button>
      </div>

      <div style={{ marginTop: '16px' }}>
        <DataTable
          columns={columns}
          data={filteredLogs}
          loading={loading}
          loadingMessage="Loading audit events..."
          emptyMessage="No audit events found."
        />
      </div>
    </div>
  );
};

export default AuditLog;
