import { createAsyncThunk } from '@reduxjs/toolkit';
import * as adminApiModule from '../../services/adminApi';
import { resolveApiModule } from '../utils/apiModule';
import { normalizeThunkError } from '../utils/thunkError';

/**
 * Fetches public platform config (`GET /admin/config/public`).
 */
export const fetchPublicConfig = createAsyncThunk(
  'platformConfig/fetchPublicConfig',
  async (_arg, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      if (typeof adminApi?.getPublicConfig !== 'function') return null;
      const cfg = await adminApi.getPublicConfig();
      return cfg || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Fetches full admin platform config (`GET /admin/config`).
 */
export const fetchPlatformConfig = createAsyncThunk(
  'platformConfig/fetchPlatformConfig',
  async (_arg, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      if (typeof adminApi?.getConfig !== 'function') return null;
      const cfg = await adminApi.getConfig();
      return cfg || null;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);

/**
 * Updates platform configuration (`PUT /admin/config`) and records audit entry.
 */
export const updatePlatformConfig = createAsyncThunk(
  'platformConfig/updatePlatformConfig',
  async (payload, { rejectWithValue }) => {
    try {
      const adminApi = resolveApiModule(adminApiModule, 'adminApi');
      const saved = await adminApi.updateConfig(payload);
      if (typeof adminApi?.recordAuditEntry === 'function') {
        adminApi
          .recordAuditEntry({
            action: 'config-saved',
            actor: 'Super User',
            target: 'Platform Configuration',
            details: {
              maxProjectsPerUser: payload?.maxProjectsPerUser,
              maxCollaboratorsPerProject: payload?.maxCollaboratorsPerProject,
              mentorMinYearsExperience: payload?.mentorMinYearsExperience,
              ...(payload?.xpPerTaskCompletion !== undefined
                ? { xpPerTaskCompletion: payload.xpPerTaskCompletion }
                : {}),
              maintenanceMode: Boolean(payload?.maintenanceMode),
            },
          })
          .catch(() => null);
      }
      return saved && typeof saved === 'object' ? { ...payload, ...saved } : payload;
    } catch (err) {
      return rejectWithValue(normalizeThunkError(err));
    }
  },
);
