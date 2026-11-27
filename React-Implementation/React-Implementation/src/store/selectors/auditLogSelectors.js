import { createSelector } from '@reduxjs/toolkit';
import {
  auditLogAdapter,
  createInitialAuditLogWorking,
} from '../slices/auditLogSlice';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const FALLBACK_WORKING = createInitialAuditLogWorking();

export const selectAuditLogState = (state) => state?.auditLog;

export const auditLogEntitySelectors =
  auditLogAdapter.getSelectors(selectAuditLogState);

export const selectAuditLogEntities = (state) =>
  state?.auditLog?.entities || EMPTY_MAP;

export const selectAuditLogIds = (state) =>
  state?.auditLog?.ids || EMPTY_IDS;

export const selectRecentEventIds = (state) =>
  state?.auditLog?.recentEventIds || EMPTY_IDS;

export const selectAllAuditLogs = createSelector(
  [selectAuditLogEntities, selectAuditLogIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectRecentAuditEvents = createSelector(
  [selectAuditLogEntities, selectRecentEventIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectAuditLogStatus = (state) =>
  state?.auditLog?.status || 'idle';

export const selectAuditLogError = (state) =>
  state?.auditLog?.error || null;

export const selectAuditLogWorking = (state) =>
  state?.auditLog?.working || FALLBACK_WORKING;

export const selectAuditFilters = createSelector(
  [selectAuditLogWorking],
  (working) => working.filters,
);

export const selectAuditTypes = createSelector(
  [selectAllAuditLogs],
  (logs) => ['all', ...Array.from(new Set(logs.map((l) => l.type)))],
);

export const selectFilteredAuditLogs = createSelector(
  [selectAllAuditLogs, selectAuditLogWorking],
  (logs, working) => {
    const typeFilter = working.typeFilter || 'all';
    const search = working.search || '';
    const actorFilter = (working.filters?.actor || '').trim().toLowerCase();
    const actionFilter = (working.filters?.action || '').trim().toLowerCase();

    return logs.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (actorFilter && !String(item.actor || '').toLowerCase().includes(actorFilter)) {
        return false;
      }
      if (actionFilter && !String(item.event || '').toLowerCase().includes(actionFilter)) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        String(item.event || '').toLowerCase().includes(q) ||
        String(item.actor || '').toLowerCase().includes(q) ||
        String(item.target || '').toLowerCase().includes(q) ||
        String(item.detailsText || item.details || '').toLowerCase().includes(q)
      );
    });
  },
);
