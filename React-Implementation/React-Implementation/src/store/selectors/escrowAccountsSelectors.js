import {
  createInitialEscrowWorking,
  escrowAccountsAdapter,
} from '../slices/escrowAccountsSlice';

const FALLBACK_WORKING = createInitialEscrowWorking();

export const selectEscrowAccountsState = (state) => state?.escrowAccounts;

export const escrowAccountsEntitySelectors = escrowAccountsAdapter.getSelectors(
  selectEscrowAccountsState,
);

export const selectAllEscrowAccounts = escrowAccountsEntitySelectors.selectAll;

export const selectProjectEscrowSummary = (projectId) => (state) =>
  state?.escrowAccounts?.byProjectId?.[String(projectId)] || null;

export const selectEscrowReconciliation = (state) =>
  state?.escrowAccounts?.reconciliation || null;

export const selectEscrowReconcileStatus = (state) =>
  state?.escrowAccounts?.reconcileStatus || 'idle';

export const selectEscrowWorking = (state) =>
  state?.escrowAccounts?.working || FALLBACK_WORKING;
