import { useSelector } from 'react-redux';
import { useState } from 'react';
import Badge from '../common/Badge';
import SafeLink from '../common/SafeLink';
import FeedbackHistory from './FeedbackHistory';
import { selectCurrentUser } from '../../store/selectors/sessionSelectors';
import { getTaskReward } from '../../utils/workflow';
import { formatDateTime, formatCountdown } from '../../utils/dateFormatter';
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
const TaskCardContent = ({
  task,
  userRole = 'Collaborator',
  isLocked = false,
  members = [],
  currentUserId,
  currentUserName,
  onAssign,
  onMoveDueDate,
  onStart,
  onSubmitProof,
  onApprove,
  onReject,
  onUnassign,
  onDelete,
}) => {
  const storeUser = useSelector(selectCurrentUser);
  const [isReassigning, setIsReassigning] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [dueHistoryExpanded, setDueHistoryExpanded] = useState(false);
  const [renderNow] = useState(() => Date.now());
  const effectiveUserId = currentUserId || storeUser?.id || storeUser?.uid;
  const effectiveUserName = currentUserName || storeUser?.name;

  const status = task.status || 'To Do';
  const priority = task.priority || task.difficulty || 'Medium';
  const xpReward = getTaskReward(priority).xp;
  const isOwner = userRole === 'Project Owner';
  const sNorm = status.toLowerCase();
  const sClean = sNorm.replace(/[\s-_]/g, '');
  const isReviewStatus = sClean === 'inreview' || sClean === 'underreview' || sClean === 'submitted';
  const isToDoStatus = sClean === 'todo' || sClean === 'open';
  const isInProgressStatus = sClean === 'inprogress';
  const isCompleted = sClean === 'completed' || sClean === 'approved' || sClean === 'done';
  const isStartedOrBeyond =
    isInProgressStatus ||
    isReviewStatus ||
    isCompleted;

  const isDueDatePast = Boolean(task.dueDate && new Date(task.dueDate).getTime() < new Date().setHours(0, 0, 0, 0));
  const isDueDateLocked = isCompleted || isDueDatePast;
  const isOverdue = !isCompleted && (Boolean(task.isOverdue) || isDueDatePast);

  const inReviewWaitDays =
    isOwner && isReviewStatus && task.inReviewSince && !Number.isNaN(new Date(task.inReviewSince).getTime())
      ? Math.max(0, Math.floor((renderNow - new Date(task.inReviewSince).getTime()) / (24 * 60 * 60 * 1000)))
      : null;
  const waitingLevel =
    inReviewWaitDays === null
      ? null
      : inReviewWaitDays >= 7
        ? 'critical'
        : inReviewWaitDays >= 3
          ? 'warning'
          : 'normal';
  const waitingVariant =
    waitingLevel === 'critical' ? 'danger' : waitingLevel === 'warning' ? 'warning' : 'info';

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

  const isAssigneeDeleted = Boolean(
    task.assigneeIsDeleted ||
      String(task.assigneeName || task.assignee || '').trim().toLowerCase() === 'deleted user',
  );
  const assigneeDisplayName = isAssigneeDeleted
    ? 'Deleted user'
    : (task.assigneeName || task.assignee || 'Unassigned');

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

  const reviewCreditEntries = Array.isArray(task.dueDateHistory)
    ? task.dueDateHistory.filter((h) => h.reason === 'REVIEW_CREDIT')
    : [];
  const latestReviewCredit = reviewCreditEntries.length > 0 ? reviewCreditEntries[reviewCreditEntries.length - 1] : null;
  const reviewCreditBadgeText = (() => {
    if (!latestReviewCredit?.creditMs) return null;
    const totalMinutes = Math.floor(latestReviewCredit.creditMs / (60 * 1000));
    const d = Math.floor(totalMinutes / (24 * 60));
    const h = Math.floor((totalMinutes % (24 * 60)) / 60);
    const timeStr = d > 0 && h > 0 ? `+${d}d ${h}h` : d > 0 ? `+${d}d` : `+${h}h`;
    return `Deadline extended ${timeStr} (Review credit)`;
  })();

  return (
    <div className={`tf-task-card tf-task-card--status-${status.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="tf-task-card-header">
        <h5 className="tf-task-card-title">{task.title}</h5>
        <div className="tf-task-card-badges">
          {isOverdue && (
            <Badge variant="danger" className="tf-task-badge-overdue">
              ⚠️ Overdue
            </Badge>
          )}
          {waitingLevel && (
            <span data-testid={`task-waiting-badge-${task.id}`} data-waiting-level={waitingLevel}>
              <Badge variant={waitingVariant}>
                Waiting {inReviewWaitDays} {inReviewWaitDays === 1 ? 'day' : 'days'}
              </Badge>
            </span>
          )}
          {task.autoApproved && (
            <span data-testid={`task-auto-approved-badge-${task.id}`}>
              <Badge variant="info">Auto-approved after 7 days</Badge>
            </span>
          )}
          {reviewCreditBadgeText && (
            <span
              data-testid={`task-review-credit-badge-${task.id}`}
              title={`Previous: ${formatDateTime(latestReviewCredit.previousDueDate)} → New: ${formatDateTime(latestReviewCredit.newDueDate)}`}
            >
              <Badge variant="purple" style={{ fontSize: '0.72rem' }}>
                ⏱️ {reviewCreditBadgeText}
              </Badge>
            </span>
          )}
          <Badge variant={priority}>{priority}</Badge>
          <Badge variant={status}>{status}</Badge>
        </div>
      </div>

      {task.description && (
        <p className="tf-task-card-desc">{task.description}</p>
      )}

      {task.rejectionReason && (
        <div
          data-testid={`task-changes-requested-${task.id}`}
          style={{
            marginTop: '8px',
            marginBottom: '8px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: '#fff7ed',
            border: '1px solid #fdba74',
            color: '#9a3412',
            fontSize: '0.84rem',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '2px' }}>Changes requested</div>
          <div>{task.rejectionReason}</div>
        </div>
      )}

      {(task.feedbackHistory?.length > 0 || task.status === 'Revision' || task.status === 'Changes Requested') && (
        <FeedbackHistory
          entityType="TASK"
          entityId={task.id}
          initialFeedback={task.feedbackHistory}
          compact
          title="Reviewer Feedback"
        />
      )}

      {Array.isArray(task.rejectionHistory) && task.rejectionHistory.length > 0 && (
        <div style={{ marginBottom: '8px', fontSize: '0.8rem' }}>
          <button
            type="button"
            data-testid={`task-rejection-history-toggle-${task.id}`}
            onClick={() => setHistoryExpanded((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {historyExpanded
              ? `Hide revision history (${task.rejectionHistory.length})`
              : `Revision history (${task.rejectionHistory.length})`}
          </button>
          {historyExpanded && (
            <ul
              data-testid={`task-rejection-history-${task.id}`}
              style={{ margin: '6px 0 0', paddingLeft: '18px', color: '#475569' }}
            >
              {task.rejectionHistory.map((item, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>
                  <strong>{formatDateTime(item.at)}:</strong> {item.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {Array.isArray(task.dueDateHistory) && task.dueDateHistory.length > 0 && (
        <div style={{ marginBottom: '8px', fontSize: '0.8rem' }}>
          <button
            type="button"
            data-testid={`task-due-history-toggle-${task.id}`}
            onClick={() => setDueHistoryExpanded((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {dueHistoryExpanded
              ? `Hide deadline history (${task.dueDateHistory.length})`
              : `Deadline history (${task.dueDateHistory.length})`}
          </button>
          {dueHistoryExpanded && (
            <ul
              data-testid={`task-due-history-${task.id}`}
              style={{ margin: '6px 0 0', paddingLeft: '18px', color: '#475569' }}
            >
              {task.dueDateHistory.map((item, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>
                  <strong>{formatDateTime(item.at)}:</strong>{' '}
                  {item.reason === 'REVIEW_CREDIT' ? 'Review time credit' : 'Owner update'} —{' '}
                  {formatDateTime(item.previousDueDate)} → {formatDateTime(item.newDueDate)}
                  {item.extendedProject && ' (Project deadline extended)'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(task.proofLink || task.proofUrl) && (
        <div style={{ marginTop: '6px', marginBottom: '8px', fontSize: '0.8rem' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Proof: </span>
          <SafeLink
            href={task.proofLink || task.proofUrl}
            style={{ color: '#2563eb', textDecoration: 'underline', wordBreak: 'break-all' }}
          >
            {task.proofLink || task.proofUrl}
          </SafeLink>
        </div>
      )}

      <div className="tf-task-card-footer">
        <div className="tf-task-card-meta">
          <span className="tf-task-card-xp">⚡ {xpReward} XP</span>
          {task.dueDate && (
            <span
              className={`tf-task-card-duedate ${isOverdue ? 'tf-task-card-duedate--overdue' : ''}`}
              data-testid={`task-due-date-${task.id}`}
              data-readonly-due={!isOwner ? 'true' : 'false'}
              style={isOverdue ? { color: '#dc2626', fontWeight: 600 } : { color: '#64748b' }}
              title={!isOwner ? 'Due date (read-only for collaborators)' : isDueDateLocked ? (isCompleted ? 'Due date locked: task approved' : 'Due date locked: deadline has passed') : `Task due date: ${formatDateTime(task.dueDate)}`}
            >
              📅 {formatDateTime(task.dueDate)} ({formatCountdown(task.dueDate)})
              {isDueDateLocked && (
                <span style={{ marginLeft: '4px', fontSize: '0.72rem', color: '#94a3b8' }} title="Due date locked">🔒</span>
              )}
            </span>
          )}
          {isOwner && !isLocked && !isDueDateLocked && onMoveDueDate && (
            <button
              type="button"
              className="tf-task-card-edit-due-btn"
              onClick={() => onMoveDueDate(task)}
              title="Move task due date"
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: '1px 4px',
                textDecoration: 'underline',
              }}
            >
              Move
            </button>
          )}
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
                {task.assigneeRole && task.assigneeRole !== 'Former member' && (
                  <Badge variant={task.assigneeRole === 'Owner' ? 'warning' : task.assigneeRole === 'Mentor' ? 'purple' : 'info'} style={{ fontSize: '0.7rem' }}>
                    {task.assigneeRole}
                  </Badge>
                )}
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span className="tf-task-card-assignee">👤 {assigneeDisplayName}</span>
              {task.assigneeRole && task.assigneeRole !== 'Former member' && (
                <Badge variant={task.assigneeRole === 'Owner' ? 'warning' : task.assigneeRole === 'Mentor' ? 'purple' : 'info'} style={{ fontSize: '0.7rem' }}>
                  {task.assigneeRole}
                </Badge>
              )}
            </div>
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
                  {(isToDoStatus || isInProgressStatus) && onUnassign && (
                    <button
                      type="button"
                      className="tf-task-btn"
                      data-testid={`task-unassign-btn-${task.id}`}
                      onClick={() => onUnassign(task)}
                      style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569' }}
                    >
                      Drop Task
                    </button>
                  )}
                </>
              )}

              {/* Project Owner Actions */}
              {isOwner && (
                <>
                  {isUnassigned && !isCompleted && onDelete && (
                    <button
                      type="button"
                      className="tf-task-btn tf-task-btn--delete"
                      data-testid={`delete-task-btn-${task.id}`}
                      onClick={() => onDelete(task.id)}
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#b91c1c',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  )}
                  {isReviewStatus && (
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const TaskCard = TaskCardContent;

export default TaskCard;
