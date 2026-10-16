import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
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
 * @param {string} [props.schedule] - Availability schedule (e.g., 'Anytime', 'Weekdays')
 * @param {number|string} [props.sessionPrice] - Session fee in INR
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
  schedule = 'Anytime',
  sessionPrice = 0,
  available = true,
  action = null,
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
              <Badge variant={isAvail ? 'success' : 'danger'}>
                {isAvail ? 'Available' : 'Unavailable'}
              </Badge>
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

        <div className="tf-mentor-card-meta">
          <span>Experience: <strong>{displayExp} yrs</strong></span>
          <span>Schedule: <strong>{schedule || 'Anytime'}</strong></span>
        </div>
      </div>

      <div className="tf-mentor-card-footer">
        <div className="tf-mentor-card-price-row">
          <span className="tf-mentor-card-price-label">Session Fee (INR)</span>
          <span className="tf-mentor-card-price-val">₹{sessionPrice || 0}</span>
        </div>

        {action && (
          <button
            type="button"
            className="tf-mentor-card-btn"
            disabled={action.disabled || !isAvail}
            onClick={action.onClick}
          >
            {action.label || (isAvail ? 'Book with Escrow' : 'Currently Unavailable')}
          </button>
        )}
      </div>
    </div>
  );
};

export default MentorCard;
