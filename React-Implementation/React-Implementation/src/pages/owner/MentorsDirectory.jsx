import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectAllowedRoles,
  selectCurrentUser,
} from '../../store/selectors/sessionSelectors';
import { fetchMentors } from '../../store/thunks/mentorProfilesThunks';
import { setMentorSearchQuery } from '../../store/slices/mentorProfilesSlice';
import {
  selectAllDirectoryMentors,
  selectMentorProfilesWorking,
  selectMentorsListStatus,
} from '../../store/selectors/mentorProfilesSelectors';
import { fetchProjects } from '../../store/thunks/projectsThunks';
import { selectAllProjects } from '../../store/selectors/projectsSelectors';
import {
  bookMentorSession,
  fetchMySessions,
} from '../../store/thunks/mentorSessionsThunks';
import { setDirectoryTab } from '../../store/slices/mentorSessionsSlice';
import {
  selectMentorSessionsWorking,
  selectMySessions,
  selectMySessionsStatus,
} from '../../store/selectors/mentorSessionsSelectors';
import { submitSessionFeedback } from '../../store/thunks/sessionFeedbackThunks';
import {
  closeSessionFeedbackModal,
  openSessionFeedbackModal,
} from '../../store/slices/sessionFeedbackSlice';
import {
  selectSessionFeedbackSubmitting,
  selectSessionFeedbackWorking,
} from '../../store/selectors/sessionFeedbackSelectors';
import {
  cancelSessionPayment,
  confirmSessionPayment,
  formatPaymentError,
} from '../../store/thunks/paymentsThunks';
import {
  closePaymentCheckout,
  openPaymentCheckout,
  resetCheckoutToDetails,
  setCheckoutError,
  setCopiedUpi,
} from '../../store/slices/paymentsSlice';
import {
  selectCheckoutDisplayTotals,
  selectPaymentCheckout,
  selectPaymentsWorking,
} from '../../store/selectors/paymentsSelectors';
import { openSessionDispute } from '../../store/thunks/sessionDisputesThunks';
import {
  closeDisputeModal,
  openDisputeModal,
} from '../../store/slices/sessionDisputesSlice';
import { selectSessionDisputesWorking } from '../../store/selectors/sessionDisputesSelectors';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import SearchBar from '../../components/common/SearchBar';
import EmptyState from '../../components/common/EmptyState';
import FilterTabs from '../../components/common/FilterTabs';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import MentorCard from '../../components/features/MentorCard';
import { fetchTrustSummaries } from '../../store/thunks/profilesThunks';
import { selectTrustSummariesMap } from '../../store/selectors/profilesSelectors';
import { formatDateTime } from '../../utils/dateFormatter';
import QRCodeSvg from '../../components/common/QRCodeSvg';
import './mentorsDirectory.css';

const BLOCKING_BOOKING_STATUSES = new Set([
  'pending',
  'payment_pending',
  'escrow_funded',
  'accepted',
  'active',
]);

const isMentorCollaboratorOnProject = (project, mentorUserId) => {
  if (!project || !mentorUserId) return false;
  const uid = String(mentorUserId);
  const matchesEntry = (entry) => {
    if (!entry) return false;
    if (typeof entry === 'string') return entry === uid;
    if (String(entry.status || '').toLowerCase() === 'removed') return false;
    return String(entry.userId || entry.id || entry.uid || '') === uid;
  };
  const collabs = Array.isArray(project.collaborators) ? project.collaborators : [];
  if (collabs.some(matchesEntry)) return true;
  const members = Array.isArray(project.members) ? project.members : [];
  return members.some((m) => matchesEntry(m) && String(m?.role || '').toLowerCase() !== 'owner');
};

const getProjectBookingStatus = (project, sessions) => {
  if (!project) return { disabled: true, reason: 'Project not found' };
  if (project.deletedAt) {
    return { disabled: true, reason: 'Project deleted' };
  }
  const statusLower = String(project.status || '').toLowerCase().trim();
  const isCompleted = project.isCompleted || statusLower === 'completed';
  if (isCompleted) {
    return { disabled: true, reason: 'Completed' };
  }
  if (statusLower === 'closed') {
    return { disabled: true, reason: 'Closed' };
  }
  if (statusLower === 'cancelled') {
    return { disabled: true, reason: 'Cancelled' };
  }
  if (project.mentorId || project.mentor) {
    return { disabled: true, reason: `Mentor already assigned (${project.mentor || 'Active'})` };
  }
  const liveSession = (sessions || []).find(
    (s) =>
      String(s.projectId) === String(project.id) &&
      BLOCKING_BOOKING_STATUSES.has(String(s.status || '').toLowerCase()),
  );
  if (liveSession) {
    if (liveSession.status === 'active') return { disabled: true, reason: 'Active mentor session' };
    if (liveSession.status === 'payment_pending') return { disabled: true, reason: 'Payment pending' };
    return { disabled: true, reason: 'Mentorship booking pending' };
  }
  return { disabled: false, reason: null };
};

