import { createAsyncThunk } from '@reduxjs/toolkit';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import { normalizeThunkError } from '../utils/thunkError';

/**
 * Lists all escrow ledger records (`GET /escrow`, admin/superuser).
 */
export const fetchEscrowAccounts = createAsyncThunk(
  'escrowAccounts/fetchEscrowAccounts',
  async (arg = {}, { rejectWithValue }) => {
    try {
      if (typeof mentorMarketplaceApi?.listEscrows !== 'function') {
        return [];
      }
      const { role } = arg || {};
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.listEscrows(role)
          : await mentorMarketplaceApi.listEscrows();
      return Array.isArray(res) ? res : res?.items || res?.data || [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches one escrow record by id (`GET /escrow/:id`).
 */
export const fetchEscrowById = createAsyncThunk(
  'escrowAccounts/fetchEscrowById',
  async ({ escrowId, role }, { rejectWithValue }) => {
    try {
      if (!escrowId || typeof mentorMarketplaceApi?.getEscrowById !== 'function') {
        return null;
      }
      const eid = String(escrowId);
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.getEscrowById(eid, role)
          : await mentorMarketplaceApi.getEscrowById(eid);
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches project-scoped escrow summary (`GET /admin/projects/:id/escrow`).
 */
export const fetchProjectEscrow = createAsyncThunk(
  'escrowAccounts/fetchProjectEscrow',
  async ({ projectId, role }, { rejectWithValue }) => {
    try {
      const pid = String(projectId);
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.getProjectEscrow(pid, role)
          : await mentorMarketplaceApi.getProjectEscrow(pid);
      return { projectId: pid, summary: res || null };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Runs server-side escrow reconciliation (`GET /admin/escrow/reconcile`).
 */
export const reconcileEscrowLedger = createAsyncThunk(
  'escrowAccounts/reconcileEscrowLedger',
  async (arg = {}, { rejectWithValue }) => {
    try {
      const { role } = arg || {};
      const res =
        role !== undefined
          ? await mentorMarketplaceApi.reconcileEscrow(role)
          : await mentorMarketplaceApi.reconcileEscrow();
      return res || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
