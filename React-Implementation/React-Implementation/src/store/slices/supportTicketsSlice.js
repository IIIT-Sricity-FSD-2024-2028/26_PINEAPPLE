import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  closeProjectFromSupportTicket,
  createSupportTicket,
  fetchAdminSupportTicketById,
  fetchAdminSupportTickets,
  fetchMySupportTicketById,
  fetchMySupportTickets,
  fetchSupportAssignees,
  replyAdminSupportTicket,
  replyToMySupportTicket,
  updateAdminSupportTicket,
} from '../thunks/supportTicketsThunks';

function deriveTicketId(ticket) {
  return String(ticket?.id || '');
}

/**
 * Support Tickets Repository Slice (`supportTicketsSlice`)
 * ========================================================
 * Mirrors `SupportService.items` across user help tickets (`/support/tickets`)
 * and the admin Support Inbox (`/admin/support/tickets`, assignees, replies,
 * internal notes, project closure, and read-only resolved/rejected tickets).
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`selectedMyTicketId`,
 *   `selectedAdminTicketId`, `statusFilter`, `typeFilter`, `assigneeFilter`,
 *   `searchQuery`, `page`, `drawerError`, `drawerSuccess`, `myReplyError`,
 *   `ticketSubmitError`, `ticketSubmitSuccess`, `pendingTerminalStatus`,
 *   `closeProjectModalOpen`, `closeError`, loading flags).
 * - STAYS across `routeChanged`: `entities`, `myTicketIds`, `adminTicketIds`,
 *   `assignees`, `total`, `totalPages`.
 * - Full reset on `sessionReset`.
 */
export const supportTicketsAdapter = createEntityAdapter({
  selectId: deriveTicketId,
});

export function createInitialSupportWorking() {
  return {
    selectedMyTicketId: null,
    myTicketDetailLoading: false,
    myReplyError: '',
    sendingMyReply: false,
    ticketSubmitting: false,
    ticketSubmitError: '',
    ticketSubmitSuccess: '',
    selectedAdminTicketId: null,
    adminDetailLoading: false,
    drawerError: '',
    drawerSuccess: '',
    updatingMeta: false,
    pendingTerminalStatus: '',
    sendingReply: false,
    closeProjectModalOpen: false,
    closingProject: false,
    closeError: '',
    statusFilter: 'all',
    typeFilter: 'all',
    assigneeFilter: 'all',
    searchQuery: '',
    page: 1,
  };
}

