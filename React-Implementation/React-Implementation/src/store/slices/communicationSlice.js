import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  fetchChatUnread,
  fetchProjectMessages,
  markProjectChatRead,
  reportChatMessage,
  sendProjectMessage,
} from '../thunks/communicationThunks';

const DEFAULT_FORBIDDEN_MESSAGE = 'You are not a member of this project.';
const REPORT_SUCCESS_CONFIRMATION =
  'Report sent. Admins will review it. You can track it in Help & Support under My reports.';

/**
 * Communication Repository Slice (`communicationSlice`)
 * ======================================================
 * Manages project chat messages (normalized via `createEntityAdapter`, indexed by
 * `messageIdsByProject`), unread summary for the navbar badge/dropdown, and chat
 * message reporting against `CommunicationController`.
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` buffers (`draftByProject`,
 *   `shouldScrollByProject`, `reportTarget`, `reportReason`, `reportError`,
 *   `reportSuccessMsg`, `sendErrorByProject`, `markReadError`).
 * - STAYS across `routeChanged`: loaded chat `entities`/`ids`,
 *   `messageIdsByProject`, `byProjectLastFetchedAt`, `unreadTotal`,
 *   `unreadByProject`, `reportedIdsById`, and `forbiddenByProject`.
 * - Full reset on `sessionReset`.
 */
export const communicationAdapter = createEntityAdapter({
  selectId: (msg) => String(msg?.id || ''),
});

export function createInitialCommunicationWorking() {
  return {
    draftByProject: {},
    shouldScrollByProject: {},
    sendErrorByProject: {},
    markReadError: null,
    reportTarget: null,
    reportReason: '',
    reportError: '',
    reportSuccessMsg: '',
  };
}

