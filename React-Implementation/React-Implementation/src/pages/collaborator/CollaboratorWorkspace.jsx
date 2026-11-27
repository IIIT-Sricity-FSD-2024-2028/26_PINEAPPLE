import Badge from '../../components/common/Badge';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/selectors/sessionSelectors';
import { useChatMessagesPolling } from '../../hooks/useChatPolling';
import { isProjectLocked } from '../../utils/projectStatus';
import {
  fetchProjectById,
  requestCloseProject,
} from '../../store/thunks/projectsThunks';
import {
  createLeaveRequest,
  fetchMyLeaveRequest,
  withdrawLeaveRequest,
} from '../../store/thunks/leaveRequestsThunks';
import { setLeaveCooldownMessage } from '../../store/slices/leaveRequestsSlice';
import {
  selectLeaveCooldownForProject,
  selectMyLeaveRequestForProject,
} from '../../store/selectors/leaveRequestsSelectors';
import { setSelectedProjectId } from '../../store/slices/projectsSlice';
import {
  selectProjectById,
  selectProjectDetailStatus,
  selectProjectTombstoneById,
} from '../../store/selectors/projectsSelectors';
import {
  fetchTasksByProject,
  unassignTask,
  updateTaskStatus,
} from '../../store/thunks/tasksThunks';
import { fetchFeedbackReasons } from '../../store/thunks/feedbackThunks';
import {
  selectTasksByProjectId,
  selectTasksForbiddenForProject,
} from '../../store/selectors/tasksSelectors';
import { selectReasonsForAction } from '../../store/selectors/feedbackSelectors';
import {
  fetchProjectMessages,
  markProjectChatRead,
  sendProjectMessage,
} from '../../store/thunks/communicationThunks';
import {
  selectChatForbiddenMessage,
  selectIsChatForbidden,
  selectIsSendingMessage,
  selectMessagesByProjectId,
} from '../../store/selectors/communicationSelectors';
import TaskCard from '../../components/features/TaskCard';
import ChatBox from '../../components/features/ChatBox';
import Modal from '../../components/common/Modal';
import SafeLink from '../../components/common/SafeLink';
import FormInput from '../../components/common/FormInput';
import EmptyState from '../../components/common/EmptyState';
import Avatar from '../../components/common/Avatar';
import ProgressBar from '../../components/common/ProgressBar';
import FilterTabs from '../../components/common/FilterTabs';
import { calculateProjectProgress } from '../../utils/progress';
import { formatMemberSince, formatProjectDueDate } from '../../utils/dateFormatter';
import ProjectTombstone from '../ProjectTombstone';
import UniversalReasonModal from '../../components/common/UniversalReasonModal';
import './collaboratorWorkspace.css';

const BackArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.6673 8H3.33398" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CollaboratorWorkspaceContent = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);

  const project = useSelector((state) => selectProjectById(state, projectId));
  const tombstoneData = useSelector((state) =>
    selectProjectTombstoneById(state, projectId),
  );
  const leaveRequest = useSelector((state) =>
    selectMyLeaveRequestForProject(state, projectId),
  );
  const leaveCooldownMsg = useSelector((state) =>
    selectLeaveCooldownForProject(state, projectId),
  );
  const detailStatus = useSelector(selectProjectDetailStatus);

  const tasks = useSelector((state) =>
    selectTasksByProjectId(state, projectId),
  );
  const storeTasksForbidden = useSelector((state) =>
    selectTasksForbiddenForProject(state, projectId),
  );
  const dropReasons = useSelector((state) =>
    selectReasonsForAction(state, 'DROP_TASK'),
  );
  const messages = useSelector((state) =>
    selectMessagesByProjectId(state, projectId),
  );
  const sendingMsg = useSelector((state) =>
    selectIsSendingMessage(state, projectId),
  );
  const chatForbidden = useSelector((state) =>
    selectIsChatForbidden(state, projectId),
  );
  const chatForbiddenMessage = useSelector((state) =>
    selectChatForbiddenMessage(state, projectId),
  );
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab === 'chat' || tab === 'tasks' || tab === 'members' || tab === 'overview') return tab;
    }
    return 'overview';
  });
  const [secondaryLoading, setSecondaryLoading] = useState(true);
  const loading =
    (detailStatus === 'loading' && !project && !tombstoneData) || secondaryLoading;

  // Proof submission modal state
  const [proofTask, setProofTask] = useState(null);
  const [proofUrlInput, setProofUrlInput] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [mutationTasksForbidden, setMutationTasksForbidden] = useState(false);
  const tasksForbidden = storeTasksForbidden || mutationTasksForbidden;

  // Leave project request state (Part 1: Collaborator leaves with owner approval)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [withdrawingLeave, setWithdrawingLeave] = useState(false);

  // Abandoned owner / closure request state
  const [requestingClose, setRequestingClose] = useState(false);
  const [closeRequestMsg, setCloseRequestMsg] = useState('');
  const [closeRequestError, setCloseRequestError] = useState('');

  // Phase 13 / Fix 4: Drop / unassign task modal state (reason ALWAYS required)
  const [unassignTaskTarget, setUnassignTaskTarget] = useState(null);
  const [unassignOpenedAt, setUnassignOpenedAt] = useState(0);
  const [unassignReason, setUnassignReason] = useState('');
  const [unassignReasons, setUnassignReasons] = useState([]);
  const [unassigning, setUnassigning] = useState(false);
  const [unassignError, setUnassignError] = useState('');

  // Phase 9 Part C: Deadline change history modal
  const [deadlineHistoryModalOpen, setDeadlineHistoryModalOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchFeedbackReasons());
  }, [dispatch]);

  useEffect(() => {
    let isMounted = true;
    if (!projectId) return;

    dispatch(setSelectedProjectId(projectId));
    dispatch(fetchProjectById({ id: projectId, force: true }));
    dispatch(fetchMyLeaveRequest({ projectId }));

    const fetchSecondaryWorkspace = async () => {
      try {
        await Promise.all([
          dispatch(fetchTasksByProject({ projectId, force: true }))
            .unwrap()
            .catch(() => []),
          dispatch(fetchProjectMessages({ projectId, force: true })).catch(() => null),
        ]);
      } catch (err) {
        console.error('Failed to load project workspace:', err);
      } finally {
        if (isMounted) {
          setSecondaryLoading(false);
        }
      }
    };

    fetchSecondaryWorkspace();

    return () => {
      isMounted = false;
    };
  }, [dispatch, projectId]);

  useChatMessagesPolling(dispatch, {
    projectId,
    enabled: Boolean(projectId && activeTab === 'chat' && !chatForbidden),
    intervalMs: 6000,
    immediate: false,
  });

  useEffect(() => {
    if (!projectId || activeTab !== 'chat') return undefined;
    dispatch(markProjectChatRead({ projectId }));
    return undefined;
  }, [dispatch, projectId, activeTab]);

  const proofResetTimerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (proofResetTimerRef.current) clearTimeout(proofResetTimerRef.current);
    };
  }, []);

  const isLocked = isProjectLocked(project);

  const handleStartTask = async (taskId) => {
    if (isLocked) return;
    try {
      await dispatch(
        updateTaskStatus({
          id: taskId,
          payload: { status: 'In Progress' },
          optimistic: true,
        }),
      ).unwrap();
    } catch (err) {
      if (err?.statusCode === 403 || err?.code === 'NOT_A_PROJECT_MEMBER') {
        setMutationTasksForbidden(true);
        setFeedback({ type: 'error', message: 'You are not a member of this project.' });
      }
      console.error('Failed to update task status:', err);
    }
  };

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (isLocked || !proofTask) return;
    setSubmittingProof(true);
    setFeedback(null);

    try {
      const finalUrl = proofUrlInput.trim();

      if (!finalUrl) {
        setFeedback({ type: 'error', message: 'Please provide a valid proof URL (e.g., GitHub pull request, Figma, or demo).' });
        setSubmittingProof(false);
        return;
      }

      // Validate URL format and length
      if (finalUrl.length > 2048) {
        setFeedback({ type: 'error', message: 'URL must not exceed 2048 characters.' });
        setSubmittingProof(false);
        return;
      }
      try {
        const parsed = new URL(finalUrl);
        if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
          throw new Error();
        }
      } catch {
        setFeedback({ type: 'error', message: 'Please enter a valid URL starting with http:// or https://' });
        setSubmittingProof(false);
        return;
      }

      await dispatch(
        updateTaskStatus({
          id: proofTask.id,
          payload: {
            status: 'In Review',
            proofUrl: finalUrl,
            proofLink: finalUrl,
            notes: proofNotes,
          },
          clearRejection: true,
        }),
      ).unwrap();

      setFeedback({ type: 'success', message: 'Proof submitted! Task is now In Review.' });
      if (proofResetTimerRef.current) clearTimeout(proofResetTimerRef.current);
      proofResetTimerRef.current = setTimeout(() => {
        setProofTask(null);
        setProofUrlInput('');
        setProofNotes('');
        setFeedback(null);
      }, 1400);
    } catch (err) {
      setFeedback({ type: 'error', message: err.serverMessage || err.message || 'Failed to submit task proof.' });
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleSendMessage = async (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed || chatForbidden) return;
    try {
      await dispatch(
        sendProjectMessage({
          projectId,
          text: trimmed,
          senderId: user?.id,
          senderName: user?.name || 'Collaborator',
          senderRole: 'Collaborator',
          role: 'Collaborator',
          userId: user?.id,
        }),
      ).unwrap();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleLeaveRequestSubmit = async ({ reasons, explanation }) => {
    if (isLocked || isOwner) return;
    dispatch(setLeaveCooldownMessage({ projectId, message: '' }));
    try {
      await dispatch(
        createLeaveRequest({
          projectId,
          payload: { reasons, explanation },
        }),
      ).unwrap();
      setLeaveModalOpen(false);
    } catch (err) {
      console.error('Failed to submit leave request:', err);
      throw err;
    }
  };

  const handleWithdrawLeaveRequest = async () => {
    if (withdrawingLeave) return;
    setWithdrawingLeave(true);
    try {
      await dispatch(withdrawLeaveRequest({ projectId })).unwrap();
    } catch (err) {
      console.error('Failed to withdraw leave request:', err);
    } finally {
      setWithdrawingLeave(false);
    }
  };

  const handleAskAdminToClose = async () => {
    if (isLocked || isOwner || requestingClose) return;
    setRequestingClose(true);
    setCloseRequestError('');
    try {
      await dispatch(requestCloseProject({ projectId, payload: {} })).unwrap();
      setCloseRequestMsg('Close request sent to admins for review.');
    } catch (err) {
      setCloseRequestError(err?.serverMessage || err?.message || 'Failed to submit closure request.');
    } finally {
      setRequestingClose(false);
    }
  };

  const handleOpenUnassignModal = (task) => {
    if (isLocked || !task) return;
    setUnassignOpenedAt(Date.now());
    setUnassignTaskTarget(task);
    setUnassignReason('');
    setUnassignError('');
  };

  const isLateUnassignWindow = (task, nowTsMs) => {
    if (!task?.dueDate) return false;
    const dueMs = new Date(task.dueDate).getTime();
    if (Number.isNaN(dueMs)) return false;
    return dueMs - nowTsMs <= 24 * 60 * 60 * 1000;
  };

  const handleConfirmUnassign = async () => {
    if (isLocked || !unassignTaskTarget || unassigning) return;
    const trimmed = unassignReason.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      setUnassignError('Dropping a task requires a reason (10 to 500 characters).');
      return;
    }
    setUnassigning(true);
    setUnassignError('');
    try {
      const resolvedReasons =
        unassignReasons.length > 0
          ? unassignReasons
          : (dropReasons[0]?.id ? [dropReasons[0].id] : []);
      const payload = {
        feedback: {
          reasons: resolvedReasons,
          explanation: trimmed,
        },
        reasons: resolvedReasons,
        explanation: trimmed,
        reason: trimmed,
      };
      await dispatch(
        unassignTask({
          id: unassignTaskTarget.id,
          payload,
        }),
      ).unwrap();
      setUnassignTaskTarget(null);
      setUnassignReason('');
    } catch (err) {
      setUnassignError(err?.serverMessage || err?.message || 'Failed to drop task.');
    } finally {
      setUnassigning(false);
    }
  };

  if (loading) {
    return (
      <div className="tf-collab-ws-container">
        <div className="tf-collab-ws-card">
          <p>Loading project workspace...</p>
        </div>
      </div>
    );
  }

  if (tombstoneData) {
    return (
      <div className="tf-collab-ws-container">
        <button
          type="button"
          className="tf-collab-ws-back-btn"
          onClick={() => navigate('/my-work')}
        >
          <BackArrowIcon /> Back to My Work
        </button>
        <ProjectTombstone project={tombstoneData} onNavigate={(path) => navigate(path)} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="tf-collab-ws-container">
        <button
          type="button"
          className="tf-collab-ws-back-btn"
          onClick={() => navigate('/my-work')}
        >
          <BackArrowIcon /> Back to My Work
        </button>
        <div className="tf-collab-ws-card">
          <h2>Project not found</h2>
          <p>The requested project workspace does not exist or you do not have permission.</p>
        </div>
      </div>
    );
  }

  const progress = calculateProjectProgress(tasks);
  const isOwner = project.owner === user?.name || project.ownerId === user?.id;
  const rawCollaborators = Array.isArray(project.collaborators) ? project.collaborators : [];
  const ownerName = typeof project.owner === 'object' && project.owner !== null
    ? (project.owner.name || project.owner.id || 'Project Owner')
    : (project.owner || 'Project Owner');
  const mentorName = typeof project.mentor === 'object' && project.mentor !== null
    ? (project.mentor.name || project.mentor.title || 'Assigned Mentor')
    : (project.mentor && project.mentor !== 'None assigned yet' ? project.mentor : null);
  const mentorObj = (mentorName || project.mentorId) ? {
    id: String(project.mentorId || 'mentor'),
    name: mentorName || 'Assigned Mentor',
    role: 'Mentor',
  } : null;
  const approvedCollabCount = rawCollaborators.filter(
    (m) => String(m.id || m.userId) !== String(project.ownerId) && String(m.id || m.userId) !== String(project.mentorId)
  ).length;
  const maxCollaboratorLimit = Number(project.maxCollaborators) > 0 ? Number(project.maxCollaborators) : 5;
  const isProjectFull = Boolean(project.isFull || approvedCollabCount >= maxCollaboratorLimit);

  const allMembers = Array.isArray(project.members) && project.members.length > 0
    ? project.members
    : [
        { id: String(project.ownerId || (typeof project.owner === 'object' ? project.owner?.id : '') || 'owner'), name: ownerName, role: 'Owner' },
        ...rawCollaborators.map((m, i) => {
          const id = typeof m === 'object' ? String(m.id || m.userId || `c-${i}`) : String(m);
          const name = typeof m === 'object' ? (m.name || id) : id;
          const role = typeof m === 'object' && m.role ? m.role : 'Collaborator';
          return { id, name, role };
        }),
        ...(mentorObj ? [mentorObj] : []),
      ];

  const deadlineHistory = Array.isArray(project.deadlineHistory) ? project.deadlineHistory : [];
  const latestDeadlineChange = deadlineHistory.length > 0 ? deadlineHistory[deadlineHistory.length - 1] : null;

  const getDeadlineChangeText = (change) => {
    if (!change) return '';
    const prevDate = formatMemberSince(change.previousDueDate);
    const newDate = formatMemberSince(change.newDueDate);
    const prevTime = new Date(change.previousDueDate).getTime();
    const newTime = new Date(change.newDueDate).getTime();
    const direction = !isNaN(prevTime) && !isNaN(newTime)
      ? (newTime > prevTime ? 'extended from' : newTime < prevTime ? 'moved earlier from' : 'changed from')
      : 'changed from';
    return `Deadline ${direction} ${prevDate} to ${newDate}. Reason: ${change.reason || 'No reason provided'}`;
  };

  return (
    <div className="tf-collab-ws-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button
          type="button"
          className="tf-collab-ws-back-btn"
          style={{ marginBottom: 0 }}
          onClick={() => navigate('/my-work')}
        >
          <BackArrowIcon /> Back
        </button>
        {!isLocked && !isOwner && (
          leaveRequest?.status === 'pending' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="tf-collab-ws-back-btn"
                disabled
                style={{ marginBottom: 0, opacity: 0.65, cursor: 'not-allowed', color: '#64748b', borderColor: '#cbd5e1' }}
                data-testid="leave-requested-btn"
              >
                Leave requested
              </button>
              <button
                type="button"
                className="tf-collab-ws-back-btn"
                style={{ marginBottom: 0, color: '#e11d48', borderColor: '#fecdd3' }}
                disabled={withdrawingLeave}
                onClick={handleWithdrawLeaveRequest}
                data-testid="withdraw-leave-btn"
              >
                {withdrawingLeave ? 'Withdrawing...' : 'Withdraw request'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="tf-collab-ws-back-btn"
              style={{ marginBottom: 0, color: '#e11d48', borderColor: '#fecdd3' }}
              onClick={() => {
                setLeaveModalOpen(true);
              }}
              data-testid="leave-project-btn"
            >
              Leave Project
            </button>
          )
        )}
      </div>

      {/* Main Workspace Card */}
      <div className="tf-collab-ws-card">
        {leaveRequest?.status === 'pending' && (
          <div
            data-testid="collab-pending-leave-banner"
            style={{
              padding: '12px 18px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
              <div>
                <strong style={{ color: '#1e40af', fontSize: '0.92rem' }}>Leave request pending owner review</strong>
                <p style={{ margin: 0, color: '#2563eb', fontSize: '0.84rem' }}>
                  Your request to leave is waiting for owner review. You keep working normally until approved.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="tf-collab-ws-btn-outline"
              style={{ padding: '6px 12px', fontSize: '0.82rem', borderColor: '#93c5fd', color: '#1d4ed8' }}
              disabled={withdrawingLeave}
              onClick={handleWithdrawLeaveRequest}
            >
              {withdrawingLeave ? 'Withdrawing...' : 'Withdraw request'}
            </button>
          </div>
        )}
        {leaveCooldownMsg && (
          <div
            data-testid="collab-leave-cooldown-banner"
            style={{
              padding: '12px 18px',
              backgroundColor: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '8px',
              marginBottom: '16px',
              color: '#be123c',
              fontSize: '0.88rem',
            }}
          >
            ⚠️ {leaveCooldownMsg}
          </div>
        )}
        {project.deletionScheduledAt && (
          <div
            data-testid="collab-scheduled-deletion-banner"
            style={{
              padding: '14px 18px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>⏳</span>
            <div>
              <strong style={{ color: '#991b1b', fontSize: '0.95rem' }}>
                This project is scheduled for deletion on {new Date(project.deletionScheduledAt).toLocaleString()} by the owner.
              </strong>
              <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: '#b91c1c' }}>
                The workspace is currently in a 48-hour notice period and is read-only. You can export or save your notes.
              </p>
            </div>
          </div>
        )}

        <div className="tf-collab-ws-header-row">
          <div className="tf-collab-ws-title-group">
            <div className="tf-collab-ws-title-flex">
              <h1 className="tf-collab-ws-title">{project.title || project.name}</h1>
              <span className="tf-collab-ws-role-badge">
                {isOwner ? 'Project Owner' : 'Collaborator'}
              </span>
              {isProjectFull && <Badge variant="warning">Full</Badge>}
              {isLocked && (
                <span className="tf-collab-ws-role-badge" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>
                  🔒 Locked / Completed
                </span>
              )}
            </div>
            <p className="tf-collab-ws-desc">{project.description || project.desc}</p>
            <div className="tf-collab-ws-meta">
              Owned by <strong>{ownerName}</strong>{mentorName ? <> · Mentor: <strong>{mentorName}</strong></> : null} · 👥 {approvedCollabCount}/{maxCollaboratorLimit} {isProjectFull ? 'Collaborators (Full)' : 'Collaborators'}{project.dueDate ? <> · 📅 <strong>{formatProjectDueDate(project.dueDate)}</strong></> : null}
            </div>
            <div className="tf-collab-ws-skills">
              {(project.skills || project.requiredSkills || []).map((s, i) => (
                <span key={i} className="tf-collab-ws-skill-tag">{s}</span>
              ))}
            </div>
          </div>

          <div className="tf-collab-ws-progress-box">
            <ProgressBar value={progress} size="md" />
          </div>
        </div>

        {/* Abandoned Owner Notice & Closure Request */}
        {!isLocked && !isOwner && (project.ownerInactive14dNotifiedAt || project.ownerInactive14d || project.ownerInactive30d) && (
          <div
            data-testid="abandoned-owner-banner"
            style={{
              marginBottom: '16px',
              padding: '14px 18px',
              borderRadius: '10px',
              background: project.ownerInactive30d ? '#fff7ed' : '#fffbeb',
              border: `1px solid ${project.ownerInactive30d ? '#fdba74' : '#fcd34d'}`,
              color: project.ownerInactive30d ? '#9a3412' : '#92400e',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <strong>
                {project.ownerInactive30d
                  ? 'Owner inactive for 30+ days'
                  : 'Owner inactive for 14+ days'}
              </strong>
              <p style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>
                {project.ownerInactive30d
                  ? 'The project owner has had no login or project activity for 30+ days. You can ask an admin to close this project.'
                  : 'The project owner has had no login or project activity for 14+ days.'}
              </p>
              {(closeRequestMsg || project.closeRequestedAt) && (
                <p data-testid="close-request-status" style={{ margin: '6px 0 0', fontSize: '0.85rem', fontWeight: 600, color: '#047857' }}>
                  {closeRequestMsg || 'Close request sent to admins for review.'}
                </p>
              )}
              {closeRequestError && (
                <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: '#dc2626' }}>
                  {closeRequestError}
                </p>
              )}
            </div>
            {project.ownerInactive30d && !project.closeRequestedAt && !closeRequestMsg && (
              <button
                type="button"
                className="tf-collab-ws-back-btn"
                data-testid="ask-admin-close-btn"
                disabled={requestingClose}
                onClick={handleAskAdminToClose}
                style={{
                  marginBottom: 0,
                  background: '#ea580c',
                  color: '#ffffff',
                  borderColor: '#ea580c',
                  fontWeight: 600,
                }}
              >
                {requestingClose ? 'Sending...' : 'Ask admin to close'}
              </button>
            )}
          </div>
        )}

        {/* Workspace Tabs */}
        <FilterTabs
          className="mb-4"
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'tasks', label: 'Tasks', count: tasks.length },
            { id: 'members', label: 'Members', count: allMembers.length },
            { id: 'chat', label: 'Chat' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div>
            <h3>Project Overview</h3>
            <p className="tf-collab-ws-desc">
              {project.description || project.desc}
            </p>
            {project.objectives && (
              <div>
                <h4>Key Objectives</h4>
                <p className="tf-collab-ws-desc">{project.objectives}</p>
              </div>
            )}
            <div className="tf-collab-ws-meta">
              <p>Mentor: <strong>{mentorName || 'None assigned yet'}</strong></p>
              {project.dueDate && <p><strong>{formatProjectDueDate(project.dueDate)}</strong></p>}
              {latestDeadlineChange && (
                <div
                  className="tf-deadline-change-banner"
                  data-testid="deadline-change-banner"
                  style={{
                    margin: '8px 0 12px 0',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '0.875rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <span data-testid="latest-deadline-change-text">
                      {getDeadlineChangeText(latestDeadlineChange)}
                    </span>
                    {deadlineHistory.length > 1 && (
                      <button
                        type="button"
                        className="tf-collab-ws-btn tf-collab-ws-btn--secondary"
                        data-testid="view-deadline-history-btn"
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          backgroundColor: '#ffffff',
                          border: '1px solid #93c5fd',
                          borderRadius: '6px',
                          color: '#1d4ed8',
                          fontWeight: 500,
                        }}
                        onClick={() => setDeadlineHistoryModalOpen(true)}
                      >
                        View history
                      </button>
                    )}
                  </div>
                </div>
              )}
              {(project.finishedLink || project.finalLink) && (
                <p>
                  Published Link:{' '}
                  <SafeLink href={project.finishedLink || project.finalLink}>
                    {project.finishedLink || project.finalLink}
                  </SafeLink>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Tasks (Rendered via TaskCard) */}
        {activeTab === 'tasks' && (
          <div className="tf-collab-ws-tasks-list">
            {tasksForbidden ? (
              <div
                role="alert"
                data-testid="tasks-forbidden-banner"
                style={{
                  padding: '16px 20px',
                  borderRadius: '10px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontWeight: 600,
                }}
              >
                You are not a member of this project.
              </div>
            ) : tasks.length > 0 ? (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  userRole="Collaborator"
                  isLocked={isLocked}
                  currentUserId={user?.id}
                  currentUserName={user?.name}
                  onStart={handleStartTask}
                  onSubmitProof={(t) => setProofTask(t)}
                  onUnassign={handleOpenUnassignModal}
                />
              ))
            ) : (
              <EmptyState
                title="No tasks assigned yet"
                message="Your project owner hasn't published tasks for this workspace yet."
              />
            )}
          </div>
        )}

        {/* Tab 3: Members */}
        {activeTab === 'members' && (
          <div>
            <h4 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
              Project Members ({allMembers.length})
            </h4>
            <div className="tf-collab-ws-members-grid">
              {allMembers.map((member, i) => {
                if (!member) return null;
                const memberId = String(member.userId || member.id || i);
                const name = member.name || memberId || 'Member';
                const role = member.role || 'Collaborator';
                const isOwner = role === 'Owner';
                const isMentor = role === 'Mentor';
                return (
                  <div key={`${memberId}-${role}`} className="tf-collab-ws-member-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Avatar name={name} src={member.avatarUrl || member.avatar} version={member.updatedAt} size="md" />
                      <div className="tf-collab-ws-member-info">
                        <h4>{name}</h4>
                        <p>{isOwner ? 'Project Lead' : isMentor ? 'Project Mentor' : 'Collaborator'}</p>
                      </div>
                    </div>
                    <Badge variant={isOwner ? 'success' : isMentor ? 'warning' : 'info'}>
                      {role}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Chat (Rendered via reusable ChatBox) */}
        {activeTab === 'chat' && (
          <ChatBox
            projectId={projectId}
            messages={messages}
            currentUserId={user?.id}
            currentUserName={user?.name}
            currentUserRole="Collaborator"
            onSendMessage={handleSendMessage}
            onRefresh={() => dispatch(fetchProjectMessages({ projectId, force: true }))}
            sending={sendingMsg}
            isForbidden={chatForbidden}
            forbiddenMessage={chatForbiddenMessage}
          />
        )}
      </div>

      {/* Task Proof Submission Modal */}
      <Modal
        isOpen={Boolean(proofTask)}
        title="Submit Task Proof"
        onClose={() => setProofTask(null)}
        footer={
          <>
            <button
              type="button"
              className="tf-collab-ws-btn-outline"
              onClick={() => setProofTask(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-collab-ws-btn-primary"
              disabled={submittingProof}
              onClick={handleSubmitProof}
            >
              {submittingProof ? 'Submitting...' : 'Submit for Review'}
            </button>
          </>
        }
      >
        {proofTask && (
          <div>
            <p className="tf-collab-ws-desc">
              Provide live URL or repository link for <strong>{proofTask.title}</strong> for owner review.
            </p>

            <FormInput
              label="Proof URL (Pull Request, Live Demo, Figma, etc.)"
              name="proofUrl"
              value={proofUrlInput}
              onChange={(e) => setProofUrlInput(e.target.value)}
              placeholder="https://github.com/... or https://..."
            />

            <FormInput
              label="Submission Notes (Optional)"
              name="proofNotes"
              value={proofNotes}
              onChange={(e) => setProofNotes(e.target.value)}
              placeholder="Provide context, pull request link, or notes for the owner..."
              multiline
              rows={3}
            />

            {feedback && (
              <div
                className={`tf-collab-ws-feedback ${
                  feedback.type === 'success'
                    ? 'tf-collab-ws-feedback-success'
                    : 'tf-collab-ws-feedback-error'
                }`}
              >
                {feedback.message}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal: Leave Project Request */}
      <UniversalReasonModal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        onConfirm={handleLeaveRequestSubmit}
        actionType="LEAVE_PROJECT"
        title="Leave Project"
        description={`Submit a request to leave "${project?.title || project?.name || 'this project'}". The owner will review your request before departure.`}
        confirmLabel="Submit Leave Request"
        entityName={project?.title || project?.name || 'Project'}
      />

      {/* Modal: Drop / Unassign Task */}
      <Modal
        isOpen={Boolean(unassignTaskTarget)}
        title={`Drop Task — ${unassignTaskTarget?.title || 'Task'}`}
        onClose={() => !unassigning && setUnassignTaskTarget(null)}
        footer={(() => {
          const trimmedLen = unassignReason.trim().length;
          const invalid = trimmedLen < 10 || trimmedLen > 500 || (dropReasons.length > 0 && unassignReasons.length === 0);
          return (
            <>
              <button
                type="button"
                className="tf-collab-ws-btn-outline"
                disabled={unassigning}
                onClick={() => setUnassignTaskTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tf-collab-ws-btn-primary"
                data-testid="confirm-task-unassign-btn"
                style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                disabled={unassigning || invalid}
                onClick={handleConfirmUnassign}
              >
                {unassigning ? 'Dropping...' : 'Confirm Drop Task'}
              </button>
            </>
          );
        })()}
      >
        {(() => {
          const isLate = isLateUnassignWindow(unassignTaskTarget, unassignOpenedAt);
          const trimmedLen = unassignReason.trim().length;

          return (
            <div data-testid="task-unassign-modal" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
                Dropping <strong>{unassignTaskTarget?.title}</strong> will return it to <strong>Unassigned</strong> and <strong>To Do</strong>.
              </p>

              {isLate ? (
                <div
                  data-testid="late-unassign-notice"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#fff7ed',
                    border: '1px solid #fdba74',
                    color: '#9a3412',
                    fontSize: '0.85rem',
                  }}
                >
                  <strong>Within 24 hours of due date:</strong> A reason (10 to 500 characters) is required and will be sent to the project owner.
                </div>
              ) : (
                <p data-testid="early-unassign-notice" style={{ margin: 0, fontSize: '0.85rem', color: '#047857' }}>
                  A reason (10 to 500 characters) is required and will be recorded in the task history.
                </p>
              )}

              {dropReasons.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Select Reasons <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {dropReasons.map((r) => {
                      const isSelected = unassignReasons.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          data-testid={`reason-chip-${r.id}`}
                          onClick={() => {
                            setUnassignReasons((prev) =>
                              prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                            );
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            border: isSelected ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            color: isSelected ? '#1d4ed8' : '#334155',
                            fontSize: '0.8rem',
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
              )}

              <div>
                <label
                  htmlFor="task-unassign-reason-textarea"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                >
                  Explanation (10 to 500 characters) *
                </label>
                <textarea
                  id="task-unassign-reason-textarea"
                  data-testid="task-unassign-reason-input"
                  rows={3}
                  value={unassignReason}
                  onChange={(e) => {
                    setUnassignReason(e.target.value);
                    if (unassignError && e.target.value.trim().length >= 10 && e.target.value.trim().length <= 500) {
                      setUnassignError('');
                    }
                  }}
                  placeholder="Explain why you need to drop this task..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ marginTop: '4px', fontSize: '0.78rem', color: trimmedLen >= 10 && trimmedLen <= 500 ? '#059669' : '#64748b' }}>
                  {trimmedLen} / 500 characters (minimum 10)
                </div>
              </div>
              {unassignError && (
                <div data-testid="task-unassign-error" style={{ color: '#dc2626', fontSize: '0.85rem', background: '#fef2f2', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                  ⚠️ {unassignError}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Modal: Project Deadline History */}
      <Modal
        isOpen={deadlineHistoryModalOpen}
        title="Project Deadline History"
        onClose={() => setDeadlineHistoryModalOpen(false)}
        testId="deadline-history-modal"
        footer={(
          <button
            type="button"
            className="tf-collab-ws-btn-outline"
            data-testid="close-deadline-history-btn"
            onClick={() => setDeadlineHistoryModalOpen(false)}
          >
            Close
          </button>
        )}
      >
        <div data-testid="deadline-history-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
          {deadlineHistory.slice().reverse().map((entry, idx) => {
            const prevTime = new Date(entry.previousDueDate).getTime();
            const newTime = new Date(entry.newDueDate).getTime();
            const direction = !isNaN(prevTime) && !isNaN(newTime)
              ? (newTime > prevTime ? 'Extended' : newTime < prevTime ? 'Moved earlier' : 'Changed')
              : 'Changed';
            return (
              <div
                key={idx}
                className="tf-deadline-history-item"
                data-testid={`deadline-history-item-${idx}`}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.875rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#64748b', fontSize: '0.8rem' }}>
                  <span><strong>Date changed:</strong> {entry.changedAt ? formatMemberSince(entry.changedAt) : 'N/A'}</span>
                  <span><strong>Changed by:</strong> {entry.changedByName || entry.changedBy || 'Project Owner'}</span>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{direction}: </span>
                  <span>{formatMemberSince(entry.previousDueDate)}</span>
                  {' ➔ '}
                  <span style={{ fontWeight: 600, color: '#2563eb' }}>{formatMemberSince(entry.newDueDate)}</span>
                </div>
                <div style={{ color: '#334155' }}>
                  <strong>Reason:</strong> {entry.reason || 'No reason provided'}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
};

const CollaboratorWorkspace = CollaboratorWorkspaceContent;
export default CollaboratorWorkspace;
