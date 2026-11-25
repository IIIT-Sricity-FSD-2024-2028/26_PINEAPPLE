import { useContext } from 'react';
import Badge from '../common/Badge';
import ProgressBar from '../common/ProgressBar';
import SafeLink from '../common/SafeLink';
import { formatDateTime, formatCountdown, formatProjectDueDate } from '../../utils/dateFormatter';
import { getRequestControlConfig } from '../../utils/requestState';
import { AuthContext } from '../../context/AuthContext';
import storage from '../../utils/storage';
import './ProjectCard.css';

const UsersIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

/**
 * Reusable ProjectCard component for displaying project summaries across multiple pages.
 * @param {Object} props
 * @param {Object} props.project
 * @param {'marketplace'|'owner'|'applied'|'mentored'|'mywork'} [props.variant='marketplace']
 * @param {(project: Object) => void} [props.onSelect]
 * @param {(project: Object) => void} [props.onApply]
 * @param {boolean} [props.hasApplied=false]
 * @param {string} [props.applicationStatus]
 * @param {(projectId: string) => void} [props.onWithdraw]
 * @param {number} [props.progress]
 * @param {number} [props.taskCount]
 * @param {Array} [props.tasks]
 * @param {() => void} [props.onSummary]
 * @param {React.ReactNode} [props.actionSlot]
 */
