import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import joinRequestsApi from '../../services/joinRequestsApi';
import projectsApi from '../../services/projectsApi';
import './appliedProjects.css';

/* ── Extracted SVG Sub-components ── */
const ClipboardListIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

const AppliedProjects = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const effectiveUserId = user?.id || (typeof localStorage !== 'undefined' && localStorage.getItem('teamforge.backendUserId')) || '';

  useEffect(() => {
    fetchApplications();
  }, [effectiveUserId]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const [requests, allProjects] = await Promise.all([
        joinRequestsApi.list({ userId: effectiveUserId }).catch(() => []),
        projectsApi.list().catch(() => []),
      ]);

      const projectsMap = new Map();
      if (Array.isArray(allProjects)) {
        allProjects.forEach((p) => projectsMap.set(p.id, p));
      }

      const enriched = (Array.isArray(requests) ? requests : []).map((req) => {
        const matchedProject = projectsMap.get(req.projectId) || {};
        return {
          id: req.id,
          projectId: req.projectId,
          project: matchedProject.title || matchedProject.name || req.projectName || 'Project',
          owner: matchedProject.owner || req.owner || 'Project Owner',
          applied: req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Recent',
          status: req.status || 'Pending',
        };
      });

      setApplications(enriched);
    } catch (err) {
      console.error('Failed to load applied projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (requestId, projectId) => {
    try {
      await joinRequestsApi.respond(requestId, 'Approved');
      fetchApplications();
      navigate(`/workspace/${projectId}`);
    } catch (err) {
      console.error('Failed to accept invite:', err);
    }
  };

  const handleDeclineInvite = async (requestId) => {
    try {
      await joinRequestsApi.respond(requestId, 'Rejected');
      fetchApplications();
    } catch (err) {
      console.error('Failed to decline invite:', err);
    }
  };

  const handleDeleteRequest = async (requestId) => {
    setDeletingId(requestId);
    setFeedback(null);
    try {
      await joinRequestsApi.remove(requestId);
      setApplications((prev) => prev.filter((item) => item.id !== requestId));
      setFeedback({ type: 'success', message: 'Application request cancelled successfully.' });
      setTimeout(() => setFeedback(null), 3500);
      fetchApplications();
    } catch (err) {
      if (err.message && (err.message.toLowerCase().includes('not found') || err.message.includes('404'))) {
        setApplications((prev) => prev.filter((item) => item.id !== requestId));
        setFeedback({ type: 'success', message: 'Application request was already removed.' });
        setTimeout(() => setFeedback(null), 3500);
      } else {
        console.error('Failed to cancel application request:', err);
        setFeedback({ type: 'error', message: err.message || 'Failed to cancel application request.' });
      }
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Approved':
      case 'Completed':
        return 'tf-applied-badge-success';
      case 'Pending':
      case 'Invited':
        return 'tf-applied-badge-warning';
      case 'Rejected':
        return 'tf-applied-badge-destructive';
      case 'Deleted':
        return 'tf-applied-badge-outline';
      default:
        return 'tf-applied-badge-outline';
    }
  };

  return (
    <div className="tf-applied-container">
      <div className="tf-applied-header">
        <h1 className="tf-applied-title">Applied Projects</h1>
        <p className="tf-applied-subtitle">Track the status of your project applications.</p>
        {feedback && (
          <div className={`tf-applied-feedback ${feedback.type === 'error' ? 'tf-applied-feedback-error' : 'tf-applied-feedback-success'}`}>
            {feedback.message}
          </div>
        )}
      </div>

      <div className="tf-applied-card">
        <div className="tf-applied-table-header">
          <span>Project</span>
          <span>Owner</span>
          <span>Applied</span>
          <span>Status</span>
        </div>

        <div id="applied-list">
          {loading ? (
            <div className="tf-applied-empty-state">
              <p>Loading application statuses...</p>
            </div>
          ) : applications.length > 0 ? (
            applications.map((item) => (
              <div key={item.id} className="tf-applied-row">
                <span className="tf-applied-project-name">{item.project}</span>
                <span className="tf-applied-owner">{item.owner}</span>
                <span className="tf-applied-date">{item.applied}</span>
                <div className="tf-applied-status-wrap">
                  {item.status === 'Invited' ? (
                    <>
                      <button
                        type="button"
                        className="tf-applied-btn-sm tf-applied-btn-primary"
                        onClick={() => handleAcceptInvite(item.id, item.projectId)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="tf-applied-btn-sm tf-applied-btn-outline"
                        onClick={() => handleDeclineInvite(item.id)}
                      >
                        Decline
                      </button>
                    </>
                  ) : item.status === 'Pending' ? (
                    <>
                      <span className={`tf-applied-badge ${getStatusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                      <button
                        type="button"
                        className="tf-applied-btn-sm tf-applied-btn-outline"
                        disabled={deletingId === item.id}
                        onClick={() => handleDeleteRequest(item.id)}
                      >
                        {deletingId === item.id ? 'Deleting...' : 'Delete Request'}
                      </button>
                    </>
                  ) : (
                    <span className={`tf-applied-badge ${getStatusBadgeClass(item.status)}`}>
                      {item.status}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="tf-applied-empty-state">
              <ClipboardListIcon />
              <div className="tf-applied-empty-title">No applications found</div>
              <p>Explore the Marketplace to discover and apply for projects!</p>
              <button
                type="button"
                className="tf-applied-btn-sm tf-applied-btn-primary"
                onClick={() => navigate('/projects')}
              >
                Browse Marketplace
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppliedProjects;
