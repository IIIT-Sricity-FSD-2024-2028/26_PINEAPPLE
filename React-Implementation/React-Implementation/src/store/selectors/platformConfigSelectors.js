import { createSelector } from '@reduxjs/toolkit';
import {
  createInitialPlatformConfigWorking,
  DEFAULT_PLATFORM_CONFIG,
} from '../slices/platformConfigSlice';

const FALLBACK_WORKING = createInitialPlatformConfigWorking();

export const selectPlatformConfigState = (state) => state?.platformConfig;

export const selectPlatformConfig = (state) =>
  state?.platformConfig?.entities?.singleton || DEFAULT_PLATFORM_CONFIG;

export const selectPublicConfig = (state) =>
  state?.platformConfig?.publicConfig || null;

export const selectMinMentorYears = createSelector(
  [selectPublicConfig, selectPlatformConfig],
  (pub, cfg) => {
    const raw =
      pub?.mentorMinYearsExperience ??
      cfg?.mentorMinYearsExperience ??
      cfg?.minimumTenure;
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : 4;
  },
);

export const selectInitialTenure = (state) =>
  state?.platformConfig?.initialTenure ?? 5;

export const selectPlatformConfigWorking = (state) =>
  state?.platformConfig?.working || FALLBACK_WORKING;
