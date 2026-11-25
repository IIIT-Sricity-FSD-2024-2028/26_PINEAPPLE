import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import UserTrustCard from './UserTrustCard';
import './MentorCard.css';

/**
 * Shared MentorCard component used across Mentors Directory and My Mentor Profile Preview.
 *
 * @param {Object} props
 * @param {string} [props.name] - Mentor's display name
 * @param {string} [props.avatar] - Mentor's avatar / photo
 * @param {string} [props.headline] - Professional title or headline
 * @param {string} [props.bio] - Short bio (clamped to 2 lines)
 * @param {string[]|string} [props.skills] - Skills list or comma-separated string
 * @param {number|string} [props.experienceYears] - Years of experience
 * @param {number|string} [props.sessionPrice] - Price in INR
 * @param {boolean} [props.available=true] - Availability status
 * @param {Object} [props.action] - Optional action button { label, onClick, disabled }
 * @param {string} [props.className] - Additional CSS class name
 */
const MentorCard = ({
  name = 'Mentor',
  avatar = '',
  headline = '',
  bio = '',
  skills = [],
  experienceYears = 0,
  sessionPrice = 0,
  available = true,
  isFull = false,
  activeMenteesCount = 0,
  maxActiveMentees = null,
  action = null,
  university = '',
  trustSummary = null,
  className = '',
}) => {
  const isAvail = available !== false;
  const skillList = Array.isArray(skills)
    ? skills
    : typeof skills === 'string' && skills.trim()
    ? skills.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const displayBio = bio || 'Experienced mentor ready to guide student projects.';
  const displayHeadline = headline || 'Software Mentor';
  const displayExp =
    experienceYears !== '' && experienceYears !== null && experienceYears !== undefined
      ? Number(experienceYears) || 0
      : 0;

  return (
    <div className={`tf-mentor-card ${className}`.trim()}>
      <div className="tf-mentor-card-body">
        <div className="tf-mentor-card-header">
          <Avatar name={name} src={avatar} size="lg" />
          <div className="tf-mentor-card-info">
            <div className="tf-mentor-card-name-row">
              <h3 className="tf-mentor-card-name" title={name}>{name || 'Mentor'}</h3>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                {isFull && (
                  <Badge variant="danger">Full</Badge>
                )}
                <Badge variant={isAvail ? 'success' : 'danger'}>
                  {isAvail ? 'Available' : 'Unavailable'}
                </Badge>
              </div>
            </div>
            <p className="tf-mentor-card-headline" title={displayHeadline}>{displayHeadline}</p>
          </div>
        </div>

        <p className="tf-mentor-card-bio" title={displayBio}>
          {displayBio}
        </p>

        <div className="tf-mentor-card-skills">
          {skillList.length > 0 ? (
            skillList.map((skill, idx) => (
              <Badge key={idx} variant="info" className="tf-mentor-skill-badge">
                {skill}
              </Badge>
            ))
          ) : (
            <Badge variant="info" className="tf-mentor-skill-badge">
              Mentorship
            </Badge>
          )}
        </div>

        {trustSummary && (
          <div style={{ margin: '8px 0' }}>
            <UserTrustCard summary={trustSummary} variant="compact" />
          </div>
        )}

        <div className="tf-mentor-card-meta">
          <span>Experience: <strong>{displayExp} yrs</strong></span>
          {maxActiveMentees !== null && maxActiveMentees !== undefined ? (
            <span>Capacity: <strong>{Number(activeMenteesCount) || 0}/{maxActiveMentees}</strong></span>
          ) : null}
          {university ? (
            <span>Institution: <strong>{university}</strong></span>
          ) : null}
        </div>
      </div>

      <div className="tf-mentor-card-footer">
        <div className="tf-mentor-card-price-row">
          <span className="tf-mentor-card-price-label">Price (INR)</span>
          <span className="tf-mentor-card-price-val">₹{sessionPrice || 0}</span>
        </div>

        {action && (
          <>
            <button
              type="button"
              className="tf-mentor-card-btn"
              disabled={action.disabled || !isAvail || isFull}
              title={action.title || action.disabledReason || ''}
              onClick={action.onClick}
            >
              {isFull ? 'Full' : (action.label || (isAvail ? 'Book with Escrow' : 'Currently Unavailable'))}
            </button>
            {action.disabledReason && !isFull && isAvail && (
              <p
                className="tf-mentor-card-disabled-reason"
                style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: '6px', marginBottom: 0, textAlign: 'center' }}
              >
                {action.disabledReason}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MentorCard;
