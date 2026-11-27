import {
  sessionFeedbackAdapter,
  createInitialSessionFeedbackWorking,
} from '../slices/sessionFeedbackSlice';

const FALLBACK_WORKING = createInitialSessionFeedbackWorking();

export const selectSessionFeedbackState = (state) => state?.sessionFeedback;

export const sessionFeedbackEntitySelectors =
  sessionFeedbackAdapter.getSelectors(selectSessionFeedbackState);

export const selectAdminMentorFeedbackById = (state, mentorId) =>
  (mentorId && state?.sessionFeedback?.adminSummaryByMentorId?.[String(mentorId)]) ||
  null;

export const selectSessionFeedbackSubmitting = (state) =>
  state?.sessionFeedback?.submitStatus === 'loading';

export const selectSessionFeedbackWorking = (state) =>
  state?.sessionFeedback?.working || FALLBACK_WORKING;
