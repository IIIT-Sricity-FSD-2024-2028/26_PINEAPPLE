import './EmptyState.css';

/**
 * Reusable empty state view when lists or search queries return no results.
 * @param {Object} props
 * @param {string} props.title
 * @param {string} props.message
 * @param {React.ReactNode} [props.icon]
 * @param {string} [props.actionLabel]
 * @param {() => void} [props.onAction]
 */
const EmptyState = ({ title, message, icon, actionLabel, onAction }) => {
  return (
    <div className="tf-empty-state">
      <div className="tf-empty-state-icon">
        {icon || (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        )}
      </div>
      <h4 className="tf-empty-state-title">{title}</h4>
      <p className="tf-empty-state-msg">{message}</p>
      {actionLabel && onAction && (
        <button type="button" className="tf-empty-state-btn" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
