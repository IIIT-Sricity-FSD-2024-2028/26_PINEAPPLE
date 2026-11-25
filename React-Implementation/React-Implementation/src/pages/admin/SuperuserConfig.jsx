import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut as fbSignOut } from 'firebase/auth';
import { auth } from '../../services/firebase.js';
import { getAuthMode, setAccessToken } from '../../services/apiClient.js';
import portalAdminsApi from '../../services/portalAdminsApi';
import adminApi, { recordPortalAuditEntry } from '../../services/adminApi';
import FormInput from '../../components/common/FormInput';
import Modal from '../../components/common/Modal';
import ScheduledJobsPanel from './ScheduledJobsPanel';
import { formatDateTime } from '../../utils/dateFormatter';
import storage from '../../utils/storage';
import './SuperuserConfig.css';

const DEFAULT_CONFIG = {
  maxProjectsPerUser: 10,
  maxCollaboratorsPerProject: 20,
  mentorMinYearsExperience: 5,
  minimumTenure: 5,
  xpPerTaskCompletion: 100,
  maintenanceMode: false,
  platformVersion: "1.4.2",
};

const SuperuserConfig = () => {
  const [config, setConfig] = useState(() => {
    try {
      const stored = storage.getPlatformConfig();
      return stored ? { ...DEFAULT_CONFIG, ...stored } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [initialTenure, setInitialTenure] = useState(5);
  const [adminsCount, setAdminsCount] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();
  const [demoResetStatus, setDemoResetStatus] = useState({ enabled: false, lastResetAt: null });
  const [isDemoResetModalOpen, setIsDemoResetModalOpen] = useState(false);
  const [demoResetConfirmText, setDemoResetConfirmText] = useState('');
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [demoResetError, setDemoResetError] = useState('');

  const { isSuperUser } = storage.getAdminSession();

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const [adminsData, statsData, backendConfig] = await Promise.all([
          portalAdminsApi.list().catch(() => []),
          adminApi.getStats().catch(() => null),
          adminApi.getConfig().catch(() => null),
        ]);

        if (backendConfig) {
          setConfig((prev) => ({ ...prev, ...backendConfig }));
          const backendTenure = Number(backendConfig.minimumTenure ?? backendConfig.mentorMinYearsExperience ?? 5);
          if (!isNaN(backendTenure)) {
            setInitialTenure(backendTenure);
          }
          storage.setPlatformConfig(backendConfig);
        }

        if (statsData?.activeAdmins !== undefined) {
          setAdminsCount(statsData.activeAdmins);
        } else if (Array.isArray(adminsData)) {
          setAdminsCount(adminsData.length);
        }

        if (statsData?.activeUsers !== undefined) {
          setActiveUsersCount(statsData.activeUsers);
        } else if (statsData?.totalUsers !== undefined) {
          setActiveUsersCount(statsData.totalUsers);
        }

        if (isSuperUser && typeof adminApi.getDemoResetStatus === 'function') {
          adminApi.getDemoResetStatus().then((status) => {
            if (status && typeof status.enabled === 'boolean') {
              setDemoResetStatus({
                enabled: status.enabled,
                lastResetAt: status.lastResetAt || null,
              });
            }
          }).catch(() => {});
        }
      } catch (err) {
        console.warn("Telemetry fetch error:", err);
      }
    };

    fetchTelemetry();
  }, [isSuperUser]);

  const handleChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setError('');
    setSuccessMsg('');

    const maxProjects = Number(config.maxProjectsPerUser);
    const maxCollabs = Number(config.maxCollaboratorsPerProject);
    const mentorYears = Number(config.minimumTenure ?? config.mentorMinYearsExperience);
    const xpPerTask = Number(config.xpPerTaskCompletion);

    if (!Number.isFinite(maxProjects) || maxProjects < 1 || maxProjects > 100) {
      setError("Max Projects per User must be between 1 and 100.");
      return;
    }
    if (!Number.isFinite(maxCollabs) || maxCollabs < 1 || maxCollabs > 200) {
      setError("Max Collaborators must be between 1 and 200.");
      return;
    }
    if (!Number.isInteger(mentorYears) || mentorYears < 5 || mentorYears > 40) {
      setError("Minimum tenure must be a whole number between 5 and 40.");
      return;
    }
    if (mentorYears < initialTenure) {
      setError(`Minimum tenure can only be raised (current: ${initialTenure}, attempted: ${mentorYears}).`);
      return;
    }
    if (!Number.isFinite(xpPerTask) || xpPerTask < 0 || xpPerTask > 10000) {
      setError("XP per task must be between 0 and 10,000.");
      return;
    }

    const updatedConfig = {
      maxProjectsPerUser: maxProjects,
      maxCollaboratorsPerProject: maxCollabs,
      mentorMinYearsExperience: mentorYears,
      minimumTenure: mentorYears,
      xpPerTaskCompletion: xpPerTask,
      maintenanceMode: Boolean(config.maintenanceMode),
      platformVersion: config.platformVersion || "1.4.2",
    };

    try {
      await adminApi.updateConfig(updatedConfig);
      storage.setPlatformConfig(updatedConfig);
      setConfig(updatedConfig);
      setSuccessMsg("Platform configuration committed successfully.");

      // Record audit entry for configuration change
      recordPortalAuditEntry({
        action: 'config-saved',
        actor: 'Super User',
        target: 'Platform Configuration',
        details: {
          maxProjectsPerUser: maxProjects,
          maxCollaboratorsPerProject: maxCollabs,
          mentorMinYearsExperience: mentorYears,
          xpPerTaskCompletion: xpPerTask,
          maintenanceMode: config.maintenanceMode,
        }
      });
    } catch (err) {
      setError("Failed to save configuration: " + err.message);
    }
  };

  const handleConfirmDemoReset = async () => {
    if (isResettingDemo || demoResetConfirmText !== 'RESET') return;
    if (typeof adminApi.resetDemoData !== 'function') return;

    setIsResettingDemo(true);
    setDemoResetError('');
    try {
      await adminApi.resetDemoData('RESET');
      setIsDemoResetModalOpen(false);
      setDemoResetConfirmText('');

      try {
        storage.clearAll();
        storage.setDemoResetNotice('Demo data restored. Please log in again.');
      } catch (storageErr) {
        console.warn('[SuperuserConfig] Error clearing session keys after demo reset:', storageErr);
      }
      setAccessToken(null);

      if (getAuthMode() === 'firebase') {
        try {
          await fbSignOut(auth);
        } catch (fbErr) {
          console.warn('[SuperuserConfig] Firebase signout after demo reset failed:', fbErr);
        }
      }

      navigate('/admin/login', {
        replace: true,
        state: { demoResetMessage: 'Demo data restored. Please log in again.' },
      });
    } catch (err) {
      const code = err?.code || err?.data?.code || '';
      if (code === 'MAINTENANCE' || err?.statusCode === 503) {
        setDemoResetError('The system is being reset, retrying...');
      } else if (code === 'RESET_IN_PROGRESS' || err?.statusCode === 409) {
        setDemoResetError(err?.serverMessage || 'A demo reset is already in progress. Please wait.');
      } else {
        setDemoResetError(err?.serverMessage || err?.message || 'Failed to reset demo data.');
      }
    } finally {
      setIsResettingDemo(false);
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

      {error && <div className="su-form-error mt-4" style={{ color: 'var(--destructive, #ef4444)', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>{error}</div>}
      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '12px', borderRadius: '10px', marginTop: '16px' }}>
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
            value={config.maxProjectsPerUser}
            onChange={(e) => handleChange("maxProjectsPerUser", e.target.value)}
          />
          <FormInput
            label="Max Collaborator Capacity"
            name="maxCollaboratorsPerProject"
            type="number"
            min="1"
            max="200"
            className="mt-3"
            value={config.maxCollaboratorsPerProject}
            onChange={(e) => handleChange("maxCollaboratorsPerProject", e.target.value)}
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
            value={config.minimumTenure ?? config.mentorMinYearsExperience ?? 5}
            onChange={(e) => {
              handleChange("mentorMinYearsExperience", e.target.value);
              handleChange("minimumTenure", e.target.value);
            }}
            helperText="Platform minimum tenure defaults to 5 and can only be raised (up to 40)."
          />
          <FormInput
            label="Standard XP Yield / Task"
            name="xpPerTaskCompletion"
            type="number"
            min="0"
            max="10000"
            className="mt-3"
            value={config.xpPerTaskCompletion}
            onChange={(e) => handleChange("xpPerTaskCompletion", e.target.value)}
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
                checked={config.maintenanceMode}
                onChange={(e) => handleChange("maintenanceMode", e.target.checked)}
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

        {/* Demo data reset card (shown only for Super User when ALLOW_DEMO_RESET enabled) */}
        {isSuperUser && demoResetStatus.enabled && (
          <div
            className="su-config-section"
            data-testid="demo-reset-card"
            style={{ borderColor: '#fecaca' }}
          >
            <h3 className="su-config-section-title" style={{ color: '#b91c1c' }}>
              <span>🧹</span> Demo data
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted, #64748b)', lineHeight: 1.5, marginBottom: '12px' }}>
              Restore all in-memory stores, seed credentials, uploaded files, CVs, and exports back to the clean initial mock seed state. Everyone including you will be logged out.
            </p>
            <div className="su-info-row">
              <span className="su-info-label">Last reset</span>
              <span className="su-info-value" data-testid="demo-reset-last-at">
                {demoResetStatus.lastResetAt ? formatDateTime(demoResetStatus.lastResetAt) : 'Never'}
              </span>
            </div>
            <div className="mt-3">
              <button
                type="button"
                data-testid="demo-reset-open-btn"
                onClick={() => {
                  setDemoResetConfirmText('');
                  setDemoResetError('');
                  setIsDemoResetModalOpen(true);
                }}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reset to mock data
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation dialog for Reset to mock data */}
      <Modal
        isOpen={isDemoResetModalOpen}
        title="Reset to mock data?"
        onClose={() => {
          if (!isResettingDemo) setIsDemoResetModalOpen(false);
        }}
        closeDisabled={isResettingDemo}
        size="sm"
        testId="demo-reset-modal"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <button
              type="button"
              data-testid="demo-reset-cancel-btn"
              disabled={isResettingDemo}
              onClick={() => setIsDemoResetModalOpen(false)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                fontWeight: 600,
                cursor: isResettingDemo ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="demo-reset-submit-btn"
              disabled={isResettingDemo || demoResetConfirmText !== 'RESET'}
              onClick={handleConfirmDemoReset}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: isResettingDemo || demoResetConfirmText !== 'RESET' ? '#fca5a5' : '#dc2626',
                color: '#fff',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: isResettingDemo || demoResetConfirmText !== 'RESET' ? 'not-allowed' : 'pointer',
              }}
            >
              {isResettingDemo && (
                <span
                  data-testid="demo-reset-spinner"
                  role="status"
                  aria-hidden="true"
                  style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid currentColor',
                    borderRightColor: 'transparent',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.75s linear infinite',
                  }}
                />
              )}
              <span>{isResettingDemo ? 'Resetting...' : 'Reset demo data'}</span>
            </button>
          </div>
        }
      >
        <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: 0, lineHeight: 1.5 }}>
          The following changes will take effect immediately:
        </p>
        <ul style={{ color: '#334155', fontSize: '0.88rem', paddingLeft: '20px', lineHeight: 1.6, margin: '8px 0 14px' }}>
          <li>All created users, projects, tasks, requests, invites, chat messages, notifications, reports, appeals, support tickets, sessions, escrow, and payments will be erased back to initial mock seed data.</li>
          <li>Post-seed uploaded files, CVs, and exports will be permanently deleted.</li>
          <li><strong>Everyone — including you — will be logged out. This cannot be undone.</strong></li>
        </ul>
        <FormInput
          label="Type RESET to confirm"
          name="demoResetConfirm"
          data-testid="demo-reset-confirm-input"
          placeholder="RESET"
          value={demoResetConfirmText}
          onChange={(e) => setDemoResetConfirmText(e.target.value)}
        />
        {demoResetError && (
          <div
            role="alert"
            data-testid="demo-reset-error"
            style={{
              marginTop: '10px',
              padding: '10px 12px',
              borderRadius: '6px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '0.86rem',
            }}
          >
            ⚠️ {demoResetError}
          </div>
        )}
      </Modal>

      {isSuperUser && (
        <div className="su-config-actions mt-4">
          <button
            className="btn btn-primary"
            style={{ height: '48px', padding: '0 28px', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem' }}
            onClick={handleSave}
          >
            Commit Changes
          </button>
        </div>
      )}

      {/* Phase 7: Scheduled Jobs Panel */}
      <ScheduledJobsPanel isSuperUser={isSuperUser} />
    </div>
  );
};

export default SuperuserConfig;
