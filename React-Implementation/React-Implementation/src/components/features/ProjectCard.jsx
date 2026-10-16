import Badge from '../common/Badge';
import ProgressBar from '../common/ProgressBar';
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
  progress,
  taskCount,
  tasks = [],
  onSummary,
  actionSlot,
}) => {
  const title = project.title || project.name || 'Untitled Project';
  const description = project.description || project.desc || 'No description provided.';
  const ownerName = project.owner || 'Project Owner';
  const difficulty = project.difficulty || 'Intermediate';
  const status = project.status || 'Open';
  const maxCollabs = project.maxCollaborators || 5;
  const currentMembers = Array.isArray(project.collaborators)
    ? project.collaborators.length
    : (Array.isArray(project.members) ? project.members.filter((m) => m.role !== 'Owner').length : (Number(project.collaborators) || 0));
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
          <Badge variant={difficulty}>{difficulty}</Badge>
          <Badge variant={status}>{status}</Badge>
        </div>
      </div>

      <p className="tf-project-card-desc">{description}</p>

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
          <span className="tf-project-card-members">
            <UsersIcon /> {currentMembers}/{maxCollabs}
          </span>
        </div>

        <div className="tf-project-card-actions">
          {variant === 'marketplace' && (
            hasApplied ? (
              <span className={`tf-project-card-applied-status status-${applicationStatus?.toLowerCase()}`}>
                {applicationStatus || 'Applied'}
              </span>
            ) : (
              <button
                type="button"
                className="tf-project-card-btn tf-project-card-btn--primary"
                onClick={handleApplyClick}
              >
                Apply
              </button>
            )
          )}

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
            <button
              type="button"
              className="tf-project-card-btn tf-project-card-btn--outline"
              onClick={handleCardClick}
            >
              Manage →
            </button>
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
                    <a
                      href={project.finishedLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tf-project-card-btn tf-project-card-btn--outline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Finished Project ↗
                    </a>
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
