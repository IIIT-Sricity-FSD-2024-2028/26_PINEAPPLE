import { useState, useEffect } from 'react';
import portalAdminsApi from '../../services/portalAdminsApi';
import adminApi, { recordPortalAuditEntry } from '../../services/adminApi';
import FormInput from '../../components/common/FormInput';
import './SuperuserConfig.css';

const DEFAULT_CONFIG = {
  maxProjectsPerUser: 10,
  maxCollaboratorsPerProject: 20,
  mentorMinYearsExperience: 4,
  xpPerTaskCompletion: 100,
  maintenanceMode: false,
  platformVersion: "1.4.2",
};

const SuperuserConfig = () => {
  const [config, setConfig] = useState(() => {
    try {
      const stored = localStorage.getItem("teamforge.platformConfig");
      return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [adminsCount, setAdminsCount] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
          localStorage.setItem("teamforge.platformConfig", JSON.stringify(backendConfig));
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
      } catch (err) {
        console.warn("Telemetry fetch error:", err);
      }
    };

    fetchTelemetry();
  }, []);

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
    const mentorYears = Number(config.mentorMinYearsExperience);
    const xpPerTask = Number(config.xpPerTaskCompletion);

    if (!Number.isFinite(maxProjects) || maxProjects < 1 || maxProjects > 100) {
      setError("Max Projects per User must be between 1 and 100.");
      return;
    }
    if (!Number.isFinite(maxCollabs) || maxCollabs < 1 || maxCollabs > 200) {
      setError("Max Collaborators must be between 1 and 200.");
      return;
    }
    if (!Number.isFinite(mentorYears) || mentorYears < 0 || mentorYears > 50) {
      setError("Mentor min years must be between 0 and 50.");
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
      xpPerTaskCompletion: xpPerTask,
      maintenanceMode: Boolean(config.maintenanceMode),
      platformVersion: config.platformVersion || "1.4.2",
    };

    try {
      await adminApi.updateConfig(updatedConfig);
      localStorage.setItem("teamforge.platformConfig", JSON.stringify(updatedConfig));
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

  return (
    <div id="su-config" className="admin-page su-config-page">
      <h1>Platform Configuration <span className="su-page-badge" style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '999px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', marginLeft: '8px' }}>Super User Only</span></h1>
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
            min="0"
            max="50"
            value={config.mentorMinYearsExperience}
            onChange={(e) => handleChange("mentorMinYearsExperience", e.target.value)}
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
      </div>

      <div className="su-config-actions mt-4">
        <button
          className="btn btn-primary"
          style={{ height: '48px', padding: '0 28px', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem' }}
          onClick={handleSave}
        >
          Commit Changes
        </button>
      </div>
    </div>
  );
};

export default SuperuserConfig;
