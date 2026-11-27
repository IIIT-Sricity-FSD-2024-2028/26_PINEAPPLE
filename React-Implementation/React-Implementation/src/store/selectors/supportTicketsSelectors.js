import { createSelector } from '@reduxjs/toolkit';
import {
  createInitialSupportWorking,
  supportTicketsAdapter,
} from '../slices/supportTicketsSlice';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const EMPTY_LIST = [];
const FALLBACK_WORKING = createInitialSupportWorking();

export const selectSupportTicketsState = (state) => state?.supportTickets;

export const supportTicketsEntitySelectors =
  supportTicketsAdapter.getSelectors(selectSupportTicketsState);

export const selectTicketEntities = (state) =>
  state?.supportTickets?.entities || EMPTY_MAP;

export const selectMyTicketIds = (state) =>
  state?.supportTickets?.myTicketIds || EMPTY_IDS;

export const selectAdminTicketIds = (state) =>
  state?.supportTickets?.adminTicketIds || EMPTY_IDS;

export const selectMySupportTickets = createSelector(
  [selectTicketEntities, selectMyTicketIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectAdminSupportTickets = createSelector(
  [selectTicketEntities, selectAdminTicketIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectSupportAssignees = (state) =>
  state?.supportTickets?.assignees || EMPTY_LIST;

export const selectSupportTotal = (state) =>
  state?.supportTickets?.total || 0;

export const selectSupportTotalPages = (state) =>
  state?.supportTickets?.totalPages || 1;

export const selectMyTicketsStatus = (state) =>
  state?.supportTickets?.myTicketsStatus || 'idle';

export const selectAdminTicketsStatus = (state) =>
  state?.supportTickets?.adminTicketsStatus || 'idle';

export const selectSupportTicketsWorking = (state) =>
  state?.supportTickets?.working || FALLBACK_WORKING;

export const selectSelectedAdminTicket = createSelector(
  [selectTicketEntities, selectSupportTicketsWorking],
  (entities, working) =>
    working.selectedAdminTicketId
      ? entities[String(working.selectedAdminTicketId)] || null
      : null,
);

export const selectSelectedMyTicket = createSelector(
  [selectTicketEntities, selectSupportTicketsWorking],
  (entities, working) =>
    working.selectedMyTicketId
      ? entities[String(working.selectedMyTicketId)] || null
      : null,
);
