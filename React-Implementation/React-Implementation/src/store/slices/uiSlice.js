import { createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';

/**
 * Navigation State-Reset Policy Across the Application (Requirement 5 = Reading B, Decision D3)
 * ============================================================================================
 *
 * STATE THAT STAYS ON ROUTE CHANGE (`routeChanged`):
 * - `session` (`user`, `accessToken`, `expiresAtMs`, `authStatus`, `activeRole`,
 *   `allowedRoles`, `portalRole`, `isSuperUser`, `permissions`, `flashNotices`)
 *   Why: Prevents logging the user out or stripping role/admin guard claims on navigation.
 * - `notifications` (`items`, `unreadCount`) & `chatMessages.unreadSummary`
 *   Why: Drives persistent Navbar badges across every authenticated page.
 * - `ui.theme`
 *   Why: Global user preference; toggling Dark/Light must survive route transitions
 *   (resets to the default light theme on full page reload per Decision D4/D5).
 * - `ui.sidebarOpen`
 *   Why: Persistent navigation layout preference; must not snap open/closed per link.
 * - `ui.toasts`
 *   Why: Action feedback toasts (e.g. post-save or post-redirect confirmation) should
 *   remain visible across navigation until dismissed or timed out.
 * - `ui.maintenance`, `ui.resettingBanner`
 *   Why: Global server availability banners apply across all non-admin routes.
 * - `mentorSessions.activeCheckout.idempotencyKey` (and pending checkout session metadata)
 *   Why: Preserves payment `Idempotency-Key` safety so accidental navigation does not cause double charges.
 * - Domain repository slice entities (`ids`, `entities`, `lastFetchedAt`), `platformConfig.public`,
 *   and `actionFeedback.reasonsConfig`
 *   Why: Reading B keeps normalized server entities cached in Redux.
 *
 * STATE THAT CLEARS ON ROUTE CHANGE (`routeChanged` via `addRouteReset`):
 * - `ui.openDropdowns`, `ui.activeModal`, `ui.modalProps`
 *   Why: Shared dropdown menus and global modal overlays belong to the page where opened.
 * - Every domain repository slice's `working` sub-state (`searchQuery`, status/type filters,
 *   `selectedId`, pagination, detail/preview drawers, mutation loading/error flags, and
 *   temporary per-project chat buffers)
 *   Why: Prevents stale filters, previous workspace chat/errors, or open dialogs from leaking across pages.
 */

export function getInitialTheme() {
  return 'light';
}

let nextToastSeq = 1;

const defaultDropdowns = {
  roleMenu: false,
  profileMenu: false,
  chatUnreadMenu: false,
};

export function createInitialUIState(theme = getInitialTheme()) {
  return {
    theme: theme === 'dark' ? 'dark' : 'light',
    sidebarOpen: true,
    toasts: [],
    openDropdowns: { ...defaultDropdowns },
    activeModal: null,
    modalProps: null,
    maintenance: { active: false, message: '' },
    resettingBanner: { active: false, message: '' },
  };
}

function clearWorkingUIState(state) {
  state.activeModal = null;
  state.modalProps = null;
  state.openDropdowns = { ...defaultDropdowns };
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: createInitialUIState(),
  reducers: {
    setTheme(state, action) {
      state.theme = action.payload === 'dark' ? 'dark' : 'light';
    },
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },
    setSidebarOpen(state, action) {
      state.sidebarOpen = Boolean(action.payload);
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    enqueueToast(state, action) {
      const payload =
        typeof action.payload === 'string'
          ? { message: action.payload }
          : action.payload || {};
      const message = String(payload.message || '').trim();
      if (!message) return;

      const id = String(payload.id || `toast-${nextToastSeq++}`);
      const existingIdx = state.toasts.findIndex((t) => t.id === id);
      const toastItem = {
        id,
        message,
        type: payload.type || 'info',
        durationMs:
          typeof payload.durationMs === 'number' ? payload.durationMs : 3500,
        createdAt: payload.createdAt || new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        state.toasts[existingIdx] = toastItem;
      } else {
        state.toasts.push(toastItem);
        if (state.toasts.length > 5) {
          state.toasts.shift();
        }
      }
    },
    dismissToast(state, action) {
      const targetId = String(action.payload || '');
      state.toasts = state.toasts.filter((t) => t.id !== targetId);
    },
    clearToasts(state) {
      state.toasts = [];
    },
    setDropdownOpen(state, action) {
      const { name, isOpen } = action.payload || {};
      if (!name) return;
      state.openDropdowns[String(name)] = Boolean(isOpen);
    },
    closeAllDropdowns(state) {
      state.openDropdowns = { ...defaultDropdowns };
    },
    openGlobalModal(state, action) {
      const payload =
        typeof action.payload === 'string'
          ? { modal: action.payload, props: null }
          : action.payload || {};
      state.activeModal = payload.modal || null;
      state.modalProps = payload.props || null;
    },
    closeGlobalModal(state) {
      state.activeModal = null;
      state.modalProps = null;
    },
    setMaintenance(state, action) {
      const { active = false, message = '' } = action.payload || {};
      state.maintenance = {
        active: Boolean(active),
        message: String(message || ''),
      };
    },
    setResettingBanner(state, action) {
      const { active = false, message = '' } = action.payload || {};
      state.resettingBanner = {
        active: Boolean(active),
        message: String(message || ''),
      };
    },
    clearWorkingUI: clearWorkingUIState,
    resetUISlice(state) {
      return createInitialUIState(state.theme);
    },
  },
  extraReducers: (builder) => {
    addRouteReset(builder, clearWorkingUIState);
    builder.addCase(sessionReset, (state) => {
      const fresh = createInitialUIState(state.theme);
      fresh.sidebarOpen = state.sidebarOpen;
      return fresh;
    });
  },
});

export const {
  setTheme,
  toggleTheme,
  setSidebarOpen,
  toggleSidebar,
  enqueueToast,
  dismissToast,
  clearToasts,
  setDropdownOpen,
  closeAllDropdowns,
  openGlobalModal,
  closeGlobalModal,
  setMaintenance,
  setResettingBanner,
  clearWorkingUI,
  resetUISlice,
} = uiSlice.actions;

export default uiSlice.reducer;