export function createInitialCommunicationState() {
  return communicationAdapter.getInitialState({
    messageIdsByProject: {},
    byProjectStatus: {},
    byProjectError: {},
    forbiddenByProject: {},
    byProjectLastFetchedAt: {},
    sendingByProject: {},
    unreadTotal: 0,
    unreadByProject: [],
    unreadStatus: 'idle',
    unreadError: null,
    unreadLastFetchedAt: null,
    reportStatus: 'idle',
    reportedIdsById: {},
    error: null,
    working: createInitialCommunicationWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.messageIdsByProject) state.messageIdsByProject = {};
  if (!state.byProjectStatus) state.byProjectStatus = {};
  if (!state.byProjectError) state.byProjectError = {};
  if (!state.forbiddenByProject) state.forbiddenByProject = {};
  if (!state.byProjectLastFetchedAt) state.byProjectLastFetchedAt = {};
  if (!state.sendingByProject) state.sendingByProject = {};
  if (typeof state.unreadTotal !== 'number') state.unreadTotal = 0;
  if (!Array.isArray(state.unreadByProject)) state.unreadByProject = [];
  if (!state.unreadStatus) state.unreadStatus = 'idle';
  if (!state.reportStatus) state.reportStatus = 'idle';
  if (!state.reportedIdsById) state.reportedIdsById = {};
  if (!state.working) state.working = createInitialCommunicationWorking();
}

function isForbiddenError(err) {
  if (!err) return false;
  return (
    err.statusCode === 403 ||
    err.code === 'CHAT_MEMBERSHIP_REQUIRED' ||
    err?.response?.status === 403 ||
    err?.data?.code === 'CHAT_MEMBERSHIP_REQUIRED'
  );
}

function formatReportErrorMessage(err) {
  const code = err?.code || err?.data?.code;
  if (code === 'ALREADY_REPORTED') {
    return 'You have already reported this message.';
  }
  if (code === 'TOO_MANY_REPORTS') {
    return 'Daily report limit reached. Please try again tomorrow.';
  }
  return err?.message || 'Failed to submit report.';
}

function appendMessageIdForProject(state, projectId, msgId) {
  const pid = String(projectId || '');
  if (!pid || !msgId) return;
  const current = Array.isArray(state.messageIdsByProject[pid])
    ? state.messageIdsByProject[pid]
    : [];
  if (!current.includes(msgId)) {
    state.messageIdsByProject[pid] = [...current, msgId];
  }
}

function replaceMessageIdForProject(state, projectId, tempId, realId) {
  const pid = String(projectId || '');
  if (!pid) return;
  const current = Array.isArray(state.messageIdsByProject[pid])
    ? state.messageIdsByProject[pid]
    : [];
  const next = [];
  let inserted = false;
  for (const id of current) {
    if (id === tempId) {
      if (realId && !next.includes(realId)) {
        next.push(realId);
        inserted = true;
      }
    } else if (id !== realId || !inserted) {
      if (!next.includes(id)) {
        next.push(id);
        if (id === realId) inserted = true;
      }
    }
  }
  if (realId && !inserted && !next.includes(realId)) {
    next.push(realId);
  }
  state.messageIdsByProject[pid] = next;
}

function removeMessageIdFromProjects(state, targetId, explicitProjectId) {
  if (explicitProjectId) {
    const pid = String(explicitProjectId);
    if (Array.isArray(state.messageIdsByProject[pid])) {
      state.messageIdsByProject[pid] = state.messageIdsByProject[pid].filter(
        (id) => id !== targetId,
      );
    }
    return;
  }
  for (const pid of Object.keys(state.messageIdsByProject)) {
    if (Array.isArray(state.messageIdsByProject[pid])) {
      state.messageIdsByProject[pid] = state.messageIdsByProject[pid].filter(
        (id) => id !== targetId,
      );
    }
  }
}

function clearWorkingCommunicationState(state) {
  state.working = createInitialCommunicationWorking();
  state.error = null;
}

const communicationSlice = createSlice({
  name: 'communication',
  initialState: createInitialCommunicationState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const payload = action.payload;
      if (Array.isArray(payload)) {
        communicationAdapter.setAll(state, payload);
        for (const msg of payload) {
          if (msg?.projectId && msg?.id) {
            appendMessageIdForProject(state, msg.projectId, String(msg.id));
          }
        }
        return;
      }
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const projectId = payload?.projectId ? String(payload.projectId) : null;
      if (projectId) {
        const nextIds = items
          .map((item) => (item?.id ? String(item.id) : null))
          .filter(Boolean);
        // Remove previous project-scoped entities not kept in fresh list
        const prevIds = state.messageIdsByProject[projectId] || [];
        const toRemove = prevIds.filter((id) => !nextIds.includes(id));
        if (toRemove.length > 0) {
          communicationAdapter.removeMany(state, toRemove);
        }
        communicationAdapter.upsertMany(state, items);
        state.messageIdsByProject[projectId] = nextIds;
      } else {
        communicationAdapter.setAll(state, items);
      }
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      const msg = action.payload;
      if (!msg?.id) return;
      communicationAdapter.addOne(state, msg);
      if (msg.projectId) {
        appendMessageIdForProject(state, msg.projectId, String(msg.id));
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      communicationAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      const id = String(action.payload);
      const existing = state.entities[id];
      communicationAdapter.removeOne(state, id);
      removeMessageIdFromProjects(state, id, existing?.projectId);
    },

    // ── Volatile Working State Reducers (Cleared on routeChanged per Reading B) ──
    setChatDraft: (state, action) => {
      ensureSubstates(state);
      const projectId = String(action.payload?.projectId || '__default__');
      const text =
        typeof action.payload?.text === 'string' ? action.payload.text : '';
      state.working.draftByProject[projectId] = text;
    },
    setChatScrollFlag: (state, action) => {
      ensureSubstates(state);
      const projectId = String(action.payload?.projectId || '__default__');
      state.working.shouldScrollByProject[projectId] = Boolean(
        action.payload?.shouldScroll,
      );
    },
    openReportDialog: (state, action) => {
      ensureSubstates(state);
      const target = action.payload;
      state.working.reportTarget = target
        ? {
            id: target.id,
            senderName: target.senderName || '',
            content: target.content || '',
          }
        : null;
      state.working.reportReason = '';
      state.working.reportError = '';
      state.reportStatus = 'idle';
    },
    closeReportDialog: (state) => {
      ensureSubstates(state);
      if (state.reportStatus === 'loading') return;
      state.working.reportTarget = null;
      state.working.reportReason = '';
      state.working.reportError = '';
    },
    setReportReason: (state, action) => {
      ensureSubstates(state);
      state.working.reportReason =
        typeof action.payload === 'string' ? action.payload : '';
      if (state.working.reportError) {
        state.working.reportError = '';
      }
    },
    setReportError: (state, action) => {
      ensureSubstates(state);
      state.working.reportError =
        typeof action.payload === 'string' ? action.payload : '';
    },
    clearChatReportFeedback: (state) => {
      ensureSubstates(state);
      state.working.reportError = '';
      state.working.reportSuccessMsg = '';
    },
  },
  extraReducers: (builder) => {
    builder
      // ── Fetch Project Messages ──
      .addCase(fetchProjectMessages.pending, (state, action) => {
        ensureSubstates(state);
        const arg = action.meta.arg;
        const projectId = String(
          typeof arg === 'object' && arg !== null ? arg.projectId : arg,
        );
        if (!projectId) return;
        state.byProjectStatus[projectId] = 'loading';
        state.byProjectError[projectId] = null;
      })
      .addCase(fetchProjectMessages.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, items } = action.payload;
        const pid = String(projectId);
        const normalized = Array.isArray(items)
          ? items.filter((item) => item && item.id)
          : [];
        const serverIds = normalized.map((item) => String(item.id));
        const prevIds = state.messageIdsByProject[pid] || [];
        // Keep in-flight temp optimistic IDs, drop removed non-temp IDs
        const activeTempIds = prevIds.filter(
          (id) => String(id).startsWith('temp-') && !serverIds.includes(id),
        );
        const removedServerIds = prevIds.filter(
          (id) => !String(id).startsWith('temp-') && !serverIds.includes(id),
        );
        if (removedServerIds.length > 0) {
          communicationAdapter.removeMany(state, removedServerIds);
        }
        communicationAdapter.upsertMany(
          state,
          normalized.map((item) => ({
            ...item,
            projectId: item.projectId || pid,
          })),
        );
        state.messageIdsByProject[pid] = [...serverIds, ...activeTempIds];
        state.byProjectStatus[pid] = 'succeeded';
        state.byProjectError[pid] = null;
        state.forbiddenByProject[pid] = false;
        state.byProjectLastFetchedAt[pid] = new Date().toISOString();
      })
      .addCase(fetchProjectMessages.rejected, (state, action) => {
        ensureSubstates(state);
        const arg = action.meta.arg;
        const projectId = String(
          typeof arg === 'object' && arg !== null ? arg.projectId : arg,
        );
        if (!projectId) return;
        const errPayload = action.payload || { message: action.error?.message };
        state.byProjectStatus[projectId] = 'failed';
        state.byProjectError[projectId] =
          errPayload?.message || DEFAULT_FORBIDDEN_MESSAGE;
        if (isForbiddenError(errPayload)) {
          state.forbiddenByProject[projectId] = true;
          state.byProjectError[projectId] =
            errPayload?.message || DEFAULT_FORBIDDEN_MESSAGE;
        }
        state.error = errPayload;
      })

      // ── Optimistic Send Message ──
      .addCase(sendProjectMessage.pending, (state, action) => {
        ensureSubstates(state);
        const arg = action.meta.arg || {};
        const pid = String(arg.projectId || '');
        if (!pid) return;
        const tempId = `temp-${action.meta.requestId}`;
        const messageText = String(arg.content ?? arg.text ?? '').trim();
        const optimisticMsg = {
          id: tempId,
          projectId: pid,
          senderId: arg.senderId || '',
          senderName: arg.senderName || 'You',
          senderRole: arg.senderRole || arg.role || '',
          content: messageText,
          text: messageText,
          timestamp: new Date().toISOString(),
          optimistic: true,
        };
        state.sendingByProject[pid] = true;
        state.working.sendErrorByProject[pid] = null;
        state.working.shouldScrollByProject[pid] = true;
        communicationAdapter.upsertOne(state, optimisticMsg);
        appendMessageIdForProject(state, pid, tempId);
      })
      .addCase(sendProjectMessage.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { projectId, tempId, message } = action.payload;
        const pid = String(projectId || '');
        state.sendingByProject[pid] = false;
        state.working.sendErrorByProject[pid] = null;

        if (message && message.id) {
          const realId = String(message.id);
          const existingTemp = state.entities[tempId];
          communicationAdapter.removeOne(state, tempId);
          communicationAdapter.upsertOne(state, {
            ...(existingTemp || {}),
            ...message,
            id: realId,
            projectId: message.projectId || pid,
            optimistic: false,
          });
          replaceMessageIdForProject(state, pid, tempId, realId);
        } else {
          // Server returned no message object; keep normalized temp cleared cleanly
          const existing = state.entities[tempId];
          if (existing) {
            communicationAdapter.updateOne(state, {
              id: tempId,
              changes: { optimistic: false },
            });
          }
        }
      })
      .addCase(sendProjectMessage.rejected, (state, action) => {
        ensureSubstates(state);
        const arg = action.meta.arg || {};
        const pid = String(arg.projectId || '');
        const tempId = `temp-${action.meta.requestId}`;
        if (pid) {
          state.sendingByProject[pid] = false;
          const errPayload = action.payload || { message: action.error?.message };
          state.working.sendErrorByProject[pid] =
            errPayload?.message || 'Failed to send message.';
          if (isForbiddenError(errPayload)) {
            state.forbiddenByProject[pid] = true;
            state.byProjectError[pid] =
              errPayload?.message || DEFAULT_FORBIDDEN_MESSAGE;
          }
          state.error = errPayload;
        }
        communicationAdapter.removeOne(state, tempId);
        removeMessageIdFromProjects(state, tempId, pid);
      })

      // ── Unread Summary ──
      .addCase(fetchChatUnread.pending, (state) => {
        ensureSubstates(state);
        state.unreadStatus = 'loading';
        state.unreadError = null;
      })
      .addCase(fetchChatUnread.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.unreadTotal = Number(action.payload?.total ?? 0);
        state.unreadByProject = Array.isArray(action.payload?.byProject)
          ? action.payload.byProject
          : [];
        state.unreadStatus = 'succeeded';
        state.unreadError = null;
        state.unreadLastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchChatUnread.rejected, (state, action) => {
        ensureSubstates(state);
        state.unreadStatus = 'failed';
        state.unreadError = action.payload || { message: action.error?.message };
      })

      // ── Mark Project Chat Read ──
      .addCase(markProjectChatRead.pending, (state, action) => {
        ensureSubstates(state);
        const arg = action.meta.arg;
        const pid = String(
          typeof arg === 'object' && arg !== null ? arg.projectId : arg,
        );
        state.working.markReadError = null;
        if (pid && Array.isArray(state.unreadByProject)) {
          let nextTotal = 0;
          state.unreadByProject = state.unreadByProject.map((item) => {
            if (String(item?.projectId) === pid) {
              return { ...item, unreadCount: 0 };
            }
            nextTotal += Number(item?.unreadCount || 0);
            return item;
          });
          state.unreadTotal = nextTotal;
        }
      })
      .addCase(markProjectChatRead.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.markReadError =
          action.payload?.message || action.error?.message || null;
      })

      // ── Report Message ──
      .addCase(reportChatMessage.pending, (state) => {
        ensureSubstates(state);
        state.reportStatus = 'loading';
        state.working.reportError = '';
      })
      .addCase(reportChatMessage.fulfilled, (state, action) => {
        ensureSubstates(state);
        const msgId = String(action.payload?.messageId || '');
        state.reportStatus = 'succeeded';
        if (msgId) {
          state.reportedIdsById[msgId] = true;
        }
        state.working.reportTarget = null;
        state.working.reportReason = '';
        state.working.reportError = '';
        state.working.reportSuccessMsg = REPORT_SUCCESS_CONFIRMATION;
      })
      .addCase(reportChatMessage.rejected, (state, action) => {
        ensureSubstates(state);
        state.reportStatus = 'failed';
        const errPayload = action.payload || { message: action.error?.message };
        state.working.reportError = formatReportErrorMessage(errPayload);
        state.error = errPayload;
      })

      // ── Shared Session & Route-Leave Resets ──
      .addCase(sessionReset, () => createInitialCommunicationState());

    addRouteReset(builder, clearWorkingCommunicationState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setChatDraft,
  setChatScrollFlag,
  openReportDialog,
  closeReportDialog,
  setReportReason,
  setReportError,
  clearChatReportFeedback,
} = communicationSlice.actions;

export default communicationSlice.reducer;
