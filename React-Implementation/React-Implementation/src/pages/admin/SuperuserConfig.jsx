import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPlatformConfig,
  updatePlatformConfig,
} from '../../store/thunks/platformConfigThunks';
import { setConfigSaveError } from '../../store/slices/platformConfigSlice';
import {
  selectInitialTenure,
  selectPlatformConfig,
  selectPlatformConfigWorking,
} from '../../store/selectors/platformConfigSelectors';
import { fetchPortalAdmins } from '../../store/thunks/portalAdminsThunks';
import { selectAllPortalAdmins } from '../../store/selectors/portalAdminsSelectors';
import { fetchDashboardStats } from '../../store/thunks/adminUsersThunks';
import { selectDashboardStats } from '../../store/selectors/adminUsersSelectors';
import {
  canAccess,
  selectIsSessionConfigured,
  selectIsSuperUser,
  selectSession,
} from '../../store/selectors/sessionSelectors';
import FormInput from '../../components/common/FormInput';
import ScheduledJobsPanel from './ScheduledJobsPanel';
import './SuperuserConfig.css';

const SuperuserConfigContent = () => {
  const dispatch = useDispatch();

  const storedConfig = useSelector(selectPlatformConfig);
  const initialTenure = useSelector(selectInitialTenure);
  const working = useSelector(selectPlatformConfigWorking);
  const admins = useSelector(selectAllPortalAdmins);
  const stats = useSelector(selectDashboardStats);
  const session = useSelector(selectSession);
  const isSessionConfigured = useSelector(selectIsSessionConfigured);
  const isSuperUser = useSelector(selectIsSuperUser);
  const canWriteConfig = canAccess(session, 'config_write');

  // Local controlled form edits overlaid onto store config until Commit Changes
  const [formOverrides, setFormOverrides] = useState({});

  const config = { ...storedConfig, ...formOverrides };

  const adminsCount =
    stats?.activeAdmins !== undefined ? stats.activeAdmins : admins.length;
  const activeUsersCount =
    stats?.activeUsers !== undefined
      ? stats.activeUsers
      : stats?.totalUsers !== undefined
      ? stats.totalUsers
      : 0;

  const error = working.saveError || '';
  const successMsg = working.saveSuccess || '';

  useEffect(() => {
    dispatch(fetchPortalAdmins());
    dispatch(fetchDashboardStats());
    dispatch(fetchPlatformConfig());
  }, [dispatch]);

  const handleChange = (field, value) => {
    setFormOverrides((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!canWriteConfig) return;
    dispatch(setConfigSaveError(''));

    const maxProjects = Number(config.maxProjectsPerUser);
    const maxCollabs = Number(config.maxCollaboratorsPerProject);
    const mentorYears = Number(config.minimumTenure ?? config.mentorMinYearsExperience);

    if (!Number.isFinite(maxProjects) || maxProjects < 1 || maxProjects > 100) {
      dispatch(setConfigSaveError('Max Projects per User must be between 1 and 100.'));
      return;
    }
    if (!Number.isFinite(maxCollabs) || maxCollabs < 1 || maxCollabs > 200) {
      dispatch(setConfigSaveError('Max Collaborators must be between 1 and 200.'));
      return;
    }
    if (!Number.isInteger(mentorYears) || mentorYears < 5 || mentorYears > 40) {
      dispatch(setConfigSaveError('Minimum tenure must be a whole number between 5 and 40.'));
      return;
    }
    if (mentorYears < initialTenure) {
      dispatch(
        setConfigSaveError(
          `Minimum tenure can only be raised (current: ${initialTenure}, attempted: ${mentorYears}).`,
        ),
      );
      return;
    }

    const updatedConfig = {
      maxProjectsPerUser: maxProjects,
      maxCollaboratorsPerProject: maxCollabs,
      mentorMinYearsExperience: mentorYears,
      minimumTenure: mentorYears,
      maintenanceMode: Boolean(config.maintenanceMode),
      platformVersion: config.platformVersion || '1.4.2',
    };

    try {
      await dispatch(updatePlatformConfig(updatedConfig)).unwrap();
      setFormOverrides({});
    } catch {
      // Friendly server error stored in platformConfigSlice working.saveError
    }
  };

  return (
    <div id="su-config" className="admin-page su-config-page">
      <h1>
        Platform Configuration &amp; Scheduler{' '}
        <span
          className="su-page-badge"
          style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '999px',
            background: isSuperUser ? '#fef3c7' : '#e0e7ff',
            color: isSuperUser ? '#92400e' : '#3730a3',
            border: isSuperUser ? '1px solid #fde68a' : '1px solid #c7d2fe',
            marginLeft: '8px',
          }}
        >
          {isSuperUser ? 'Super User Only' : 'Admin Read-Only'}
        </span>
      </h1>
      <p className="page-subtitle mt-1">System-level settings that control platform behaviour for all users.</p>

      {error && (
        <div
          className="su-form-error mt-4"
          data-testid="config-error-banner"
          style={{ color: 'var(--destructive, #ef4444)', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}
        >
          {error}
        </div>
      )}
      {successMsg && (
        <div
          data-testid="config-success-banner"
          style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '12px', borderRadius: '10px', marginTop: '16px' }}
        >
          {successMsg}
        </div>
      )}

      <div className="su-config-grid mt-4">
        <div className="su-config-section">
          <h3 className="su-config-section-title">
            <span>📊</span> Project Parameters
          </h3>
          <FormInput
            label="Project Quota / User"
            name="maxProjectsPerUser"
            type="number"
            min="1"
            max="100"
            disabled={!canWriteConfig}
            value={config.maxProjectsPerUser}
            onChange={(e) => handleChange('maxProjectsPerUser', e.target.value)}
          />
          <FormInput
            label="Max Collaborator Capacity"
            name="maxCollaboratorsPerProject"
            type="number"
            min="1"
            max="200"
            className="mt-3"
            disabled={!canWriteConfig}
            value={config.maxCollaboratorsPerProject}
            onChange={(e) => handleChange('maxCollaboratorsPerProject', e.target.value)}
          />
        </div>

        <div className="su-config-section">
          <h3 className="su-config-section-title">
            <span>🎓</span> Mentor Authorization
          </h3>
          <FormInput
            label="Minimum Career Tenure (Years)"
            name="mentorMinYearsExperience"
            type="number"
            min={Math.max(5, initialTenure)}
            max="40"
            step="1"
            disabled={!canWriteConfig}
            value={config.minimumTenure ?? config.mentorMinYearsExperience ?? 5}
            onChange={(e) => {
              handleChange('mentorMinYearsExperience', e.target.value);
              handleChange('minimumTenure', e.target.value);
            }}
            helperText="Platform minimum tenure defaults to 5 and can only be raised (up to 40)."
          />
        </div>

        <div className="su-config-section">
          <h3 className="su-config-section-title">
            <span>🛡️</span> System Controls
          </h3>
          <div className="su-toggle-row">
            <div>
              <div className="su-toggle-label">Maintenance Override</div>
              <div className="su-toggle-desc">Lock platform for internal utility</div>
            </div>
            <label className="su-switch">
              <input
                type="checkbox"
                disabled={!canWriteConfig}
                checked={Boolean(config.maintenanceMode)}
                onChange={(e) => handleChange('maintenanceMode', e.target.checked)}
              />
              <span className="su-switch-track"></span>
            </label>
          </div>
          <div className="su-info-row mt-4" style={{ borderBottom: 'none', paddingTop: '12px', borderTop: '1px solid var(--border, #e5e7eb)' }}>
            <span className="su-info-label">Platform State</span>
            <span className="su-info-value" style={{ color: config.maintenanceMode ? 'var(--destructive, #ef4444)' : 'var(--success, #10b981)', fontWeight: 600 }}>
              {config.maintenanceMode ? 'Maintenance Mode Active' : 'Operational (Accepting Traffic)'}
            </span>
          </div>
        </div>

        <div className="su-config-section">
          <h3 className="su-config-section-title">
            <span>⚙️</span> Network Telemetry
          </h3>
          <div className="su-info-row">
            <span className="su-info-label">Revision Protocol</span>
            <span className="su-info-value" style={{ color: 'var(--primary, #6366f1)' }}>{config.platformVersion}</span>
          </div>
          <div className="su-info-row">
            <span className="su-info-label">Role Privilege</span>
            <span className="su-info-value" style={{ color: 'var(--success, #10b981)' }}>Super User Elevation</span>
          </div>
          <div className="su-info-row">
            <span className="su-info-label">Identified Admins</span>
            <span className="su-info-value">{adminsCount} active</span>
          </div>
          <div className="su-info-row">
            <span className="su-info-label">Active Users</span>
            <span className="su-info-value">{activeUsersCount} authenticated</span>
          </div>
        </div>
      </div>

      {(canWriteConfig || isSessionConfigured) && (
        <div className="su-config-actions mt-4">
          <button
            className="btn btn-primary"
            data-testid="commit-config-btn"
            disabled={!canWriteConfig || working.saving}
            title={!canWriteConfig ? 'Super User permission required' : undefined}
            style={{ height: '48px', padding: '0 28px', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem' }}
            onClick={handleSave}
          >
            {working.saving ? 'Saving...' : 'Commit Changes'}
          </button>
        </div>
      )}

      {/* Phase 7: Scheduled Jobs Panel */}
      <ScheduledJobsPanel isSuperUser={isSuperUser} />
    </div>
  );
};

const SuperuserConfig = SuperuserConfigContent;
export default SuperuserConfig;
