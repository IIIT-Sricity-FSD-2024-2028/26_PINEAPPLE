import { useState, useEffect } from 'react';
import feedbackApi from '../../services/feedbackApi';
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
 * Displays historical reasons and explanations for an entity.
 */
const FeedbackHistory = ({
  entityType,
  entityId,
  initialFeedback = null,
  title = 'Reason & Feedback History',
  compact = false,
}) => {
  const [history, setHistory] = useState(initialFeedback || []);
  const [loading, setLoading] = useState(!initialFeedback && Boolean(entityType && entityId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialFeedback && initialFeedback.length > 0) {
      setHistory(initialFeedback);
      setLoading(false);
      return;
    }

    if (!entityType || !entityId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    feedbackApi
      .getEntityFeedback(entityType, entityId)
      .then((data) => {
        if (!isMounted) return;
        setHistory(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err?.message || 'Failed to load feedback history.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [entityType, entityId, initialFeedback]);

  if (loading) {
    return (
      <div className="tf-feedback-history">
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)' }}>
          Loading feedback history...
        </span>
      </div>
    );
  }

  if (error || !history || history.length === 0) {
    return null; // Don't display empty section
  }

  return (
    <div className={`tf-feedback-history ${compact ? 'compact' : ''}`} data-testid="feedback-history-section">
      {title && <div className="tf-feedback-history-title">{title}</div>}
      <div className="tf-feedback-list">
        {history.map((entry) => {
          const badge = getActionBadgeInfo(entry.actionType);
          const reasons = Array.isArray(entry.reasons) ? entry.reasons : [];
          const labels = Array.isArray(entry.reasonLabels) && entry.reasonLabels.length === reasons.length
            ? entry.reasonLabels
            : reasons;
          const formattedDate = entry.createdAt
            ? new Date(entry.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '';

          return (
            <div key={entry.id || `${entry.actionType}-${entry.createdAt}`} className="tf-feedback-item">
              <div className="tf-feedback-header">
                <span className={`tf-feedback-action-badge ${badge.variant}`}>{badge.label}</span>
                {formattedDate && <span className="tf-feedback-date">{formattedDate}</span>}
              </div>

              {labels.length > 0 && (
                <div className="tf-feedback-reasons">
                  {labels.map((lbl, idx) => (
                    <span key={idx} className="tf-feedback-tag">
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

export default FeedbackHistory;
