import { createAsyncThunk } from '@reduxjs/toolkit';
import communicationApi from '../../services/communicationApi';
import { normalizeThunkError } from '../utils/thunkError';

export const CHAT_MESSAGES_STALE_MS = 6 * 1000;
export const CHAT_UNREAD_STALE_MS = 20 * 1000;

function extractMessagesList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.messages)) return res.messages;
  return [];
}

/**
 * Fetches chat messages for a project (`GET /communication/messages/project/:projectId`).
 */
export const fetchProjectMessages = createAsyncThunk(
  'communication/fetchProjectMessages',
  async (arg, { rejectWithValue }) => {
    try {
      const opts =
        typeof arg === 'object' && arg !== null ? arg : { projectId: arg };
      const projectId = String(opts.projectId);
      const role = opts.role;
      if (typeof communicationApi?.getMessages !== 'function') {
        return { projectId, items: [] };
      }
      const res =
        role !== undefined
          ? await communicationApi.getMessages(projectId, role)
          : await communicationApi.getMessages(projectId);
      return {
        projectId,
        items: extractMessagesList(res),
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg, { getState }) => {
      const opts =
        typeof arg === 'object' && arg !== null ? arg : { projectId: arg };
      const projectId = opts.projectId ? String(opts.projectId) : '';
      if (!projectId) return false;
      if (opts.force === true) return true;
      const slice = getState()?.communication;
      if (!slice) return true;
      if (slice.byProjectStatus?.[projectId] === 'loading') return false;
      if (slice.forbiddenByProject?.[projectId]) return false;
      const ts = slice.byProjectLastFetchedAt?.[projectId];
      if (ts) {
        const parsed = Date.parse(ts);
        if (
          Number.isFinite(parsed) &&
          Date.now() - parsed < CHAT_MESSAGES_STALE_MS
        ) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Sends a chat message (`POST /communication/messages`).
 * Optimistic temp message lifecycle (`temp-${requestId}`) is handled by `communicationSlice`.
 */
export const sendProjectMessage = createAsyncThunk(
  'communication/sendProjectMessage',
  async (arg, { rejectWithValue, requestId }) => {
    try {
      const {
        projectId,
        text,
        content,
        senderName,
        role,
        userId,
      } = arg || {};
      const pid = String(projectId || '');
      const messageText = String(content ?? text ?? '').trim();
      const payload = {
        projectId: pid,
        content: messageText,
        text: messageText,
        ...(senderName ? { senderName } : {}),
      };

      let created;
      if (userId !== undefined) {
        created = await communicationApi.sendMessage(payload, role, userId);
      } else if (role !== undefined) {
        created = await communicationApi.sendMessage(payload, role);
      } else {
        created = await communicationApi.sendMessage(payload);
      }

      return {
        projectId: pid,
        tempId: `temp-${requestId}`,
        message: created || null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches unread project chat summary (`GET /communication/unread`).
 */
export const fetchChatUnread = createAsyncThunk(
  'communication/fetchChatUnread',
  async (arg = {}, { rejectWithValue }) => {
    try {
      if (typeof communicationApi?.getUnread !== 'function') {
        return { total: 0, byProject: [] };
      }
      const { role, userId } = arg || {};
      let res;
      if (userId !== undefined) {
        res = await communicationApi.getUnread(role, userId);
      } else if (role !== undefined) {
        res = await communicationApi.getUnread(role);
      } else {
        res = await communicationApi.getUnread();
      }
      const byProject = Array.isArray(res?.byProject) ? res.byProject : [];
      const total =
        typeof res?.total === 'number'
          ? res.total
          : byProject.reduce((acc, item) => acc + Number(item?.unreadCount || 0), 0);
      return { total, byProject };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
  {
    condition: (arg = {}, { getState }) => {
      if (arg?.force === true) return true;
      const slice = getState()?.communication;
      if (!slice) return true;
      if (slice.unreadStatus === 'loading') return false;
      if (slice.unreadLastFetchedAt) {
        const parsed = Date.parse(slice.unreadLastFetchedAt);
        if (
          Number.isFinite(parsed) &&
          Date.now() - parsed < CHAT_UNREAD_STALE_MS
        ) {
          return false;
        }
      }
      return true;
    },
  },
);

/**
 * Marks all chat messages in a project as read (`POST /communication/projects/:id/read`)
 * and refreshes the navbar unread summary.
 */
export const markProjectChatRead = createAsyncThunk(
  'communication/markProjectChatRead',
  async (arg, { dispatch, rejectWithValue }) => {
    try {
      const opts =
        typeof arg === 'object' && arg !== null ? arg : { projectId: arg };
      const projectId = String(opts.projectId || '');
      const { role, userId } = opts;

      let res = { ok: true };
      if (typeof communicationApi?.markProjectRead === 'function') {
        if (userId !== undefined) {
          res = await communicationApi.markProjectRead(projectId, role, userId);
        } else if (role !== undefined) {
          res = await communicationApi.markProjectRead(projectId, role);
        } else {
          res = await communicationApi.markProjectRead(projectId);
        }
      }

      if (typeof communicationApi?.getUnread === 'function') {
        await dispatch(
          fetchChatUnread({
            force: true,
            ...(role !== undefined ? { role } : {}),
            ...(userId !== undefined ? { userId } : {}),
          }),
        );
      }

      return { projectId, result: res || { ok: true } };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Reports an offensive chat message (`POST /communication/messages/:id/report`).
 */
export const reportChatMessage = createAsyncThunk(
  'communication/reportChatMessage',
  async (arg, { rejectWithValue }) => {
    try {
      const { messageId, reason, role, userId } = arg || {};
      const idStr = String(messageId);
      let res;
      if (userId !== undefined) {
        res = await communicationApi.reportMessage(idStr, reason, role, userId);
      } else if (role !== undefined) {
        res = await communicationApi.reportMessage(idStr, reason, role);
      } else {
        res = await communicationApi.reportMessage(idStr, reason);
      }
      return {
        messageId: idStr,
        report: res || null,
      };
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
