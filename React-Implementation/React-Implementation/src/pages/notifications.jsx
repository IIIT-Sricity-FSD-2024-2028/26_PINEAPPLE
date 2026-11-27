import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useInRouterContext } from "react-router-dom";
import {
  selectFilteredNotifications,
  selectUnreadNotificationsCount,
  selectNotificationWorking,
  selectNotificationsStatus,
  selectNotificationsError,
  selectNotificationsInvalidated,
  selectNotificationsNeedsRefresh,
} from "../store/selectors/notificationsSelectors";
import { selectCurrentUser } from "../store/selectors/sessionSelectors";
import {
  clearMarkAllError,
  setNotificationFilter,
  setSelectedNotificationId,
  toggleGroupExpanded,
} from "../store/slices/notificationsSlice";
import {
  deleteNotification as deleteNotificationThunk,
  fetchNotifications as fetchNotificationsThunk,
  markAllRead as markAllReadThunk,
  markRead as markReadThunk,
} from "../store/thunks/notificationsThunks";
import { fetchMyInvites } from "../store/thunks/invitesThunks";
import {
  selectInviteActingIds,
  selectMyInvites,
} from "../store/selectors/invitesSelectors";
import {
  fetchMyAppeals,
  submitWarningAppeal,
} from "../store/thunks/appealsThunks";
import {
  closeAppealSubmitModal,
  openAppealSubmitModal,
} from "../store/slices/appealsSlice";
import {
  selectAppealsWorking,
  selectMyAppeals,
} from "../store/selectors/appealsSelectors";
import { fetchMyWarnings } from "../store/thunks/warningsThunks";
import { selectMyWarnings } from "../store/selectors/warningsSelectors";
import EmptyState from "../components/common/EmptyState";
import { formatRelativeTime } from "../utils/dateFormatter";
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

