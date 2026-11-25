import { useContext, useState, useEffect, useCallback, useRef } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { NotificationContext } from "../context/NotificationContext";
import EmptyState from "../components/common/EmptyState";
import { formatRelativeTime } from "../utils/dateUtils";
import appealsApi from "../services/appealsApi";
import adminApi from "../services/adminApi";
import projectsApi from "../services/projectsApi";
import VerifyEmailBanner from "../components/common/VerifyEmailBanner";
import Modal from "../components/common/Modal";
import useReasonAction from "../hooks/useReasonAction";
import SafeLink from "../components/common/SafeLink";
import "./notifications.css";

const getIconColorClass = (type) => {
  switch (type) {
    case 'success': return 'notif-dot-success';
    case 'info': return 'notif-dot-info';
    case 'warning': return 'notif-dot-warning';
    default: return 'notif-dot-default';
  }
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const Notifications = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useContext(NotificationContext);
  const inRouter = useInRouterContext();
  const [currentTime] = useState(() => Date.now());

  const [appeals, setAppeals] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [selectedWarningId, setSelectedWarningId] = useState(null);
  const [explanation, setExplanation] = useState("");
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appealError, setAppealError] = useState("");
  const [appealSuccess, setAppealSuccess] = useState("");
  const [emailNotVerifiedError, setEmailNotVerifiedError] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [markAllError, setMarkAllError] = useState("");

  const handleMarkAllAsRead = async () => {
    setIsMarkingAllRead(true);
    setMarkAllError("");
    try {
      await markAllAsRead();
    } catch (err) {
      setMarkAllError(err?.serverMessage || err?.message || "Failed to mark all notifications as read. Please try again.");
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  // Phase 15: Direct project invitations
  const [invites, setInvites] = useState([]);
  const [inviteFeedback, setInviteFeedback] = useState(null);
  const [actingInviteId, setActingInviteId] = useState(null);
  const [expandedDigestIds, setExpandedDigestIds] = useState(() => new Set());
  const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set());
  const appealCloseTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (appealCloseTimerRef.current) clearTimeout(appealCloseTimerRef.current);
    };
  }, []);

  const toggleDigestExpand = (e, notifId) => {
    e.stopPropagation();
    setExpandedDigestIds((prev) => {
      const next = new Set(prev);
      const key = String(notifId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroupExpand = (e, notifId) => {
    e.stopPropagation();
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      const key = String(notifId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const loadAppealsAndWarnings = useCallback(async () => {
    try {
      const [appealsRes, warningsRes, invitesRes] = await Promise.allSettled([
        appealsApi.getMyAppeals(),
        adminApi.getMyWarnings ? adminApi.getMyWarnings() : Promise.resolve([]),
        typeof projectsApi.getMyInvites === 'function' ? projectsApi.getMyInvites() : Promise.resolve([]),
      ]);

      if (appealsRes.status === 'fulfilled') {
        const list = Array.isArray(appealsRes.value) ? appealsRes.value : appealsRes.value?.data || [];
        setAppeals(list);
      }
      if (warningsRes.status === 'fulfilled') {
        const list = Array.isArray(warningsRes.value) ? warningsRes.value : warningsRes.value?.data || [];
        setWarnings(list);
      }
      if (invitesRes.status === 'fulfilled') {
        const list = Array.isArray(invitesRes.value) ? invitesRes.value : invitesRes.value?.data || [];
        setInvites(list);
      }
    } catch (err) {
      console.warn("Could not load appeals/warnings:", err);
    }
  }, []);

  const {
    renderModal: renderReasonModal,
    handleDeclineInvite: declineInviteAction,
    handleAcceptInvite: acceptInviteAction,
  } = useReasonAction();

  const handleAcceptInvite = async (inviteId) => {
    setActingInviteId(inviteId);
    setInviteFeedback(null);
    setEmailNotVerifiedError(false);
    try {
      await acceptInviteAction(inviteId);
      setInviteFeedback({ type: 'success', message: 'Invitation accepted! You are now a project member.' });
      await loadAppealsAndWarnings();
    } catch (err) {
      if (err?.code === 'EMAIL_NOT_VERIFIED' || /verify your email/i.test(err?.serverMessage || err?.message || '')) {
        setEmailNotVerifiedError(true);
      }
      setInviteFeedback({
        type: 'error',
        message: err?.serverMessage || err?.message || 'Failed to accept invitation.',
        projects: err?.code === 'ACTIVE_PROJECT_CAP' && Array.isArray(err?.projects) ? err.projects : null,
      });
    } finally {
      setActingInviteId(null);
    }
  };

  const handleDeclineInvite = async (invite, block = false) => {
    setActingInviteId(invite?.id || invite);
    setInviteFeedback(null);
    try {
      await declineInviteAction(invite, {
        block,
        onSuccess: async () => {
          setInviteFeedback({
            type: 'success',
            message: block ? 'Invitation declined and project blocked for 14 days.' : 'Invitation declined.',
          });
          await loadAppealsAndWarnings();
        },
      });
    } catch (err) {
      setInviteFeedback({
        type: 'error',
        message: err?.serverMessage || err?.message || 'Failed to decline invitation.',
      });
    } finally {
      setActingInviteId(null);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAppealsAndWarnings();
  }, [loadAppealsAndWarnings]);

  const handleOpenAppealModal = (warningId) => {
    setSelectedWarningId(warningId);
    setExplanation("");
    setAppealError("");
    setAppealSuccess("");
    setAppealModalOpen(true);
  };

  const handleCloseAppealModal = () => {
    setAppealModalOpen(false);
    setSelectedWarningId(null);
    setExplanation("");
    setAppealError("");
  };

  const handleSubmitAppeal = async (e) => {
    e.preventDefault();
    if (!selectedWarningId || explanation.trim().length < 20 || explanation.length > 1000) {
      return;
    }

    setSubmittingAppeal(true);
    setAppealError("");
    try {
      await appealsApi.submitAppeal(selectedWarningId, {
        explanation: explanation.trim(),
      });
      setAppealSuccess("Appeal submitted successfully. Administrators will review it.");
      await loadAppealsAndWarnings();
      if (appealCloseTimerRef.current) clearTimeout(appealCloseTimerRef.current);
      appealCloseTimerRef.current = setTimeout(() => {
        handleCloseAppealModal();
      }, 1200);
    } catch (err) {
      const msg = err?.message || err?.error || "Failed to submit appeal.";
      setAppealError(msg);
    } finally {
      setSubmittingAppeal(false);
    }
  };

  return (
    <div className="notifications-page">
      {/* Header */}
      <div className="notif-header-wrap">
        <div>
          <h1 className="notif-title-main">Notifications</h1>
          <p className="notif-subtitle">Stay updated on your projects, warnings, and tasks.</p>
        </div>
        <button
          type="button"
          onClick={handleMarkAllAsRead}
          className="notif-btn-secondary"
          data-testid="mark-all-read-btn"
          disabled={unreadCount === 0 || isMarkingAllRead}
        >
          {isMarkingAllRead ? "Marking all as read..." : "Mark all as read"}
        </button>
      </div>

      {markAllError && (
        <div
          role="alert"
          data-testid="mark-all-error"
          style={{
            marginBottom: "16px",
            padding: "10px 14px",
            borderRadius: "6px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: "0.88rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{markAllError}</span>
          <button
            type="button"
            onClick={() => setMarkAllError("")}
            style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontWeight: 700 }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Account Warnings History (including Expired warnings from Phase 17 decay) */}
      {warnings.length > 0 && (
        <div
          className="notif-glass-card"
          data-testid="my-warnings-history-section"
          style={{ marginBottom: '20px', padding: '14px 18px' }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginTop: 0, marginBottom: '10px', color: '#0f172a' }}>
            Account Warning History
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {warnings.map((w) => {
              const st = (w.status || 'active').toLowerCase();
              const isExpired = st === 'expired';
              const isActive = st === 'active';
              return (
                <div
                  key={w.id}
                  data-testid={`my-warning-item-${w.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${isActive ? '#fde68a' : '#e2e8f0'}`,
                    backgroundColor: isActive ? '#fffbeb' : '#f8fafc',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>{w.reason}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : ''}
                      {isExpired && w.expiredAt ? ` · Expired ${new Date(w.expiredAt).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                  <span
                    data-testid={`my-warning-status-${w.id}`}
                    style={{
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      backgroundColor: isActive ? '#fef3c7' : '#e2e8f0',
                      color: isActive ? '#92400e' : '#475569',
                    }}
                  >
                    {isExpired ? 'Expired' : w.label || st}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Direct Project Invitations (Phase 15) */}
      {(invites.some((i) => i.status === 'pending') || inviteFeedback) && (
        <div
          className="notif-glass-card"
          data-testid="my-invites-section"
          style={{ marginBottom: '20px', padding: '16px 20px' }}
        >
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 0, marginBottom: '12px', color: '#0f172a' }}>
            Project Invitations
          </h2>
          {emailNotVerifiedError && <VerifyEmailBanner forceShow />}
          {inviteFeedback && (
            <div
              role="alert"
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '12px',
                fontSize: '0.88rem',
                backgroundColor: inviteFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${inviteFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                color: inviteFeedback.type === 'success' ? '#065f46' : '#991b1b',
              }}
            >
              <div>{inviteFeedback.message}</div>
              {Array.isArray(inviteFeedback.projects) && inviteFeedback.projects.length > 0 && (
                <ul data-testid="invite-cap-projects-list" style={{ marginTop: '6px', marginBottom: 0, paddingLeft: '18px' }}>
                  {inviteFeedback.projects.map((p) => (
                    <li key={p.id}>{p.title} ({p.status})</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {invites
              .filter((inv) => inv.status === 'pending')
              .map((inv) => (
                <div
                  key={inv.id}
                  data-testid={`invite-card-${inv.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{inv.projectTitle || inv.projectId}</div>
                    <div style={{ fontSize: '0.83rem', color: '#475569', marginTop: '2px' }}>
                      Invited by <strong>{inv.invitedByName || 'Project Owner'}</strong>
                      {Array.isArray(inv.projectSkills) && inv.projectSkills.length > 0 && (
                        <> · Skills: {inv.projectSkills.join(', ')}</>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      data-testid={`accept-invite-btn-${inv.id}`}
                      className="notif-btn-secondary"
                      style={{ backgroundColor: '#16a34a', color: '#ffffff', borderColor: '#16a34a' }}
                      disabled={actingInviteId === inv.id}
                      onClick={() => handleAcceptInvite(inv.id)}
                    >
                      {actingInviteId === inv.id ? 'Processing...' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      data-testid={`decline-invite-btn-${inv.id}`}
                      className="notif-btn-secondary"
                      disabled={actingInviteId === inv.id}
                      onClick={() => handleDeclineInvite(inv, false)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="notif-glass-card">
        {notifications.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="You're all caught up!"
            message="There are no new notifications right now."
          />
        ) : (
          <div className="notif-list-container">
            {notifications.map((notif) => {
              const isWarning =
                notif.type === 'warning' ||
                (notif.title && notif.title.toLowerCase().startsWith('warning')) ||
                Boolean(notif.metadata?.warningId);

              // Find warning ID
              const warningId =
                notif.metadata?.warningId ||
                notif.warningId ||
                (warnings.find((w) => notif.message && notif.message.includes(w.reason))?.id);

              // Find matching appeal if exists
              const matchedAppeal = appeals.find(
                (a) => String(a.warningId) === String(warningId)
              );

              // Find warning entity if available
              const warningObj = warnings.find((w) => String(w.id) === String(warningId));
              const isWarningActive = warningObj ? warningObj.status === 'active' : true;

              // Check 7-day appeal window
              const warningCreatedAt = warningObj?.createdAt || notif.createdAt || notif.timestamp;
              const isWithin7Days = warningCreatedAt
                ? currentTime - new Date(warningCreatedAt).getTime() <= SEVEN_DAYS_MS
                : true;

              const isDigest = notif.type === 'DAILY_DIGEST' || Boolean(notif.metadata?.isDigest);
              const groupedItems = !isDigest
                ? (Array.isArray(notif.items) && notif.items.length > 0
                    ? notif.items
                    : Array.isArray(notif.metadata?.items) && notif.metadata.items.length > 0
                    ? notif.metadata.items
                    : [])
                : [];
              const groupedCount = !isDigest
                ? Number(notif.count ?? notif.metadata?.count ?? groupedItems.length ?? 0)
                : 0;
              const isGroupExpanded = expandedGroupIds.has(String(notif.id));

              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.isRead && markAsRead(notif.id)}
                  className={`notif-item ${notif.isRead ? 'read' : 'unread'}`}
                  data-testid={`notif-item-${notif.id}`}
                >
                  <div className={`notif-dot-icon ${getIconColorClass(notif.type)} ${notif.isRead ? 'read' : ''}`}></div>
                  <div className="notif-content-col">
                    <div className="notif-title-row">
                      <div className={`notif-title ${notif.isRead ? 'read' : 'unread'}`}>
                        {notif.title || "Notification"}
                        {groupedCount > 1 && (
                          <span
                            data-testid={`notif-group-count-${notif.id}`}
                            style={{
                              marginLeft: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '1px 7px',
                              borderRadius: '999px',
                              background: '#e0f2fe',
                              color: '#0369a1',
                            }}
                          >
                            ({groupedCount})
                          </span>
                        )}
                      </div>
                      {!notif.isRead && <span className="notif-badge"></span>}
                    </div>
                    <div className={`notif-desc ${notif.isRead ? 'read' : 'unread'}`}>
                      {notif.message}
                    </div>
                    {!isDigest && groupedItems.length > 0 && (
                      <div
                        data-testid={`notif-group-${notif.id}`}
                        style={{ marginTop: '6px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          aria-expanded={isGroupExpanded}
                          data-testid={`notif-group-toggle-${notif.id}`}
                          onClick={(e) => toggleGroupExpand(e, notif.id)}
                          style={{
                            background: 'none',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '3px 10px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#2563eb',
                            cursor: 'pointer',
                          }}
                        >
                          {isGroupExpanded
                            ? `Hide items (${groupedCount || groupedItems.length})`
                            : `Show ${groupedCount || groupedItems.length} item${(groupedCount || groupedItems.length) === 1 ? '' : 's'}`}
                        </button>
                        {isGroupExpanded && (() => {
                          const visibleItems = groupedItems.slice(0, 10);
                          const overflowCount = Math.max(
                            0,
                            Math.max(groupedCount, groupedItems.length) - visibleItems.length
                          );
                          return (
                            <ul
                              data-testid={`notif-group-list-${notif.id}`}
                              style={{
                                marginTop: '8px',
                                marginBottom: 0,
                                paddingLeft: '18px',
                                fontSize: '0.84rem',
                                color: '#334155',
                              }}
                            >
                              {visibleItems.map((item, idx) => (
                                <li key={`${item.label || item.summary || idx}-${idx}`} style={{ marginBottom: '4px' }}>
                                  <span>{item.label || item.summary}</span>
                                  {item.link && (
                                    <>
                                      {' '}
                                      {String(item.link).startsWith('/') ? (
                                        inRouter ? (
                                          <Link to={item.link} style={{ color: '#2563eb', fontWeight: 500 }}>
                                            Open →
                                          </Link>
                                        ) : (
                                          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{item.link}</span>
                                        )
                                      ) : (
                                        <SafeLink href={item.link} style={{ color: '#2563eb', fontWeight: 500 }}>
                                          Open →
                                        </SafeLink>
                                      )}
                                    </>
                                  )}
                                </li>
                              ))}
                              {overflowCount > 0 && (
                                <li
                                  data-testid={`notif-group-overflow-${notif.id}`}
                                  style={{ color: '#64748b', fontStyle: 'italic' }}
                                >
                                  and {overflowCount} more
                                </li>
                              )}
                            </ul>
                          );
                        })()}
                      </div>
                    )}
                    {isDigest &&
                      Array.isArray(notif.metadata?.items) &&
                      notif.metadata.items.length > 0 && (() => {
                        const isExpanded = expandedDigestIds.has(String(notif.id));
                        const digestItems = notif.metadata.items;
                        return (
                          <div
                            data-testid={`notif-digest-${notif.id}`}
                            style={{ marginTop: '6px' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              data-testid={`notif-digest-toggle-${notif.id}`}
                              onClick={(e) => toggleDigestExpand(e, notif.id)}
                              style={{
                                background: 'none',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '3px 10px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#2563eb',
                                cursor: 'pointer',
                              }}
                            >
                              {isExpanded
                                ? `Hide digest items (${digestItems.length})`
                                : `Show all ${digestItems.length} updates`}
                            </button>
                            {isExpanded && (
                              <ul
                                data-testid={`notif-digest-list-${notif.id}`}
                                style={{
                                  marginTop: '8px',
                                  marginBottom: 0,
                                  paddingLeft: '18px',
                                  fontSize: '0.84rem',
                                  color: '#334155',
                                }}
                              >
                                {digestItems.map((item, idx) => (
                                  <li key={item.key || idx} style={{ marginBottom: '4px' }}>
                                    <span>{item.summary}</span>
                                    {item.link && (
                                      <>
                                        {' '}
                                        {String(item.link).startsWith('/') ? (
                                          inRouter ? (
                                            <Link to={item.link} style={{ color: '#2563eb', fontWeight: 500 }}>
                                              Open →
                                            </Link>
                                          ) : (
                                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{item.link}</span>
                                          )
                                        ) : (
                                          <SafeLink href={item.link} style={{ color: '#2563eb', fontWeight: 500 }}>
                                            Open →
                                          </SafeLink>
                                        )}
                                      </>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })()}
                    {(() => {
                      const suggestions = notif.suggestedProjects || notif.metadata?.suggestedProjects || [];
                      if (!Array.isArray(suggestions) || suggestions.length === 0) return null;
                      return (
                        <div
                          data-testid={`notif-suggestions-${notif.id}`}
                          style={{
                            marginTop: '6px',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.82rem',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                            Similar projects you can try:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {suggestions.slice(0, 3).map((sp) =>
                              inRouter ? (
                                <Link
                                  key={sp.id}
                                  to={`/projects?apply=${encodeURIComponent(sp.id)}`}
                                  style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                                >
                                  {sp.title} →
                                </Link>
                              ) : (
                                <span
                                  key={sp.id}
                                  style={{ color: '#2563eb', fontWeight: 600 }}
                                >
                                  {sp.title} →
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {(notif.link || notif.referenceId) && (() => {
                      const targetLink = notif.link || `/projects/${notif.referenceId}`;
                      const isRelative = String(targetLink).startsWith('/');
                      return (
                        <div style={{ marginTop: '4px', fontSize: '0.84rem' }}>
                          {isRelative ? (
                            inRouter ? (
                              <Link
                                to={targetLink}
                                data-testid={`notif-link-${notif.id}`}
                                style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                View Project →
                              </Link>
                            ) : (
                              <span
                                data-testid={`notif-link-${notif.id}`}
                                style={{ color: '#64748b', fontWeight: 600 }}
                              >
                                {targetLink}
                              </span>
                            )
                          ) : (
                            <SafeLink
                              href={targetLink}
                              data-testid={`notif-link-${notif.id}`}
                              style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              View Project →
                            </SafeLink>
                          )}
                        </div>
                      );
                    })()}
                    {(notif.createdAt || notif.timestamp) && (
                      <div className="notif-time">
                        {formatRelativeTime(notif.createdAt || notif.timestamp)}
                      </div>
                    )}

                    {/* Warning Appeal Flow */}
                    {isWarning && (
                      <div className="notif-appeal-box" data-testid={`appeal-box-${notif.id}`}>
                        <div className="notif-appeal-action-row">
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#92400e' }}>
                            Account Warning
                          </span>

                          {matchedAppeal ? (
                            matchedAppeal.status === 'pending' ? (
                              <span className="notif-appeal-badge notif-appeal-pending" data-testid="appeal-status-pending">
                                Appealed (Under Review)
                              </span>
                            ) : matchedAppeal.status === 'accepted' ? (
                              <span className="notif-appeal-badge notif-appeal-accepted" data-testid="appeal-status-accepted">
                                Appeal Accepted (+10 Rep restored)
                              </span>
                            ) : (
                              <span className="notif-appeal-badge notif-appeal-rejected" data-testid="appeal-status-rejected">
                                Appeal Rejected
                              </span>
                            )
                          ) : isWarningActive && isWithin7Days ? (
                            <button
                              type="button"
                              className="notif-btn-appeal"
                              data-testid={`appeal-btn-${warningId || notif.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAppealModal(warningId || notif.id, notif);
                              }}
                            >
                              Appeal Warning
                            </button>
                          ) : !isWithin7Days ? (
                            <span className="notif-appeal-expired">Appeal window closed (7 days passed)</span>
                          ) : warningObj?.status === 'expired' ? (
                            <span className="notif-appeal-expired" data-testid={`warning-expired-label-${warningObj.id}`}>Expired</span>
                          ) : (
                            <span className="notif-appeal-expired">Warning is {warningObj?.status || 'inactive'}</span>
                          )}
                        </div>

                        {matchedAppeal?.adminNote && (
                          <div className="notif-appeal-note" data-testid="appeal-admin-note">
                            <strong>Moderator note:</strong> {matchedAppeal.adminNote}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Appeal Warning Modal */}
      <Modal
        isOpen={appealModalOpen}
        title="Appeal Account Warning"
        onClose={() => { if (!submittingAppeal) handleCloseAppealModal(); }}
        closeDisabled={submittingAppeal}
        size="sm"
      >
        <p className="notif-modal-sub">
          Explain why you believe this warning was issued in error. Appeals are reviewed by senior moderators within 7 days.
        </p>

        {appealSuccess && (
          <div className="help-banner-success" role="alert">
            {appealSuccess}
          </div>
        )}

        {appealError && (
          <div className="notif-modal-error" role="alert" data-testid="appeal-modal-error">
            {appealError}
          </div>
        )}

        <form onSubmit={handleSubmitAppeal}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
              <label htmlFor="appeal-explanation" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                Explanation *
              </label>
              <span
                style={{
                  fontSize: '0.8rem',
                  color:
                    explanation.length > 0 && explanation.length < 20
                      ? '#d97706'
                      : explanation.length > 1000
                      ? '#dc2626'
                      : '#6b7280',
                }}
              >
                {explanation.length} / 1000 characters (min. 20)
              </span>
            </div>
            <textarea
              id="appeal-explanation"
              data-testid="appeal-explanation-input"
              className="notif-modal-textarea"
              placeholder="Provide a clear, factual explanation (20 to 1,000 characters)..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              maxLength={1000}
            />
          </div>

          <div className="notif-modal-footer">
            <button
              type="button"
              className="notif-modal-btn-cancel"
              onClick={handleCloseAppealModal}
              disabled={submittingAppeal}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="notif-modal-btn-submit"
              data-testid="submit-appeal-btn"
              disabled={
                submittingAppeal ||
                explanation.trim().length < 20 ||
                explanation.length > 1000
              }
            >
              {submittingAppeal ? "Submitting..." : "Submit Appeal"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Universal Reason Modal for Declining Project Invitations (Fix 4 / Phase 9) */}
      {renderReasonModal()}
    </div>
  );
};

export default Notifications;
