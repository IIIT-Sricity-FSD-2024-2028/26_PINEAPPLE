import { useState } from 'react';

/**
 * Returns visual styles and icons for a Trust Label.
 */
export function getTrustLabelConfig(label) {
  switch (label) {
    case 'Trusted contributor':
      return {
        variant: 'success',
        icon: '★',
        bg: '#ecfdf5',
        color: '#065f46',
        border: '#a7f3d0',
      };
    case 'Reliable':
      return {
        variant: 'primary',
        icon: '✓',
        bg: '#eff6ff',
        color: '#1e40af',
        border: '#bfdbfe',
      };
    case 'Rising':
      return {
        variant: 'info',
        icon: '↗',
        bg: '#f5f3ff',
        color: '#5b21b6',
        border: '#ddd6fe',
      };
    case 'New member':
      return {
        variant: 'secondary',
        icon: '🌱',
        bg: '#f0fdfa',
        color: '#115e59',
        border: '#99f6e4',
      };
    case 'Getting started':
    default:
      return {
        variant: 'secondary',
        icon: '•',
        bg: '#f8fafc',
        color: '#475569',
        border: '#e2e8f0',
      };
  }
}

/**
 * Returns visual styles for a Standing Band.
 */
export function getStandingBandConfig(band) {
  switch (band) {
    case 'Good standing':
      return {
        variant: 'success',
        bg: '#ecfdf5',
        color: '#047857',
        border: '#a7f3d0',
      };
    case 'Fair standing':
      return {
        variant: 'warning',
        bg: '#fffbeb',
        color: '#b45309',
        border: '#fde68a',
      };
    case 'Low standing':
    default:
      return {
        variant: 'danger',
        bg: '#fff1f2',
        color: '#be123c',
        border: '#fecdd3',
      };
  }
}

/**
 * UserTrustCard component displaying conduct score, XP number, and trust label.
 *
 * @param {Object} props
 * @param {Object} props.summary - UserTrustSummary data from trustApi
 * @param {'compact'|'expanded'} [props.variant='compact'] - Card layout variant
 * @param {boolean} [props.isAdminViewer=false] - Whether caller is an administrator
 * @param {boolean} [props.isSelf=false] - Whether caller is viewing their own card
 * @param {string} [props.className=''] - Additional custom CSS class
 */