const NotificationsContent = () => {
  const dispatch = useDispatch();

  const currentUser = useSelector(selectCurrentUser);
  const userId = currentUser?.id ?? null;
  const notifications = useSelector(selectFilteredNotifications);
  const unreadCount = useSelector(selectUnreadNotificationsCount);
  const storeWorking = useSelector(selectNotificationWorking);
  const notifStatus = useSelector(selectNotificationsStatus);
  const notifError = useSelector(selectNotificationsError);
  const notifInvalidated = useSelector(selectNotificationsInvalidated);
  const needsRefresh = useSelector(selectNotificationsNeedsRefresh);
  const invites = useSelector(selectMyInvites);
  const actingInviteIds = useSelector(selectInviteActingIds);
  const appeals = useSelector(selectMyAppeals);
  const warnings = useSelector(selectMyWarnings);
  const appealsWorking = useSelector(selectAppealsWorking);

  const inRouter = useInRouterContext();
  const [currentTime] = useState(() => Date.now());

  const appealModalOpen = Boolean(appealsWorking.appealModalOpen);
  const selectedWarningId = appealsWorking.selectedWarningId;
  const submittingAppeal = Boolean(appealsWorking.submitting);
  const appealError = appealsWorking.submitError || "";
  const appealSuccess = appealsWorking.submitSuccess || "";
  const [explanation, setExplanation] = useState("");
  const [emailNotVerifiedError, setEmailNotVerifiedError] = useState(false);

  const [inviteFeedback, setInviteFeedback] = useState(null);
  const [actingInviteId, setActingInviteId] = useState(null);
  const appealCloseTimerRef = useRef(null);

  const readFilter = storeWorking?.readFilter || "all";
  const selectedNotificationId = storeWorking?.selectedNotificationId || null;
  const isMarkingAllRead = Boolean(storeWorking?.isMarkingAllRead);
  const markAllError = storeWorking?.markAllError || "";

  const markAsRead = useCallback(
    async (id) => {
      try {
        await dispatch(markReadThunk({ id })).unwrap();
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    },
    [dispatch],
  );

  const handleDeleteNotification = useCallback(
    async (e, id) => {
      e.stopPropagation();
      try {
        await dispatch(deleteNotificationThunk({ id })).unwrap();
      } catch (err) {
        console.error("Failed to delete notification:", err);
      }
    },
    [dispatch],
  );

  const handleMarkAllAsRead = async () => {
    try {
      await dispatch(markAllReadThunk({})).unwrap();
    } catch {
      // Error banner state is stored synchronously via markAllRead.rejected rollback
    }
  };

  useEffect(() => {
    return () => {
      if (appealCloseTimerRef.current) clearTimeout(appealCloseTimerRef.current);
    };
  }, []);

  const toggleGroupExpand = (e, notifId) => {
    e.stopPropagation();
    dispatch(toggleGroupExpanded(notifId));
  };

  const handleFilterChange = (nextFilter) => {
    dispatch(setNotificationFilter({ readFilter: nextFilter }));
    if (userId && needsRefresh) {
      dispatch(fetchNotificationsThunk({ userId }));
    }
  };

  const handleSelectAndReadNotification = (notif) => {
    dispatch(setSelectedNotificationId(notif.id));
    if (!notif.isRead) {
      markAsRead(notif.id);
    }
  };

  const loadAppealsAndWarnings = useCallback(async () => {
    try {
      await Promise.allSettled([
        dispatch(fetchMyAppeals()),
        dispatch(fetchMyWarnings()),
        dispatch(fetchMyInvites({ force: true })),
      ]);
    } catch (err) {
      console.warn("Could not load appeals/warnings:", err);
    }
  }, [dispatch]);

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
    loadAppealsAndWarnings();
  }, [loadAppealsAndWarnings]);

  useEffect(() => {
    if (!userId) return;
    dispatch(fetchNotificationsThunk({ userId }));
  }, [dispatch, userId]);

  useEffect(() => {
    if (!userId || !notifInvalidated) return;
    dispatch(fetchNotificationsThunk({ userId }));
  }, [dispatch, userId, notifInvalidated]);

  const handleOpenAppealModal = (warningId) => {
    setExplanation("");
    dispatch(openAppealSubmitModal(warningId));
  };

  const handleCloseAppealModal = () => {
    setExplanation("");
    dispatch(closeAppealSubmitModal());
  };

  const handleSubmitAppeal = async (e) => {
    e.preventDefault();
    if (!selectedWarningId || explanation.trim().length < 20 || explanation.length > 1000) {
      return;
    }

    try {
      await dispatch(
        submitWarningAppeal({
          warningId: selectedWarningId,
          explanation: explanation.trim(),
        }),
      ).unwrap();
      if (appealCloseTimerRef.current) clearTimeout(appealCloseTimerRef.current);
      appealCloseTimerRef.current = setTimeout(() => {
        handleCloseAppealModal();
      }, 1200);
    } catch {
      // Friendly error stored in appealsSlice working.submitError
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', gap: '6px' }} role="group" aria-label="Notification filter">
            <button
              type="button"
              data-testid="notif-filter-all"
              className={`notif-btn-secondary${readFilter === 'all' ? ' active' : ''}`}
              aria-pressed={readFilter === 'all'}
              onClick={() => handleFilterChange('all')}
            >
              All
            </button>
            <button
              type="button"
              data-testid="notif-filter-unread"
              className={`notif-btn-secondary${readFilter === 'unread' ? ' active' : ''}`}
              aria-pressed={readFilter === 'unread'}
              onClick={() => handleFilterChange('unread')}
            >
              Unread
            </button>
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
            onClick={() => dispatch(clearMarkAllError())}
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
                      disabled={actingInviteId === inv.id || Boolean(actingInviteIds[inv.id])}
                      onClick={() => handleAcceptInvite(inv.id)}
                    >
                      {actingInviteId === inv.id || actingInviteIds[inv.id] ? 'Processing...' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      data-testid={`decline-invite-btn-${inv.id}`}
                      className="notif-btn-secondary"
                      disabled={actingInviteId === inv.id || Boolean(actingInviteIds[inv.id])}
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
          notifStatus === 'loading' || (unreadCount > 0 && notifInvalidated) ? (
            <EmptyState
              icon="⏳"
              title="Loading notifications..."
              message="Fetching your latest updates."
            />
          ) : notifStatus === 'failed' && notifError ? (
            <EmptyState
              icon="⚠️"
              title="Unable to load notifications"
              message={notifError?.message || "Please try refreshing your notifications."}
              actionLabel={userId ? "Retry" : undefined}
              onAction={userId ? () => dispatch(fetchNotificationsThunk({ userId, force: true })) : undefined}
            />
          ) : (
            <EmptyState
              icon="🔔"
              title="You're all caught up!"
              message="There are no new notifications right now."
            />
          )
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

              const groupedItems =
                Array.isArray(notif.items) && notif.items.length > 0
                  ? notif.items
                  : Array.isArray(notif.metadata?.items) && notif.metadata.items.length > 0
                  ? notif.metadata.items
                  : [];
              const groupedCount = Number(
                notif.count ?? notif.metadata?.count ?? groupedItems.length ?? 0,
              );
              const isGroupExpanded = Boolean(
                storeWorking?.expandedGroupIds?.[String(notif.id)],
              );

              return (
                <div
                  key={notif.id}
                  onClick={() => handleSelectAndReadNotification(notif)}
                  className={`notif-item ${notif.isRead ? 'read' : 'unread'}${selectedNotificationId === String(notif.id) ? ' selected' : ''}`}
                  data-testid={`notif-item-${notif.id}`}
                  data-selected={selectedNotificationId === String(notif.id) ? 'true' : 'false'}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {!notif.isRead && <span className="notif-badge"></span>}
                        <button
                          type="button"
                          data-testid={`notif-delete-${notif.id}`}
                          aria-label="Delete notification"
                          onClick={(e) => handleDeleteNotification(e, notif.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            lineHeight: 1,
                            padding: '2px 4px',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div className={`notif-desc ${notif.isRead ? 'read' : 'unread'}`}>
                      {notif.message}
                    </div>
                    {groupedItems.length > 0 && (
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

const Notifications = NotificationsContent;

export default Notifications;
