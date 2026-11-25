import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import projectsApi from '../../services/projectsApi';
import feedbackApi from '../../services/feedbackApi';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import { formatDateTime, formatProjectDueDate } from '../../utils/dateFormatter';
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

  const [currentTime] = useState(() => Date.now());
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState({});
  const [feedback, setFeedback] = useState(null);

  // Decline Modal state
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [selectedDeclineReq, setSelectedDeclineReq] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declineReasons, setDeclineReasons] = useState([]);
  const [declineReasonOptions, setDeclineReasonOptions] = useState([]);
  const [declineError, setDeclineError] = useState('');

  useEffect(() => {
    feedbackApi.getFeedbackReasons().then((cfg) => {
      const list = cfg?.MENTOR_DECLINE_ASSIGNMENT?.reasons || cfg?.actions?.MENTOR_DECLINE_ASSIGNMENT?.reasons || [];
      if (Array.isArray(list) && list.length > 0) {
        setDeclineReasonOptions(list);
      }
    }).catch(() => {});
  }, []);

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
            projectDueDate: s.projectDueDate || linkedProj.dueDate || null,
            projectDesc: s.projectDescription || linkedProj.desc || '',
            message: s.projectDescription || s.notes || 'Project owner funded escrow for your mentorship.',
            agreedPrice: s.agreedPrice || 1000,
            skills: linkedProj.skills || [],
            status: 'escrow_funded',
            createdAt: s.createdAt || new Date().toISOString(),
            respondBy: s.respondBy,
            declineReason: s.declineReason,
            declinedBy: s.declinedBy,
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
        message: err?.serverMessage || err?.message || 'Failed to accept mentorship request.',
      });
    } finally {
      setActionInProgress((prev) => ({ ...prev, [req.id]: false }));
    }
  };

  const handleOpenDeclineModal = (req) => {
    setSelectedDeclineReq(req);
    setDeclineReason('');
    setDeclineError('');
    setDeclineModalOpen(true);
  };

  const handleConfirmDecline = async () => {
    if (!selectedDeclineReq) return;
    const trimmed = declineReason.trim();
    if (!trimmed || trimmed.length < 10) {
      setDeclineError('A decline reason of at least 10 characters (up to 500) is required.');
      return;
    }
    if (trimmed.length > 500) {
      setDeclineError('Decline reason cannot exceed 500 characters.');
      return;
    }

    const reqId = selectedDeclineReq.id;
    const reqProjName = selectedDeclineReq.projectName;

    setActionInProgress((prev) => ({ ...prev, [reqId]: true }));
    setFeedback(null);
    try {
      const resolvedReasons =
        declineReasons.length > 0
          ? declineReasons
          : (declineReasonOptions[0]?.id ? [declineReasonOptions[0].id] : []);
      const payload = {
        feedback: {
          reasons: resolvedReasons,
          explanation: trimmed,
        },
        reasons: resolvedReasons,
        explanation: trimmed,
        reason: trimmed,
      };
      await mentorMarketplaceApi.declineSession(reqId, payload);

      setFeedback({
        type: 'info',
        message: `Mentorship for "${reqProjName}" declined. The project owner has been notified with your reason and refunded in full from escrow.`,
      });

      // Update local state to reflect declined status
      setRequests((prev) =>
        prev.map((item) =>
          item.id === reqId
            ? { ...item, status: 'refunded', declineReason: trimmed, declinedBy: 'mentor' }
            : item
        )
      );
      setDeclineModalOpen(false);
      setSelectedDeclineReq(null);
    } catch (err) {
      console.error('Failed to decline mentor request:', err);
      setDeclineError(err.message || 'Failed to decline mentorship request.');
    } finally {
      setActionInProgress((prev) => ({ ...prev, [reqId]: false }));
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
                      {r.projectDueDate && (
                        <>
                          <span className="tf-mentor-req-dot">·</span>
                          <span className="tf-mentor-req-duedate" data-testid={`project-due-${r.id}`}>
                            📅 Project due: {formatProjectDueDate(r.projectDueDate).replace(/^Due /, '')}
                          </span>
                        </>
                      )}
                      <span className="tf-mentor-req-dot">·</span>
                      <span>{formatDateTime(r.createdAt)}</span>
                      {r.respondBy && isPending && (
                        <>
                          <span className="tf-mentor-req-dot">·</span>
                          <span style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>
                            ⏱️ Respond within {Math.max(1, Math.ceil((new Date(r.respondBy).getTime() - currentTime) / (1000 * 60 * 60 * 24)))}d
                          </span>
                        </>
                      )}
                    </div>

                    {r.message && (
                      <div className="tf-mentor-req-notes">
                        &quot;{r.message}&quot;
                      </div>
                    )}

                    {r.declineReason && (
                      <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#b91c1c', background: '#fef2f2', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                        <strong>Decline Reason ({r.declinedBy === 'system' ? 'System auto-declined' : 'Mentor'}):</strong> {r.declineReason}
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
                          onClick={() => handleOpenDeclineModal(r)}
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

      {/* Decline Mentorship Request Modal */}
      <Modal
        isOpen={declineModalOpen}
        title="Decline Mentorship Booking"
        onClose={() => {
          if (!actionInProgress[selectedDeclineReq?.id]) {
            setDeclineModalOpen(false);
            setSelectedDeclineReq(null);
          }
        }}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="tf-mentor-req-btn-outline"
              disabled={actionInProgress[selectedDeclineReq?.id]}
              onClick={() => {
                setDeclineModalOpen(false);
                setSelectedDeclineReq(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-mentor-req-btn-reject"
              style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              disabled={actionInProgress[selectedDeclineReq?.id] || declineReason.trim().length < 10 || declineReason.trim().length > 500}
              onClick={handleConfirmDecline}
            >
              {actionInProgress[selectedDeclineReq?.id] ? 'Declining...' : 'Confirm Decline & Refund'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
            Please provide a written reason for declining the mentorship booking for{' '}
            <strong>{selectedDeclineReq?.projectName}</strong>. The project owner will be notified with your written explanation, and their escrow payment of <strong>₹{selectedDeclineReq?.agreedPrice}</strong> will be refunded in full.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>
              Decline Reason Tags <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {declineReasonOptions.map((r) => {
                const isSelected = declineReasons.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    data-testid={`reason-chip-${r.id}`}
                    onClick={() => {
                      setDeclineReasons((prev) =>
                        prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                      );
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '9999px',
                      border: isSelected ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      color: isSelected ? '#1d4ed8' : '#334155',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="mentor-decline-reason" style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>
              Decline Reason <span style={{ color: '#dc2626' }}>*</span> (10 to 500 characters)
            </label>
            <textarea
              id="mentor-decline-reason"
              rows={4}
              value={declineReason}
              onChange={(e) => {
                setDeclineReason(e.target.value);
                if (declineError) setDeclineError('');
              }}
              placeholder="Explain why you cannot take on this mentorship (e.g. current capacity limits, domain mismatch)..."
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: declineError ? '1px solid #dc2626' : '1px solid #cbd5e1',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}>
              <span>Minimum 10 characters required</span>
              <span style={{ color: declineReason.trim().length > 500 ? '#dc2626' : '#64748b' }}>
                {declineReason.trim().length} / 500 characters
              </span>
            </div>
            {declineError && (
              <div style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: '4px' }}>
                ⚠️ {declineError}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MentorRequests;
