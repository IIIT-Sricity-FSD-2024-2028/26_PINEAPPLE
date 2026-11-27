import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  checkAccountDeletionEligibility,
  checkUsernameAvailability,
  confirmUsername,
  deleteMyAccount,
  fetchPhoneOtpStatus,
  recordFailedPhoneOtpAttempt,
  resendEmailVerification,
  saveProfileSettings,
  uploadUserAvatar,
  verifyUserPhone,
} from '../thunks/settingsThunks';

function deriveSettingsId(item) {
  return String(item?.id || item?.userId || 'me');
}

/**
 * Settings Repository Slice (`settingsSlice`)
 * ===========================================
 * Holds account deletion eligibility checks (`GET /users/me/deletion-check`),
 * phone OTP lockout status, email verification resend state, and profile save
 * operational status.
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` (`savingProfile`,
 *   `deletingAccount`, `deleteError`, `deleteObligations`, `deleteTaskBlockers`,
 *   `profileError`, `verificationStatusMessage`, `verificationErrorMessage`).
 * - STAYS across `routeChanged`: `entities`, `deletionCheck`, `phoneOtpStatus`.
 * - Full reset on `sessionReset`.
 */
export const settingsAdapter = createEntityAdapter({
  selectId: deriveSettingsId,
});

export function createInitialSettingsWorking() {
  return {
    savingProfile: false,
    checkingDeletion: false,
    deletingAccount: false,
    deleteError: '',
    deleteObligations: [],
    deleteTaskBlockers: [],
    profileError: '',
    usernameAvailable: null,
    resendingVerification: false,
    verificationStatusMessage: '',
    verificationErrorMessage: '',
    confirmingUsername: false,
    usernameError: '',
  };
}

export function createInitialSettingsState() {
  return settingsAdapter.getInitialState({
    deletionCheck: null,
    phoneOtpStatus: null,
    status: 'idle',
    error: null,
    lastFetchedAt: null,
    working: createInitialSettingsWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.working) state.working = createInitialSettingsWorking();
}

function clearWorkingSettingsState(state) {
  ensureSubstates(state);
  state.working = createInitialSettingsWorking();
  state.error = null;
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState: createInitialSettingsState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      const list = Array.isArray(action.payload) ? action.payload : [];
      settingsAdapter.setAll(state, list);
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (!action.payload) return;
      settingsAdapter.upsertOne(state, {
        ...action.payload,
        id: deriveSettingsId(action.payload),
      });
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      settingsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      settingsAdapter.removeOne(state, String(action.payload));
    },
    clearDeleteFeedback: (state) => {
      ensureSubstates(state);
      state.working.deleteError = '';
      state.working.deleteObligations = [];
      state.working.deleteTaskBlockers = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkUsernameAvailability.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.usernameAvailable =
          action.payload?.available !== undefined ? Boolean(action.payload.available) : true;
      })
      .addCase(confirmUsername.pending, (state) => {
        ensureSubstates(state);
        state.working.confirmingUsername = true;
        state.working.usernameError = '';
      })
      .addCase(confirmUsername.fulfilled, (state) => {
        ensureSubstates(state);
        state.working.confirmingUsername = false;
        state.working.usernameError = '';
      })
      .addCase(confirmUsername.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.confirmingUsername = false;
        state.working.usernameError = action.payload?.message || 'Failed to confirm username. Please try again.';
      })
      .addCase(uploadUserAvatar.pending, (state) => {
        ensureSubstates(state);
        state.working.savingProfile = true;
      })
      .addCase(uploadUserAvatar.rejected, (state) => {
        ensureSubstates(state);
        state.working.savingProfile = false;
      })
      .addCase(saveProfileSettings.pending, (state) => {
        ensureSubstates(state);
        state.working.savingProfile = true;
        state.working.profileError = '';
      })
      .addCase(saveProfileSettings.fulfilled, (state) => {
        ensureSubstates(state);
        state.working.savingProfile = false;
        state.working.profileError = '';
      })
      .addCase(saveProfileSettings.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.savingProfile = false;
        state.working.profileError = action.payload?.message || 'Failed to save profile.';
      })
      .addCase(verifyUserPhone.fulfilled, (state) => {
        ensureSubstates(state);
        state.phoneOtpStatus = { wrongAttempts: 0, locked: false, remainingSeconds: 0 };
      })
      .addCase(fetchPhoneOtpStatus.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.phoneOtpStatus = action.payload || null;
      })
      .addCase(recordFailedPhoneOtpAttempt.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload) {
          state.phoneOtpStatus = action.payload;
        }
      })
      .addCase(checkAccountDeletionEligibility.pending, (state) => {
        ensureSubstates(state);
        state.working.checkingDeletion = true;
      })
      .addCase(checkAccountDeletionEligibility.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.checkingDeletion = false;
        state.deletionCheck = action.payload || null;
      })
      .addCase(checkAccountDeletionEligibility.rejected, (state) => {
        ensureSubstates(state);
        state.working.checkingDeletion = false;
      })
      .addCase(deleteMyAccount.pending, (state) => {
        ensureSubstates(state);
        state.working.deletingAccount = true;
        state.working.deleteError = '';
        state.working.deleteObligations = [];
        state.working.deleteTaskBlockers = [];
      })
      .addCase(deleteMyAccount.fulfilled, (state) => {
        ensureSubstates(state);
        state.working.deletingAccount = false;
      })
      .addCase(deleteMyAccount.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.deletingAccount = false;
        state.working.deleteError = action.payload?.message || 'Could not delete account.';
        state.working.deleteObligations = Array.isArray(action.payload?.obligations)
          ? action.payload.obligations
          : [];
        state.working.deleteTaskBlockers = Array.isArray(action.payload?.taskBlockers)
          ? action.payload.taskBlockers
          : [];
      })
      .addCase(resendEmailVerification.pending, (state) => {
        ensureSubstates(state);
        state.working.resendingVerification = true;
        state.working.verificationStatusMessage = '';
        state.working.verificationErrorMessage = '';
      })
      .addCase(resendEmailVerification.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.working.resendingVerification = false;
        state.working.verificationStatusMessage =
          action.payload?.message || 'Verification email sent. Please check your inbox.';
      })
      .addCase(resendEmailVerification.rejected, (state, action) => {
        ensureSubstates(state);
        state.working.resendingVerification = false;
        if (action.payload?.code === 'EMAIL_ALREADY_VERIFIED' || action.payload?.statusCode === 409) {
          state.working.verificationStatusMessage = '';
          state.working.verificationErrorMessage = '';
        } else {
          state.working.verificationErrorMessage =
            action.payload?.message || 'Could not resend verification email.';
        }
      })
      .addCase(sessionReset, () => createInitialSettingsState());

    addRouteReset(builder, clearWorkingSettingsState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  clearDeleteFeedback,
} = settingsSlice.actions;

export default settingsSlice.reducer;
