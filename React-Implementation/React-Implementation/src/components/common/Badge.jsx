import './Badge.css';

/**
 * Reusable Badge component for statuses, tags, difficulties, and roles.
 * @param {Object} props
 * @param {'open'|'in-progress'|'completed'|'pending'|'accepted'|'rejected'|'suspended'|'beginner'|'intermediate'|'advanced'|'info'|'warning'|'success'|'danger'|string} [props.variant='info']
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 */
const Badge = ({ variant = 'info', children, className = '' }) => {
  const normalizedVariant = String(variant).toLowerCase().replace(/\s+/g, '-');
  return (
    <span className={`tf-badge tf-badge--${normalizedVariant} ${className}`.trim()}>
      {children}
    </span>
  );
};

export default Badge;
