import { createAsyncThunk } from '@reduxjs/toolkit';
import supportApi from '../../services/supportApi';
import { normalizeThunkError } from '../utils/thunkError';

function isTicketClosedError(err) {
  return (
    err?.code === 'TICKET_CLOSED' ||
    /read-only|ticket_closed/i.test(err?.serverMessage || err?.message || '')
  );
}

/**
 * Fetches user's own support tickets (`GET /support/tickets`).
 */
export const fetchMySupportTickets = createAsyncThunk(
  'supportTickets/fetchMySupportTickets',
  async (_arg, { rejectWithValue }) => {
    try {
      const res = await supportApi.listMyTickets();
      return Array.isArray(res) ? res : res?.items || res?.data || [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches full user ticket detail (`GET /support/tickets/:id`).
 */
export const fetchMySupportTicketById = createAsyncThunk(
  'supportTickets/fetchMySupportTicketById',
  async (ticketId, { rejectWithValue }) => {
    try {
      const detail = await supportApi.getMyTicket(String(ticketId));
      return detail || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Creates a user support ticket (`POST /support/tickets`).
 */
export const createSupportTicket = createAsyncThunk(
  'supportTickets/createSupportTicket',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const created = await supportApi.createTicket(payload);
      await dispatch(fetchMySupportTickets()).catch(() => null);
      return created || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Posts a reply from the user to their support ticket (`POST /support/tickets/:id/replies`).
 */
export const replyToMySupportTicket = createAsyncThunk(
  'supportTickets/replyToMySupportTicket',
  async ({ ticketId, body }, { dispatch, rejectWithValue }) => {
    const tid = String(ticketId);
    try {
      const updated = await supportApi.replyToMyTicket(tid, String(body || '').trim());
      dispatch(fetchMySupportTickets()).catch(() => null);
      return updated || null;
    } catch (err) {
      const normalized = normalizeThunkError(err);
      if (isTicketClosedError(err)) {
        const refreshedTicket = await supportApi.getMyTicket(tid).catch(() => null);
        dispatch(fetchMySupportTickets()).catch(() => null);
        return rejectWithValue({
          ...normalized,
          code: 'TICKET_CLOSED',
          ticketId: tid,
          refreshedTicket,
        });
      }
      return rejectWithValue(normalized);
    }
  },
);

/**
 * Lists support assignees for Admin Support Inbox (`GET /admin/support/assignees`).
 */
export const fetchSupportAssignees = createAsyncThunk(
  'supportTickets/fetchSupportAssignees',
  async (_arg, { rejectWithValue }) => {
    try {
      if (typeof supportApi?.listAssignees !== 'function') return [];
      const list = await supportApi.listAssignees();
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Lists paginated admin support tickets (`GET /admin/support/tickets`).
 */
export const fetchAdminSupportTickets = createAsyncThunk(
  'supportTickets/fetchAdminSupportTickets',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await supportApi.listAdminTickets({
        status: params.status || 'all',
        type: params.type || 'all',
        assignee: params.assignee || 'all',
        q: typeof params.q === 'string' ? params.q.trim() : '',
        page: params.page || 1,
        limit: params.limit || 20,
      });
      const items = Array.isArray(res) ? res : res?.items || res?.data || [];
      return {
        items,
        total: typeof res?.total === 'number' ? res.total : items.length,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : 1,
        page: params.page || 1,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches full admin ticket detail (`GET /admin/support/tickets/:id`).
 */
export const fetchAdminSupportTicketById = createAsyncThunk(
  'supportTickets/fetchAdminSupportTicketById',
  async (ticketId, { rejectWithValue }) => {
    try {
      const detail = await supportApi.getAdminTicket(String(ticketId));
      return detail || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Updates ticket status/priority/assignee (`PATCH /admin/support/tickets/:id`).
 * Handles 409 `TICKET_CLOSED` by refreshing read-only ticket state into the store.
 */
export const updateAdminSupportTicket = createAsyncThunk(
  'supportTickets/updateAdminSupportTicket',
  async ({ ticketId, payload, successMessage, listParams }, { dispatch, rejectWithValue }) => {
    const tid = String(ticketId);
    try {
      const updated = await supportApi.updateAdminTicket(tid, payload);
      if (listParams) {
        dispatch(fetchAdminSupportTickets(listParams)).catch(() => null);
      }
      return {
        ticketId: tid,
        ticket: updated || null,
        successMessage: successMessage || 'Ticket updated.',
      };
    } catch (err) {
      const normalized = normalizeThunkError(err);
      if (isTicketClosedError(err)) {
        const refreshedTicket = await supportApi.getAdminTicket(tid).catch(() => null);
        return rejectWithValue({
          ...normalized,
          code: 'TICKET_CLOSED',
          ticketId: tid,
          refreshedTicket,
        });
      }
      return rejectWithValue(normalized);
    }
  },
);

/**
 * Posts a public reply or internal note on an admin ticket (`POST /admin/support/tickets/:id/replies`).
 */
export const replyAdminSupportTicket = createAsyncThunk(
  'supportTickets/replyAdminSupportTicket',
  async ({ ticketId, body, internal, listParams }, { dispatch, rejectWithValue }) => {
    const tid = String(ticketId);
    try {
      const updated = await supportApi.replyAdminTicket(tid, {
        body: String(body || '').trim(),
        internal: Boolean(internal),
      });
      if (listParams) {
        dispatch(fetchAdminSupportTickets(listParams)).catch(() => null);
      }
      return {
        ticketId: tid,
        ticket: updated || null,
        internal: Boolean(internal),
      };
    } catch (err) {
      const normalized = normalizeThunkError(err);
      if (isTicketClosedError(err)) {
        const refreshedTicket = await supportApi.getAdminTicket(tid).catch(() => null);
        return rejectWithValue({
          ...normalized,
          code: 'TICKET_CLOSED',
          ticketId: tid,
          refreshedTicket,
        });
      }
      return rejectWithValue(normalized);
    }
  },
);

/**
 * Closes an abandoned project from a project_closure ticket (`POST /admin/support/tickets/:id/close-project`).
 */
export const closeProjectFromSupportTicket = createAsyncThunk(
  'supportTickets/closeProjectFromSupportTicket',
  async ({ ticketId, reason, listParams }, { dispatch, rejectWithValue }) => {
    const tid = String(ticketId);
    try {
      const res = await supportApi.closeProjectFromTicket(tid, String(reason || '').trim());
      if (listParams) {
        dispatch(fetchAdminSupportTickets(listParams)).catch(() => null);
      }
      return {
        ticketId: tid,
        ticket: res?.ticket || null,
      };
    } catch (err) {
      const normalized = normalizeThunkError(err);
      if (isTicketClosedError(err)) {
        const refreshedTicket = await supportApi.getAdminTicket(tid).catch(() => null);
        return rejectWithValue({
          ...normalized,
          code: 'TICKET_CLOSED',
          ticketId: tid,
          refreshedTicket,
        });
      }
      return rejectWithValue(normalized);
    }
  },
);
