import Badge from '../common/Badge';
import './JoinRequestCard.css';

/**
 * Reusable JoinRequestCard for project owners reviewing collaborator join applications.
 * @param {Object} props
 * @param {Object} props.request
 * @param {(requestId: string) => void} [props.onAccept]
 * @param {(requestId: string) => void} [props.onReject]
 */
const JoinRequestCard = ({ request, isLocked = false, onAccept, onReject }) => {
  const applicantName = request.userName || request.name || 'Anonymous Applicant';
  const role = request.role || 'Collaborator';
  const message = request.message || 'No introduction provided.';
  const status = request.status || 'Pending';
  const isPending = status.toLowerCase() === 'pending';

  return (
    <div className="tf-join-req-card">
      <div className="tf-join-req-header">
        <div className="tf-join-req-user">
          <div className="tf-join-req-avatar">
            {applicantName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h5 className="tf-join-req-name">{applicantName}</h5>
            <span className="tf-join-req-role">{role}</span>
          </div>
        </div>
        <Badge variant={status}>{status}</Badge>
      </div>

      <p className="tf-join-req-msg">"{message}"</p>

      {isPending && !isLocked && (onAccept || onReject) && (
        <div className="tf-join-req-actions">
          {onAccept && (
            <button
              type="button"
              className="tf-join-req-btn tf-join-req-btn--accept"
              onClick={() => onAccept(request.id)}
            >
              Accept
            </button>
          )}
          {onReject && (
            <button
              type="button"
              className="tf-join-req-btn tf-join-req-btn--reject"
              onClick={() => onReject(request.id)}
            >
              Decline
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default JoinRequestCard;
