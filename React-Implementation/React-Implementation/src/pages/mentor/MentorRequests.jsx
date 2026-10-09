import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import mentorRequestsApi from '../../services/mentorRequestsApi';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import projectsApi from '../../services/projectsApi';
import './mentorRequests.css';

/* ── Extracted SVG Functional Components ── */
const MoneyIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const MentorRequests = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState({});
  const [feedback, setFeedback] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [directRequests, marketplaceSessions, allProjects] = await Promise.all([
        mentorRequestsApi.list().catch(() => []),
        mentorMarketplaceApi.mentorSessions().catch(() => []),
        projectsApi.list().catch(() => []),
      ]);

      const projectsMap = {};
      if (Array.isArray(allProjects)) {
        allProjects.forEach((p) => {
          projectsMap[p.id] = p;
        });
      }

      const formatted = [];

      // Process direct mentor requests from project owners
      if (Array.isArray(directRequests)) {
        directRequests.forEach((req) => {
          const linkedProj = projectsMap[req.projectId] || {};
          formatted.push({
            id: req.id,
            type: 'direct',
            projectId: req.projectId,
            projectName: linkedProj.name || linkedProj.title || req.projectName || 'Project Mentorship',
            ownerName: linkedProj.owner || req.projectOwnerName || req.projectOwnerId || 'Project Owner',
            projectDesc: linkedProj.desc || linkedProj.description || '',
            message: req.message || 'Owner requested your mentorship.',
            skills: linkedProj.skills || [],
            status: String(req.status || 'pending').toLowerCase(),
            createdAt: req.createdAt || req.requestedOn || new Date().toISOString(),
          });
        });
      }

      // Process paid marketplace mentor sessions
      if (Array.isArray(marketplaceSessions)) {
        marketplaceSessions.forEach((s) => {
          const linkedProj = projectsMap[s.projectId] || {};
          formatted.push({
            id: s.id,
            type: 'marketplace',
            projectId: s.projectId,
            projectName: linkedProj.name || s.projectName || 'Marketplace Session',
            ownerName: linkedProj.owner || s.ownerName || 'Project Owner',
            projectDesc: s.projectDescription || linkedProj.desc || '',
            message: s.notes || s.projectDescription || 'Mentorship session booking awaiting approval.',
            agreedPrice: s.agreedPrice,
            skills: linkedProj.skills || [],
            status: s.status === 'escrow_funded' ? 'pending' : String(s.status || '').toLowerCase(),
            createdAt: s.createdAt || new Date().toISOString(),
          });
        });
      }

      setRequests(formatted);
    } catch (err) {
      console.error('Failed to load mentor requests:', err);
      setFeedback({ type: 'error', message: 'Failed to load mentor requests from the backend.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const handleApprove = async (req) => {
    setActionInProgress((prev) => ({ ...prev, [req.id]: true }));
    setFeedback(null);
    try {
      if (req.type === 'marketplace') {
        await mentorMarketplaceApi.acceptSession(req.id);
      } else {
        await mentorRequestsApi.accept(req.id);
      }

      setFeedback({
        type: 'success',
        message: `Mentorship request for "${req.projectName}" accepted! You now have access to the workspace.`,
      });

      // Update local state to reflect accepted status
      setRequests((prev) =>
        prev.map((item) =>
          item.id === req.id ? { ...item, status: 'accepted' } : item
        )
      );
    } catch (err) {
      console.error('Failed to accept mentor request:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to accept mentorship request.',
      });
    } finally {
      setActionInProgress((prev) => ({ ...prev, [req.id]: false }));
    }
  };

  const handleDecline = async (req) => {
    setActionInProgress((prev) => ({ ...prev, [req.id]: true }));
    setFeedback(null);
    try {
      if (req.type === 'marketplace') {
        await mentorMarketplaceApi.declineSession(req.id);
      } else {
        await mentorRequestsApi.decline(req.id);
      }

      setFeedback({
        type: 'info',
        message: `Mentorship request for "${req.projectName}" was declined.`,
      });

      // Update local state
      setRequests((prev) =>
        prev.map((item) =>
          item.id === req.id ? { ...item, status: 'declined' } : item
        )
      );
    } catch (err) {
      console.error('Failed to decline mentor request:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to decline mentorship request.',
      });
    } finally {
      setActionInProgress((prev) => ({ ...prev, [req.id]: false }));
    }
  };

  return (
    <div className="tf-mentor-req-container">
      <div className="tf-mentor-req-header">
        <h1 className="tf-mentor-req-title">Mentor Requests</h1>
        <p className="tf-mentor-req-subtitle">Project owners requesting your mentorship.</p>
      </div>

      {feedback && (
        <div className={`tf-mentor-req-feedback ${feedback.type}`}>
          <span>{feedback.message}</span>
          <button
            type="button"
            className="tf-mentor-req-btn-outline"
            onClick={() => setFeedback(null)}
          >
            <XIcon />
          </button>
        </div>
      )}

      <div className="tf-mentor-req-card">
        <div className="tf-mentor-req-topbar">
          <p className="tf-mentor-req-topbar-desc">
            Requests awaiting your response — payment or deliverables are tracked in the platform.
          </p>
          <button
            type="button"
            className="tf-mentor-req-btn-outline"
            onClick={() => navigate('/mentors')}
          >
            <MoneyIcon />
            <span>View Mentors Directory</span>
          </button>
        </div>

        {loading ? (
          <div className="tf-mentor-req-loading">Loading requests…</div>
        ) : requests.length === 0 ? (
          <div className="tf-mentor-req-empty">
            No mentor requests for you right now.
          </div>
        ) : (
          <div className="tf-mentor-req-list">
            {requests.map((r) => {
              const isPending = r.status === 'pending';
              const isAccepted = r.status === 'accepted' || r.status === 'active';
              const isDeclined = r.status === 'declined' || r.status === 'rejected';
              const isBusy = actionInProgress[r.id];

              return (
                <div key={r.id} className="tf-mentor-req-row">
                  <div className="tf-mentor-req-info">
                    <h3 className="tf-mentor-req-project-name">{r.projectName}</h3>
                    <div className="tf-mentor-req-meta">
                      <span>Owner: <strong>{r.ownerName}</strong></span>
                      {r.agreedPrice && (
                        <>
                          <span className="tf-mentor-req-dot">·</span>
                          <span className="tf-mentor-req-escrow">₹{r.agreedPrice} in Escrow</span>
                        </>
                      )}
                      <span className="tf-mentor-req-dot">·</span>
                      <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>

                    {r.message && (
                      <div className="tf-mentor-req-notes">
                        "{r.message}"
                      </div>
                    )}

                    {r.skills && r.skills.length > 0 && (
                      <div className="tf-mentor-req-skills">
                        {r.skills.map((skill, idx) => (
                          <span key={idx} className="tf-mentor-req-skill-badge">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="tf-mentor-req-actions">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          className="tf-mentor-req-btn-approve"
                          disabled={isBusy}
                          onClick={() => handleApprove(r)}
                        >
                          <CheckIcon />
                          <span>{isBusy ? 'Processing...' : 'Approve'}</span>
                        </button>
                        <button
                          type="button"
                          className="tf-mentor-req-btn-reject"
                          disabled={isBusy}
                          onClick={() => handleDecline(r)}
                        >
                          <XIcon />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : isAccepted ? (
                      <>
                        <span className="tf-mentor-req-badge success">Accepted</span>
                        {r.projectId && (
                          <button
                            type="button"
                            className="tf-mentor-req-btn-view"
                            onClick={() => navigate(`/mentor/workspace/${r.projectId}`)}
                          >
                            <FolderIcon />
                            <span>Workspace</span>
                          </button>
                        )}
                      </>
                    ) : isDeclined ? (
                      <span className="tf-mentor-req-badge danger">Declined</span>
                    ) : (
                      <span className="tf-mentor-req-badge pending">{r.status}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MentorRequests;

