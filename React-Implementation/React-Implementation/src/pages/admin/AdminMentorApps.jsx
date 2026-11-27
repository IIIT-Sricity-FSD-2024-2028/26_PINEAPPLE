import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  approveMentorApplication,
  downloadMentorCv,
  fetchMentorApplications,
  rejectMentorApplication,
} from '../../store/thunks/mentorApplicationsThunks';
import { fetchPublicConfig } from '../../store/thunks/platformConfigThunks';
import {
  setAdminMentorAppFilter,
  setAdminMentorSearch,
  setAdminMentorVerificationFilter,
  setOverrideModalAppId,
  setOverrideModalError,
  toggleMentorAppExpanded,
} from '../../store/slices/mentorApplicationsSlice';
import {
  selectAdminMentorApplications,
  selectMentorApplicationsListError,
  selectMentorApplicationsListStatus,
  selectMentorApplicationsWorking,
} from '../../store/selectors/mentorApplicationsSelectors';
import { selectPublicConfig } from '../../store/selectors/platformConfigSelectors';
import Badge from '../../components/common/Badge';
import SearchBar from '../../components/common/SearchBar';
import FilterTabs from '../../components/common/FilterTabs';
import ConfirmModal from '../../components/common/ConfirmModal';
import UniversalReasonModal from '../../components/common/UniversalReasonModal';
import SafeLink from '../../components/common/SafeLink';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/common/EmptyState';
import { CREDENTIAL_STATUS } from '../../constants/credentialStatus';
import './AdminMentorApps.css';

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
  const name = String(source.name || 'Unknown Applicant');
  const initials = String(source.initials || '')
    .trim()
    .toUpperCase();

  let years = Number(source.years ?? source.yearsOfExperience ?? 0);
  if (!years && source.experience) {
    const match = String(source.experience).match(/\d+/);
    if (match) years = parseInt(match[0], 10);
  }

  let expertise = Array.isArray(source.expertise)
    ? source.expertise.join(', ')
    : source.expertise || '';
  if (!expertise && Array.isArray(source.skills)) {
    expertise = source.skills.join(', ');
  }
  if (!expertise) expertise = 'General Mentorship';

  const motivation = source.motivation || source.bio || 'No motivation provided.';

  let submittedAt = source.submittedAt || '';
  if (!submittedAt && source.applicationDate) {
    try {
      submittedAt = new Date(source.applicationDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      submittedAt = source.applicationDate;
    }
  }
  if (!submittedAt) submittedAt = 'Recently';

  const specialization = String(
    source.specialization || (expertise ? expertise.split(',')[0].trim() : 'General'),
  );

  const certificates = Array.isArray(source.certificates) ? source.certificates : [];
  const excludedCertificates = Array.isArray(source.excludedCertificates) ? source.excludedCertificates : [];

  const verifiedCertificates = certificates.filter(
    (c) => c.status === CREDENTIAL_STATUS.VERIFIED || c.verificationStatus === 'verified',
  );
  const unverifiedCertificates = [
    ...certificates.filter((c) => !(c.status === CREDENTIAL_STATUS.VERIFIED || c.verificationStatus === 'verified')),
    ...excludedCertificates,
  ];

  const verifiedCount = verifiedCertificates.length;
  const unverifiedCount = unverifiedCertificates.length;
  const totalCredentials = verifiedCount + unverifiedCount;

  let verificationStatusCategory = 'no_verified';
  if (verifiedCount > 0 && unverifiedCount === 0) {
    verificationStatusCategory = 'fully_verified';
  } else if (verifiedCount > 0 && unverifiedCount > 0) {
    verificationStatusCategory = 'has_unverified';
  } else if (verifiedCount === 0) {
    verificationStatusCategory = 'no_verified';
  }

  return {
    id: String(source.id || `mentor-app-${index + 1}`),
    name,
    initials:
      initials ||
      name
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() ||
      'MA',
    university: String(source.university || source.institution || ''),
    submittedAt,
    expertise,
    specialization,
    linkedin: String(source.linkedin || source.portfolio || '#'),
    years,
    experienceText: typeof source.experience === 'string' ? source.experience : '',
    motivation,
    status: String(source.status || 'pending').toLowerCase(),
    cvFileName: source.cvFileName,
    cvOriginalName: source.cvOriginalName,
    cvFileSize: source.cvFileSize,
    cvUrl: source.cvUrl,
    certificates,
    excludedCertificates,
    verifiedCount,
    unverifiedCount,
    totalCredentials,
    verificationStatusCategory,
    approvalOverrideNote: source.approvalOverrideNote || '',
    rejectionReason: source.rejectionReason,
  };
}

