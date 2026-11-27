import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { addRouteReset } from '../utils/routeReset';
import { sessionReset } from '../actions/appActions';
import {
  approveMentorApplication,
  deleteMentorApplication,
  fetchDigiLockerStatus,
  fetchMentorApplicationById,
  fetchMentorApplications,
  fetchMentorMinYearsConfig,
  fetchMyMentorApplicationStatus,
  pullDigiLockerDocuments,
  rejectMentorApplication,
  submitMentorApplication,
  updateMentorApplication,
  uploadMentorCv,
} from '../thunks/mentorApplicationsThunks';

/**
 * Mentor Applications Repository Slice (`mentorApplicationsSlice`)
 * ================================================================
 * Manages mentor eligibility applications, DigiLocker verification state,
 * CV upload metadata, and cooldown notices.
 *
 * Route-Leave Reset (Reading B — Decision D3):
 * - CLEARS on `routeChanged`: `working` transient form alerts, CV/DigiLocker
 *   errors, and list filters.
 * - STAYS across `routeChanged`: `myStatusData` / `existingApplication`,
 *   normalized `entities`, `minYearsRequired`, `cvData`, `digiLockerDocs`.
 * - Full reset on `sessionReset`.
 */
export const mentorApplicationsAdapter = createEntityAdapter({
  selectId: (app) => String(app?.id || ''),
});

export function createInitialMentorApplicationsWorking() {
  return {
    showFormOverride: null,
    statusFilter: 'all',
    selectedApplicationId: null,
    adminFilter: 'pending',
    verificationFilter: 'all',
    adminSearch: '',
    expandedIds: {},
    overrideModalAppId: null,
    overrideError: '',
    submitError: '',
    submitSuccess: '',
    cvError: '',
    digiLockerError: '',
    emailNotVerifiedError: false,
  };
}

export function createInitialMentorApplicationsState() {
  return mentorApplicationsAdapter.getInitialState({
    myApplicationId: null,
    adminListIds: [],
    myStatusData: {
      status: 'none',
      mentorUnlocked: false,
      application: null,
      inCooldown: false,
      cooldownAvailableAt: null,
      cooldownDays: 14,
    },
    myStatus: 'idle',
    myError: null,
    myLastFetchedAt: null,
    listStatus: 'idle',
    listError: null,
    listLastFetchedAt: null,
    minYearsRequired: 5,
    cvData: null,
    cvUploading: false,
    digiLockerDocs: [],
    digiLockerConnected: false,
    digiLockerLoading: false,
    digiLockerMode: null,
    submitting: false,
    error: null,
    working: createInitialMentorApplicationsWorking(),
  });
}

function ensureSubstates(state) {
  if (!state.entities) state.entities = {};
  if (!Array.isArray(state.ids)) state.ids = [];
  if (!state.myStatusData) {
    state.myStatusData = createInitialMentorApplicationsState().myStatusData;
  }
  if (!Array.isArray(state.digiLockerDocs)) state.digiLockerDocs = [];
  if (!state.working) state.working = createInitialMentorApplicationsWorking();
}

function clearWorkingMentorAppsState(state) {
  state.working = createInitialMentorApplicationsWorking();
  state.error = null;
}

