import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/selectors/sessionSelectors';
import { confirmUsername } from '../../store/thunks/settingsThunks';
import { refreshSessionUser } from '../../store/thunks/sessionThunks';
import './UsernameConfirmationBanner.css';

const UsernameConfirmationBannerContent = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Only render if user needs confirmation
  if (!user || !user.needsUsernameConfirmation) {
    return null;
  }

  const handleKeep = async () => {
    setSaving(true);
    setError('');
    try {
      await dispatch(confirmUsername({ confirm: true })).unwrap();
      await dispatch(refreshSessionUser()).unwrap().catch(() => {});
    } catch (err) {
      setError(err?.message || 'Failed to confirm username. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="username-confirm-banner" role="region" aria-label="Username Confirmation">
      <div className="username-banner-content">
        <div className="username-banner-icon" aria-hidden="true">
          🔒
        </div>

        <div className="username-banner-text-block">
          <div className="username-banner-text">
            <strong>Your username:</strong>{' '}
            <span className="current-username-tag">@{user.username}</span>{' '}
            <span>— Your username can&apos;t be changed.</span>
          </div>

          {error && <div className="username-banner-error">{error}</div>}

          <div className="username-banner-actions">
            <button
              type="button"
              className="banner-btn banner-btn-primary"
              onClick={handleKeep}
              disabled={saving}
            >
              {saving ? 'Confirming...' : `Got it (@${user.username})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const UsernameConfirmationBanner = UsernameConfirmationBannerContent;

export default UsernameConfirmationBanner;
