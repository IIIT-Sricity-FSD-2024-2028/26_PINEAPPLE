import {
  createInitialDisputesWorking,
  sessionDisputesAdapter,
} from '../slices/sessionDisputesSlice';

const FALLBACK_WORKING = createInitialDisputesWorking();

export const selectSessionDisputesState = (state) => state?.sessionDisputes;

export const sessionDisputesEntitySelectors =
  sessionDisputesAdapter.getSelectors(selectSessionDisputesState);

export const selectAllSessionDisputes = sessionDisputesEntitySelectors.selectAll;

export const selectSessionDisputesStatus = (state) =>
  state?.sessionDisputes?.status || 'idle';

export const selectSessionDisputesWorking = (state) =>
  state?.sessionDisputes?.working || FALLBACK_WORKING;
