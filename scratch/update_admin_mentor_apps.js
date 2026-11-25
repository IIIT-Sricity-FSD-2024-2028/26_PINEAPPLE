const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../React-Implementation/React-Implementation/src/pages/admin/AdminMentorApps.jsx');

const content = `import { useState, useEffect } from 'react';
import mentorApplicationsApi from '../../services/mentorApplicationsApi';
import uploadsApi from '../../services/uploadsApi';
import Badge from '../../components/common/Badge';
import SearchBar from '../../components/common/SearchBar';
import FilterTabs from '../../components/common/FilterTabs';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/common/EmptyState';
import './AdminMentorApps.css';

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return \`\${bytes} B\`;
  if (bytes < 1024 * 1024) return \`\${(bytes / 1024).toFixed(1)} KB\`;
  return \`\${(bytes / (1024 * 1024)).toFixed(2)} MB\`;
}

// ─── Componentized SVGs ──────────────────────────────────────────

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
    <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4l3.3 3.3 6.4-6.4a1 1 0 0 1 1.4 0z" />
  </svg>
);

const CrossIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
    <path d="M5.7 4.3 10 8.6l4.3-4.3a1 1 0 1 1 1.4 1.4L11.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 0 1-1.4-1.4L8.6 10 4.3 5.7a1 1 0 1 1 1.4-1.4z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
    <path d="M5.2 7.6a1 1 0 0 1 1.4 0L10 11l3.4-3.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L5.2 9a1 1 0 0 1 0-1.4z" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
    <path d="M14.8 12.4a1 1 0 0 1-1.4 0L10 9l-3.4 3.4a1 1 0 1 1-1.4-1.4l4.1-4.1a1 1 0 0 1 1.4 0l4.1 4.1a1 1 0 0 1 0 1.4z" />
  </svg>
);

// ─── Normalization Helper ────────────────────────────────────────

function normalizeMentorApp(source = {}, index = 0) {
  const name = String(source.name || "Unknown Applicant");
  const initials = String(source.initials || "")
    .trim()
    .toUpperCase();

  let years = Number(source.years ?? source.yearsOfExperience ?? 0);
  if (!years && source.experience) {
    const match = String(source.experience).match(/\\d+/);
    if (match) years = parseInt(match[0], 10);
  }

  let expertise = source.expertise || "";
  if (!expertise && Array.isArray(source.skills)) {
    expertise = source.skills.join(", ");
  }
  if (!expertise) expertise = "General Mentorship";

  const motivation = source.motivation || source.bio || "No motivation provided.";

  let submittedAt = source.submittedAt || "";
  if (!submittedAt && source.applicationDate) {
    try {
      submittedAt = new Date(source.applicationDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      submittedAt = source.applicationDate;
    }
  }
  if (!submittedAt) submittedAt = "Recently";

  const specialization = String(
    source.specialization || (expertise ? expertise.split(",")[0].trim() : "General")
  );

  return {
    id: String(source.id || \`mentor-app-\${index + 1}\`),
    name,
    initials:
      initials ||
      name
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "MA",
    university: String(source.university || source.institution || ""),
    submittedAt,
    expertise,
    specialization,
    linkedin: String(source.linkedin || source.portfolio || "#"),
    years,
    experienceText: typeof source.experience === 'string' ? source.experience : '',
    motivation,
    status: String(source.status || "pending").toLowerCase(),
    cvFileName: source.cvFileName,
    cvOriginalName: source.cvOriginalName,
    cvFileSize: source.cvFileSize,
    cvUrl: source.cvUrl,
    certificates: Array.isArray(source.certificates) ? source.certificates : [],
    rejectionReason: source.rejectionReason,
  };
}

function toTitleCase(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ─── Main Component ──────────────────────────────────────────────

const AdminMentorApps = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState({});
  const [processingId, setProcessingId] = useState(null);

  // Reject Reason Modal State
  const [rejectModalApp, setRejectModalApp] = useState(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadApplications = async () => {
      try {
        const data = await mentorApplicationsApi.list();
        if (isMounted) {
          setApplications(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to load mentor applications:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load mentor applications.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadApplications();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleDetails = (id, currentStatus) => {
    setExpandedIds((prev) => {
      const isCurrentlyOpen =
        prev[id] !== undefined ? prev[id] : currentStatus === 'pending';
      return {
        ...prev,
        [id]: !isCurrentlyOpen,
      };
    });
  };

  const handleApprove = async (app) => {
    const normalized = normalizeMentorApp(app);
    if (normalized.years < 4) {
      alert("❌ Cannot approve: Applicant has less than 4 years of experience");
      return;
    }

    setProcessingId(app.id);
    try {
      await mentorApplicationsApi.approve(app.id);
      setApplications((prev) =>
        prev.map((item) =>
          item.id === app.id ? { ...item, status: 'approved' } : item
        )
      );
    } catch (err) {
      console.error('Failed to approve mentor application:', err);
      alert(err.message || 'Failed to approve mentor application');
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenRejectModal = (app) => {
    setRejectModalApp(app);
    setRejectReasonInput('Application did not meet minimum criteria or credential standards.');
  };

  const handleConfirmReject = async () => {
    if (!rejectModalApp) return;
    setProcessingId(rejectModalApp.id);
    try {
      const reason = rejectReasonInput.trim() || 'Application did not meet requirements.';
      await mentorApplicationsApi.reject(rejectModalApp.id, { reason });
      setApplications((prev) =>
        prev.map((item) =>
          item.id === rejectModalApp.id ? { ...item, status: 'rejected', rejectionReason: reason } : item
        )
      );
      setRejectModalApp(null);
    } catch (err) {
      console.error('Failed to reject mentor application:', err);
      alert(err.message || 'Failed to reject mentor application');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDownloadCv = async (filename, originalName) => {
    try {
      const blob = await uploadsApi.downloadCv(filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName || filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err.message || 'Failed to download CV file.');
    }
  };

  const handleDeleteCv = async (appId) => {
    if (!window.confirm('Are you sure you want to delete this applicant\\'s CV file? This cannot be undone.')) {
      return;
    }
    setProcessingId(appId);
    try {
      await mentorApplicationsApi.deleteCv(appId);
      setApplications((prev) =>
        prev.map((item) =>
          item.id === appId ? { ...item, cvFileName: null, cvUrl: null } : item
        )
      );
      alert('CV file was permanently deleted.');
    } catch (err) {
      alert(err.message || 'Failed to delete CV file');
    } finally {
      setProcessingId(null);
    }
  };

  const normalizedApps = applications.map(normalizeMentorApp);

  const pendingCount = normalizedApps.filter((a) => a.status === 'pending').length;
  const approvedCount = normalizedApps.filter((a) => a.status === 'approved').length;
  const rejectedCount = normalizedApps.filter((a) => a.status === 'rejected').length;
  const totalCount = normalizedApps.length;

  const filteredApps = normalizedApps.filter((a) => {
    const matchesFilter = filter === 'all' || a.status === filter;
    if (!matchesFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.expertise.toLowerCase().includes(q) ||
      a.university.toLowerCase().includes(q)
    );
  });

  return (
    <div id="admin-mentor-apps" className="admin-page">
      <h1>Mentor Applications</h1>
      <p className="page-subtitle mt-1">Review and approve mentor applications</p>

      {/* DigiLocker Sandbox Active Notice */}
      <div className="admin-digilocker-banner mt-3">
        <span style={{ fontSize: '1.25rem' }}>🛡️</span>
        <div>
          <strong>Simulated DigiLocker Verification Active (Demo Mode)</strong>
          <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
            Credential verification and issuer records are simulated against the DigiLocker Sandbox API for testing and viva demonstration.
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div id="admin-mentor-list">
          {/* Eligibility Criteria */}
          <div className="admin-mentor-criteria">
            <div className="admin-mentor-criteria-title">Eligibility Criteria</div>
            <div className="admin-mentor-criteria-tags">
              <span className="admin-mentor-criteria-tag">
                <span className="admin-mentor-icon"><CheckIcon /></span>
                Min. 4-5 years professional experience
              </span>
              <span className="admin-mentor-criteria-tag">
                <span className="admin-mentor-icon"><CheckIcon /></span>
                Verified CV (.pdf, &le; 5MB, verified %PDF-)
              </span>
              <span className="admin-mentor-criteria-tag">
                <span className="admin-mentor-icon"><CheckIcon /></span>
                At least 1 verified DigiLocker credential
              </span>
              <span className="admin-mentor-criteria-tag">
                <span className="admin-mentor-icon"><CheckIcon /></span>
                Complete LinkedIn / Portfolio URL
              </span>
            </div>
          </div>

          {/* Filter and Search Toolbar */}
          <div className="admin-mentor-toolbar mt-3" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <SearchBar
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              placeholder="Search mentor applicants..."
            />
            <FilterTabs
              tabs={[
                { id: 'pending', label: 'Pending', count: pendingCount },
                { id: 'approved', label: 'Approved', count: approvedCount },
                { id: 'rejected', label: 'Rejected', count: rejectedCount },
                { id: 'all', label: 'All', count: totalCount }
              ]}
              activeTab={filter}
              onChange={setFilter}
            />
          </div>

          {/* Applications List */}
          <div className="admin-mentor-list-wrap mt-3">
            {loading ? (
              <div className="admin-users-empty">Loading mentor applications...</div>
            ) : error ? (
              <div className="admin-users-empty" style={{ color: 'var(--destructive)' }}>
                {error}
              </div>
            ) : filteredApps.length === 0 ? (
              <EmptyState
                title="No mentor applications"
                message={searchQuery ? \`No applications found matching "\${searchQuery}".\` : "No applications in this category."}
              />
            ) : (
              filteredApps.map((app) => {
                const isExpanded =
                  expandedIds[app.id] !== undefined
                    ? expandedIds[app.id]
                    : app.status === 'pending';
                const statusText = toTitleCase(app.status);
                const meetsCriteria = app.years >= 4;
                const isProcessing = processingId === app.id;

                return (
                  <div
                    key={app.id}
                    className={\`admin-mentor-card \${app.status === 'pending' ? 'pending' : ''}\`}
                  >
                    <button
                      type="button"
                      className="admin-mentor-head"
                      onClick={() => handleToggleDetails(app.id, app.status)}
                    >
                      <div className="admin-mentor-left">
                        <Avatar name={app.name} size="md" />
                        <div>
                          <div className="admin-mentor-name">{app.name}</div>
                          <div className="admin-mentor-sub">
                            {app.university ? \`\${app.university} · \` : ''}Submitted {app.submittedAt}
                          </div>
                        </div>
                      </div>
                      <div className="admin-mentor-right">
                        <div className="admin-mentor-spec">{app.specialization}</div>
                        <Badge variant={app.status}>{statusText}</Badge>
                        <span className="admin-mentor-chevron">
                          {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        </span>
                      </div>
                    </button>

                    <div className={\`admin-mentor-details\${isExpanded ? ' open' : ''}\`}>
                      <div className="admin-mentor-grid">
                        <div>
                          <div className="admin-mentor-label">Expertise</div>
                          <div className="admin-mentor-value">{app.expertise}</div>
                        </div>
                        <div>
                          <div className="admin-mentor-label">Experience</div>
                          <div className="admin-mentor-value">
                            {app.years} years
                            <Badge variant={meetsCriteria ? 'criteria-met' : 'criteria-unmet'}>
                              <span className="admin-mentor-icon" style={{ display: 'inline-flex', marginRight: '4px' }}>
                                {meetsCriteria ? <CheckIcon /> : <CrossIcon />}
                              </span>
                              {meetsCriteria ? 'Meets criteria' : 'Below criteria'}
                            </Badge>
                          </div>
                          {app.experienceText && !app.experienceText.startsWith(\`\${app.years} years of professional experience\`) && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                              {app.experienceText}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="admin-mentor-label">LinkedIn</div>
                          <a
                            className="admin-mentor-link"
                            href={app.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View Profile ↗
                          </a>
                        </div>
                        <div>
                          <div className="admin-mentor-label">University</div>
                          <div className="admin-mentor-value">{app.university || 'Not specified'}</div>
                        </div>
                      </div>

                      <div className="admin-mentor-label mt-3">Motivation</div>
                      <blockquote className="admin-mentor-quote">
                        "{app.motivation}"
                      </blockquote>

                      {/* Rejection Reason Notice if rejected */}
                      {app.status === 'rejected' && app.rejectionReason && (
                        <div className="admin-rejection-alert mt-3">
                          <strong>Rejection Reason:</strong> {app.rejectionReason}
                        </div>
                      )}

                      {/* Verified CV Section */}
                      <div className="mt-3">
                        <div className="admin-mentor-label">Submitted Curriculum Vitae (CV)</div>
                        {app.cvFileName ? (
                          <div className="admin-cv-box mt-1">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '1.2rem' }}>📄</span>
                              <div>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                  {app.cvOriginalName || app.cvFileName}
                                </span>
                                {app.cvFileSize && (
                                  <span style={{ fontSize: '0.8rem', color: 'var(--muted-fg)', marginLeft: '8px' }}>
                                    ({formatBytes(app.cvFileSize)})
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                className="btn btn-outline"
                                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                                onClick={() => handleDownloadCv(app.cvFileName, app.cvOriginalName)}
                              >
                                View / Download CV
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline"
                                style={{ padding: '4px 10px', fontSize: '0.8rem', color: '#dc2626' }}
                                onClick={() => handleDeleteCv(app.id)}
                                disabled={isProcessing}
                              >
                                Delete CV (Privacy)
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: 'var(--muted-fg)', marginTop: '4px' }}>
                            No CV file attached or file was removed for privacy.
                          </div>
                        )}
                      </div>

                      {/* DigiLocker Verified Credentials Section */}
                      <div className="mt-3">
                        <div className="admin-mentor-label">
                          🛡️ DigiLocker Verified Credentials ({app.certificates.length})
                        </div>
                        {app.certificates.length > 0 ? (
                          <div className="admin-doc-grid">
                            {app.certificates.map((cert, idx) => (
                              <div key={idx} className="admin-doc-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <strong style={{ fontSize: '0.85rem' }}>{cert.title || cert.name}</strong>
                                  <span
                                    className={\`tf-mentor-digilocker-badge \${cert.verificationStatus === 'verified' ? 'verified' : 'mismatch'}\`}
                                    style={{ fontSize: '0.7rem' }}
                                  >
                                    {cert.verificationStatus === 'verified' ? '✓ Verified' : '⚠️ Name Mismatch'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--muted-fg)' }}>
                                  <strong>Issuer:</strong> {cert.issuer}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--muted-fg)' }}>
                                  <strong>Holder:</strong> {cert.holderName}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                  Doc #{cert.documentNumber} · Issued {cert.issueDate}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: 'var(--muted-fg)', marginTop: '4px' }}>
                            No DigiLocker credentials linked.
                          </div>
                        )}
                      </div>

                      {app.status === 'pending' && (
                        <div className="admin-mentor-actions mt-3">
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleApprove(app)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? 'Processing...' : 'Approve Application'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => handleOpenRejectModal(app)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? 'Processing...' : 'Reject Application'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Reject Reason Modal */}
      {rejectModalApp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--card, #ffffff)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--fg, #0f172a)' }}>
              Reject Mentor Application
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: 'var(--muted-fg, #64748b)' }}>
              Provide a reason for rejecting <strong>{rejectModalApp.name}</strong>'s application. This will be visible to the applicant.
            </p>
            <textarea
              style={{
                width: '100%',
                minHeight: '90px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: '0.9rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
              value={rejectReasonInput}
              onChange={(e) => setRejectReasonInput(e.target.value)}
              placeholder="Enter rejection reason..."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setRejectModalApp(null)}
                disabled={processingId === rejectModalApp.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                onClick={handleConfirmReject}
                disabled={processingId === rejectModalApp.id}
              >
                {processingId === rejectModalApp.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMentorApps;
`;

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully wrote updated AdminMentorApps.jsx');