const ProjectCard = ({
  project,
  variant = 'marketplace',
  onSelect,
  onApply,
  hasApplied = false,
  applicationStatus = '',
  onWithdraw,
  onAcceptInvite,
  onDeclineInvite,
  isOwner: propIsOwner,
  isMember: propIsMember,
  progress,
  taskCount,
  tasks = [],
  onSummary,
  actionSlot,
  ownerResponseTime,
  showDelete = false,
  onDelete,
}) => {
  const auth = useContext(AuthContext);
  const currentUserId = auth?.user?.id || storage?.getBackendUserId?.();
  const currentUserName = auth?.user?.name || auth?.user?.username;

  const title = project.title || project.name || 'Untitled Project';
  const description = project.description || project.desc || 'No description provided.';
  const ownerName = project.owner || 'Project Owner';
  const difficulty = project.difficulty || 'Intermediate';
  const status = project.status || 'Open';
  const isClosed = String(status).toLowerCase() === 'closed';
  const ownerId = String(project.ownerId || (typeof project.owner === 'object' ? project.owner?.id : ''));
  const mentorId = String(project.mentorId || '');
  const effectiveResponseTime = ownerResponseTime || project.ownerResponseTime;

  const isOwner = Boolean(
    propIsOwner !== undefined
      ? propIsOwner
      : project.isOwner ||
        (currentUserId && ownerId && String(ownerId) === String(currentUserId)) ||
        (currentUserName && typeof ownerName === 'string' && ownerName.toLowerCase() === currentUserName.toLowerCase())
  );

  const isCollab = Array.isArray(project.collaborators) && project.collaborators.some((c) => {
    const uid = typeof c === 'object' && c !== null ? String(c.id || c.userId || '') : String(c);
    return uid && currentUserId && uid === String(currentUserId);
  });

  const isMember = Boolean(
    propIsMember !== undefined
      ? propIsMember
      : project.isMember || isCollab || project.myRequestStatus?.state === 'member'
  );

  const approvedCollabs = Array.isArray(project.collaborators)
    ? project.collaborators.filter((c) => {
        const id = typeof c === 'string' ? String(c) : String(c.id || c.userId || '');
        if (!id) return false;
        if (ownerId && id === ownerId) return false;
        if (mentorId && id === mentorId) return false;
        return true;
      }).length
    : (Number(project.approvedCollaboratorCount ?? project.collaboratorCount) || 0);

  const maxCollaborators = Number(project.maxCollaborators) > 0 ? Number(project.maxCollaborators) : 5;
  const isFull = Boolean(project.isFull || approvedCollabs >= maxCollaborators);
  const skills = Array.isArray(project.skills || project.requiredSkills)
    ? project.skills || project.requiredSkills
    : [];

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(project);
    }
  };

  const handleApplyClick = (e) => {
    e.stopPropagation();
    if (onApply) {
      onApply(project);
    }
  };

  const handleWithdrawClick = (e) => {
    e.stopPropagation();
    if (onWithdraw) {
      onWithdraw(project.id);
    }
  };

  return (
    <div className={`tf-project-card tf-project-card--${variant}`} onClick={handleCardClick}>
      <div className="tf-project-card-header">
        <h4 className="tf-project-card-title">{title}</h4>
        <div className="tf-project-card-badges">
          {isFull && <Badge variant="warning">Full</Badge>}
          <Badge variant={difficulty}>{difficulty}</Badge>
          <Badge variant={isClosed ? 'danger' : status}>{isClosed ? 'Closed' : status}</Badge>
        </div>
      </div>

      <p className="tf-project-card-desc">{description}</p>
      {isClosed && (
        <div className="tf-project-card-closure-banner" data-testid="project-card-closure-banner" style={{ fontSize: '0.8rem', color: '#b91c1c', backgroundColor: '#fee2e2', padding: '4px 8px', borderRadius: '4px', marginBottom: '8px', display: 'inline-block' }}>
          <strong>Closed:</strong> {project.closureReason || project.closedReason || 'Project closed'}
        </div>
      )}

      {skills.length > 0 && (
        <div className="tf-project-card-skills">
          {skills.slice(0, 4).map((skill, idx) => (
            <span key={idx} className="tf-project-card-skill-tag">
              {skill}
            </span>
          ))}
          {skills.length > 4 && (
            <span className="tf-project-card-skill-tag tf-project-card-skill-tag--more">
              +{skills.length - 4}
            </span>
          )}
        </div>
      )}

      {(variant === 'mywork' || progress !== undefined) && (
        <div className="tf-project-card-progress-section">
          <ProgressBar value={Number(progress) || 0} size="sm" />
          {(taskCount !== undefined || tasks.length > 0) && (
            <div className="tf-project-card-task-summary">
              <span>Your Tasks: <strong>{taskCount ?? tasks.length}</strong></span>
            </div>
          )}
        </div>
      )}

      <div className="tf-project-card-footer">
        <div className="tf-project-card-meta">
          <span className="tf-project-card-owner">By {ownerName}</span>
          {effectiveResponseTime && (
            <span
              className="tf-project-card-response-time"
              style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              title={effectiveResponseTime}
            >
              ⏱️ {effectiveResponseTime}
            </span>
          )}
          <span className="tf-project-card-members" title={`Collaborator Capacity: ${approvedCollabs}/${maxCollaborators}`}>
            <UsersIcon /> {approvedCollabs}/{maxCollaborators} {isFull ? 'full' : ''}
          </span>
          {(project.dueDate || project.projectDueDate) && (
            <span
              className="tf-project-card-duedate"
              title={formatProjectDueDate(project.dueDate || project.projectDueDate)}
              data-testid={`project-card-due-${project.id}`}
            >
              📅 {variant === 'mentored'
                ? `Project due: ${formatProjectDueDate(project.dueDate || project.projectDueDate).replace(/^Due /, '')}`
                : formatProjectDueDate(project.dueDate || project.projectDueDate)}
            </span>
          )}
        </div>

        <div className="tf-project-card-actions">
          {variant === 'marketplace' && (() => {
            const isCompletedProject = Boolean(
              project.isCompleted || String(project.status || '').toLowerCase() === 'completed'
            );
            const isClosedProject = Boolean(
              isClosed || String(project.status || '').toLowerCase() === 'closed'
            );
            const reqConfig = project.myRequestStatus
              ? getRequestControlConfig(project.myRequestStatus)
              : (isCompletedProject
                  ? getRequestControlConfig({ state: 'completed', lastReason: project.closureReason })
                  : (isClosedProject
                      ? getRequestControlConfig({ state: 'closed' })
                      : (isFull
                          ? getRequestControlConfig({ state: 'full' })
                          : (hasApplied || String(applicationStatus || '').toLowerCase() === 'applied'
                              ? getRequestControlConfig({
                                  state: (!applicationStatus || applicationStatus.toLowerCase() === 'pending' || applicationStatus.toLowerCase() === 'applied')
                                    ? 'pending'
                                    : (applicationStatus.toLowerCase() === 'rejected' ? 'rejected_final' : 'member'),
                                })
                              : getRequestControlConfig({ state: 'none' })))));

            if (isOwner) {
              return (
                <button
                  type="button"
                  className="tf-project-card-btn tf-project-card-btn--secondary tf-project-card-btn--disabled"
                  disabled
                  aria-disabled="true"
                  title="This is your project"
                  style={{ opacity: 0.65, cursor: 'not-allowed' }}
                  data-testid={`owner-btn-${project.id}`}
                >
                  Owner
                </button>
              );
            }

            if (isMember || reqConfig.state === 'member') {
              return (
                <button
                  type="button"
                  className="tf-project-card-btn tf-project-card-btn--secondary tf-project-card-btn--disabled"
                  disabled
                  aria-disabled="true"
                  title="You are already a member of this project"
                  style={{ opacity: 0.65, cursor: 'not-allowed' }}
                  data-testid={`member-btn-${project.id}`}
                >
                  Member
                </button>
              );
            }

            if (reqConfig.state === 'invited') {
              return (
                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#b45309' }}>
                    Invited: respond
                  </span>
                  <div style={{ display: 'inline-flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="tf-project-card-btn tf-project-card-btn--success"
                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      data-testid={`accept-invite-btn-${project.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const inviteId = reqConfig.inviteId || project.id;
                        if (onAcceptInvite) onAcceptInvite(inviteId);
                        else if (project.onAcceptInvite) project.onAcceptInvite(inviteId);
                        else handleCardClick();
                      }}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="tf-project-card-btn tf-project-card-btn--danger"
                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      data-testid={`decline-invite-btn-${project.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const inviteId = reqConfig.inviteId || project.id;
                        if (onDeclineInvite) onDeclineInvite(inviteId);
                        else if (project.onDeclineInvite) project.onDeclineInvite(inviteId);
                        else handleCardClick();
                      }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            }

            if (reqConfig.state === 'pending' || hasApplied || String(applicationStatus || '').toLowerCase() === 'applied') {
              return (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="tf-project-card-btn tf-project-card-btn--secondary tf-project-card-btn--disabled"
                    disabled
                    aria-disabled="true"
                    title="You have already applied to this project"
                    style={{ opacity: 0.75, cursor: 'not-allowed' }}
                    data-testid={`applied-btn-${project.id}`}
                  >
                    Applied
                  </button>
                  {onWithdraw && (
                    <button
                      type="button"
                      className="tf-project-card-btn tf-project-card-btn--danger"
                      onClick={handleWithdrawClick}
                      data-testid={`withdraw-btn-${project.id}`}
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              );
            }

            if (isClosedProject || reqConfig.state === 'closed') {
              return (
                <button
                  type="button"
                  className="tf-project-card-btn tf-project-card-btn--secondary tf-project-card-btn--disabled"
                  disabled
                  aria-disabled="true"
                  title="This project is closed"
                  style={{ opacity: 0.65, cursor: 'not-allowed' }}
                  data-testid={`closed-btn-${project.id}`}
                >
                  Closed
                </button>
              );
            }

            if (isCompletedProject || reqConfig.state === 'completed') {
              return (
                <button
                  type="button"
                  className="tf-project-card-btn tf-project-card-btn--secondary tf-project-card-btn--disabled"
                  disabled
                  aria-disabled="true"
                  title="This project is completed"
                  style={{ opacity: 0.65, cursor: 'not-allowed' }}
                  data-testid={`completed-btn-${project.id}`}
                >
                  Completed
                </button>
              );
            }

            if (isFull || reqConfig.state === 'full') {
              return (
                <button
                  type="button"
                  className="tf-project-card-btn tf-project-card-btn--secondary tf-project-card-btn--disabled"
                  disabled
                  aria-disabled="true"
                  title="This project has reached its maximum team capacity"
                  style={{ opacity: 0.65, cursor: 'not-allowed' }}
                  data-testid={`full-btn-${project.id}`}
                >
                  Full
                </button>
              );
            }

            if (reqConfig.state === 'not_accepting') {
              return (
                <button
                  type="button"
                  className="tf-project-card-btn tf-project-card-btn--secondary tf-project-card-btn--disabled"
                  disabled
                  aria-disabled="true"
                  title="This project is completed"
                  style={{ opacity: 0.65, cursor: 'not-allowed' }}
                  data-testid={`not-accepting-btn-${project.id}`}
                >
                  Not accepting requests
                </button>
              );
            }

            return (
              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <button
                  type="button"
                  className={`tf-project-card-btn tf-project-card-btn--${reqConfig.variant} ${reqConfig.disabled ? 'tf-project-card-btn--disabled' : ''}`}
                  disabled={reqConfig.disabled}
                  aria-disabled={reqConfig.disabled ? 'true' : 'false'}
                  title={reqConfig.reason || reqConfig.hint || ''}
                  onClick={handleApplyClick}
                  style={reqConfig.disabled ? { opacity: 0.65, cursor: 'not-allowed' } : {}}
                  data-testid={`apply-btn-${project.id}`}
                >
                  {reqConfig.label}
                </button>
                {reqConfig.hint && (
                  <span className="tf-project-card-request-hint" style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500 }}>
                    {reqConfig.hint}
                  </span>
                )}
              </div>
            );
          })()}

          {variant === 'applied' && (
            <>
              {applicationStatus?.toLowerCase() === 'accepted' ? (
                <button
                  type="button"
                  className="tf-project-card-btn tf-project-card-btn--success"
                  onClick={handleCardClick}
                >
                  Workspace →
                </button>
              ) : onWithdraw ? (
                <button
                  type="button"
                  className="tf-project-card-btn tf-project-card-btn--danger"
                  onClick={handleWithdrawClick}
                >
                  Withdraw
                </button>
              ) : null}
            </>
          )}

          {variant === 'owner' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {Number(project.pendingRequestsCount) > 0 && (
                <button
                  type="button"
                  className="tf-project-card-btn tf-project-card-btn--warning"
                  data-testid={`pending-requests-link-${project.id}`}
                  style={{
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    borderColor: '#fcd34d',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    padding: '4px 8px',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof onSelect === 'function') {
                      onSelect(project, 'requests');
                    }
                    if (typeof window !== 'undefined') {
                      window.location.href = `/owner/workspace/${project.id}?tab=members&section=requests`;
                    }
                  }}
                >
                  {project.pendingRequestsCount} pending request{project.pendingRequestsCount === 1 ? '' : 's'}
                </button>
              )}
              {showDelete && onDelete && (
                <button
                  type="button"
                  data-testid={`project-card-delete-btn-${project.id}`}
                  className="tf-project-card-btn tf-project-card-btn--outline"
                  style={{ color: '#dc2626', borderColor: '#fecaca' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(project);
                  }}
                >
                  Delete
                </button>
              )}
              {actionSlot}
              <button
                type="button"
                className="tf-project-card-btn tf-project-card-btn--outline"
                onClick={handleCardClick}
              >
                Manage →
              </button>
            </div>
          )}

          {variant === 'mentored' && (
            <button
              type="button"
              className="tf-project-card-btn tf-project-card-btn--primary"
              onClick={handleCardClick}
            >
              Mentor Workspace →
            </button>
          )}

          {variant === 'mywork' && (
            actionSlot || (
              project.isCompleted ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {project.finishedLink && (
                    <SafeLink
                      href={project.finishedLink}
                      className="tf-project-card-btn tf-project-card-btn--outline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Finished Project ↗
                    </SafeLink>
                  )}
                  {onSummary && (
                    <button
                      type="button"
                      className="tf-project-card-btn tf-project-card-btn--outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSummary(project);
                      }}
                    >
                      Contribution Summary
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="tf-project-card-btn tf-project-card-btn--primary"
                  onClick={handleCardClick}
                >
                  Open Workspace
                </button>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
