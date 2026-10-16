import { useState, useEffect } from 'react';
import mentorApplicationsApi from '../../services/mentorApplicationsApi';
import Badge from '../../components/common/Badge';
import SearchBar from '../../components/common/SearchBar';
import FilterTabs from '../../components/common/FilterTabs';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/common/EmptyState';
import './AdminMentorApps.css';

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
    const match = String(source.experience).match(/\d+/);
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
    id: String(source.id || `mentor-app-${index + 1}`),
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
    university: String(source.university || source.institution || "Unknown University"),
    submittedAt,
    expertise,
    specialization,
    linkedin: String(source.linkedin || source.portfolio || "#"),
    years,
    experienceText: typeof source.experience === 'string' ? source.experience : '',
    motivation,
    status: String(source.status || "pending").toLowerCase(),
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

  const handleReject = async (app) => {
    setProcessingId(app.id);
    try {
      await mentorApplicationsApi.reject(app.id);
      setApplications((prev) =>
        prev.map((item) =>
          item.id === app.id ? { ...item, status: 'rejected' } : item
        )
      );
    } catch (err) {
      console.error('Failed to reject mentor application:', err);
      alert(err.message || 'Failed to reject mentor application');
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
                Complete &amp; authentic LinkedIn profile
              </span>
              <span className="admin-mentor-criteria-tag">
                <span className="admin-mentor-icon"><CheckIcon /></span>
                Consistent relevant career history
              </span>
              <span className="admin-mentor-criteria-tag">
                <span className="admin-mentor-icon"><CheckIcon /></span>
                Professional conduct - no misconduct record
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
                message={searchQuery ? `No applications found matching "${searchQuery}".` : "No applications in this category."}
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
                    className={`admin-mentor-card ${app.status === 'pending' ? 'pending' : ''}`}
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
                            {app.university} · Submitted {app.submittedAt}
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

                    <div className={`admin-mentor-details${isExpanded ? ' open' : ''}`}>
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
                          {app.experienceText && !app.experienceText.startsWith(`${app.years} years of professional experience`) && (
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
                          <div className="admin-mentor-value">{app.university}</div>
                        </div>
                      </div>

                      <div className="admin-mentor-label mt-3">Motivation</div>
                      <blockquote className="admin-mentor-quote">
                        "{app.motivation}"
                      </blockquote>

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
                            onClick={() => handleReject(app)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? 'Processing...' : 'Reject'}
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
    </div>
  );
};

export default AdminMentorApps;