function toTitleCase(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ─── Main Component ──────────────────────────────────────────────

const AdminMentorAppsContent = () => {
  const dispatch = useDispatch();

  const applications = useSelector(selectAdminMentorApplications);
  const listStatus = useSelector(selectMentorApplicationsListStatus);
  const listError = useSelector(selectMentorApplicationsListError);
  const working = useSelector(selectMentorApplicationsWorking);
  const publicConfig = useSelector(selectPublicConfig);

  const loading = listStatus === 'idle' || (listStatus === 'loading' && applications.length === 0);
  const error = listError?.serverMessage || listError?.message || null;
  const filter = working.adminFilter || 'pending';
  const verificationFilter = working.verificationFilter || 'all';
  const searchQuery = working.adminSearch || '';
  const expandedIds = working.expandedIds || {};
  const minYearsRequired =
    publicConfig?.mentorMinYearsExperience !== undefined
      ? Number(publicConfig.mentorMinYearsExperience)
      : 4;

  const [processingId, setProcessingId] = useState(null);
  const [rejectModalApp, setRejectModalApp] = useState(null);
  const [overrideNoteInput, setOverrideNoteInput] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const toastTimeoutRef = useRef(null);

  const overrideModalApp = working.overrideModalAppId
    ? applications.find((a) => String(a.id) === String(working.overrideModalAppId)) || null
    : null;
  const overrideError = working.overrideError || '';

  const showToast = (message, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4500);
  };

  useEffect(() => {
    dispatch(fetchPublicConfig());
    dispatch(fetchMentorApplications());

    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [dispatch]);

  const handleToggleDetails = (id, currentStatus) => {
    dispatch(toggleMentorAppExpanded({ id, currentStatus }));
  };

  const handleApprove = async (app, override = false, overrideNote = '') => {
    const normalized = normalizeMentorApp(app);
    if (normalized.years < minYearsRequired) {
      showToast(`❌ Cannot approve: Applicant has less than ${minYearsRequired} years of experience`, 'error');
      return;
    }

    // Require verified credentials unless explicitly overridden with a note
    if (normalized.verifiedCount === 0 && !override) {
      dispatch(setOverrideModalAppId(app.id));
      setOverrideNoteInput('');
      return;
    }

    setProcessingId(app.id);
    try {
      const payload = override
        ? { overrideVerification: true, overrideNote: overrideNote.trim() }
        : undefined;
      await dispatch(approveMentorApplication({ id: app.id, payload })).unwrap();
      showToast(
        override
          ? `Mentor application for ${normalized.name} approved with administrative verification override.`
          : `Mentor application for ${normalized.name} approved successfully.`,
        'success',
      );
      dispatch(setOverrideModalAppId(null));
      dispatch(fetchMentorApplications());
    } catch (err) {
      const msg = err?.serverMessage || err?.message || 'Failed to approve mentor application';
      if (msg.includes('0 verified') || msg.includes('override') || msg.includes('409')) {
        dispatch(setOverrideModalAppId(app.id));
        setOverrideNoteInput('');
        dispatch(setOverrideModalError(msg));
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmOverride = async () => {
    if (!overrideModalApp) return;
    if (!overrideNoteInput.trim()) {
      dispatch(
        setOverrideModalError(
          'A justification note is required to approve an applicant without verified credentials.',
        ),
      );
      return;
    }
    await handleApprove(overrideModalApp, true, overrideNoteInput.trim());
  };

  const handleOpenRejectModal = (app) => {
    setRejectModalApp(app);
  };

  const handleConfirmReject = async ({ reasons, explanation }) => {
    if (!rejectModalApp) return;
    setProcessingId(rejectModalApp.id);
    try {
      const reason = explanation || reasons.join(', ');
      const payload = {
        reasons,
        explanation,
        reason,
        feedback: {
          reasons,
          explanation,
        },
      };
      await dispatch(rejectMentorApplication({ id: rejectModalApp.id, payload })).unwrap();
      showToast(`Mentor application for ${rejectModalApp.name} rejected.`, 'info');
      setRejectModalApp(null);
      dispatch(fetchMentorApplications());
    } catch (err) {
      const msg = err?.serverMessage || err?.message || 'Failed to reject mentor application';
      showToast(msg, 'error');
      throw err;
    } finally {
      setProcessingId(null);
    }
  };

  const handleDownloadCv = async (filename, originalName) => {
    try {
      await dispatch(downloadMentorCv({ filename, originalName })).unwrap();
    } catch (err) {
      showToast(err?.serverMessage || err?.message || 'Failed to download CV file.', 'error');
    }
  };

  const normalizedApps = applications.map(normalizeMentorApp);

  const pendingCount = normalizedApps.filter((a) => a.status === 'pending').length;
  const approvedCount = normalizedApps.filter((a) => a.status === 'approved').length;
  const rejectedCount = normalizedApps.filter((a) => a.status === 'rejected').length;
  const totalCount = normalizedApps.length;

  const fullyVerifiedCount = normalizedApps.filter((a) => a.verificationStatusCategory === 'fully_verified').length;
  const hasUnverifiedCount = normalizedApps.filter((a) => a.verificationStatusCategory === 'has_unverified').length;
  const noVerifiedCount = normalizedApps.filter((a) => a.verificationStatusCategory === 'no_verified').length;

  const filteredApps = normalizedApps.filter((a) => {
    const matchesFilter = filter === 'all' || a.status === filter;
    if (!matchesFilter) return false;

    const matchesVerification =
      verificationFilter === 'all' || a.verificationStatusCategory === verificationFilter;
    if (!matchesVerification) return false;

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
              onChange={(e) => dispatch(setAdminMentorSearch(e.target.value))}
              onClear={() => dispatch(setAdminMentorSearch(''))}
              placeholder="Search mentor applicants..."
            />
            <FilterTabs
              tabs={[
                { id: 'pending', label: 'Pending', count: pendingCount },
                { id: 'approved', label: 'Approved', count: approvedCount },
                { id: 'rejected', label: 'Rejected', count: rejectedCount },
                { id: 'all', label: 'All', count: totalCount },
              ]}
              activeTab={filter}
              onChange={(val) => dispatch(setAdminMentorAppFilter(val))}
            />
          </div>

          {/* Verification Status Filter Tabs */}
          <div className="admin-mentor-toolbar mt-2" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted-fg)' }}>
              Verification:
            </span>
            <FilterTabs
              tabs={[
                { id: 'all', label: 'All', count: totalCount },
                { id: 'fully_verified', label: 'Fully verified', count: fullyVerifiedCount },
                { id: 'has_unverified', label: 'Has unverified', count: hasUnverifiedCount },
                { id: 'no_verified', label: 'No verified', count: noVerifiedCount },
              ]}
              activeTab={verificationFilter}
              onChange={(val) => dispatch(setAdminMentorVerificationFilter(val))}
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
                message={searchQuery ? `No applications found matching "${searchQuery}".` : 'No applications in this category.'}
              />
            ) : (
              filteredApps.map((app) => {
                const isExpanded =
                  expandedIds[app.id] !== undefined
                    ? expandedIds[app.id]
                    : app.status === 'pending';
                const statusText = toTitleCase(app.status);
                const meetsCriteria = app.years >= minYearsRequired;
                const isProcessing = processingId === app.id;

                return (
                  <div
                    key={app.id}
                    className={`admin-mentor-card ${app.status === 'pending' ? 'pending' : ''}`}
                  >
                    <button
                      type="button"
                      className="admin-mentor-head"
                      onClick={() => handleToggleDetails(app.id, app.status)}
                    >
                      <div className="admin-mentor-left">
                        <Avatar name={app.name} src={app.avatarUrl || app.avatar} version={app.updatedAt} size="md" />
                        <div>
                          <div className="admin-mentor-name">{app.name}</div>
                          <div className="admin-mentor-sub">
                            {app.university ? `${app.university} · ` : ''}Submitted {app.submittedAt}
                          </div>
                        </div>
                      </div>
                      <div className="admin-mentor-right">
                        <div className="admin-mentor-spec">{app.specialization}</div>
                        <span className="admin-mentor-cred-chip" title={`${app.verifiedCount} of ${app.totalCredentials} credentials verified`}>
                          🛡️ {app.totalCredentials > 0 ? `${app.verifiedCount} of ${app.totalCredentials} verified` : '0 verified'}
                        </span>
                        <Badge variant={app.status}>{statusText}</Badge>
                        <span className="admin-mentor-chevron">
                          {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        </span>
                      </div>
                    </button>

                    <div className={`admin-mentor-details${isExpanded ? ' open' : ''}`}>
                      <div className="admin-mentor-grid">
                        <div>
                          <div className="admin-mentor-label">Expertise</div>
                          <div className="admin-mentor-value">{app.expertise}</div>
                        </div>
                        <div>
                          <div className="admin-mentor-label">Experience</div>
                          <div className="admin-mentor-value">
                            {app.years} years (Min. {minYearsRequired} required)
                            <Badge variant={meetsCriteria ? 'criteria-met' : 'criteria-unmet'}>
                              <span className="admin-mentor-icon" style={{ display: 'inline-flex', marginRight: '4px' }}>
                                {meetsCriteria ? <CheckIcon /> : <CrossIcon />}
                              </span>
                              {meetsCriteria ? 'Meets criteria' : 'Below criteria'}
                            </Badge>
                          </div>
                          {app.experienceText && !app.experienceText.startsWith(`${app.years} years of professional experience`) && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                              {app.experienceText}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="admin-mentor-label">LinkedIn</div>
                          <SafeLink className="admin-mentor-link" href={app.linkedin}>
                            View Profile ↗
                          </SafeLink>
                        </div>
                        <div>
                          <div className="admin-mentor-label">University</div>
                          <div className="admin-mentor-value">{app.university || 'Not specified'}</div>
                        </div>
                      </div>

                      <div className="admin-mentor-label mt-3">Motivation</div>
                      <blockquote className="admin-mentor-quote">
                        &quot;{app.motivation}&quot;
                      </blockquote>

                      {/* Rejection Reason Notice if rejected */}
                      {app.status === 'rejected' && app.rejectionReason && (
                        <div className="admin-rejection-alert mt-3">
                          <strong>Rejection Reason:</strong> {app.rejectionReason}
                        </div>
                      )}

                      {/* Administrative Exception Note if approved without verification */}
                      {app.approvalOverrideNote && (
                        <div className="admin-override-notice mt-3">
                          <strong>⚠️ Administrative Exception Note:</strong> {app.approvalOverrideNote}
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="admin-mentor-label">
                            🛡️ DigiLocker Verified Credentials ({app.verifiedCount})
                          </div>
                          <Badge variant={app.verifiedCount > 0 ? 'verified' : 'unverified'}>
                            {app.verifiedCount > 0 ? `${app.verifiedCount} of ${app.totalCredentials} Verified` : '0 Verified'}
                          </Badge>
                        </div>
                        {app.certificates.length > 0 ? (
                          <div className="admin-doc-grid">
                            {app.certificates.map((cert, idx) => {
                              const isDocVerified =
                                cert.status === CREDENTIAL_STATUS.VERIFIED ||
                                cert.verificationStatus === 'verified';
                              return (
                                <div key={idx} className="admin-doc-card">
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <strong style={{ fontSize: '0.85rem' }}>{cert.title || cert.name || cert.documentType}</strong>
                                    <Badge variant={isDocVerified ? 'verified' : 'name-mismatch'} style={{ fontSize: '0.7rem' }}>
                                      {isDocVerified ? '✓ Verified' : '⚠️ Name Mismatch'}
                                    </Badge>
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
                                  {cert.verificationId && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--muted-fg)', marginTop: '2px' }}>
                                      Verif ID: {cert.verificationId}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: 'var(--muted-fg)', marginTop: '4px' }}>
                            No verified credentials linked.
                          </div>
                        )}
                      </div>

                      {/* Excluded / Unverified Credentials Section */}
                      {app.excludedCertificates.length > 0 && (
                        <div className="mt-3">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="admin-mentor-label" style={{ color: '#b91c1c' }}>
                              ⚠️ Excluded / Unverified Credentials ({app.excludedCertificates.length})
                            </div>
                            <Badge variant="name-mismatch">Excluded</Badge>
                          </div>
                          <div className="admin-doc-grid">
                            {app.excludedCertificates.map((cert, idx) => (
                              <div
                                key={`ex-${idx}`}
                                className="admin-doc-card"
                                style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.04)' }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <strong style={{ fontSize: '0.85rem' }}>{cert.title || cert.name || cert.documentType}</strong>
                                  <Badge variant="name-mismatch" style={{ fontSize: '0.7rem' }}>
                                    {cert.status === CREDENTIAL_STATUS.NAME_MISMATCH || cert.verificationStatus === 'mismatch'
                                      ? '⚠️ Name Mismatch'
                                      : 'Unverified'}
                                  </Badge>
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
                                {cert.mismatchReason && (
                                  <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px' }}>
                                    ⚠️ {cert.mismatchReason}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

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
      {toast.visible && (
        <div className={`admin-mentor-toast ${toast.type}`}>
          <span className="admin-mentor-toast-icon">
            {toast.type === 'success' && '✓'}
            {toast.type === 'error' && '✕'}
            {toast.type === 'info' && 'ℹ'}
          </span>
          <span className="admin-mentor-toast-text">{toast.message}</span>
          <button
            type="button"
            className="admin-mentor-toast-close"
            onClick={() => setToast((prev) => ({ ...prev, visible: false }))}
          >
            ✕
          </button>
        </div>
      )}

      {/* Universal Reason Modal for Rejecting Mentor Applications */}
      <UniversalReasonModal
        isOpen={Boolean(rejectModalApp)}
        onClose={() => {
          if (processingId !== rejectModalApp?.id) setRejectModalApp(null);
        }}
        onConfirm={handleConfirmReject}
        actionType="ADMIN_REJECT_MENTOR_APP"
        entityName={rejectModalApp ? `${rejectModalApp.name}'s Mentor Application` : 'Mentor Application'}
      />

      {/* Override Verification Approval Modal */}
      {overrideModalApp && (
        <ConfirmModal
          isOpen={Boolean(overrideModalApp)}
          title="Approve Without Verification"
          variant="warning"
          confirmLabel="Approve with Exception"
          cancelLabel="Cancel"
          loading={processingId === overrideModalApp.id}
          onConfirm={handleConfirmOverride}
          onCancel={() => {
            dispatch(setOverrideModalAppId(null));
          }}
          message={
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.875rem', color: 'var(--fg, #0f172a)' }}>
                <strong>{overrideModalApp.name}</strong> has <strong>0 verified credentials</strong>. Platform policy strictly refuses approval without verified credentials unless granted an explicit administrative exception.
              </p>
              {overrideError && (
                <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '8px' }}>
                  {overrideError}
                </div>
              )}
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--fg, #0f172a)' }}>
                Administrative Override Note (Required) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #cbd5e1)',
                  background: 'var(--card, #ffffff)',
                  color: 'var(--fg, #0f172a)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
                placeholder="State the justification note for approving without verified credentials (recorded in audit log)..."
                value={overrideNoteInput}
                onChange={(e) => {
                  setOverrideNoteInput(e.target.value);
                  if (e.target.value.trim()) dispatch(setOverrideModalError(''));
                }}
              />
            </div>
          }
        />
      )}
    </div>
  );
};

const AdminMentorApps = AdminMentorAppsContent;
export default AdminMentorApps;
