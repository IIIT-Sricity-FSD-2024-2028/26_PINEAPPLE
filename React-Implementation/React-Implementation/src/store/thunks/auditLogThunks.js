import { createAsyncThunk } from '@reduxjs/toolkit';
import * as adminApiModule from '../../services/adminApi';
import { resolveApiModule } from '../utils/apiModule';
import { normalizeThunkError } from '../utils/thunkError';

/**
 * Normalizes a raw backend audit event into consistent UI display fields
 * while preserving the raw fields for selectors/filters.
 */
export function normalizeAuditLogEntry(e = {}, index = 0) {
  let type = e.type || 'system';
  if (!e.type) {
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
    else if (action.includes('project')) type = 'project';
  }

  return {
    ...e,
    id: String(e.id || `audit-${index}`),
    type,
    event: e.action || e.event || 'System Action',
    actor: e.performedBy || e.actor || e.user || 'System',
    target: e.entityId
      ? `${e.entityType || 'Entity'} #${e.entityId}`
      : e.target || '-',
    detailsText: e.details
      ? typeof e.details === 'object'
        ? JSON.stringify(e.details)
        : String(e.details)
      : '-',
    timestampFormatted: e.timestamp
      ? new Date(e.timestamp).toLocaleString()
      : e.createdAt
      ? new Date(e.createdAt).toLocaleString()
      : new Date().toLocaleString(),
  };
}

/**
 * Fetches filtered or unfiltered audit log entries (`GET /admin/audit`).
 */
export const fetchAuditLogs = createAsyncThunk(
  'auditLog/fetchAuditLogs',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const params = {};
      if (filters?.userId) params.userId = filters.userId;
      if (filters?.reportId) params.reportId = filters.reportId;
      if (filters?.actor) params.actor = filters.actor;
      if (filters?.action) params.action = filters.action;
      if (filters?.range) params.range = filters.range;
      if (filters?.from) params.from = filters.from;
      if (filters?.to) params.to = filters.to;
      if (filters?.limit) params.limit = filters.limit;

      const hasParams = Object.keys(params).length > 0;
      const data = hasParams
        ? await adminApi.getAuditLog(params)
        : await adminApi.getAuditLog();
      const rawEntries = Array.isArray(data) ? data : data?.data || [];
      return rawEntries.map((entry, idx) => normalizeAuditLogEntry(entry, idx));
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Exports audit log entries in CSV or JSON (`GET /admin/audit/export`)
 * with active filter criteria and returns the download feedback message.
 */
export const exportAuditLogs = createAsyncThunk(
  'auditLog/exportAuditLogs',
  async (payload = {}, { dispatch, rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const format = payload.format || 'csv';
      const exportParams = {
        format,
        from: payload.from || '',
        to: payload.to || '',
        actor: payload.actor || '',
        action: payload.action || '',
        userId: payload.userId || undefined,
        reportId: payload.reportId || undefined,
      };
      if (payload.range) {
        exportParams.range = payload.range;
      }

      const res = await adminApi.exportAuditLog(exportParams);
      const content =
        format === 'csv'
          ? typeof res === 'string'
            ? res
            : res?.csv || ''
          : JSON.stringify(res, null, 2);
      const mime =
        format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json';

      if (
        typeof Blob !== 'undefined' &&
        typeof URL !== 'undefined' &&
        typeof URL.createObjectURL === 'function'
      ) {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-export.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      if (payload.refreshFilters !== false) {
        dispatch(fetchAuditLogs(payload.currentFilters || {})).catch(() => null);
      }

      return {
        format,
        exportedCount: res?.exportedCount ?? res?.items?.length ?? 0,
        message:
          format === 'csv'
            ? 'CSV audit export downloaded successfully (max 10,000 rows). Export action logged.'
            : `Exported ${res?.exportedCount ?? res?.items?.length ?? 0} audit entries as JSON.`,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Records a portal audit entry (`POST /admin/audit`).
 */
export const recordAuditEntry = createAsyncThunk(
  'auditLog/recordAuditEntry',
  async (entry, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      if (typeof adminApi?.recordAuditEntry !== 'function') return null;
      const res = await adminApi.recordAuditEntry(entry);
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
