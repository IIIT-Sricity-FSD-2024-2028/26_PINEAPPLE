import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import SuspendedAccountPanel from '../components/common/SuspendedAccountPanel';
import { selectSuspendedInfo } from '../store/selectors/sessionSelectors';
import { clearSuspendedInfo } from '../store/slices/sessionSlice';
import { sessionReset } from '../store/actions/appActions';
import { clearTransportSession } from '../store/thunks/sessionThunks';
import './Auth.css';

const SuspendedContent = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const storeSuspendedInfo = useSelector(selectSuspendedInfo);

  const info =
    location.state?.suspendedInfo ||
    storeSuspendedInfo || {
      reason: 'Your account has been suspended by administration.',
      suspendedAt: new Date().toISOString(),
      suspensionType: 'manual',
      appealAvailable: false,
      supportContact: 'support@teamforge.io',
    };

  useEffect(() => {
    clearTransportSession();
    dispatch(sessionReset({ keepSuspendedInfo: true }));
  }, [dispatch]);

  const handleBackToLogin = () => {
    dispatch(clearSuspendedInfo());
    navigate('/login');
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container" style={{ maxWidth: '480px', margin: '40px auto' }}>
        <div className="form-section" style={{ width: '100%' }}>
          <div className="auth-header">
            <div className="brand-group">
              <div className="logo-placeholder">TF</div>
              <h2>TeamForge</h2>
            </div>
          </div>

          <div className="view-section">
            <SuspendedAccountPanel info={info} />

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleBackToLogin}
                data-testid="back-to-login-btn"
                style={{ width: '100%' }}
              >
                Back to login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Suspended = SuspendedContent;
export default Suspended;