export function createInitialSupportTicketsState() {
  return supportTicketsAdapter.getInitialState({
    myTicketIds: [],
    myTicketsStatus: 'idle',
    myTicketsError: '',
    adminTicketIds: [],
    adminTicketsStatus: 'idle',
    adminTicketsError: '',
    total: 0,
    totalPages: 1,
    assignees: [],
    lastFetchedAt: null,
    working: createInitialSupportWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!Array.isArray(state.myTicketIds)) state.myTicketIds = [];
  if (!Array.isArray(state.adminTicketIds)) state.adminTicketIds = [];
  if (!Array.isArray(state.assignees)) state.assignees = [];
  if (!state.working) state.working = createInitialSupportWorking();
}

function clearWorkingSupportState(state) {
  ensureSubstates(state);
  state.working = createInitialSupportWorking();
  state.myTicketsError = '';
  state.adminTicketsError = '';
}

const supportTicketsSlice = createSlice({
  name: 'supportTickets',
  initialState: createInitialSupportTicketsState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const items = Array.isArray(action.payload) ? action.payload : [];
      supportTicketsAdapter.setAll(state, items);
      state.adminTicketIds = items.map(deriveTicketId).filter(Boolean);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      const tid = deriveTicketId(action.payload);
      if (!tid) return;
      supportTicketsAdapter.addOne(state, action.payload);
      if (!state.adminTicketIds.includes(tid)) {
        state.adminTicketIds.unshift(tid);
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      supportTicketsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const tid = String(action.payload);
      supportTicketsAdapter.removeOne(state, tid);
      state.myTicketIds = state.myTicketIds.filter((id) => id !== tid);
      state.adminTicketIds = state.adminTicketIds.filter((id) => id !== tid);
    },

    // ── Volatile Working State Reducers ──
    setSupportStatusFilter: (state, action) => {
      ensureSubstates(state);
      state.working.statusFilter = action.payload || 'all';
      state.working.page = 1;
    },
    setSupportTypeFilter: (state, action) => {
      ensureSubstates(state);
      state.working.typeFilter = action.payload || 'all';
      state.working.page = 1;
    },
    setSupportAssigneeFilter: (state, action) => {
      ensureSubstates(state);
      state.working.assigneeFilter = action.payload || 'all';
      state.working.page = 1;
    },
    setSupportSearchQuery: (state, action) => {
      ensureSubstates(state);
      state.working.searchQuery =
        typeof action.payload === 'string' ? action.payload : '';
      state.working.page = 1;
    },
    setSupportPage: (state, action) => {
      ensureSubstates(state);
      state.working.page = Math.max(1, Number(action.payload) || 1);
    },
    closeAdminTicketDrawer: (state) => {
      ensureSubstates(state);
      state.working.selectedAdminTicketId = null;
      state.working.drawerError = '';
      state.working.drawerSuccess = '';
      state.working.pendingTerminalStatus = '';
    },
    setPendingTerminalStatus: (state, action) => {
      ensureSubstates(state);
      state.working.pendingTerminalStatus = action.payload || '';
      state.working.drawerError = '';
    },
    setDrawerError: (state, action) => {
      ensureSubstates(state);
      state.working.drawerError =
        typeof action.payload === 'string' ? action.payload : '';
    },
    openCloseProjectModal: (state) => {
      ensureSubstates(state);
      state.working.closeProjectModalOpen = true;
      state.working.closeError = '';
    },
    dismissCloseProjectModal: (state) => {
      ensureSubstates(state);
      state.working.closeProjectModalOpen = false;
      state.working.closeError = '';
    },
    selectMyTicket: (state, action) => {
      ensureSubstates(state);
      state.working.selectedMyTicketId = action.payload
        ? String(action.payload)
        : null;
      state.working.myReplyError = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMySupportTickets.pending, (state) => {
        ensureSubstates(state);
        state.myTicketsStatus = 'loading';
        state.myTicketsError = '';
      })
      .addCase(fetchMySupportTickets.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = (Array.isArray(action.payload) ? action.payload : []).filter(
          (t) => deriveTicketId(t),
        );
        supportTicketsAdapter.upsertMany(state, list);
        state.myTicketIds = list.map(deriveTicketId);
        state.myTicketsStatus = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchMySupportTickets.rejected, (state, action) => {
        ensureSubstates(state);
        state.myTicketsStatus = 'failed';
        state.myTicketsError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to load your support tickets.';
      })

      .addCase(fetchMySupportTicketById.pending, (state) => {
        ensureSubstates(state);
        state.working.myTicketDetailLoading = true;
        state.working.myReplyError = '';
      })
      .addCase(fetchMySupportTicketById.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.myTicketDetailLoading = false;
        const detail = action.payload;
        if (detail && deriveTicketId(detail)) {
          supportTicketsAdapter.upsertOne(state, detail);
          state.working.selectedMyTicketId = deriveTicketId(detail);
        }
      })
      .addCase(fetchMySupportTicketById.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.myTicketDetailLoading = false;
        state.myTicketsError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Could not load support ticket.';
      })

      .addCase(createSupportTicket.pending, (state) => {
        ensureSubstates(state);
        state.working.ticketSubmitting = true;
        state.working.ticketSubmitError = '';
        state.working.ticketSubmitSuccess = '';
      })
      .addCase(createSupportTicket.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.ticketSubmitting = false;
        state.working.ticketSubmitSuccess =
          'Support ticket submitted successfully.';
        const created = action.payload;
        const tid = deriveTicketId(created);
        if (tid) {
          supportTicketsAdapter.upsertOne(state, created);
          if (!state.myTicketIds.includes(tid)) {
            state.myTicketIds.unshift(tid);
          }
          state.working.selectedMyTicketId = tid;
        }
      })
      .addCase(createSupportTicket.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.ticketSubmitting = false;
        state.working.ticketSubmitError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to submit ticket.';
      })

      .addCase(replyToMySupportTicket.pending, (state) => {
        ensureSubstates(state);
        state.working.sendingMyReply = true;
        state.working.myReplyError = '';
      })
      .addCase(replyToMySupportTicket.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.sendingMyReply = false;
        const updated = action.payload;
        if (updated && deriveTicketId(updated)) {
          supportTicketsAdapter.upsertOne(state, updated);
        }
      })
      .addCase(replyToMySupportTicket.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.sendingMyReply = false;
        const payload = action.payload || {};
        if (payload.code === 'TICKET_CLOSED') {
          if (payload.refreshedTicket && deriveTicketId(payload.refreshedTicket)) {
            supportTicketsAdapter.upsertOne(state, payload.refreshedTicket);
          }
          state.working.myReplyError =
            'This ticket is closed and can no longer receive replies. Please open a follow-up ticket.';
        } else {
          state.working.myReplyError =
            payload.serverMessage ||
            payload.message ||
            action.error?.message ||
            'Failed to send reply.';
        }
      })

      .addCase(fetchSupportAssignees.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.assignees = Array.isArray(action.payload) ? action.payload : [];
      })

      .addCase(fetchAdminSupportTickets.pending, (state) => {
        ensureSubstates(state);
        state.adminTicketsStatus = 'loading';
        state.adminTicketsError = '';
      })
      .addCase(fetchAdminSupportTickets.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { items = [], total, totalPages, page } = action.payload || {};
        const valid = items.filter((t) => deriveTicketId(t));
        supportTicketsAdapter.upsertMany(state, valid);
        state.adminTicketIds = valid.map(deriveTicketId);
        state.total = typeof total === 'number' ? total : valid.length;
        state.totalPages = typeof totalPages === 'number' ? totalPages : 1;
        if (typeof page === 'number') state.working.page = page;
        state.adminTicketsStatus = 'succeeded';
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchAdminSupportTickets.rejected, (state, action) => {
        ensureSubstates(state);
        state.adminTicketsStatus = 'failed';
        state.adminTicketsError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Failed to load support tickets.';
      })

      .addCase(fetchAdminSupportTicketById.pending, (state) => {
        ensureSubstates(state);
        state.working.adminDetailLoading = true;
        state.working.drawerError = '';
        state.working.drawerSuccess = '';
      })
      .addCase(fetchAdminSupportTicketById.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.adminDetailLoading = false;
        const detail = action.payload;
        if (detail && deriveTicketId(detail)) {
          supportTicketsAdapter.upsertOne(state, detail);
          state.working.selectedAdminTicketId = deriveTicketId(detail);
        }
      })
      .addCase(fetchAdminSupportTicketById.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.adminDetailLoading = false;
        state.adminTicketsError =
          action.payload?.serverMessage ||
          action.payload?.message ||
          action.error?.message ||
          'Could not load ticket details.';
      })

      .addCase(updateAdminSupportTicket.pending, (state) => {
        ensureSubstates(state);
        state.working.updatingMeta = true;
        state.working.drawerError = '';
        state.working.drawerSuccess = '';
      })
      .addCase(updateAdminSupportTicket.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.updatingMeta = false;
        const { ticket, successMessage } = action.payload || {};
        if (ticket && deriveTicketId(ticket)) {
          supportTicketsAdapter.upsertOne(state, ticket);
        }
        state.working.pendingTerminalStatus = '';
        state.working.drawerSuccess = successMessage || 'Ticket updated.';
      })
      .addCase(updateAdminSupportTicket.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.updatingMeta = false;
        const payload = action.payload || {};
        if (payload.code === 'TICKET_CLOSED') {
          if (payload.refreshedTicket && deriveTicketId(payload.refreshedTicket)) {
            supportTicketsAdapter.upsertOne(state, payload.refreshedTicket);
          }
          state.working.pendingTerminalStatus = '';
          state.working.drawerError = 'This ticket is closed and read-only.';
        } else {
          state.working.drawerError =
            payload.serverMessage ||
            payload.message ||
            action.error?.message ||
            'Failed to update ticket.';
        }
      })

      .addCase(replyAdminSupportTicket.pending, (state) => {
        ensureSubstates(state);
        state.working.sendingReply = true;
        state.working.drawerError = '';
        state.working.drawerSuccess = '';
      })
      .addCase(replyAdminSupportTicket.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.sendingReply = false;
        const { ticket, internal } = action.payload || {};
        if (ticket && deriveTicketId(ticket)) {
          supportTicketsAdapter.upsertOne(state, ticket);
        }
        state.working.drawerSuccess = internal
          ? 'Internal note added.'
          : 'Public reply sent to user.';
      })
      .addCase(replyAdminSupportTicket.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.sendingReply = false;
        const payload = action.payload || {};
        if (payload.code === 'TICKET_CLOSED') {
          if (payload.refreshedTicket && deriveTicketId(payload.refreshedTicket)) {
            supportTicketsAdapter.upsertOne(state, payload.refreshedTicket);
          }
          state.working.drawerError = 'This ticket is closed and read-only.';
        } else {
          state.working.drawerError =
            payload.serverMessage ||
            payload.message ||
            action.error?.message ||
            'Failed to post reply.';
        }
      })

      .addCase(closeProjectFromSupportTicket.pending, (state) => {
        ensureSubstates(state);
        state.working.closingProject = true;
        state.working.closeError = '';
      })
      .addCase(closeProjectFromSupportTicket.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.closingProject = false;
        state.working.closeProjectModalOpen = false;
        const { ticket } = action.payload || {};
        if (ticket && deriveTicketId(ticket)) {
          supportTicketsAdapter.upsertOne(state, ticket);
        }
        state.working.drawerSuccess =
          'Project closed ("Owner inactive"), Phase 9 refunds processed, and ticket resolved.';
      })
      .addCase(closeProjectFromSupportTicket.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.closingProject = false;
        const payload = action.payload || {};
        if (payload.code === 'TICKET_CLOSED') {
          if (payload.refreshedTicket && deriveTicketId(payload.refreshedTicket)) {
            supportTicketsAdapter.upsertOne(state, payload.refreshedTicket);
          }
          state.working.closeProjectModalOpen = false;
          state.working.drawerError = 'This ticket is closed and read-only.';
        } else {
          state.working.closeError =
            payload.serverMessage ||
            payload.message ||
            action.error?.message ||
            'Failed to close project from ticket.';
        }
      })

      .addCase(sessionReset, () => createInitialSupportTicketsState());

    addRouteReset(builder, clearWorkingSupportState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setSupportStatusFilter,
  setSupportTypeFilter,
  setSupportAssigneeFilter,
  setSupportSearchQuery,
  setSupportPage,
  closeAdminTicketDrawer,
  setPendingTerminalStatus,
  setDrawerError,
  openCloseProjectModal,
  dismissCloseProjectModal,
  selectMyTicket,
} = supportTicketsSlice.actions;

export default supportTicketsSlice.reducer;
