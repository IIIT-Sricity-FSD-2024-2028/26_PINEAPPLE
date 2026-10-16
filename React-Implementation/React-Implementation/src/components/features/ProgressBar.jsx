import { calculateProjectProgress } from '../../utils/progress';
import './ProgressBar.css';

/**
 * Standard ProgressBar component.
 *
 * @param {Object} props
 * @param {number} [props.value] - Progress percentage (0 - 100).
 * @param {Array} [props.tasks] - Task list to automatically compute progress from.
 * @param {boolean} [props.showLabel=true] - Whether to render "Progress" header and percentage.
 * @param {string} [props.label="Progress"] - Custom label text.
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Height variant.
 * @param {string} [props.color] - Custom bar color override.
 * @param {string} [props.className] - Additional class names.
 */
export const ProgressBar = ({
  value,
  tasks,
  showLabel = true,
  label = 'Progress',
  size = 'md',
  color,
  className = '',
}) => {
  const computedPercent = typeof value === 'number'
    ? Math.min(100, Math.max(0, Math.round(value)))
    : Array.isArray(tasks)
    ? calculateProjectProgress(tasks)
    : 0;

  const isCompleted = computedPercent >= 100;

  return (
    <div className={`tf-progress-container ${className}`.trim()}>
      {showLabel && (
        <div className="tf-progress-header">
          <span className="tf-progress-label">{label}</span>
          <span className="tf-progress-val">{computedPercent}%</span>
        </div>
      )}
      <div className={`tf-progress-track tf-progress-track--${size}`}>
        <div
          className={`tf-progress-fill ${isCompleted ? 'tf-progress-fill--completed' : ''}`}
          style={{
            width: `${computedPercent}%`,
            ...(color ? { background: color } : {}),
          }}
          role="progressbar"
          aria-valuenow={computedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
