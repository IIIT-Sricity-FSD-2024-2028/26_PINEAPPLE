import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  exportAuditLogs,
  fetchAuditLogs,
} from '../../store/thunks/auditLogThunks';
import {
  clearAllAuditFilters,
  clearAuditFilterField,
  setAuditExportFormat,
  setAuditExportOpen,
  setAuditPage,
  setAuditSearch,
  setAuditTypeFilter,
  syncAuditFiltersFromUrl,
} from '../../store/slices/auditLogSlice';
import {
  selectAllAuditLogs,
  selectAuditFilters,
  selectAuditLogStatus,
  selectAuditLogWorking,
  selectAuditTypes,
  selectFilteredAuditLogs,
} from '../../store/selectors/auditLogSelectors';
import SearchBar from '../../components/common/SearchBar';
import DataTable from '../../components/common/DataTable';
import FilterTabs from '../../components/common/FilterTabs';
import Modal from '../../components/common/Modal';
import './AuditLog.css';

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

const AuditLogContent = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract URL filters cleanly (note: `from=report` is a navigation referrer, not a date bound)
  const rawFrom = searchParams.get('from') || '';
  const urlUserId = searchParams.get('userId') || '';
  const urlReportId = searchParams.get('reportId') || '';
  const urlActor = searchParams.get('actor') || '';
  const urlAction = searchParams.get('action') || '';
  const urlRange = searchParams.get('range') || '';
  const urlFromDate = DATE_RE.test(rawFrom) ? rawFrom : '';
  const urlToDate = searchParams.get('to') || '';

  const logs = useSelector(selectAllAuditLogs);
  const filteredLogs = useSelector(selectFilteredAuditLogs);
  const types = useSelector(selectAuditTypes);
  const status = useSelector(selectAuditLogStatus);
  const filters = useSelector(selectAuditFilters);
  const working = useSelector(selectAuditLogWorking);

  const loading = status === 'idle' || status === 'loading';
  const filter = working.typeFilter || 'all';
  const search = working.search || '';
  const page = working.page || 1;
  const pageSize = 15;
  const exportOpen = Boolean(working.exportOpen);
  const exportFormat = working.exportFormat || 'csv';
  const exportSubmitting = Boolean(working.exportSubmitting);
  const exportFeedback = working.exportFeedback;

  // Local controlled form drafts for export modal date/text overrides
  const [exportFrom, setExportFrom] = useState(urlFromDate);
  const [exportTo, setExportTo] = useState(urlToDate);
  const [exportActor, setExportActor] = useState(urlActor);
  const [exportAction, setExportAction] = useState(urlAction);

  const userId = filters.userId || '';
  const reportId = filters.reportId || '';
  const actor = filters.actor || '';
  const actionFilter = filters.action || '';
  const rangeFilter = filters.range || '';

  // Single effect synchronizing URL query parameters -> slice working filters + fetching logs
  useEffect(() => {
    const nextFilters = {
      userId: urlUserId,
      reportId: urlReportId,
      actor: urlActor,
      action: urlAction,
      range: urlRange,
      from: urlFromDate,
      to: urlToDate,
    };
    dispatch(syncAuditFiltersFromUrl(nextFilters));
    dispatch(fetchAuditLogs(nextFilters));
  }, [
    dispatch,
    urlUserId,
    urlReportId,
    urlActor,
    urlAction,
    urlRange,
    urlFromDate,
    urlToDate,
  ]);

  const handleRefresh = () => {
    dispatch(fetchAuditLogs(filters));
  };

  const handleRemoveUrlParam = (key) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next);
    dispatch(clearAuditFilterField(key));
  };

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
          <div className="admin-audit-time">{entry.timestampFormatted || entry.timestamp}</div>
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
        if (entry.detailsText) return entry.detailsText;
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

  const hasAnyChip = Boolean(
    userId ||
      reportId ||
      actor ||
      actionFilter ||
      rangeFilter ||
      filters.from ||
      filters.to ||
      filter !== 'all' ||
      search,
  );

  return (
    <div className="admin-audit-container">
      <div className="admin-audit-head-row">
        <div>
          <h1>Audit Log</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0', color: 'var(--muted-fg, #6b7280)' }}>
            Immutable record of all significant platform events.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {urlReportId && (
            <button
              type="button"
              data-testid="back-to-report-btn"
              className="btn btn-outline"
              onClick={() =>
                navigate(`/admin/reports?open=${encodeURIComponent(urlReportId)}`)
              }
            >
              ← Back to report
            </button>
          )}
          <button
            type="button"
            data-testid="open-audit-export-btn"
            className="btn btn-primary"
            onClick={() => {
              setExportFrom(filters.from || '');
              setExportTo(filters.to || '');
              setExportActor(filters.actor || '');
              setExportAction(filters.action || '');
              dispatch(setAuditExportOpen(true));
            }}
          >
            Export Log
          </button>
          <span className="admin-audit-readonly">Read-only · Cannot be modified</span>
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasAnyChip && (
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
                onClick={() => handleRemoveUrlParam('userId')}
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
                onClick={() => handleRemoveUrlParam('reportId')}
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
          {actor && (
            <div
              data-testid="chip-actor"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: '#ecfeff',
                border: '1px solid #a5f3fc',
                borderRadius: '16px',
                color: '#155e75',
                fontSize: '12px',
              }}
            >
              <span>Actor: <strong>{actor}</strong></span>
              <button
                type="button"
                data-testid="remove-chip-actor"
                onClick={() => handleRemoveUrlParam('actor')}
                aria-label="Remove actor filter"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#155e75',
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
          {actionFilter && (
            <div
              data-testid="chip-action"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '16px',
                color: '#166534',
                fontSize: '12px',
              }}
            >
              <span>Action: <strong>{actionFilter}</strong></span>
              <button
                type="button"
                data-testid="remove-chip-action"
                onClick={() => handleRemoveUrlParam('action')}
                aria-label="Remove action filter"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#166534',
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
          {rangeFilter && (
            <div
              data-testid="chip-range"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: '#fefce8',
                border: '1px solid #fef08a',
                borderRadius: '16px',
                color: '#854d0e',
                fontSize: '12px',
              }}
            >
              <span>Range: <strong>{rangeFilter}</strong></span>
              <button
                type="button"
                data-testid="remove-chip-range"
                onClick={() => handleRemoveUrlParam('range')}
                aria-label="Remove range filter"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#854d0e',
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
                onClick={() => dispatch(setAuditTypeFilter('all'))}
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
              <span>Search: <strong>&quot;{search}&quot;</strong></span>
              <button
                type="button"
                data-testid="remove-chip-search"
                onClick={() => dispatch(setAuditSearch(''))}
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
              next.delete('actor');
              next.delete('action');
              next.delete('range');
              next.delete('from');
              next.delete('to');
              setSearchParams(next);
              dispatch(clearAllAuditFilters());
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
          onChange={(e) => dispatch(setAuditSearch(e.target.value))}
          onClear={() => dispatch(setAuditSearch(''))}
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
            onChange={(t) => dispatch(setAuditTypeFilter(t))}
            ariaLabel="Audit event type filters"
          />
        </div>
      </div>

      <div className="admin-audit-count" data-testid="audit-result-count" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{filteredLogs.length} event{filteredLogs.length === 1 ? '' : 's'} shown</span>
        <span>·</span>
        <button
          onClick={handleRefresh}
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
              onClick={() => dispatch(setAuditPage(Math.max(1, page - 1)))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={page >= totalPages}
              onClick={() => dispatch(setAuditPage(Math.min(totalPages, page + 1)))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={exportOpen}
        title="Export Audit Log"
        onClose={() => !exportSubmitting && dispatch(setAuditExportOpen(false))}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={exportSubmitting}
              onClick={() => dispatch(setAuditExportOpen(false))}
            >
              Close
            </button>
            <button
              type="button"
              data-testid="confirm-audit-export-btn"
              className="btn btn-primary"
              disabled={exportSubmitting}
              onClick={() => {
                dispatch(
                  exportAuditLogs({
                    format: exportFormat,
                    from: exportFrom || filters.from || '',
                    to: exportTo || filters.to || '',
                    actor: exportActor || filters.actor || '',
                    action: exportAction || filters.action || '',
                    range: filters.range || '',
                    userId: userId || undefined,
                    reportId: reportId || undefined,
                    currentFilters: filters,
                  }),
                );
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
              onChange={(e) => dispatch(setAuditExportFormat(e.target.value))}
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

const AuditLog = AuditLogContent;
export default AuditLog;
