import { createSelector } from '@reduxjs/toolkit';
import {
  createInitialWarningsWorking,
  warningsAdapter,
} from '../slices/warningsSlice';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const FALLBACK_WORKING = createInitialWarningsWorking();

export const selectWarningsState = (state) => state?.warnings;

export const warningsEntitySelectors =
  warningsAdapter.getSelectors(selectWarningsState);

export const selectWarningEntities = (state) =>
  state?.warnings?.entities || EMPTY_MAP;

export const selectMyWarningIds = (state) =>
  state?.warnings?.myWarningIds || EMPTY_IDS;

export const selectMyWarnings = createSelector(
  [selectWarningEntities, selectMyWarningIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectUserActiveWarningsCount = (userId) => (state) =>
  state?.warnings?.activeWarningsCountByUserId?.[String(userId)] ?? null;

export const selectWarningsWorking = (state) =>
  state?.warnings?.working || FALLBACK_WORKING;
