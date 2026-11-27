import { useState } from 'react';
import Badge from '../../components/common/Badge';
import { formatMemberSince, formatProjectDueDate } from '../../utils/dateFormatter';
import { isProjectLocked } from '../../utils/projectStatus';

const ProjectDetailsCard = ({
  project,
  isClosed,
  isCompleted,
  restoringProject,
  restoreError,
  handleRestoreProject,
  cancellingDeletion,
  cancelDeletionError,
  handleCancelDeletion,
  closingProject,
  closeError,
  handleAdminCloseProject,
}) => {
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  const statusLower = String(project.status || '').toLowerCase();
  const badgeVariant = project.deletedAt
    ? 'danger'
    : isCompleted
    ? 'completed'
    : isClosed
    ? 'danger'
    : statusLower === 'in progress'
    ? 'in-progress'
    : 'open';

  const badgeLabel = project.deletedAt
    ? 'Deleted'
    : isCompleted
    ? 'Completed'
    : isClosed
    ? 'Closed'
    : project.status || 'Open';

  // Format skills
  const skillsList = Array.isArray(project.requiredSkills)
    ? project.requiredSkills
    : typeof project.requiredSkills === 'string' && project.requiredSkills.trim() && project.requiredSkills.toLowerCase() !== 'none'
    ? project.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const descriptionText = project.description || 'No description provided.';
  const isLongDescription = descriptionText.length > 180 || (descriptionText.match(/\n/g) || []).length > 3;

  return (
    <div className="card admin-details-card">
      <h2 className="admin-card-title">Project details</h2>

      <div className="admin-details-fields-grid">
        <div className="admin-detail-item">
          <span className="admin-detail-label">Owner:</span>
          <span className="admin-detail-value">
            {project.owner?.name || project.owner || project.ownerId || 'Unassigned'}
          </span>
        </div>

        <div className="admin-detail-item">
          <span className="admin-detail-label">Status:</span>
          <span className="admin-detail-value">
            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          </span>
        </div>

        <div className="admin-detail-item">
          <span className="admin-detail-label">Difficulty:</span>
          <span className="admin-detail-value">{project.difficulty || '—'}</span>
        </div>

        <div className="admin-detail-item">
          <span className="admin-detail-label">Due Date:</span>
          <span className="admin-detail-value">
            {project.dueDate ? formatProjectDueDate(project.dueDate) : '—'}
          </span>
        </div>

        <div className="admin-detail-item admin-detail-item--full">
          <span className="admin-detail-label">Required Skills:</span>
          <div className="admin-detail-value admin-skills-list">
            {skillsList.length > 0 ? (
              skillsList.map((skill, idx) => (
                <span key={idx} className="admin-skill-chip">
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-muted">None</span>
            )}
          </div>
        </div>
      </div>

      <div className="admin-project-description-section">
        <span className="admin-detail-label">Description:</span>
        <div
          className={`admin-project-description ${
            isLongDescription && !isDescExpanded ? 'is-clamped' : 'is-expanded'
          }`}
        >
          {descriptionText}
        </div>
        {isLongDescription && (
          <button
            type="button"
            className="admin-desc-toggle-btn"
            onClick={() => setIsDescExpanded(!isDescExpanded)}
          >
            {isDescExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Closed Project Notice */}
      {(isClosed || project.closureReason) && (
        <div
          data-testid="admin-closure-notice"
          className="admin-notice-box admin-notice-box--closed"
        >
          <div className="admin-notice-header">
            <Badge variant="danger">Closed</Badge>
            {project.closedAt && (
              <span className="admin-notice-date">
                Closed on {formatMemberSince(project.closedAt)}
              </span>
            )}
          </div>
          <div data-testid="admin-closure-reason" className="admin-notice-body">
            <strong>Closure Reason:</strong> {project.closureReason || 'Owner suspended'}
          </div>
        </div>
      )}

      {/* Soft-deleted Project Banner */}
      {project.deletedAt && (
        <div
          data-testid="admin-deleted-project-banner"
          className="admin-notice-box admin-notice-box--deleted"
        >
          <div className="admin-notice-header">
            <span className="admin-notice-text">
              <strong>Soft-deleted</strong> on {formatMemberSince(project.deletedAt)}
            </span>
            <button
              type="button"
              data-testid="admin-restore-project-btn"
              className="btn btn-primary"
              disabled={restoringProject}
              onClick={handleRestoreProject}
            >
              {restoringProject ? 'Restoring...' : 'Restore Project'}
            </button>
          </div>
          {restoreError && (
            <p data-testid="admin-restore-error" className="admin-notice-error">
              {restoreError}
            </p>
          )}
        </div>
      )}

      {/* Scheduled Deletion Banner */}
      {project.deletionScheduledAt && (
        <div
          data-testid="admin-scheduled-deletion-banner"
          className="admin-notice-box admin-notice-box--scheduled"
        >
          <p className="admin-notice-title">
            ⏳ Scheduled for deletion on {new Date(project.deletionScheduledAt).toLocaleString()}
          </p>
          <p className="admin-notice-subtext">
            Requested by: {project.deletionRequestedBy || 'Owner'}. Project is locked to read-only.
          </p>
          <button
            type="button"
            data-testid="admin-cancel-deletion-btn"
            className="btn btn-outline admin-delete-btn"
            disabled={cancellingDeletion}
            onClick={handleCancelDeletion}
          >
            {cancellingDeletion ? 'Cancelling...' : 'Cancel Deletion'}
          </button>
          {cancelDeletionError && (
            <p className="admin-notice-error">{cancelDeletionError}</p>
          )}
        </div>
      )}

      {/* Owner Inactive 30+ Days Banner */}
      {!isProjectLocked(project) && (project.ownerInactive30d || project.closeRequestedAt) && (
        <div className="admin-notice-box admin-notice-box--warning">
          <p className="admin-notice-title">
            <strong>Owner inactive 30+ days</strong>
            {project.closeRequestedAt ? ' · Collaborator requested closure' : ''}
          </p>
          <div>
            <button
              type="button"
              className="btn btn-danger"
              data-testid="admin-close-project-btn"
              disabled={closingProject}
              onClick={handleAdminCloseProject}
            >
              {closingProject ? 'Closing...' : 'Close Project (Owner inactive)'}
            </button>
          </div>
          {closeError && (
            <p className="admin-notice-error">{closeError}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectDetailsCard;
