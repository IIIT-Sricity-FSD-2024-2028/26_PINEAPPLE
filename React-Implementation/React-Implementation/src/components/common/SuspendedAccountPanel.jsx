import { Link } from 'react-router-dom';

const SuspendedAccountPanel = ({ info, onDismiss }) => {
  if (!info) return null;

  const {
    reason,
    suspendedAt,
    suspensionType,
    appealAvailable,
    supportContact = 'support@teamforge.io',
  } = info;

  const formattedDate = suspendedAt
    ? new Date(suspendedAt).toLocaleString()
    : 'Unknown date';

  const typeLabel =
    suspensionType === 'automatic'
      ? 'Automatic after 4 warnings'
      : 'Suspended by a moderator';

  return (
    <div
      role="alert"
      data-testid="suspended-account-panel"
      style={{
        background: '#fef2f2',
        border: '1px solid #f87171',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        color: '#991b1b',
        fontSize: '0.9rem',
        lineHeight: 1.5,
        textAlign: 'left',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '10px',
        }}
      >
        <h3
          data-testid="suspended-panel-title"
          style={{
            margin: 0,
            fontSize: '1.05rem',
            fontWeight: 700,
            color: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Your account is suspended
        </h3>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss suspended notice"
            style={{
              background: 'none',
              border: 'none',
              color: '#991b1b',
              fontSize: '1.3rem',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div>
          <strong>Reason: </strong>
          <span data-testid="suspended-reason">{reason || 'No reason provided.'}</span>
        </div>

        <div>
          <strong>Date: </strong>
          <span data-testid="suspended-date">{formattedDate}</span>
        </div>

        <div>
          <strong>Type: </strong>
          <span data-testid="suspended-type">{typeLabel}</span>
        </div>

        <div
          style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid #fee2e2',
            fontSize: '0.88rem',
          }}
        >
          {appealAvailable ? (
            <p style={{ margin: 0 }}>
              You can{' '}
              <Link
                to="/appeal"
                data-testid="appeal-link"
                style={{
                  color: '#b91c1c',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                submit an appeal
              </Link>{' '}
              if you believe this was in error.
            </p>
          ) : (
            <p style={{ margin: 0 }}>
              Contact support at{' '}
              <a
                href={`mailto:${supportContact}`}
                data-testid="support-contact-link"
                style={{
                  color: '#b91c1c',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                {supportContact}
              </a>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuspendedAccountPanel;