export const UserTrustCard = ({
  summary,
  variant = 'compact',
  isAdminViewer = false,
  isSelf = false,
  className = '',
}) => {
  const [showScoreInfo, setShowScoreInfo] = useState(false);

  if (!summary) return null;

  const {
    xp = 0,
    label = 'Getting started',
    band = 'Good standing',
    trackRecord = {},
    reputation,
    needsAttention,
  } = summary;

  const labelConfig = getTrustLabelConfig(label);
  const bandConfig = getStandingBandConfig(band);

  const formattedXp = `${Number(xp || 0).toLocaleString()} XP`;

  const tasksCount = trackRecord.tasksApproved ?? 0;
  const onTimeText =
    trackRecord.onTimeRate !== null && trackRecord.onTimeRate !== undefined
      ? `${trackRecord.onTimeRate}% on time`
      : 'Not enough data';
  const projectsCount = trackRecord.projectsCompleted ?? 0;
  const memberSinceFormatted = trackRecord.memberSince
    ? new Date(trackRecord.memberSince).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const hasScoreAccess = (isSelf || isAdminViewer) && reputation !== undefined;

  // COMPACT VARIANT (Used in Member Rows, Applicants, Invites, Mentors Directory, Admin Users)
  if (variant === 'compact') {
    return (
      <div
        className={`tf-trust-card-compact ${className}`}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.8125rem',
          color: '#334155',
        }}
      >
        {/* Trust Label */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: labelConfig.bg,
            color: labelConfig.color,
            border: `1px solid ${labelConfig.border}`,
          }}
          title={`Trust tier: ${label}`}
        >
          <span>{labelConfig.icon}</span>
          <span>{label}</span>
        </span>

        {/* Standing Band */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: bandConfig.bg,
            color: bandConfig.color,
            border: `1px solid ${bandConfig.border}`,
          }}
          title={`Standing: ${band}`}
        >
          {band}
        </span>

        {/* XP Number */}
        <span
          style={{
            fontWeight: 700,
            color: '#1e293b',
            padding: '2px 6px',
            background: '#f1f5f9',
            borderRadius: '6px',
          }}
        >
          {formattedXp}
        </span>

        {/* Core Contribution Stats */}
        <span style={{ color: '#64748b' }}>
          <strong>{tasksCount}</strong> {tasksCount === 1 ? 'task' : 'tasks'}
        </span>
        <span style={{ color: '#cbd5e1' }}>•</span>
        <span style={{ color: '#64748b' }}>{onTimeText}</span>
        <span style={{ color: '#cbd5e1' }}>•</span>
        <span style={{ color: '#64748b' }}>
          <strong>{projectsCount}</strong> {projectsCount === 1 ? 'project' : 'projects'}
        </span>

        {/* Admin/Self Reputation Display */}
        {hasScoreAccess && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontWeight: 600,
              color: '#334155',
            }}
            title="Conduct Score (Starts at 100, conduct penalties only)"
          >
            Conduct: {reputation}/100
          </span>
        )}

        {/* Admin Needs Attention Flag */}
        {isAdminViewer && needsAttention && (
          <span
            style={{
              padding: '2px 6px',
              background: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #f87171',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '0.75rem',
            }}
          >
            Needs attention
          </span>
        )}
      </div>
    );
  }

  // EXPANDED VARIANT (Used on Profile Page)
  return (
    <div
      className={`tf-trust-card-expanded ${className}`}
      style={{
        background: 'var(--card, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,0.05))',
      }}
    >
      {/* Top Header: Trust Label, Standing Band, XP */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: hasScoreAccess ? '1px solid var(--border, #f1f5f9)' : 'none',
          paddingBottom: hasScoreAccess ? '16px' : '0',
          marginBottom: hasScoreAccess ? '16px' : '0',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            {/* Trust Label */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '0.875rem',
                fontWeight: 600,
                background: labelConfig.bg,
                color: labelConfig.color,
                border: `1px solid ${labelConfig.border}`,
              }}
            >
              <span>{labelConfig.icon}</span>
              <span>{label}</span>
            </span>

            {/* Standing Band */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '0.875rem',
                fontWeight: 600,
                background: bandConfig.bg,
                color: bandConfig.color,
                border: `1px solid ${bandConfig.border}`,
              }}
            >
              {band}
            </span>

            {/* Active This Week Pill */}
            {trackRecord.activeThisWeek && (
              <span
                style={{
                  padding: '4px 8px',
                  background: '#f0fdf4',
                  color: '#15803d',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: '1px solid #bbf7d0',
                }}
              >
                Active this week
              </span>
            )}

            {/* Admin Needs Attention Flag */}
            {isAdminViewer && needsAttention && (
              <span
                style={{
                  padding: '4px 8px',
                  background: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: '1px solid #f87171',
                }}
              >
                Needs attention
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--muted-fg, #64748b)' }}>
            {memberSinceFormatted ? `Member since ${memberSinceFormatted}` : 'TeamForge member'}
          </div>
        </div>

        {/* Experience Points */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-fg, #64748b)', textTransform: 'uppercase' }}>
            Experience Points
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--fg, #0f172a)' }}>
            {formattedXp}
          </div>
        </div>
      </div>

      {/* Conduct Score Section (Exposed strictly to Self and Admins) */}
      {hasScoreAccess && (
        <div
          style={{
            background: 'var(--surface-alt, #f8fafc)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '8px',
            padding: '12px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--fg, #1e293b)' }}>
              Conduct Score:
            </span>
            <span
              style={{
                fontSize: '1.125rem',
                fontWeight: 800,
                color: reputation >= 80 ? '#059669' : reputation >= 60 ? '#d97706' : '#dc2626',
              }}
            >
              {reputation} / 100
            </span>
            <button
              type="button"
              onClick={() => setShowScoreInfo(!showScoreInfo)}
              style={{
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--card, #ffffff)',
                color: 'var(--muted-fg, #64748b)',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
              title="How does Conduct Score work?"
              aria-label="How does Conduct Score work?"
            >
              ?
            </button>
          </div>

          {showScoreInfo && (
            <div
              style={{
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px dashed var(--border, #cbd5e1)',
                fontSize: '0.8125rem',
                color: 'var(--muted-fg, #475569)',
                lineHeight: 1.5,
              }}
            >
              Starts at 100. Reduced only by conduct penalties (-10 per warning, missed deadlines).
              Recovers +2 after 14 clean days. Work contributions (tasks/projects) earn XP,
              but do not increase conduct score.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserTrustCard;
