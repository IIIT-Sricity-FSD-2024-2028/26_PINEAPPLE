import './StatCard.css';

/**
 * Reusable KPI / Stat metric card.
 * @param {Object} props
 * @param {React.ReactNode} [props.icon]
 * @param {string} props.label
 * @param {string|number} props.value
 * @param {string|React.ReactNode} [props.meta]
 * @param {string|React.ReactNode} [props.subtext]
 * @param {string|{ text: string, isPositive?: boolean }} [props.trend]
 * @param {() => void} [props.onClick]
 * @param {string} [props.variant='default']
 * @param {string} [props.className='']
 */
const StatCard = ({ icon, label, value, meta, subtext, trend, onClick, variant = 'default', className = '' }) => {
  return (
    <div
      className={`tf-stat-card tf-stat-card--${variant} ${onClick ? 'tf-stat-card--clickable' : ''} ${className}`.trim()}
      onClick={onClick}
    >
      <div className="tf-stat-card-top">
        {icon ? <div className="tf-stat-card-icon">{icon}</div> : <div />}
        {meta && <span className="tf-stat-card-meta">{meta}</span>}
      </div>
      <div className="tf-stat-card-value">{value ?? 0}</div>
      <div className="tf-stat-card-label">{label}</div>
      {subtext && <div className="tf-stat-card-subtext">{subtext}</div>}
      {trend && (
        <div className={`tf-stat-card-trend ${typeof trend === 'object' && trend.isPositive === false ? 'negative' : 'positive'}`}>
          {typeof trend === 'object' ? trend.text : trend}
        </div>
      )}
    </div>
  );
};

export default StatCard;
