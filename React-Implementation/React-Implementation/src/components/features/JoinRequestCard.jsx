import { useState } from 'react';
import { useSelector } from 'react-redux';
import Badge from '../common/Badge';
import FeedbackHistory from './FeedbackHistory';
import UserTrustCard from './UserTrustCard';
import { formatDateTime } from '../../utils/dateFormatter';
import { selectIsJoinRequestResponding } from '../../store/selectors/joinRequestsSelectors';
import { selectIsInviteActing } from '../../store/selectors/invitesSelectors';
import './JoinRequestCard.css';

/**
 * Reusable JoinRequestCard for project owners reviewing collaborator join applications.
 */
const JoinRequestCardContent = ({
  request,
  trustSummary,
  isLocked = false,
  isResponding: externalResponding = false,
  onAccept,
  onReject,
  onViewProfile,
  onCancelInvite,
}) => {
  const [localResponding, setLocalResponding] = useState(false);
  const storeResponding = useSelector((state) =>
    selectIsJoinRequestResponding(state, request?.id),
  );
  const storeInviteActing = useSelector((state) =>
    selectIsInviteActing(state, request?.id),
  );
  const isResponding =
    localResponding || storeResponding || storeInviteActing || Boolean(externalResponding);

  const trustData = trustSummary || request.trustSummary || request.trust;

  const isInvited = request.type === 'Invited';
  const applicantName = request.applicantName || request.userName || request.name || (isInvited ? 'Invited Collaborator' : 'Anonymous Applicant');
  const username = request.username || request.applicantUsername || '';
  const rawRole = (request.role || '').toLowerCase();
  const role = (rawRole === 'owner' || rawRole === 'mentor') ? request.role : 'Collaborator';
  const message = request.message || (isInvited ? 'Direct invitation to join as collaborator.' : 'No introduction provided.');
  const rawStatus = String(request.status || 'pending').toLowerCase();
  const statusDisplayMap = {
    pending: 'Pending',
    approved: 'Approved',
    accepted: 'Accepted',
    rejected: 'Rejected',
    declined: 'Declined',
    withdrawn: 'Withdrawn',
    system_closed: 'System Closed',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };
  const status = statusDisplayMap[rawStatus] || request.status || 'Pending';
  const isPending = rawStatus === 'pending';
  const applicantId = request.userId || request.applicantId || request.id;
  const rawDate = request.date || request.sentAt || request.createdAt;
  const dateFormatted = rawDate ? formatDateTime(rawDate) : '';
  const skillMatchPercent = request.skillMatch?.percent;

  const handleAccept = async () => {
    if (isResponding || !onAccept) return;
    setLocalResponding(true);
    try {
      await onAccept(request.id);
    } finally {
      setLocalResponding(false);
    }
  };

  const handleReject = async () => {
    if (isResponding || !onReject) return;
    setLocalResponding(true);
    try {
      await onReject(request.id, request);
    } finally {
      setLocalResponding(false);
    }
  };

  return (
    <div className="tf-join-req-card" data-testid={isInvited ? `project-invite-row-${request.id}` : `join-request-row-${request.id}`}>
      <div className="tf-join-req-header">
        <div className="tf-join-req-user">
          <div className="tf-join-req-avatar">
            {applicantName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <h5 className="tf-join-req-name">{applicantName}</h5>
              {username && (
                <span className="tf-join-req-username" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  @{username}
                </span>
              )}
              <span
                className="tf-join-req-type-tag"
                data-testid="item-type-tag"
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: isInvited ? '#e0e7ff' : '#f1f5f9',
                  color: isInvited ? '#4338ca' : '#475569',
                }}
              >
                {isInvited ? 'Invited' : 'Applied'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
              <span className="tf-join-req-role">{role}</span>
              {skillMatchPercent !== undefined && skillMatchPercent !== null && (
                <span
                  className="tf-join-req-skill-badge"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: skillMatchPercent >= 70 ? '#047857' : skillMatchPercent >= 40 ? '#b45309' : '#475569',
                    backgroundColor: skillMatchPercent >= 70 ? '#ecfdf5' : skillMatchPercent >= 40 ? '#fffbeb' : '#f1f5f9',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  🎯 {skillMatchPercent}% Skill Match
                </span>
              )}
              {dateFormatted && (
                <span className="tf-join-req-date" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  📅 {dateFormatted}
                </span>
              )}
            </div>
          </div>
        </div>
        <Badge variant={(rawStatus === 'approved' || rawStatus === 'accepted') ? 'success' : rawStatus === 'pending' ? 'warning' : (rawStatus === 'rejected' || rawStatus === 'declined') ? 'danger' : 'neutral'}>
          {status}
        </Badge>
      </div>

      {trustData && (
        <div style={{ margin: '6px 0 10px' }} data-testid={`join-request-trust-${applicantId}`}>
          <UserTrustCard summary={trustData} variant="compact" />
        </div>
      )}

      <p className="tf-join-req-msg">"{message}"</p>

      {request.rejectionReason && (
        <div style={{ margin: '6px 0 10px', fontSize: '0.8rem', color: '#b91c1c', fontStyle: 'italic' }}>
          Reason for rejection: &ldquo;{request.rejectionReason}&rdquo;
        </div>
      )}

      {request.closureReason && (
        <div style={{ margin: '6px 0 10px', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
          Closure Reason: &ldquo;{request.closureReason}&rdquo;
        </div>
      )}

      {(rawStatus === 'rejected' || rawStatus === 'withdrawn' || (request.feedbackHistory && request.feedbackHistory.length > 0)) && (
        <FeedbackHistory
          entityType="APPLICATION"
          entityId={request.id}
          initialFeedback={request.feedbackHistory}
          compact
          title="Application History"
        />
      )}

      <div className="tf-join-req-actions">
        {isInvited ? (
          <>
            {isPending && !isLocked && onCancelInvite && (
              <button
                type="button"
                className="tf-join-req-btn tf-join-req-btn--reject"
                data-testid={`cancel-invite-btn-${request.id}`}
                disabled={isResponding}
                onClick={() => onCancelInvite(request.id)}
              >
                Cancel
              </button>
            )}
          </>
        ) : (
          <>
            {onViewProfile && (
              <button
                type="button"
                className="tf-join-req-btn tf-join-req-btn--view-profile"
                onClick={() => onViewProfile(applicantId, request)}
              >
                View Profile
              </button>
            )}
            {isPending && !isLocked && onAccept && (
              <button
                type="button"
                className="tf-join-req-btn tf-join-req-btn--accept"
                data-testid="accept-join-request-btn"
                disabled={isResponding}
                onClick={handleAccept}
              >
                {isResponding ? 'Accepting...' : 'Approve'}
              </button>
            )}
            {isPending && !isLocked && onReject && (
              <button
                type="button"
                className="tf-join-req-btn tf-join-req-btn--reject"
                data-testid="reject-join-request-btn"
                aria-label="Decline"
                disabled={isResponding}
                onClick={handleReject}
              >
                Reject
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const JoinRequestCard = JoinRequestCardContent;

export default JoinRequestCard;
