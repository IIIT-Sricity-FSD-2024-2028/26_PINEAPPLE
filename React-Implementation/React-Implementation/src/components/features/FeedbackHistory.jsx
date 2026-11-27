import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEntityFeedback } from '../../store/thunks/feedbackThunks';
import {
  selectFeedbackByEntity,
  selectFeedbackEntityError,
  selectFeedbackEntityStatus,
} from '../../store/selectors/feedbackSelectors';
import './FeedbackHistory.css';

/**
 * Maps raw actionType strings to user-friendly titles and badge variants.
 */
function getActionBadgeInfo(actionType) {
  switch (actionType) {
    case 'REJECT_WORK':
      return { label: 'Work Rejected', variant: 'danger' };
    case 'REQUEST_CHANGES':
      return { label: 'Changes Requested', variant: 'warning' };
    case 'DROP_TASK':
    case 'UNASSIGN_FROM_TASK':
      return { label: 'Task Dropped', variant: 'warning' };
    case 'REJECT_APPLICATION':
      return { label: 'Application Rejected', variant: 'danger' };
    case 'WITHDRAW_APPLICATION':
      return { label: 'Application Withdrawn', variant: 'info' };
    case 'DECLINE_INVITATION':
      return { label: 'Invitation Declined', variant: 'warning' };
    case 'CANCEL_INVITATION':
      return { label: 'Invitation Cancelled', variant: 'info' };
    case 'REMOVE_COLLABORATOR':
      return { label: 'Member Removed', variant: 'danger' };
    case 'LEAVE_PROJECT':
      return { label: 'Left Project', variant: 'warning' };
    case 'CANCEL_PROJECT':
      return { label: 'Project Closed / Cancelled', variant: 'danger' };
    case 'MENTOR_DECLINE_ASSIGNMENT':
    case 'MENTOR_REJECT_REQUEST':
      return { label: 'Mentorship Declined', variant: 'warning' };
    case 'STUDENT_CANCEL_MENTORSHIP':
      return { label: 'Mentorship Cancelled', variant: 'info' };
    case 'ADMIN_REJECT_MENTOR_APP':
      return { label: 'Mentor Application Rejected', variant: 'danger' };
    default:
      return { label: actionType || 'Feedback', variant: 'info' };
  }
}

/**
 * Reusable Feedback History component (Fix 4).
 * Reads audit history from `actionFeedbackSlice` when `initialFeedback` is not passed inline.
 */
const FeedbackHistoryContent = ({
  entityType,
  entityId,
  initialFeedback = null,
  title = 'Reason & Feedback History',
  compact = false,
}) => {
  const dispatch = useDispatch();
  const hasInitial =
    Array.isArray(initialFeedback) && initialFeedback.length > 0;

  const storeHistory = useSelector((state) =>
    selectFeedbackByEntity(state, entityType, entityId),
  );
  const entityStatus = useSelector((state) =>
    selectFeedbackEntityStatus(state, entityType, entityId),
  );
  const entityError = useSelector((state) =>
    selectFeedbackEntityError(state, entityType, entityId),
  );

  useEffect(() => {
    if (hasInitial || !entityType || !entityId) return;
    dispatch(fetchEntityFeedback({ entityType, entityId }));
  }, [dispatch, entityType, entityId, hasInitial]);

  const history = hasInitial ? initialFeedback : storeHistory;
  const loading = !hasInitial && Boolean(entityType && entityId) && entityStatus === 'loading';

  if (loading && (!history || history.length === 0)) {
    return (
      <div className="tf-feedback-history">
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted, #6b7280)',
          }}
        >
          Loading feedback history...
        </span>
      </div>
    );
  }

  if (entityError && !hasInitial && (!history || history.length === 0)) {
    return null;
  }

  if (!history || history.length === 0) {
    return null;
  }

  return (
    <div
      className="tf-feedback-history"
      data-testid="feedback-history-section"
      style={compact ? { marginTop: '8px', padding: '10px 12px' } : undefined}
    >
      <div className="tf-feedback-history-header">
        <span>📝</span>
        <span>{title}</span>
      </div>

      <div className="tf-feedback-list">
        {history.map((entry, idx) => {
          const badge = getActionBadgeInfo(entry.actionType);
          const dateStr = entry.createdAt
            ? new Date(entry.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '';

          return (
            <div
              key={entry.id || idx}
              className="tf-feedback-entry"
              data-testid={`feedback-entry-${idx}`}
            >
              <div className="tf-feedback-entry-top">
                <span
                  className={`tf-feedback-action-badge ${badge.variant}`}
                >
                  {badge.label}
                </span>
                <div className="tf-feedback-meta">
                  {entry.actorName && (
                    <span className="tf-feedback-actor">{entry.actorName}</span>
                  )}
                  {dateStr && <span>• {dateStr}</span>}
                </div>
              </div>

              {entry.reasonLabels && entry.reasonLabels.length > 0 && (
                <div className="tf-feedback-tags">
                  {entry.reasonLabels.map((lbl, rIdx) => (
                    <span key={rIdx} className="tf-feedback-tag">
                      {lbl}
                    </span>
                  ))}
                </div>
              )}

              {entry.explanation && (
                <div className="tf-feedback-explanation">
                  &ldquo;{entry.explanation}&rdquo;
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FeedbackHistory = FeedbackHistoryContent;

export default FeedbackHistory;
