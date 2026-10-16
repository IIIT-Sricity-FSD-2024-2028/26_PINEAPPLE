import { useContext, useState } from 'react';
import Badge from '../common/Badge';
import { AuthContext } from '../../context/AuthContext';
import './TaskCard.css';

/**
 * Reusable TaskCard component for workspace task boards.
 * @param {Object} props
 * @param {Object} props.task
 * @param {'Collaborator'|'Project Owner'|'Mentor'} [props.userRole='Collaborator']
 * @param {(taskId: string) => void} [props.onStart]
 * @param {(task: Object) => void} [props.onSubmitProof]
 * @param {(taskId: string) => void} [props.onApprove]
 * @param {(taskId: string) => void} [props.onReject]
 */
const TaskCard = ({
  task,
  userRole = 'Collaborator',
  isLocked = false,
  members = [],
  currentUserId,
  currentUserName,
  onAssign,
  onStart,
  onSubmitProof,
  onApprove,
  onReject,
}) => {
  const auth = useContext(AuthContext);
  const [isReassigning, setIsReassigning] = useState(false);
  const effectiveUserId = currentUserId || auth?.user?.id;
  const effectiveUserName = currentUserName || auth?.user?.name;

  const status = task.status || 'To Do';
  const priority = task.priority || task.difficulty || 'Medium';
  const pNorm = priority.trim().toLowerCase();
  const xpReward = pNorm === 'high' || pNorm === 'advanced' ? 40 : pNorm === 'medium' || pNorm === 'intermediate' ? 20 : 10;
  const isOwner = userRole === 'Project Owner';
  const sNorm = status.toLowerCase();
  const sClean = sNorm.replace(/[\s-_]/g, '');
  const isReviewStatus = sClean === 'inreview' || sClean === 'underreview' || sClean === 'submitted';
  const isToDoStatus = sClean === 'todo' || sClean === 'open';
  const isInProgressStatus = sClean === 'inprogress';
  const isStartedOrBeyond =
    isInProgressStatus ||
    isReviewStatus ||
    sClean === 'completed' ||
    sClean === 'approved' ||
    sClean === 'done';

  const selectedAssigneeId = (() => {
    if (task.assigneeId && String(task.assigneeId).toLowerCase() !== 'unassigned') {
      return String(task.assigneeId);
    }
    const currentName = task.assigneeName || task.assignee;
    if (currentName && currentName.toLowerCase() !== 'unassigned') {
      const match = members.find(
        (m) =>
          (m.name && m.name.toLowerCase() === currentName.toLowerCase()) ||
          String(m.id || m.userId) === String(currentName)
      );
      if (match) {
        return String(match.id || match.userId);
      }
    }
    return '';
  })();

  const assigneeDisplayName = task.assigneeName || task.assignee || 'Unassigned';

  const isAssignedToMe = Boolean(
    (effectiveUserId && task.assigneeId && String(task.assigneeId) === String(effectiveUserId)) ||
    (effectiveUserName && (
      (task.assigneeName && task.assigneeName.toLowerCase() === effectiveUserName.toLowerCase()) ||
      (task.assignee && task.assignee.toLowerCase() === effectiveUserName.toLowerCase())
    ))
  );

  const isUnassigned =
    !selectedAssigneeId ||
    selectedAssigneeId.toLowerCase() === 'unassigned' ||
    assigneeDisplayName.toLowerCase() === 'unassigned';

  return (
    <div className={`tf-task-card tf-task-card--status-${status.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="tf-task-card-header">
        <h5 className="tf-task-card-title">{task.title}</h5>
        <div className="tf-task-card-badges">
          <Badge variant={priority}>{priority}</Badge>
          <Badge variant={status}>{status}</Badge>
        </div>
      </div>

      {task.description && (
        <p className="tf-task-card-desc">{task.description}</p>
      )}

      {(task.proofLink || task.proofUrl) && (
        <div style={{ marginTop: '6px', marginBottom: '8px', fontSize: '0.8rem' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Proof: </span>
          <a
            href={task.proofLink || task.proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#2563eb', textDecoration: 'underline', wordBreak: 'break-all' }}
          >
            {task.proofLink || task.proofUrl}
          </a>
        </div>
      )}

      <div className="tf-task-card-footer">
        <div className="tf-task-card-meta">
          <span className="tf-task-card-xp">⚡ {xpReward} XP</span>
          {isOwner && !isLocked && onAssign && !isStartedOrBeyond ? (
            isUnassigned || isReassigning ? (
              <div className="tf-task-card-assign-wrap" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.85rem' }}>👤</span>
                <select
                  className="tf-task-assign-select"
                  value={selectedAssigneeId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val || val === 'Unassigned') {
                      onAssign(task.id, '', 'Unassigned');
                      setIsReassigning(false);
                      return;
                    }
                    const member = members.find(
                      (m) => String(m.id || m.userId) === String(val) || String(m.name) === String(val)
                    );
                    const mId = member?.id || member?.userId || val;
                    const mName = member?.name || (typeof member === 'string' ? member : val);
                    onAssign(task.id, String(mId), mName);
                    setIsReassigning(false);
                  }}
                  style={{
                    padding: '3px 6px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    background: '#ffffff',
                    color: '#1e293b',
                    cursor: 'pointer',
                    maxWidth: '150px',
                  }}
                >
                  <option value="">Unassigned</option>
                  {members.map((m, idx) => {
                    const mId = m.id || m.userId || (typeof m === 'string' ? m : `mem-${idx}`);
                    const mName = m.name || (typeof m === 'string' ? m : 'Collaborator');
                    return (
                      <option key={String(mId) || idx} value={String(mId)}>
                        {mName}
                      </option>
                    );
                  })}
                </select>
                {isReassigning && (
                  <button
                    type="button"
                    onClick={() => setIsReassigning(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      padding: '2px 4px',
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className="tf-task-card-assignee">👤 {assigneeDisplayName}</span>
                <button
                  type="button"
                  onClick={() => setIsReassigning(true)}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    borderRadius: '4px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Reassign
                </button>
              </div>
            )
          ) : (
            <span className="tf-task-card-assignee">👤 {assigneeDisplayName}</span>
          )}
        </div>

        <div className="tf-task-card-actions">
          {!isLocked && (
            <>
              {/* Collaborator Actions */}
              {!isOwner && isAssignedToMe && (
                <>
                  {isToDoStatus && onStart && (
                    <button
                      type="button"
                      className="tf-task-btn tf-task-btn--start"
                      onClick={() => onStart(task.id)}
                    >
                      Start Task
                    </button>
                  )}
                  {isInProgressStatus && onSubmitProof && (
                    <button
                      type="button"
                      className="tf-task-btn tf-task-btn--submit"
                      onClick={() => onSubmitProof(task)}
                    >
                      Submit Proof
                    </button>
                  )}
                </>
              )}

              {/* Project Owner Actions */}
              {isOwner && isReviewStatus && (
                <div className="tf-task-card-review-actions">
                  {onApprove && (
                    <button
                      type="button"
                      className="tf-task-btn tf-task-btn--approve"
                      onClick={() => onApprove(task.id)}
                    >
                      Approve
                    </button>
                  )}
                  {onReject && (
                    <button
                      type="button"
                      className="tf-task-btn tf-task-btn--reject"
                      onClick={() => onReject(task.id)}
                    >
                      Reject
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
