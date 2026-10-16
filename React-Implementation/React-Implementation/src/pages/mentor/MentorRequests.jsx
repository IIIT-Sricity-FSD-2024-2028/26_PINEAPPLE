import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import projectsApi from '../../services/projectsApi';
import EmptyState from '../../components/common/EmptyState';
import './mentorRequests.css';

/* ── Extracted SVG Functional Components ── */
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

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MentorRequests = () => {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState({});
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadRequests = async () => {
      try {
        const [marketplaceSessions, allProjects] = await Promise.all([
          mentorMarketplaceApi.mentorSessions().catch(() => []),
          projectsApi.list().catch(() => []),
        ]);

        const projectsMap = {};
        if (Array.isArray(allProjects)) {
          allProjects.forEach((p) => {
            projectsMap[p.id] = p;
          });
        }

        // Rule: lists only sessions with status escrow_funded
        const fundedSessions = (Array.isArray(marketplaceSessions) ? marketplaceSessions : []).filter(
          (s) => s.status === 'escrow_funded'
        );

        const formatted = fundedSessions.map((s) => {
          const linkedProj = projectsMap[s.projectId] || {};
          return {
            id: s.id,
            projectId: s.projectId,
            projectName: linkedProj.name || linkedProj.title || s.projectName || 'Project Mentorship',
            ownerName: linkedProj.owner || s.ownerName || 'Project Owner',
            projectDesc: s.projectDescription || linkedProj.desc || '',
            message: s.projectDescription || s.notes || 'Project owner funded escrow for your mentorship.',
            agreedPrice: s.agreedPrice || 1000,
            skills: linkedProj.skills || [],
            status: 'escrow_funded',
            createdAt: s.createdAt || new Date().toISOString(),
          };
        });

        if (isMounted) {
          setRequests(formatted);
        }
      } catch (err) {
        console.error('Failed to load mentor requests:', err);
        if (isMounted) {
          setFeedback({ type: 'error', message: 'Failed to load mentor requests from the backend.' });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadRequests();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleApprove = async (req) => {
    setActionInProgress((prev) => ({ ...prev, [req.id]: true }));
    setFeedback(null);
    try {
      await mentorMarketplaceApi.acceptSession(req.id);

      setFeedback({
        type: 'success',
        message: `Mentorship for "${req.projectName}" accepted! You have been added to the project and funds remain secured in escrow.`,
      });

      // Update local state to reflect accepted status
      setRequests((prev) =>
        prev.map((item) =>
          item.id === req.id ? { ...item, status: 'active' } : item
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
      await mentorMarketplaceApi.declineSession(req.id);

      setFeedback({
        type: 'info',
        message: `Mentorship for "${req.projectName}" declined. The project owner has been refunded in full from escrow.`,
      });

      // Update local state to reflect declined status
      setRequests((prev) =>
        prev.map((item) =>
          item.id === req.id ? { ...item, status: 'refunded' } : item
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
        <p className="tf-mentor-req-subtitle">
          Incoming bookings with funds pre-deposited into escrow awaiting your confirmation.
        </p>
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
            Incoming escrow-funded mentorship bookings from project owners.
          </p>
          <button
            type="button"
            className="tf-mentor-req-btn-outline"
            onClick={() => navigate('/mentor/profile')}
          >
            <UserIcon />
            <span>My Mentor Profile</span>
          </button>
        </div>

        {loading ? (
          <div className="tf-mentor-req-loading">Loading requests…</div>
        ) : requests.length === 0 ? (
          <EmptyState
            title="No Pending Mentor Requests"
            message="When project owners book your mentorship with escrow funding, their booking requests will appear here for your approval."
            actionLabel="View My Mentor Profile"
            onAction={() => navigate('/mentor/profile')}
          />
        ) : (
          <div className="tf-mentor-req-list">
            {requests.map((r) => {
              const isPending = r.status === 'escrow_funded';
              const isAccepted = r.status === 'active' || r.status === 'accepted';
              const isDeclined = r.status === 'refunded' || r.status === 'declined';
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
                          <span className="tf-mentor-req-escrow">🔒 ₹{r.agreedPrice} in Escrow</span>
                        </>
                      )}
                      <span className="tf-mentor-req-dot">·</span>
                      <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>

                    {r.message && (
                      <div className="tf-mentor-req-notes">
                        &quot;{r.message}&quot;
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
                          <span>{isBusy ? 'Processing...' : 'Accept'}</span>
                        </button>
                        <button
                          type="button"
                          className="tf-mentor-req-btn-reject"
                          disabled={isBusy}
                          onClick={() => handleDecline(r)}
                        >
                          <XIcon />
                          <span>Decline</span>
                        </button>
                      </>
                    ) : isAccepted ? (
                      <>
                        <span className="tf-mentor-req-badge success">Accepted (Active)</span>
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
                      <span className="tf-mentor-req-badge danger">Declined (Refunded)</span>
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
