import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import adminApi from '../../services/adminApi';
import SearchBar from '../../components/common/SearchBar';
import DataTable from '../../components/common/DataTable';
import FilterTabs from '../../components/common/FilterTabs';
import Modal from '../../components/common/Modal';
import './AuditLog.css';

const AuditLog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = searchParams.get('userId') || '';
  const reportId = searchParams.get('reportId') || '';
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportActor, setExportActor] = useState('');
  const [exportAction, setExportAction] = useState('');
  const [exportSubmitting, setExportSubmitting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadLogs = async () => {
      setLoading(true);
      try {
        const params = {};
        if (userId) params.userId = userId;
        if (reportId) params.reportId = reportId;
        const data = await adminApi.getAuditLog(Object.keys(params).length > 0 ? params : undefined);
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
          else if (action.includes('report')) type = 'report';
          else if (action.includes('appeal')) type = 'appeal';
          else if (action.includes('ticket')) type = 'support';

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
  }, [refreshKey, userId, reportId]);

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

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const pagedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            data-testid="open-audit-export-btn"
            className="btn btn-primary"
            onClick={() => {
              setExportFeedback(null);
              setExportOpen(true);
            }}
          >
            Export Log
          </button>
          <span className="admin-audit-readonly">Read-only · Cannot be modified</span>
        </div>
      </div>

      {/* Active Filter Chips */}
      {(userId || reportId || filter !== 'all' || search) && (
        <div
          className="admin-audit-chips"
          data-testid="active-filter-chips"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginTop: '12px' }}
        >
          <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Active Filters:</span>
          {userId && (
            <div
              data-testid="chip-userId"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '16px',
                color: '#1e40af',
                fontSize: '12px',
              }}
            >
              <span>User: <strong>{userId}</strong></span>
              <button
                type="button"
                data-testid="remove-chip-userId"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('userId');
                  setSearchParams(next);
                  setPage(1);
                }}
                aria-label="Remove user filter"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#1e40af',
                  fontWeight: 'bold',
                  padding: '0 2px',
                  fontSize: '13px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          )}
          {reportId && (
            <div
              data-testid="chip-reportId"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: '#fdf4ff',
                border: '1px solid #f0abfc',
                borderRadius: '16px',
                color: '#86198f',
                fontSize: '12px',
              }}
            >
              <span>Report: <strong>{reportId}</strong></span>
              <button
                type="button"
                data-testid="remove-chip-reportId"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('reportId');
                  setSearchParams(next);
                  setPage(1);
                }}
                aria-label="Remove report filter"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#86198f',
                  fontWeight: 'bold',
                  padding: '0 2px',
                  fontSize: '13px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          )}
          {filter !== 'all' && (
            <div
              data-testid="chip-type"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '16px',
                color: '#334155',
                fontSize: '12px',
              }}
            >
              <span>Type: <strong>{filter.toUpperCase()}</strong></span>
              <button
                type="button"
                data-testid="remove-chip-type"
                onClick={() => {
                  setFilter('all');
                  setPage(1);
                }}
                aria-label="Remove type filter"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#334155',
                  fontWeight: 'bold',
                  padding: '0 2px',
                  fontSize: '13px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          )}
          {search && (
            <div
              data-testid="chip-search"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '16px',
                color: '#334155',
                fontSize: '12px',
              }}
            >
              <span>Search: <strong>"{search}"</strong></span>
              <button
                type="button"
                data-testid="remove-chip-search"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                aria-label="Remove search filter"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#334155',
                  fontWeight: 'bold',
                  padding: '0 2px',
                  fontSize: '13px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          )}
          <button
            type="button"
            data-testid="clear-all-filters-btn"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('userId');
              next.delete('reportId');
              next.delete('from');
              setSearchParams(next);
              setFilter('all');
              setSearch('');
              setPage(1);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#dc2626',
              fontWeight: 600,
              fontSize: '12px',
              padding: '4px 8px',
              textDecoration: 'underline',
            }}
          >
            Clear all
          </button>
        </div>
      )}

      <div className="admin-audit-toolbar" style={{ marginTop: '20px' }}>
        <SearchBar
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          onClear={() => {
            setSearch('');
            setPage(1);
          }}
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
            onChange={(t) => {
              setFilter(t);
              setPage(1);
            }}
            ariaLabel="Audit event type filters"
          />
        </div>
      </div>

      <div className="admin-audit-count" data-testid="audit-result-count" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          data={pagedLogs}
          loading={loading}
          loadingMessage="Loading audit events..."
          emptyMessage={
            userId
              ? 'No audit entries for this user.'
              : reportId
              ? 'No audit entries for this report.'
              : 'No audit events found.'
          }
        />
      </div>

      {totalPages > 1 && (
        <div
          className="admin-audit-pagination"
          data-testid="audit-pagination"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}
        >
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Showing {pagedLogs.length} of {filteredLogs.length} events (Page {page} of {totalPages})
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={exportOpen}
        title="Export Audit Log"
        onClose={() => !exportSubmitting && setExportOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={exportSubmitting}
              onClick={() => setExportOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              data-testid="confirm-audit-export-btn"
              className="btn btn-primary"
              disabled={exportSubmitting}
              onClick={async () => {
                setExportSubmitting(true);
                setExportFeedback(null);
                try {
                  const res = await adminApi.exportAuditLog({
                    format: exportFormat,
                    from: exportFrom,
                    to: exportTo,
                    actor: exportActor,
                    action: exportAction,
                    userId: userId || undefined,
                    reportId: reportId || undefined,
                  });
                  const content =
                    exportFormat === 'csv'
                      ? (typeof res === 'string' ? res : res?.csv || '')
                      : JSON.stringify(res, null, 2);
                  const mime = exportFormat === 'csv' ? 'text/csv;charset=utf-8' : 'application/json';
                  if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                    const blob = new Blob([content], { type: mime });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `audit-export.${exportFormat}`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  }
                  setExportFeedback({
                    type: 'success',
                    message:
                      exportFormat === 'csv'
                        ? 'CSV audit export downloaded successfully (max 10,000 rows). Export action logged.'
                        : `Exported ${res?.exportedCount ?? res?.items?.length ?? 0} audit entries as JSON.`,
                  });
                  setRefreshKey((k) => k + 1);
                } catch (err) {
                  setExportFeedback({
                    type: 'error',
                    message: err?.serverMessage || err?.message || 'Audit export failed.',
                  });
                } finally {
                  setExportSubmitting(false);
                }
              }}
            >
              {exportSubmitting ? 'Exporting...' : `Download ${exportFormat.toUpperCase()}`}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-testid="audit-export-modal">
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
            Export up to 10,000 rows in CSV or JSON. Formula characters in CSV cells are neutralized and every export is logged.
          </p>
          <div>
            <label htmlFor="audit-export-format" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Format</label>
            <select
              id="audit-export-format"
              data-testid="audit-export-format"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label htmlFor="audit-export-from" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>From Date</label>
              <input
                id="audit-export-from"
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label htmlFor="audit-export-to" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>To Date</label>
              <input
                id="audit-export-to"
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label htmlFor="audit-export-actor" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Actor Filter (optional)</label>
              <input
                id="audit-export-actor"
                type="text"
                value={exportActor}
                onChange={(e) => setExportActor(e.target.value)}
                placeholder="e.g. admin"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label htmlFor="audit-export-action" style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>Action Filter (optional)</label>
              <input
                id="audit-export-action"
                type="text"
                value={exportAction}
                onChange={(e) => setExportAction(e.target.value)}
                placeholder="e.g. suspend"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          {exportFeedback && (
            <div
              role="alert"
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.86rem',
                background: exportFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
                color: exportFeedback.type === 'success' ? '#065f46' : '#991b1b',
              }}
            >
              {exportFeedback.message}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default AuditLog;