const mentorApplicationsSlice = createSlice({
  name: 'mentorApplications',
  initialState: createInitialMentorApplicationsState(),
  reducers: {
    // ── Four Explicit CRUD Reducers (SPEC 2, D2) ──
    setAll: (state, action) => {
      ensureSubstates(state);
      mentorApplicationsAdapter.setAll(
        state,
        Array.isArray(action.payload) ? action.payload : [],
      );
    },
    addOne: (state, action) => {
      ensureSubstates(state);
      if (action.payload?.id) {
        mentorApplicationsAdapter.addOne(state, action.payload);
      }
    },
    updateOne: (state, action) => {
      ensureSubstates(state);
      mentorApplicationsAdapter.updateOne(state, action.payload);
    },
    removeOne: (state, action) => {
      ensureSubstates(state);
      mentorApplicationsAdapter.removeOne(state, String(action.payload));
    },

    // ── Working / Form UI Reducers ──
    setShowMentorForm: (state, action) => {
      ensureSubstates(state);
      state.working.showFormOverride =
        action.payload === null ? null : Boolean(action.payload);
    },
    removeDigiLockerDocAt: (state, action) => {
      ensureSubstates(state);
      const idx = Number(action.payload);
      state.digiLockerDocs = state.digiLockerDocs.filter((_, i) => i !== idx);
    },
    setMentorAppCvError: (state, action) => {
      ensureSubstates(state);
      state.working.cvError =
        typeof action.payload === 'string' ? action.payload : '';
    },
    setMentorAppDigiLockerError: (state, action) => {
      ensureSubstates(state);
      state.working.digiLockerError =
        typeof action.payload === 'string' ? action.payload : '';
    },
    setMentorAppSubmitError: (state, action) => {
      ensureSubstates(state);
      state.working.submitError =
        typeof action.payload === 'string' ? action.payload : '';
    },
    clearMentorAppMessages: (state) => {
      ensureSubstates(state);
      state.working.submitError = '';
      state.working.submitSuccess = '';
      state.working.emailNotVerifiedError = false;
    },
    setAdminMentorAppFilter: (state, action) => {
      ensureSubstates(state);
      state.working.adminFilter = action.payload || 'pending';
    },
    setAdminMentorVerificationFilter: (state, action) => {
      ensureSubstates(state);
      state.working.verificationFilter = action.payload || 'all';
    },
    setAdminMentorSearch: (state, action) => {
      ensureSubstates(state);
      state.working.adminSearch =
        typeof action.payload === 'string' ? action.payload : '';
    },
    toggleMentorAppExpanded: (state, action) => {
      ensureSubstates(state);
      const { id, currentStatus } = action.payload || {};
      const key = String(id || '');
      if (!key) return;
      if (!state.working.expandedIds) state.working.expandedIds = {};
      const currentlyOpen =
        state.working.expandedIds[key] !== undefined
          ? state.working.expandedIds[key]
          : currentStatus === 'pending';
      state.working.expandedIds[key] = !currentlyOpen;
    },
    setOverrideModalAppId: (state, action) => {
      ensureSubstates(state);
      state.working.overrideModalAppId = action.payload ? String(action.payload) : null;
      state.working.overrideError = '';
    },
    setOverrideModalError: (state, action) => {
      ensureSubstates(state);
      state.working.overrideError =
        typeof action.payload === 'string' ? action.payload : '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyMentorApplicationStatus.pending, (state) => {
        ensureSubstates(state);
        state.myStatus = 'loading';
        state.myError = null;
      })
      .addCase(fetchMyMentorApplicationStatus.fulfilled, (state, action) => {
        ensureSubstates(state);
        const data = action.payload || { status: 'none', application: null };
        state.myStatus = 'succeeded';
        state.myStatusData = data;
        state.myLastFetchedAt = new Date().toISOString();
        if (data.application?.id) {
          state.myApplicationId = String(data.application.id);
          mentorApplicationsAdapter.upsertOne(state, data.application);
        }
        if (data.status === 'none' || !data.application) {
          state.working.showFormOverride = true;
        } else if (data.status === 'pending' || data.status === 'approved' || data.mentorUnlocked) {
          state.working.showFormOverride = false;
        }
      })
      .addCase(fetchMyMentorApplicationStatus.rejected, (state, action) => {
        ensureSubstates(state);
        state.myStatus = 'failed';
        state.myLastFetchedAt = new Date().toISOString();
        state.myError = action.payload || { message: action.error?.message };
        state.working.showFormOverride = true;
      })

      .addCase(fetchMentorApplications.pending, (state) => {
        ensureSubstates(state);
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchMentorApplications.fulfilled, (state, action) => {
        ensureSubstates(state);
        const list = Array.isArray(action.payload) ? action.payload : [];
        mentorApplicationsAdapter.upsertMany(state, list);
        state.adminListIds = list.map((a) => String(a?.id || '')).filter(Boolean);
        state.listStatus = 'succeeded';
        state.listLastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchMentorApplications.rejected, (state, action) => {
        ensureSubstates(state);
        state.listStatus = 'failed';
        state.listError = action.payload || { message: action.error?.message };
      })

      .addCase(fetchMentorApplicationById.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload?.id) {
          mentorApplicationsAdapter.upsertOne(state, action.payload);
        }
      })

      .addCase(fetchMentorMinYearsConfig.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.minYearsRequired = Math.max(5, Number(action.payload) || 5);
      })

      .addCase(uploadMentorCv.pending, (state) => {
        ensureSubstates(state);
        state.cvUploading = true;
        state.working.cvError = '';
      })
      .addCase(uploadMentorCv.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.cvUploading = false;
        state.cvData = action.payload || null;
        state.working.cvError = '';
      })
      .addCase(uploadMentorCv.rejected, (state, action) => {
        ensureSubstates(state);
        state.cvUploading = false;
        const err = action.payload || { message: action.error?.message };
        state.working.cvError =
          err?.message || 'Failed to upload CV file. Please try again.';
      })

      .addCase(fetchDigiLockerStatus.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.digiLockerMode = action.payload || null;
      })

      .addCase(pullDigiLockerDocuments.pending, (state) => {
        ensureSubstates(state);
        state.digiLockerLoading = true;
        state.working.digiLockerError = '';
      })
      .addCase(pullDigiLockerDocuments.fulfilled, (state, action) => {
        ensureSubstates(state);
        state.digiLockerLoading = false;
        state.digiLockerDocs = Array.isArray(action.payload)
          ? action.payload
          : [];
        state.digiLockerConnected = true;
        state.working.digiLockerError = '';
      })
      .addCase(pullDigiLockerDocuments.rejected, (state, action) => {
        ensureSubstates(state);
        state.digiLockerLoading = false;
        const err = action.payload || { message: action.error?.message };
        state.working.digiLockerError =
          err?.message || 'Failed to connect to DigiLocker sandbox.';
      })

      .addCase(submitMentorApplication.pending, (state) => {
        ensureSubstates(state);
        state.submitting = true;
        state.working.submitError = '';
        state.working.submitSuccess = '';
        state.working.emailNotVerifiedError = false;
      })
      .addCase(submitMentorApplication.fulfilled, (state, action) => {
        ensureSubstates(state);
        const { application, excludedCount = 0, verifiedCount = 0 } =
          action.payload || {};
        state.submitting = false;
        if (application?.id) {
          state.myApplicationId = String(application.id);
          mentorApplicationsAdapter.upsertOne(state, application);
        }
        state.myStatusData = {
          status: application?.status || 'pending',
          mentorUnlocked: application?.status === 'approved',
          application: application || { status: 'pending' },
          inCooldown: false,
          cooldownAvailableAt: null,
          cooldownDays: 14,
        };
        state.working.showFormOverride = false;
        const excludedMsg =
          excludedCount > 0
            ? ` (Note: ${excludedCount} unverified credential(s) were excluded)`
            : '';
        state.working.submitSuccess = `Your mentor application with ${verifiedCount} verified credential(s) has been submitted successfully for admin review!${excludedMsg}`;
      })
      .addCase(submitMentorApplication.rejected, (state, action) => {
        ensureSubstates(state);
        state.submitting = false;
        const err = action.payload || { message: action.error?.message };
        if (
          err?.code === 'EMAIL_NOT_VERIFIED' ||
          /verify your email/i.test(err?.message || '')
        ) {
          state.working.emailNotVerifiedError = true;
        }
        if (err?.code === 'REAPPLY_COOLDOWN' || err?.availableAt) {
          state.myStatusData = {
            ...(state.myStatusData || {}),
            inCooldown: true,
            cooldownAvailableAt: err.availableAt || null,
            cooldownDays: err.cooldownDays || 14,
          };
        }
        state.working.submitError =
          err?.message || 'Failed to submit mentor application. Please try again.';
        state.error = err;
      })

      .addCase(updateMentorApplication.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload?.id) {
          mentorApplicationsAdapter.upsertOne(state, action.payload);
        }
      })
      .addCase(approveMentorApplication.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload?.id) {
          mentorApplicationsAdapter.upsertOne(state, {
            ...action.payload,
            status: action.payload.status || 'approved',
          });
        }
      })
      .addCase(rejectMentorApplication.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload?.id) {
          mentorApplicationsAdapter.upsertOne(state, {
            ...action.payload,
            status: action.payload.status || 'rejected',
          });
        }
      })
      .addCase(deleteMentorApplication.fulfilled, (state, action) => {
        ensureSubstates(state);
        if (action.payload?.id) {
          mentorApplicationsAdapter.removeOne(state, String(action.payload.id));
        }
      })

      .addCase(sessionReset, () => createInitialMentorApplicationsState());

    addRouteReset(builder, clearWorkingMentorAppsState);
  },
});

export const {
  setAll,
  addOne,
  updateOne,
  removeOne,
  setShowMentorForm,
  removeDigiLockerDocAt,
  setMentorAppCvError,
  setMentorAppDigiLockerError,
  setMentorAppSubmitError,
  clearMentorAppMessages,
  setAdminMentorAppFilter,
  setAdminMentorVerificationFilter,
  setAdminMentorSearch,
  toggleMentorAppExpanded,
  setOverrideModalAppId,
  setOverrideModalError,
} = mentorApplicationsSlice.actions;

export default mentorApplicationsSlice.reducer;
