import { createSelector } from '@reduxjs/toolkit';
import {
  communicationAdapter,
  createInitialCommunicationWorking,
} from '../slices/communicationSlice';

const EMPTY_IDS = [];
const EMPTY_BY_PROJECT = [];
const EMPTY_MAP = {};
const FALLBACK_WORKING = createInitialCommunicationWorking();

export const selectCommunicationState = (state) => state?.communication;

export const communicationEntitySelectors =
  communicationAdapter.getSelectors(selectCommunicationState);

export const selectCommunicationEntities = (state) =>
  state?.communication?.entities || EMPTY_MAP;

export const selectMessageIdsByProject = (state, projectId) =>
  (projectId && state?.communication?.messageIdsByProject?.[String(projectId)]) ||
  EMPTY_IDS;

export const selectMessagesByProjectId = createSelector(
  [selectCommunicationEntities, selectMessageIdsByProject],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectMessagesStatusForProject = (state, projectId) =>
  (projectId && state?.communication?.byProjectStatus?.[String(projectId)]) ||
  'idle';

export const selectMessagesErrorForProject = (state, projectId) =>
  (projectId && state?.communication?.byProjectError?.[String(projectId)]) ||
  null;

export const selectIsChatForbidden = (state, projectId) =>
  Boolean(
    projectId && state?.communication?.forbiddenByProject?.[String(projectId)],
  );

export const selectChatForbiddenMessage = (state, projectId) =>
  (projectId &&
    state?.communication?.forbiddenByProject?.[String(projectId)] &&
    state?.communication?.byProjectError?.[String(projectId)]) ||
  'You are not a member of this project.';

export const selectIsSendingMessage = (state, projectId) =>
  Boolean(
    projectId && state?.communication?.sendingByProject?.[String(projectId)],
  );

export const selectChatUnreadTotal = (state) =>
  Number(state?.communication?.unreadTotal ?? 0);

export const selectChatUnreadByProject = (state) =>
  state?.communication?.unreadByProject || EMPTY_BY_PROJECT;

export const selectChatUnreadSummary = createSelector(
  [selectChatUnreadTotal, selectChatUnreadByProject],
  (total, byProject) => ({
    total,
    byProject,
  }),
);

export const selectReportedIdsMap = (state) =>
  state?.communication?.reportedIdsById || EMPTY_MAP;

export const selectReportStatus = (state) =>
  state?.communication?.reportStatus || 'idle';

export const selectCommunicationWorking = (state) =>
  state?.communication?.working || FALLBACK_WORKING;

export const selectChatDraftForProject = (state, projectId) =>
  state?.communication?.working?.draftByProject?.[
    String(projectId || '__default__')
  ] || '';

export const selectChatSendErrorForProject = (state, projectId) =>
  (projectId &&
    state?.communication?.working?.sendErrorByProject?.[String(projectId)]) ||
  null;