const formatBookingError = formatPaymentError;

const MentorsDirectoryContent = () => {
  const user = useSelector(selectCurrentUser);
  const allowedRoles = useSelector(selectAllowedRoles);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const mentors = useSelector(selectAllDirectoryMentors);
  const mentorsListStatus = useSelector(selectMentorsListStatus);
  const mentorsWorking = useSelector(selectMentorProfilesWorking);
  const allProjects = useSelector(selectAllProjects);
  const mySessions = useSelector(selectMySessions);
  const mySessionsStatus = useSelector(selectMySessionsStatus);
  const sessionsWorking = useSelector(selectMentorSessionsWorking);
  const feedbackSubmitting = useSelector(selectSessionFeedbackSubmitting);
  const feedbackWorking = useSelector(selectSessionFeedbackWorking);
  const checkout = useSelector(selectPaymentCheckout);
  const checkoutTotals = useSelector(selectCheckoutDisplayTotals);
  const paymentsWorking = useSelector(selectPaymentsWorking);
  const disputesWorking = useSelector(selectSessionDisputesWorking);

  const searchQuery = mentorsWorking.searchQuery || '';
  const activeTab = sessionsWorking.directoryTab || 'browse';
  const setSearchQuery = (val) => dispatch(setMentorSearchQuery(val));
  const setActiveTab = (val) => dispatch(setDirectoryTab(val));

  const ownedProjects = useMemo(
    () =>
      allProjects.filter(
        (p) => p && (p.ownerId === user?.id || p.owner === user?.name),
      ),
    [allProjects, user?.id, user?.name],
  );

  const trustSummaries = useSelector(selectTrustSummariesMap);
  const loading =
    mentorsListStatus === 'idle' ||
    mentorsListStatus === 'loading' ||
    mySessionsStatus === 'idle';

  // Escrow Booking Modal state (checkout + Idempotency-Key live in Redux paymentsSlice)
  const selectedMentor = useMemo(() => {
    if (!checkout.isOpen || !checkout.selectedMentorId) return null;
    return (
      mentors.find((m) => String(m.id) === String(checkout.selectedMentorId)) || {
        id: checkout.selectedMentorId,
        name: checkout.selectedMentorName || 'Mentor',
        sessionPrice: checkout.selectedMentorPrice || 0,
      }
    );
  }, [checkout.isOpen, checkout.selectedMentorId, checkout.selectedMentorName, checkout.selectedMentorPrice, mentors]);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [requestMsg, setRequestMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localFeedback, setLocalFeedback] = useState(null);

  // Demo Payment Flow state backed by paymentsSlice (Idempotency-Key survives routeChanged)
  const bookingStep = checkout.bookingStep || 'details';
  const activePaymentSession = checkout.session;
  const activePaymentIntent = checkout.paymentIntent;
  const confirmingPayment = checkout.confirmStatus === 'loading';
  const copiedUpi = Boolean(paymentsWorking.copiedUpi);
  const feedback = useMemo(() => {
    if (localFeedback) return localFeedback;
    if (checkout.successMessage) return { type: 'success', message: checkout.successMessage };
    if (checkout.error) return { type: 'error', message: checkout.error };
    return null;
  }, [localFeedback, checkout.successMessage, checkout.error]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const paymentTimeLeft =
    bookingStep === 'payment' && checkout.paymentOpenedAtMs
      ? Math.max(0, 1800 - Math.floor((nowMs - checkout.paymentOpenedAtMs) / 1000))
      : 1800;
  const successTimerRef = useRef(null);

  // Post-session feedback modal state (backed by sessionFeedbackSlice + local keystrokes)
  const feedbackTargetSession = useMemo(
    () =>
      mySessions.find(
        (s) => String(s.id) === String(feedbackWorking.targetSessionId),
      ) || null,
    [mySessions, feedbackWorking.targetSessionId],
  );
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const feedbackModalError = feedbackWorking.modalError || '';

  // Escrow dispute modal state (backed by sessionDisputesSlice + local keystrokes)
  const disputeTargetSession = useMemo(
    () =>
      mySessions.find(
        (s) => String(s.id) === String(disputesWorking.targetSessionId),
      ) || null,
    [mySessions, disputesWorking.targetSessionId],
  );
  const [disputeReason, setDisputeReason] = useState('');
  const disputeSubmitting = Boolean(disputesWorking.submitting);
  const disputeModalError = disputesWorking.modalError || '';

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // Non-owners opening Mentors directory must be redirected
  useEffect(() => {
    const isOwnerAllowed =
      allowedRoles.includes('Project Owner') ||
      allowedRoles.includes('admin') ||
      allowedRoles.includes('superuser');
    if (!isOwnerAllowed) {
      navigate('/dashboard', { replace: true });
    }
  }, [allowedRoles, navigate]);

  useEffect(() => {
    let isMounted = true;
    const loadDirectoryData = async () => {
      try {
        const [marketMentors, allProjs, bookedSessions] = await Promise.all([
          dispatch(fetchMentors({ force: true }))
            .unwrap()
            .catch(() => []),
          dispatch(fetchProjects({ force: true }))
            .unwrap()
            .then((r) => r?.items || [])
            .catch(() => []),
          dispatch(fetchMySessions({ force: true }))
            .unwrap()
            .catch(() => []),
        ]);

        const validMentors = Array.isArray(marketMentors) ? marketMentors : [];
        if (isMounted) {
          const owned = (Array.isArray(allProjs) ? allProjs : []).filter(
            (p) => p && (p.ownerId === user?.id || p.owner === user?.name),
          );
          const firstEligible = owned.find(
            (p) => !getProjectBookingStatus(p, bookedSessions).disabled,
          );
          if (firstEligible) setSelectedProjectId(firstEligible.id);
          else if (owned.length > 0) setSelectedProjectId(owned[0].id);

          if (validMentors.length > 0) {
            const mentorIds = validMentors
              .map((m) => String(m.userId || m.id || ''))
              .filter(Boolean);
            if (mentorIds.length > 0) {
              dispatch(fetchTrustSummaries(mentorIds.slice(0, 50)));
            }
          }
        }
      } catch (err) {
        console.error('Failed to load mentors directory:', err);
      }
    };

    loadDirectoryData();

    return () => {
      isMounted = false;
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, [dispatch, user?.id, user?.name]);

  // Sync 30-minute hold countdown from server paymentOpenedAtMs timestamp
  useEffect(() => {
    if (bookingStep !== 'payment') {
      return undefined;
    }
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [bookingStep]);

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleOpenBooking = (mentor) => {
    const viewerId = user?.id || user?.uid;
    if (viewerId && mentor?.userId && String(mentor.userId) === String(viewerId)) {
      return;
    }
    dispatch(openPaymentCheckout({ mentor }));
    setLocalFeedback(null);
    setRequestMsg('');
    const hasCurrentSelected = selectedProjectId && ownedProjects.some((p) => String(p.id) === String(selectedProjectId));
    if (!hasCurrentSelected) {
      const firstEligible = ownedProjects.find((p) => !getProjectBookingStatus(p, mySessions).disabled);
      if (firstEligible) setSelectedProjectId(firstEligible.id);
      else setSelectedProjectId(ownedProjects[0]?.id || '');
    }
  };

  const handleBookAgain = () => {
    dispatch(resetCheckoutToDetails());
    setLocalFeedback(null);
  };

  // Server-sourced fee values from Redux paymentsSlice (zero client arithmetic)
  const {
    basePrice,
    platformFee,
    gatewayFee,
    totalAmount,
    mentorPayout,
  } = checkoutTotals;

  const handleProceedToPayment = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setLocalFeedback({ type: 'error', message: 'Please select one of your projects to book mentorship for.' });
      return;
    }

    const targetProj = ownedProjects.find((p) => String(p.id) === String(selectedProjectId));
    if (!targetProj) {
      setLocalFeedback({ type: 'error', message: 'You can only book mentors for projects that you own.' });
      return;
    }

    const viewerId = user?.id || user?.uid;
    if (viewerId && selectedMentor?.userId && String(selectedMentor.userId) === String(viewerId)) {
      setLocalFeedback({ type: 'error', message: 'You cannot book yourself as a mentor for your own project.' });
      return;
    }

    if (isMentorCollaboratorOnProject(targetProj, selectedMentor?.userId)) {
      setLocalFeedback({ type: 'error', message: 'Cannot book a collaborator or member of this project as its mentor.' });
      return;
    }

    const bookingStatus = getProjectBookingStatus(targetProj, mySessions);
    if (bookingStatus.disabled) {
      setLocalFeedback({ type: 'error', message: `Cannot book mentorship: ${bookingStatus.reason}` });
      return;
    }

    setSubmitting(true);
    setLocalFeedback(null);
    dispatch(setCheckoutError(null));

    try {
      await dispatch(
        bookMentorSession({
          payload: {
            mentorId: selectedMentor.id,
            projectId: selectedProjectId,
            projectDescription:
              requestMsg.trim() ||
              'Mentorship booking for project deliverables and architecture review.',
          },
        }),
      ).unwrap();
      setNowMs(Date.now());
    } catch (err) {
      setLocalFeedback({
        type: 'error',
        message: formatBookingError(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    dispatch(closePaymentCheckout());
    setLocalFeedback(null);
  };

  const handleConfirmPayment = async () => {
    if (!activePaymentSession || confirmingPayment || paymentTimeLeft <= 0) return;

    setLocalFeedback(null);
    try {
      await dispatch(
        confirmSessionPayment({
          sessionId: activePaymentSession.id,
        }),
      ).unwrap();

      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        dispatch(closePaymentCheckout());
        setLocalFeedback(null);
      }, 1600);
    } catch {
      // Friendly formatted error stored in paymentsSlice checkout.error
    }
  };

  const handleCancelPayment = async () => {
    if (activePaymentSession && bookingStep === 'payment') {
      try {
        await dispatch(
          cancelSessionPayment({ sessionId: activePaymentSession.id }),
        ).unwrap();
      } catch (err) {
        console.warn('[MentorsDirectory] Error cancelling payment session:', err);
      }
    }
    handleCloseModal();
  };

  const handleCopyUpi = () => {
    const vpa = activePaymentIntent?.payeeVpa || 'teamforge@demo';
    navigator.clipboard.writeText(vpa);
    dispatch(setCopiedUpi(true));
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => dispatch(setCopiedUpi(false)), 2000);
  };

  const viewerId = user?.id || user?.uid;

  const displayedMentors = mentors.filter((m) => {
    // Hide owner's own mentor profile so they cannot try to book themselves
    if (viewerId && m.userId && String(m.userId) === String(viewerId)) return false;
    // Hide suspended mentors
    if (m.isSuspended || String(m.status || '').toLowerCase() === 'suspended') return false;
    // Hide mentors with availability off
    if (m.isAvailable === false) return false;
    // Do not list demo mentors without a price
    if (!m.sessionPrice || Number(m.sessionPrice) <= 0) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (m.name || '').toLowerCase();
    const title = (m.title || m.bio || '').toLowerCase();
    const skills = Array.isArray(m.skills) ? m.skills.join(' ').toLowerCase() : '';
    return name.includes(q) || title.includes(q) || skills.includes(q);
  });

  const selectedProject = ownedProjects.find((p) => String(p.id) === String(selectedProjectId)) || null;
  const selectedProjectStatus = selectedProject
    ? getProjectBookingStatus(selectedProject, mySessions)
    : null;

  const mentorMap = {};
  mentors.forEach((m) => {
    mentorMap[m.id] = m;
  });

  const historyColumns = [
    {
      key: 'mentor',
      header: 'Mentor',
      render: (s) => {
        const m = mentorMap[s.mentorId];
        return <strong>{m ? m.name : s.mentorName || 'Mentor'}</strong>;
      },
    },
    {
      key: 'project',
      header: 'Project',
      render: (s) => s.projectName || (s.projectId ? `Project #${String(s.projectId).slice(-6)}` : '—'),
    },
    {
      key: 'price',
      header: 'Price',
      render: (s) => <span>₹{(s.agreedPrice || 0).toLocaleString()}</span>,
    },
    {
      key: 'platformFee',
      header: 'Platform Fee (15%)',
      render: (s) => <span className="text-muted">₹{(s.platformFee || 0).toLocaleString()}</span>,
    },
    {
      key: 'gatewayFee',
      header: 'Gateway Fee (2%)',
      render: (s) => <span className="text-muted">₹{(s.gatewayFee || 0).toLocaleString()}</span>,
    },
    {
      key: 'totalAmount',
      header: 'Total Paid',
      render: (s) => <span className="font-bold">₹{(s.totalAmount || 0).toLocaleString()}</span>,
    },
    {
      key: 'payout',
      header: 'Mentor Payout',
      render: (s) => <span className="text-muted">₹{(s.payout || s.agreedPrice || 0).toLocaleString()}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => {
        const map = {
          payment_pending: ['Payment Pending', 'warning'],
          escrow_funded: ['Escrow Funded', 'warning'],
          active: ['Active', 'success'],
          completed: ['Completed', 'completed'],
          refunded: ['Refunded', 'danger'],
          cancelled: ['Cancelled', 'danger'],
          payout_pending: ['Payout Pending', 'warning'],
          disputed: ['Disputed (Frozen)', 'danger'],
          split: ['Split Settled', 'info'],
        };
        const [label, variant] = map[s.status] || [s.status, 'info'];
        return (
          <div>
            <Badge variant={variant}>{label}</Badge>
            {(s.status === 'disputed' || s.disputed) && (
              <div
                data-testid={`session-frozen-badge-${s.id}`}
                style={{ marginTop: '4px', fontSize: '0.78rem', color: '#b91c1c', fontWeight: 600 }}
              >
                Payout Frozen — Admin Dispute Review
              </div>
            )}
            {s.dispute?.status === 'decided' && (
              <div style={{ marginTop: '4px', fontSize: '0.76rem', color: '#334155' }}>
                Decision: <strong>{s.dispute.decision}</strong>
                {s.dispute.decisionReason ? ` — ${s.dispute.decisionReason}` : ''}
              </div>
            )}
            {s.status === 'refunded' && (
              <div style={{ marginTop: '4px', fontSize: '0.78rem', color: '#b91c1c', maxWidth: '240px', wordBreak: 'break-word' }}>
                <strong>Refunded:</strong> ₹{(s.totalAmount || 0).toLocaleString()}
                {s.declineReason && <div>&ldquo;{s.declineReason}&rdquo;</div>}
              </div>
            )}
            {s.status === 'cancelled' && (
              <div style={{ marginTop: '4px', fontSize: '0.78rem', color: '#b91c1c', maxWidth: '240px', wordBreak: 'break-word' }}>
                {s.declineReason || 'Payment not completed'}
              </div>
            )}
            {s.status !== 'refunded' && s.status !== 'cancelled' && s.declineReason && (
              <div style={{ marginTop: '4px', fontSize: '0.78rem', color: '#b91c1c', maxWidth: '240px', wordBreak: 'break-word' }}>
                <strong>{s.declinedBy === 'system' ? 'Auto-declined' : 'Declined'}:</strong> &ldquo;{s.declineReason}&rdquo;
              </div>
            )}
            {s.status === 'escrow_funded' && s.respondBy && (
              <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#64748b' }}>
                Respond by: {formatDateTime(s.respondBy)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'date',
      header: 'Booked',
      render: (s) => (s.createdAt ? formatDateTime(s.createdAt) : '—'),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (s) => {
        const canDispute =
          !s.disputed &&
          s.status !== 'disputed' &&
          s.dispute?.status !== 'decided' &&
          (['escrow_funded', 'active', 'payout_pending'].includes(s.status) ||
            (['completed', 'refunded'].includes(s.status) &&
              Date.now() - new Date(s.completedAt || s.endedAt || s.refundedAt || s.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000));
        return (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {s.status === 'completed' && (
              s.hasFeedback ? (
                <Badge variant="success">Rated</Badge>
              ) : (
                <button
                  type="button"
                  data-testid={`rate-session-btn-${s.id}`}
                  className="tf-mentors-btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  onClick={() => {
                    dispatch(openSessionFeedbackModal(s.id));
                    setFeedbackRating(5);
                    setFeedbackComment('');
                  }}
                >
                  Rate Session
                </button>
              )
            )}
            {canDispute && (
              <button
                type="button"
                data-testid={`open-dispute-btn-${s.id}`}
                className="tf-mentors-btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.78rem', color: '#b91c1c', borderColor: '#fecaca' }}
                onClick={() => {
                  dispatch(openDisputeModal(s.id));
                  setDisputeReason('');
                }}
              >
                Dispute
              </button>
            )}
            {s.status !== 'completed' && !canDispute && '—'}
          </div>
        );
      },
    },
  ];

  return (
    <div id="page-mentors" className="tf-mentors-container">
      <div className="tf-mentors-header">
        <h1 className="tf-mentors-title">Mentors Directory</h1>
        <p className="tf-mentors-subtitle">
          Connect with verified mentors with transparent session pricing and secure escrow protection.
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <FilterTabs
          tabs={[
            { id: 'browse', label: 'Browse Mentors' },
            { id: 'history', label: 'Booking History', count: mySessions.length },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'history' ? (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#111827', margin: '0 0 16px 0' }}>
            My Mentorship Bookings
          </h2>
          <DataTable
            columns={historyColumns}
            data={[...mySessions].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))}
            loading={loading}
            loadingMessage="Loading booking history..."
            emptyTitle="No mentor bookings yet"
            emptyMessage="When you book a mentor for one of your projects, your booking and escrow breakdown will appear here."
            actionLabel="Find a Mentor"
            onAction={() => setActiveTab('browse')}
          />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', marginBottom: '20px' }}>
            <div style={{ flex: '1 1 280px', maxWidth: '480px' }}>
              <SearchBar
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
                placeholder="Search mentors by name or skill..."
              />
            </div>

            {ownedProjects.length > 0 && (
              <div style={{ flex: '1 1 280px', maxWidth: '420px' }}>
                <label
                  htmlFor="directory-project-select"
                  className="tf-mentors-form-label"
                  style={{ display: 'block', marginBottom: '4px' }}
                >
                  Booking for Project
                </label>
                <select
                  id="directory-project-select"
                  className="tf-mentors-input"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  {ownedProjects.map((p) => {
                    const st = getProjectBookingStatus(p, mySessions);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.title || p.name} {st.reason ? `(${st.reason})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {selectedProject && selectedProjectStatus?.disabled && (
            <div
              data-testid="project-not-bookable-banner"
              style={{
                marginBottom: '18px',
                padding: '10px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '0.88rem',
                fontWeight: 600,
              }}
            >
              Booking unavailable for &ldquo;{selectedProject.title || selectedProject.name}&rdquo;: {selectedProjectStatus.reason}
            </div>
          )}

          {loading ? (
            <p>Loading mentors directory...</p>
          ) : displayedMentors.length === 0 ? (
            <EmptyState
              title="No mentors found"
              message={searchQuery ? `No mentors matching "${searchQuery}". Try a different search term.` : 'No mentors currently available in the marketplace.'}
              actionLabel={searchQuery ? 'Clear Search' : undefined}
              onAction={searchQuery ? () => setSearchQuery('') : undefined}
            />
          ) : (
            <div id="mentors-grid" className="tf-mentors-grid">
              {displayedMentors.map((m) => {
                const isCollabMentor =
                  selectedProject && isMentorCollaboratorOnProject(selectedProject, m.userId);
                const projectBlockedReason = isCollabMentor
                  ? 'Already a collaborator on selected project'
                  : selectedProjectStatus?.disabled
                  ? `Project not bookable: ${selectedProjectStatus.reason}`
                  : null;
                const actionDisabled =
                  m.isAvailable === false ||
                  Boolean(m.isFull) ||
                  Boolean(projectBlockedReason);
                const actionLabel = m.isFull
                  ? 'Full'
                  : isCollabMentor
                  ? 'Project Collaborator'
                  : m.isAvailable !== false
                  ? 'Book with Escrow'
                  : 'Currently Unavailable';

                return (
                  <MentorCard
                    key={m.id}
                    name={m.name}
                    avatar={m.avatar}
                    headline={m.title || m.bio || 'Verified Mentor'}
                    bio={m.bio}
                    skills={m.skills}
                    experienceYears={m.experienceYears}
                    sessionPrice={m.sessionPrice}
                    available={m.isAvailable !== false}
                    isFull={Boolean(m.isFull)}
                    activeMenteesCount={m.activeMenteesCount ?? 0}
                    maxActiveMentees={m.maxActiveMentees ?? 3}
                    university={m.university || m.institution || ''}
                    trustSummary={trustSummaries[m.userId || m.id]}
                    action={{
                      label: actionLabel,
                      onClick: () => handleOpenBooking(m),
                      disabled: actionDisabled,
                      disabledReason: projectBlockedReason,
                    }}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Escrow Booking Modal via Reusable Modal */}
      <Modal
        isOpen={Boolean(selectedMentor)}
        title={
          bookingStep === 'payment'
            ? `Demo Payment — ₹${totalAmount}`
            : `Book Mentorship Session: ${selectedMentor?.name || ''}`
        }
        onClose={handleCancelPayment}
        closeDisabled={bookingStep === 'payment' ? confirmingPayment : submitting}
        footer={
          bookingStep === 'payment' ? (
            <>
              <button
                type="button"
                className="tf-myproj-btn-primary"
                style={{ background: '#9ca3af' }}
                disabled={confirmingPayment}
                onClick={handleCancelPayment}
              >
                Cancel
              </button>
              {paymentTimeLeft <= 0 ? (
                <button
                  type="button"
                  className="tf-mentors-btn-primary"
                  style={{ width: 'auto' }}
                  onClick={handleBookAgain}
                >
                  Book again
                </button>
              ) : (
                <button
                  type="button"
                  className="tf-mentors-btn-primary"
                  style={{ width: 'auto' }}
                  disabled={confirmingPayment || paymentTimeLeft <= 0}
                  onClick={handleConfirmPayment}
                >
                  {confirmingPayment
                    ? 'Securing Escrow...'
                    : 'I have paid'}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="tf-myproj-btn-primary"
                style={{ background: '#9ca3af' }}
                onClick={handleCloseModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tf-mentors-btn-primary"
                style={{ width: 'auto' }}
                disabled={submitting || ownedProjects.length === 0 || ownedProjects.every((p) => getProjectBookingStatus(p, mySessions).disabled) || !selectedProjectId}
                onClick={handleProceedToPayment}
              >
                {submitting
                  ? 'Creating Payment Hold...'
                  : platformFee !== null
                  ? `Proceed to Payment (₹${totalAmount})`
                  : `Proceed to Payment (₹${basePrice} + fees)`}
              </button>
            </>
          )
        }
      >
        {selectedMentor && (
          bookingStep === 'payment' ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              {/* Prominent Demo Payment Banner */}
              <div
                style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  color: '#92400e',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                ⚠️ Demo payment: no real money is charged.
              </div>

              {/* Amount & Timer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', padding: '0 8px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
                  Total: ₹{totalAmount}
                </span>
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: paymentTimeLeft < 60 ? '#dc2626' : '#4b5563',
                    background: '#f3f4f6',
                    padding: '4px 10px',
                    borderRadius: '20px',
                  }}
                >
                  ⏱️ Hold expires in: {formatTimer(paymentTimeLeft)}
                </span>
              </div>

              {/* QR Code */}
              <div style={{ margin: '14px 0' }}>
                <QRCodeSvg
                  value={activePaymentIntent?.upiUri || `upi://pay?pa=teamforge@demo&pn=TeamForge&am=${totalAmount}`}
                  size={180}
                />
              </div>

              {/* UPI ID and Copy */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  margin: '8px 0 14px 0',
                }}
              >
                <span style={{ fontSize: '0.825rem', color: '#6b7280' }}>UPI ID:</span>
                <code style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>
                  {activePaymentIntent?.payeeVpa || 'teamforge@demo'}
                </code>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  style={{
                    background: '#e5e7eb',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {copiedUpi ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              {/* Pay using UPI app link */}
              <div>
                <a
                  href={activePaymentIntent?.upiUri || '#'}
                  className="tf-mentors-btn-secondary"
                  style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    fontSize: '0.875rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    marginBottom: '10px',
                  }}
                >
                  📱 Pay using UPI app
                </a>
              </div>

              {paymentTimeLeft <= 0 && (
                <div style={{ marginTop: '14px', padding: '12px', background: '#fee2e2', borderRadius: '8px', color: '#b91c1c' }}>
                  <p style={{ margin: '0 0 10px 0', fontWeight: 600 }}>Payment window expired (Payment not completed). Hold released.</p>
                  <button
                    type="button"
                    className="tf-mentors-btn-primary"
                    style={{ width: 'auto', padding: '6px 16px' }}
                    onClick={handleBookAgain}
                  >
                    Book again
                  </button>
                </div>
              )}

              {feedback && (
                <p
                  className="tf-myproj-card-meta"
                  style={{
                    color: feedback.type === 'success' ? '#16a34a' : '#ef4444',
                    marginTop: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {feedback.message}
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleProceedToPayment}>
              <div className="tf-mentors-form-group">
                <label className="tf-mentors-form-label">Select Your Project</label>
                {ownedProjects.length === 0 ? (
                  <p className="tf-myproj-card-meta" style={{ color: '#dc2626' }}>
                    You have no active projects eligible for mentorship. Please create an active project first.
                  </p>
                ) : (
                  <>
                    <select
                      className="tf-mentors-input"
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      required
                    >
                      <option value="" disabled>-- Select an eligible project --</option>
                      {ownedProjects.map((p) => {
                        const status = getProjectBookingStatus(p, mySessions);
                        return (
                          <option key={p.id} value={p.id} disabled={status.disabled}>
                            {p.title || p.name} {status.reason ? `(${status.reason})` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {selectedProject && selectedProjectStatus?.disabled && (
                      <p className="tf-myproj-card-meta" style={{ color: '#dc2626', marginTop: '6px' }}>
                        Cannot book mentorship for this project: {selectedProjectStatus.reason}
                      </p>
                    )}
                  </>
                )}
              </div>

              <FormInput
                label="Mentorship Needs & Project Goals"
                name="requestMsg"
                value={requestMsg}
                onChange={(e) => setRequestMsg(e.target.value)}
                placeholder="Describe current architecture challenges, code reviews, or guidance needed..."
                multiline
                rows={3}
                helperText="The mentor will review this description before accepting the session."
              />

              {/* Escrow Price Breakdown */}
              <div className="tf-mentors-escrow-breakdown">
                <div className="tf-escrow-breakdown-row">
                  <span>Mentor Price</span>
                  <span>₹{basePrice}</span>
                </div>
                <div className="tf-escrow-breakdown-row">
                  <span>Platform Fee (15%)</span>
                  <span>{platformFee !== null ? `₹${platformFee}` : 'Calculated on server'}</span>
                </div>
                <div className="tf-escrow-breakdown-row">
                  <span>Payment Gateway Fee (2%)</span>
                  <span>{gatewayFee !== null ? `₹${gatewayFee}` : 'Calculated on server'}</span>
                </div>
                <div className="tf-escrow-breakdown-row" style={{ color: '#16a34a', fontWeight: 500 }}>
                  <span>Mentor Payout (on completion)</span>
                  <span>₹{mentorPayout}</span>
                </div>
                <div className="tf-escrow-breakdown-total">
                  <span>Total Amount</span>
                  <span>{platformFee !== null ? `₹${totalAmount}` : `₹${basePrice} + server fees`}</span>
                </div>
                <span className="tf-escrow-badge">
                  🔒 Escrow Protection: Funds will be held securely in escrow upon payment confirmation. Payout is released to the mentor only after you complete and publish the project.
                </span>
              </div>

              {feedback && (
                <p
                  className="tf-myproj-card-meta"
                  style={{
                    color: feedback.type === 'success' ? '#16a34a' : '#ef4444',
                    marginTop: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {feedback.message}
                </p>
              )}
            </form>
          )
        )}
      </Modal>

      {/* Phase 14: Private Post-Session Feedback Modal (1–5 stars, one-time) */}
      <Modal
        isOpen={Boolean(feedbackTargetSession)}
        title="Rate Completed Mentor Session"
        onClose={() => !feedbackSubmitting && dispatch(closeSessionFeedbackModal())}
        footer={
          <>
            <button
              type="button"
              className="tf-myproj-btn-primary"
              style={{ background: '#9ca3af' }}
              disabled={feedbackSubmitting}
              onClick={() => dispatch(closeSessionFeedbackModal())}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="submit-session-feedback-btn"
              className="tf-mentors-btn-primary"
              style={{ width: 'auto' }}
              disabled={feedbackSubmitting}
              onClick={async () => {
                if (!feedbackTargetSession || feedbackSubmitting) return;
                try {
                  await dispatch(
                    submitSessionFeedback({
                      sessionId: feedbackTargetSession.id,
                      payload: {
                        rating: feedbackRating,
                        comment: feedbackComment.trim() || undefined,
                      },
                    }),
                  ).unwrap();
                } catch {
                  // Friendly error stored in sessionFeedback.working.modalError
                }
              }}
            >
              {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </>
        }
      >
        {feedbackTargetSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569' }}>
              Your feedback is confidential: single ratings and comments are visible only to administrators and never alter mentor payouts.
            </p>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
                Session Rating (1 to 5 stars)
              </div>
              <div style={{ display: 'flex', gap: '8px' }} data-testid="feedback-star-selector">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    data-testid={`feedback-star-${star}`}
                    onClick={() => setFeedbackRating(star)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: feedbackRating >= star ? '1px solid #d97706' : '1px solid #cbd5e1',
                      background: feedbackRating >= star ? '#fef3c7' : '#ffffff',
                      color: feedbackRating >= star ? '#b45309' : '#64748b',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ★ {star}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="session-feedback-comment" style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
                Private Comment (optional, max 500 chars)
              </label>
              <textarea
                id="session-feedback-comment"
                data-testid="feedback-comment-input"
                rows={3}
                maxLength={500}
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Share helpful details about mentoring quality and responsiveness..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
                {feedbackComment.trim().length} / 500 characters
              </div>
            </div>
            {feedbackModalError && (
              <div style={{ color: '#dc2626', fontSize: '0.85rem', background: '#fef2f2', padding: '8px 10px', borderRadius: '6px' }}>
                ⚠️ {feedbackModalError}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Phase 17: Open Escrow Dispute Modal */}
      <Modal
        isOpen={Boolean(disputeTargetSession)}
        title="Open Escrow Dispute"
        onClose={() => !disputeSubmitting && dispatch(closeDisputeModal())}
        footer={
          <>
            <button
              type="button"
              className="tf-mentors-btn-secondary"
              disabled={disputeSubmitting}
              onClick={() => dispatch(closeDisputeModal())}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="submit-dispute-btn"
              className="tf-mentors-btn-primary"
              style={{ background: '#dc2626' }}
              disabled={disputeSubmitting || disputeReason.trim().length < 10}
              onClick={async () => {
                if (!disputeTargetSession || disputeSubmitting) return;
                try {
                  await dispatch(
                    openSessionDispute({
                      sessionId: disputeTargetSession.id,
                      reason: disputeReason.trim(),
                    }),
                  ).unwrap();
                } catch {
                  // Error stored in sessionDisputes.working.modalError
                }
              }}
            >
              {disputeSubmitting ? 'Submitting...' : 'Freeze Payout & Open Dispute'}
            </button>
          </>
        }
      >
        {disputeTargetSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569' }}>
              Opening a dispute immediately freezes escrow payout or refund until an administrator reviews evidence from both parties and makes a binding ruling.
            </p>
            <div>
              <label htmlFor="session-dispute-reason" style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
                Dispute Reason (10 to 1000 characters) *
              </label>
              <textarea
                id="session-dispute-reason"
                data-testid="dispute-reason-input"
                rows={4}
                maxLength={1000}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Explain the issue with this mentorship session..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
                {disputeReason.trim().length} / 1000 characters
              </div>
            </div>
            {disputeModalError && (
              <div style={{ color: '#dc2626', fontSize: '0.85rem', background: '#fef2f2', padding: '8px 10px', borderRadius: '6px' }}>
                ⚠️ {disputeModalError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

const MentorsDirectory = MentorsDirectoryContent;
export default MentorsDirectory;
