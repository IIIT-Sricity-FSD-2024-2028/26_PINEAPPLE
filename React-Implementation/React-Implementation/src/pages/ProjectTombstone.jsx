import { useNavigate } from 'react-router-dom';
import './ProjectTombstone.css';

export default function ProjectTombstone({ project, onNavigate }) {
  const navigate = useNavigate();

  const handleBrowse = () => {
    if (typeof onNavigate === 'function') {
      onNavigate('/projects');
    } else {
      navigate('/projects');
    }
  };

  const handleMyWork = () => {
    if (typeof onNavigate === 'function') {
      onNavigate('/my-work');
    } else {
      navigate('/my-work');
    }
  };

  const formattedDate = project?.deletedAt
    ? new Date(project.deletedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'recently';

  const reasons = Array.isArray(project?.reasons) ? project.reasons : [];
  const explanation = project?.explanation;

  const reasonLabels = {
    CREATED_BY_MISTAKE: 'Created by mistake',
    DUPLICATE_PROJECT: 'Duplicate project',
    PROJECT_NO_LONGER_REQUIRED: 'Project no longer required',
    LACK_OF_RESOURCES: 'Lack of resources',
    CHANGE_IN_PROJECT_DIRECTION: 'Change in project direction',
    INSUFFICIENT_PARTICIPATION: 'Insufficient participation',
    OTHER: 'Other',
  };

  return (
    <div className="tf-tombstone-container" data-testid="project-tombstone">
      <div className="tf-tombstone-card">
        <div className="tf-tombstone-icon">🏛️</div>
        <h1 className="tf-tombstone-title">Project Deleted</h1>
        <p className="tf-tombstone-subtitle">
          <strong>{project?.title || 'This project'}</strong> was deleted on {formattedDate}.
        </p>

        {reasons.length > 0 && (
          <div className="tf-tombstone-reasons">
            <span className="tf-tombstone-label">Reason(s):</span>
            <div className="tf-tombstone-chips">
              {reasons.map((r) => (
                <span key={r} className="tf-tombstone-chip">
                  {reasonLabels[r] || r}
                </span>
              ))}
            </div>
          </div>
        )}

        {explanation && (
          <div className="tf-tombstone-explanation">
            <span className="tf-tombstone-label">Explanation:</span>
            <p className="tf-tombstone-quote">"{explanation}"</p>
          </div>
        )}

        <div className="tf-tombstone-info">
          <p>
            All member tasks have been released back to the backlog and the workspace is closed.
            Your completed tasks and earned XP remain safely recorded in your profile.
          </p>
        </div>

        <div className="tf-tombstone-actions">
          <button
            type="button"
            className="tf-tombstone-btn-primary"
            onClick={handleBrowse}
            data-testid="tombstone-browse-btn"
          >
            Explore Open Projects
          </button>
          <button
            type="button"
            className="tf-tombstone-btn-secondary"
            onClick={handleMyWork}
            data-testid="tombstone-mywork-btn"
          >
            My Work
          </button>
        </div>
      </div>
    </div>
  );
}
