import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/selectors/sessionSelectors';
import { useChatMessagesPolling } from '../../hooks/useChatPolling';
import { getProjectSeatCounts, isProjectLocked } from '../../utils/projectStatus';
import {
  applyProjectTaskTemplates,
  cancelProjectDeletion,
  changeProjectDeadline,
  completeProject,
  fetchProjectById,
  fetchProjectTaskTemplates,
  fetchRemovalCheck,
  releaseMemberTasks,
  removeProjectMember,
  updateProject,
} from '../../store/thunks/projectsThunks';
import {
  setRemovalCheckEntry,
  setSelectedProjectId,
  updateOne,
} from '../../store/slices/projectsSlice';
import {
  selectProjectById,
  selectProjectDetailStatus,
  selectProjectRemovalChecks,
  selectProjectTombstoneById,
} from '../../store/selectors/projectsSelectors';
import {
  createTask,
  deleteTask,
  fetchTasksByProject,
  reviewTask,
  updateTask,
} from '../../store/thunks/tasksThunks';
import {
  updateOne as updateTaskOne,
  upsertMany as upsertTasks,
} from '../../store/slices/tasksSlice';
import {
  selectTasksByProjectId,
  selectTasksForbiddenForProject,
} from '../../store/selectors/tasksSelectors';
import {
  fetchJoinRequests,
  respondJoinRequest,
} from '../../store/thunks/joinRequestsThunks';
import {
  cancelProjectInvite,
  fetchProjectInvites,
  sendProjectInvite,
} from '../../store/thunks/invitesThunks';
import {
  approveLeaveRequest,
  fetchProjectLeaveRequests,
  rejectLeaveRequest,
} from '../../store/thunks/leaveRequestsThunks';
import {
  setMembersSubSection as setMembersSubSectionAction,
  setRequestStatusFilter as setRequestStatusFilterAction,
} from '../../store/slices/joinRequestsSlice';
import {
  selectCombinedProjectRequests,
  selectFilteredCombinedProjectRequests,
  selectJoinRequestsByProjectId,
  selectMembersSubSection,
  selectRequestStatusFilter,
} from '../../store/selectors/joinRequestsSelectors';
import { selectInvitesSendStatus } from '../../store/selectors/invitesSelectors';
import {
  selectLeaveProcessingIds,
  selectPendingLeaveRequestsByProjectId,
} from '../../store/selectors/leaveRequestsSelectors';
import {
  fetchProjectAbandonmentReview,
  openAbandonmentReview,
} from '../../store/thunks/abandonmentReviewsThunks';
import {
  closeReportMentorModal,
  openReportMentorModal,
  setReportMentorReason,
} from '../../store/slices/abandonmentReviewsSlice';
import {
  selectAbandonmentWorking,
  selectIsOpeningAbandonmentForProject,
  selectProjectAbandonmentInfo,
} from '../../store/selectors/abandonmentReviewsSelectors';
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
import {
  fetchPublicProfile,
  fetchTrustSummaries,
  searchUsers as searchUsersThunk,
} from '../../store/thunks/profilesThunks';
import { selectTrustSummariesMap } from '../../store/selectors/profilesSelectors';
import TaskCard from '../../components/features/TaskCard';
import JoinRequestCard from '../../components/features/JoinRequestCard';
import UserTrustCard from '../../components/features/UserTrustCard';
import ChatBox from '../../components/features/ChatBox';
import Modal from '../../components/common/Modal';
import SafeLink from '../../components/common/SafeLink';
import FormInput from '../../components/common/FormInput';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import ProgressBar from '../../components/common/ProgressBar';
import FilterTabs from '../../components/common/FilterTabs';
import { calculateProjectProgress } from '../../utils/progress';
import { getTaskReward } from '../../utils/workflow';
import DatePicker from '../../components/common/DatePicker';
import { formatMemberSince, formatDateTime, formatProjectDueDate } from '../../utils/dateFormatter';
import StarterTaskPicker from '../../components/features/StarterTaskPicker';
import {
  STARTER_TASK_CONSTRAINTS,
  formatStarterTaskError,
} from '../../constants/projectCategories';
import { highlightMatch } from '../../utils/highlightMatch';
import DeleteProjectDialog from '../../components/features/DeleteProjectDialog';
import UniversalReasonModal from '../../components/common/UniversalReasonModal';
import ProjectTombstone from '../ProjectTombstone';
import './ownedWorkspace.css';

const BackArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.6673 8H3.33398" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const OwnedWorkspaceContent = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);

  const project = useSelector((state) => selectProjectById(state, projectId));
  const tombstoneData = useSelector((state) =>
    selectProjectTombstoneById(state, projectId),
  );
  const removalChecks = useSelector((state) =>
    selectProjectRemovalChecks(state, projectId),
  );
  const detailStatus = useSelector(selectProjectDetailStatus);

  const tasks = useSelector((state) =>
    selectTasksByProjectId(state, projectId),
  );
  const storeTasksForbidden = useSelector((state) =>
    selectTasksForbiddenForProject(state, projectId),
  );
  const joinRequests = useSelector((state) =>
    selectJoinRequestsByProjectId(state, projectId),
  );
  const combinedRequestsData = useSelector((state) =>
    selectCombinedProjectRequests(state, projectId),
  );
  const filteredItems = useSelector((state) =>
    selectFilteredCombinedProjectRequests(state, projectId),
  );
  const requestStatusFilter = useSelector(selectRequestStatusFilter);
  const storeMembersSubSection = useSelector(selectMembersSubSection);
  const [urlMembersSubSection, setUrlMembersSubSection] = useState(() => {
    const sec = new URLSearchParams(location.search).get('section');
    if (sec === 'requests' || sec === 'team') return sec;
    return null;
  });
  const membersSubSection = urlMembersSubSection || storeMembersSubSection;
  const setMembersSubSection = (sec) => {
    setUrlMembersSubSection(null);
    dispatch(setMembersSubSectionAction(sec));
  };
  const setRequestStatusFilter = (filterVal) => {
    dispatch(setRequestStatusFilterAction(filterVal));
  };
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
  const tabFromSearch = useMemo(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    return ['overview', 'tasks', 'members', 'chat'].includes(tab) ? tab : null;
  }, [location.search]);
  const [tabOverride, setTabOverride] = useState({ search: location.search, tab: null });
  const activeTab =
    tabOverride.search === location.search && tabOverride.tab
      ? tabOverride.tab
      : tabFromSearch || 'overview';
  const setActiveTab = useCallback(
    (tab) => setTabOverride({ search: location.search, tab }),
    [location.search],
  );
  const [secondaryLoading, setSecondaryLoading] = useState(true);
  const loading =
    (detailStatus === 'loading' && !project && !tombstoneData) || secondaryLoading;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const secParam = params.get('section');
    if (secParam && ['all', 'team', 'requests'].includes(secParam)) {
      dispatch(setMembersSubSectionAction(secParam));
    }
  }, [dispatch, location.search]);

  // Create Task Modal state
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    xpReward: 20,
    assigneeId: '',
    assigneeName: '',
    assignee: '',
    difficulty: 'Medium',
    dueDate: '',
  });
  const [taskFormError, setTaskFormError] = useState('');
  const [mutationTasksForbidden, setMutationTasksForbidden] = useState(false);
  const tasksForbidden = storeTasksForbidden || mutationTasksForbidden;
  const [minTaskDate] = useState(() => new Date());
  const [creatingTask, setCreatingTask] = useState(false);

  // Publish Finished Project Modal state
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [finishedLink, setFinishedLink] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [completionBadgeNotice, setCompletionBadgeNotice] = useState(null);

  // Remove Member Modal state
  const [removeMemberTarget, setRemoveMemberTarget] = useState(null);
  const [removeReason, setRemoveReason] = useState('');
  const [removingMember, setRemovingMember] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [removeBlockers, setRemoveBlockers] = useState([]);
  const [taskFilter, setTaskFilter] = useState(null);

  const displayTasks = useMemo(() => {
    if (!taskFilter) return tasks;
    if (Array.isArray(taskFilter.taskIds) && taskFilter.taskIds.length > 0) {
      return tasks.filter((t) => taskFilter.taskIds.includes(t.id));
    }
    if (taskFilter.memberId) {
      return tasks.filter((t) => {
        const mId = String(taskFilter.memberId).toLowerCase();
        return (
          (t.assigneeId && String(t.assigneeId).toLowerCase() === mId) ||
          (t.assignee && String(t.assignee).toLowerCase() === mId)
        );
      });
    }
    return tasks;
  }, [tasks, taskFilter]);

  // Decline Join Request Modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetRequest, setRejectTargetRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const toastTimeoutRef = useRef(null);

  // Phase 15: Direct invites + Project Deletion Enhancement
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [cancellingDeletion, setCancellingDeletion] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState([]);
  const [searchingInviteUsers, setSearchingInviteUsers] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const storeSendInviteStatus = useSelector(selectInvitesSendStatus);
  const [inviteFeedback, setInviteFeedback] = useState(null);
  const trustSummaries = useSelector(selectTrustSummariesMap);

  // Leave Requests state (Part 1: Collaborator leaves with owner approval)
  const pendingLeaveRequests = useSelector((state) =>
    selectPendingLeaveRequestsByProjectId(state, projectId),
  );
  const leaveProcessingIds = useSelector(selectLeaveProcessingIds);
  const [rejectLeaveModalOpen, setRejectLeaveModalOpen] = useState(false);
  const [rejectingLeaveRequest, setRejectingLeaveRequest] = useState(null);
  const [processingLeaveId, setProcessingLeaveId] = useState(null);

  const handleCancelDeletion = async () => {
    if (cancellingDeletion) return;
    setCancellingDeletion(true);
    try {
      await dispatch(cancelProjectDeletion({ id: projectId })).unwrap();
      showToast('Scheduled deletion cancelled. The project has been restored.', 'success');
    } catch (err) {
      showToast(err?.serverMessage || err?.message || 'Failed to cancel deletion.', 'error');
    } finally {
      setCancellingDeletion(false);
    }
  };

  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Applicant Profile Modal state
  const [applicantModalOpen, setApplicantModalOpen] = useState(false);
  const [applicantProfile, setApplicantProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [targetRequest, setTargetRequest] = useState(null);

  // Change Project Deadline Modal state
  const [changeDeadlineModalOpen, setChangeDeadlineModalOpen] = useState(false);
  const [newDeadlineDate, setNewDeadlineDate] = useState('');
  const [changeDeadlineReason, setChangeDeadlineReason] = useState('');
  const [changeDeadlineError, setChangeDeadlineError] = useState('');
  const [changingDeadline, setChangingDeadline] = useState(false);
  const [shiftTasks, setShiftTasks] = useState(false);
  const [minProjectDeadline] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000));

  // Edit Project Settings Modal state
  const [editProjectModalOpen, setEditProjectModalOpen] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState({
    title: '',
    description: '',
    skills: '',
    teamSize: 5,
    dueDate: '',
  });
  const [editProjectError, setEditProjectError] = useState('');
  const [savingProjectSettings, setSavingProjectSettings] = useState(false);

  // Phase 12: Zombie countdown timestamp & Release Member Tasks modal state
  const [nowTs] = useState(() => Date.now());
  const [releaseTasksTarget, setReleaseTasksTarget] = useState(null);
  const [releasingTasks, setReleasingTasks] = useState(false);
  const [releaseTasksError, setReleaseTasksError] = useState('');

  // Phase 13: Task rejection modal state (mandatory 10-500 char reason)
  const [rejectTaskTarget, setRejectTaskTarget] = useState(null);
  const [rejectTaskReason, setRejectTaskReason] = useState('');
  const [rejectTaskError, setRejectTaskError] = useState('');
  const [rejectingTask, setRejectingTask] = useState(false);
  // Phase 29: Review Time Credit & Mandatory Project Deadline Cascade state
  const [rejectExtendedProjectDueDate, setRejectExtendedProjectDueDate] = useState('');
  const [rejectProjectExtensionReason, setRejectProjectExtensionReason] = useState('');

  // Phase 14: Mentor activity & abandonment review state (backed by abandonmentReviewsSlice)
  const mentorAbandonmentInfo = useSelector((state) =>
    selectProjectAbandonmentInfo(state, projectId),
  );
  const abandonmentWorking = useSelector(selectAbandonmentWorking);
  const reportingMentor = useSelector((state) =>
    selectIsOpeningAbandonmentForProject(state, projectId),
  );
  const reportMentorModalOpen = Boolean(abandonmentWorking.reportModalOpen);
  const reportMentorReason = abandonmentWorking.reportReason || '';
  const reportMentorError = abandonmentWorking.reportError || '';

  // Phase 28: Starter Task Templates picker modal state
  const [starterModalOpen, setStarterModalOpen] = useState(false);
  const [starterLoading, setStarterLoading] = useState(false);
  const [starterCategory, setStarterCategory] = useState('General');
  const [starterTemplates, setStarterTemplates] = useState([]);
  const [starterSelectedKeys, setStarterSelectedKeys] = useState([]);
  const [starterOverrides, setStarterOverrides] = useState({});
  const [applyingStarterTasks, setApplyingStarterTasks] = useState(false);
  const [starterError, setStarterError] = useState('');
  const [starterSkipped, setStarterSkipped] = useState([]);

  useEffect(() => {
    let isMounted = true;
    if (!projectId) return;

    dispatch(setSelectedProjectId(projectId));

    const fetchWorkspace = async () => {
      try {
        const [projAction, , reqsData, , invitesRes] = await Promise.all([
          dispatch(fetchProjectById({ id: projectId, force: true }))
            .unwrap()
            .then((res) => res?.project || null)
            .catch(() => null),
          dispatch(fetchTasksByProject({ projectId, force: true }))
            .unwrap()
            .then((res) => res?.items || [])
            .catch(() => []),
          dispatch(fetchJoinRequests({ projectId, force: true }))
            .unwrap()
            .then((res) => res?.items || [])
            .catch(() => []),
          dispatch(fetchProjectMessages({ projectId, force: true })).catch(() => null),
          dispatch(fetchProjectInvites({ projectId, force: true }))
            .unwrap()
            .then((res) => res?.items || [])
            .catch(() => []),
          dispatch(fetchProjectLeaveRequests({ projectId, force: true }))
            .unwrap()
            .then((res) => res?.items || [])
            .catch(() => []),
        ]);

        if (isMounted) {
          let projData = projAction;
          if (
            projData &&
            (projData.isCompleted || String(projData.status).toLowerCase() === 'completed') &&
            !projData.finalLink &&
            !projData.finishedLink
          ) {
            projData = { ...projData, isCompleted: false, status: 'In Progress' };
            dispatch(updateOne({ id: projectId, changes: { isCompleted: false, status: 'In Progress' } }));
          }
          if (projData?.finishedLink || projData?.finalLink) {
            setFinishedLink(projData.finishedLink || projData.finalLink);
          }
          if (projData?.mentorId) {
            dispatch(fetchProjectAbandonmentReview({ projectId }));
          }

          // Bulk fetch trust summaries for all members, applicants, and invitees
          try {
            const memberIds = Array.isArray(projData?.members)
              ? projData.members.map((m) => String(m.id || m.userId || '')).filter(Boolean)
              : [];
            const reqUserIds = Array.isArray(reqsData)
              ? reqsData.map((r) => String(r.userId || r.applicantId || '')).filter(Boolean)
              : [];
            const inviteeIds = Array.isArray(invitesRes)
              ? invitesRes.map((inv) => String(inv.invitedUserId || '')).filter(Boolean)
              : [];
            const allUserIds = Array.from(new Set([...memberIds, ...reqUserIds, ...inviteeIds]));
            if (allUserIds.length > 0) {
              dispatch(fetchTrustSummaries(allUserIds.slice(0, 50)));
            }
          } catch {
            // Non-critical
          }
        }
      } catch (err) {
        console.error('Failed to load owned project workspace:', err);
      } finally {
        if (isMounted) {
          setSecondaryLoading(false);
        }
      }
    };

    fetchWorkspace();

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

  // Mark chat read when opening chat tab
  useEffect(() => {
    if (!projectId || activeTab !== 'chat') return undefined;
    dispatch(markProjectChatRead({ projectId }));
    return undefined;
  }, [dispatch, projectId, activeTab]);

  const fetchRemovalChecks = useCallback(async () => {
    if (!projectId || !project) return;
    const collabs = (Array.isArray(project.collaborators) ? project.collaborators : []).concat(
      Array.isArray(project.members) ? project.members.filter((m) => String(m.role || '').toLowerCase() === 'collaborator') : []
    );
    const uniqueIds = Array.from(new Set(
      collabs
        .map((c) => (typeof c === 'string' ? c : (c.userId || c.id)))
        .filter(Boolean)
        .map(String)
    ));
    if (uniqueIds.length === 0) return;

    await Promise.allSettled(
      uniqueIds.map((uId) => dispatch(fetchRemovalCheck({ projectId, userId: uId }))),
    );
  }, [dispatch, projectId, project]);

  useEffect(() => {
    if (!projectId || !project) return undefined;
    const collabs = (Array.isArray(project.collaborators) ? project.collaborators : []).concat(
      Array.isArray(project.members) ? project.members.filter((m) => String(m.role || '').toLowerCase() === 'collaborator') : []
    );
    const uniqueIds = Array.from(new Set(
      collabs
        .map((c) => (typeof c === 'string' ? c : (c.userId || c.id)))
        .filter(Boolean)
        .map(String)
    ));
    if (uniqueIds.length === 0) return undefined;

    uniqueIds.forEach((uId) => {
      dispatch(fetchRemovalCheck({ projectId, userId: uId }));
    });
    return undefined;
  }, [dispatch, projectId, project]);

  const isLocked = isProjectLocked(project);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (isLocked || !taskForm.title.trim()) return;

    if (!taskForm.dueDate) {
      setTaskFormError('Task due date is required.');
      return;
    }
    const dueTime = new Date(taskForm.dueDate).getTime();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueTime < today.getTime()) {
      setTaskFormError('Task due date cannot be in the past.');
      return;
    }
    if (project?.dueDate) {
      const projectDueTime = new Date(project.dueDate).getTime();
      if (dueTime > projectDueTime) {
        setTaskFormError(`Task due date cannot exceed project due date (${formatMemberSince(project.dueDate)}).`);
        return;
      }
    }
    setTaskFormError('');

    setCreatingTask(true);
    try {
      const priority = taskForm.priority || 'Medium';
      const reward = getTaskReward(priority);
      const xpReward = reward.xp;
      const selectedMember = members.find((m) => {
        const mId = m.id || m.userId;
        return String(mId) === String(taskForm.assigneeId);
      });
      const assigneeId = selectedMember ? String(selectedMember.id || selectedMember.userId) : (taskForm.assigneeId || undefined);
      const assigneeName = selectedMember?.name || (taskForm.assigneeId ? taskForm.assignee : 'Unassigned');

      await dispatch(
        createTask({
          payload: {
            projectId,
            title: taskForm.title.trim(),
            description: taskForm.description.trim(),
            priority,
            xpReward,
            assigneeId: assigneeId || undefined,
            assigneeName: assigneeName || 'Unassigned',
            assignee: assigneeName || 'Unassigned',
            difficulty: taskForm.difficulty || priority,
            dueDate: taskForm.dueDate,
            status: 'To Do',
          },
        }),
      ).unwrap();

      setCreateTaskModalOpen(false);
      setTaskForm({
        title: '',
        description: '',
        priority: 'Medium',
        xpReward: 20,
        assigneeId: '',
        assigneeName: '',
        assignee: '',
        difficulty: 'Medium',
        dueDate: '',
      });
      setTaskFormError('');
    } catch (err) {
      console.error('Failed to create task:', err);
      if (err?.statusCode === 403 || err?.code === 'NOT_A_PROJECT_MEMBER') {
        setMutationTasksForbidden(true);
        setTaskFormError('You are not a member of this project.');
      } else if (err?.code === 'TASK_LIMIT_REACHED' || err?.data?.code === 'TASK_LIMIT_REACHED') {
        setTaskFormError(formatStarterTaskError('TASK_LIMIT_REACHED', err?.serverMessage || err?.message));
      } else {
        setTaskFormError(err?.serverMessage || err?.message || 'Failed to create task.');
      }
    } finally {
      setCreatingTask(false);
    }
  };

  const handleApproveTask = async (taskId) => {
    if (isLocked) return;
    try {
      const taskObj = tasks.find((t) => t.id === taskId);
      const reward = getTaskReward(taskObj?.priority || taskObj?.difficulty);
      const res = await dispatch(
        reviewTask({
          id: taskId,
          payload: { decision: 'approve' },
          projectId,
        }),
      ).unwrap();
      if (res?.task?.xpReward === undefined) {
        dispatch(
          updateTaskOne({
            id: String(taskId),
            changes: { xpAwarded: true, xpReward: reward.xp },
          }),
        );
      }
      fetchRemovalChecks();
    } catch (err) {
      if (err?.statusCode === 403 || err?.code === 'NOT_A_PROJECT_MEMBER') {
        setMutationTasksForbidden(true);
        showToast('You are not a member of this project.', 'error');
      } else {
        showToast(err?.serverMessage || err?.message || 'Failed to approve task.', 'error');
      }
      console.error('Failed to approve task:', err);
    }
  };

  const [rejectModalOpenedAt, setRejectModalOpenedAt] = useState(0);

  // Phase 29: Review Time Credit helper for Rejection Modal
  const getRejectionReviewCreditInfo = (task, proj, nowMs = 0) => {
    if (!task) return null;
    const subAt = task.submittedAt || task.inReviewSince;
    const subMs = subAt ? new Date(subAt).getTime() : 0;
    const now = nowMs;
    const durationMs = subMs > 0 && now > subMs ? now - subMs : 0;
    const durationMinutes = Math.floor(durationMs / (60 * 1000));
    const days = Math.floor(durationMinutes / (24 * 60));
    const hours = Math.floor((durationMinutes % (24 * 60)) / 60);
    const minutes = durationMinutes % 60;

    let formattedDuration = '0 minutes';
    if (days > 0) {
      formattedDuration = `${days} ${days === 1 ? 'day' : 'days'}${hours > 0 ? ` ${hours} ${hours === 1 ? 'hour' : 'hours'}` : ''}`;
    } else if (hours > 0) {
      formattedDuration = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    } else if (minutes > 0) {
      formattedDuration = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    }

    const hasMinDuration = durationMinutes >= 60;
    const creditMs = hasMinDuration ? Math.min(durationMs, 14 * 24 * 60 * 60 * 1000) : 0;
    const origTaskDueMs = task.dueDate ? new Date(task.dueDate).getTime() : 0;
    const newTaskDueIso = origTaskDueMs > 0 && creditMs > 0 ? new Date(origTaskDueMs + creditMs).toISOString() : task.dueDate;
    const projDueMs = proj?.dueDate ? new Date(proj.dueDate).getTime() : 0;
    const requiresProjectExtension = Boolean(
      origTaskDueMs > 0 && creditMs > 0 && projDueMs > 0 && (origTaskDueMs + creditMs) > projDueMs
    );

    return {
      durationMs,
      durationMinutes,
      formattedDuration,
      creditMs,
      hasMinDuration,
      newTaskDueIso,
      requiresProjectExtension,
      origTaskDueDate: task.dueDate,
      projectDueDate: proj?.dueDate,
    };
  };

  const handleRejectTask = (taskId) => {
    if (isLocked) return;
    const taskObj = tasks.find((t) => t.id === taskId);
    if (!taskObj) return;
    setRejectModalOpenedAt(Date.now());
    setRejectTaskTarget(taskObj);
    setRejectTaskReason('');
    setRejectTaskError('');
    setRejectExtendedProjectDueDate('');
    setRejectProjectExtensionReason('');
  };

  const handleConfirmRejectTask = async () => {
    if (isLocked || !rejectTaskTarget || rejectingTask) return;
    const trimmed = rejectTaskReason.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      setRejectTaskError('Please provide a reason between 10 and 500 characters.');
      return;
    }

    const creditInfo = getRejectionReviewCreditInfo(
      rejectTaskTarget,
      project,
      rejectModalOpenedAt,
    );
    const requiresExtension = Boolean(creditInfo?.requiresProjectExtension);

    if (requiresExtension) {
      if (!rejectExtendedProjectDueDate) {
        setRejectTaskError('Please specify an extended project deadline.');
        return;
      }
      if (rejectProjectExtensionReason.trim().length < 10) {
        setRejectTaskError('Please provide a project deadline extension reason (at least 10 characters).');
        return;
      }
      const minDueMs = creditInfo?.newTaskDueIso ? new Date(creditInfo.newTaskDueIso).getTime() : 0;
      if (new Date(rejectExtendedProjectDueDate).getTime() < minDueMs) {
        setRejectTaskError(`New project deadline cannot be earlier than task due date (${formatDateTime(creditInfo.newTaskDueIso)}).`);
        return;
      }
    }

    setRejectingTask(true);
    setRejectTaskError('');
    try {
      const payload = {
        decision: 'reject',
        reason: trimmed,
        ...(requiresExtension
          ? {
              extendedProjectDueDate: new Date(rejectExtendedProjectDueDate).toISOString(),
              projectReason: rejectProjectExtensionReason.trim(),
            }
          : {}),
      };

      await dispatch(
        reviewTask({
          id: rejectTaskTarget.id,
          payload,
          projectId,
          cascadeProject: requiresExtension,
        }),
      ).unwrap();

      fetchRemovalChecks();
      showToast('Task sent back for revision.', 'success');
      setRejectTaskTarget(null);
      setRejectTaskReason('');
      setRejectExtendedProjectDueDate('');
      setRejectProjectExtensionReason('');
    } catch (err) {
      const errMsg = err?.serverMessage || err?.message || 'Failed to reject task.';
      setRejectTaskError(errMsg);
    } finally {
      setRejectingTask(false);
    }
  };

  const handleAssignTask = async (taskId, assigneeId, assigneeName) => {
    if (isLocked) return;
    try {
      const payload = {
        assigneeId: assigneeId || undefined,
        assigneeName: assigneeName || 'Unassigned',
        assignee: assigneeName || 'Unassigned',
      };
      await dispatch(updateTask({ id: taskId, payload })).unwrap();
    } catch (err) {
      if (err?.statusCode === 403 || err?.code === 'NOT_A_PROJECT_MEMBER') {
        setMutationTasksForbidden(true);
        showToast('You are not a member of this project.', 'error');
      } else {
        showToast(err?.serverMessage || err?.message || 'Failed to assign task.', 'error');
      }
      console.error('Failed to assign task:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (isLocked) return;
    try {
      await dispatch(
        deleteTask({ id: taskId, projectId, role: 'Project Owner' }),
      ).unwrap();
      showToast('Task deleted successfully.', 'success');
    } catch (err) {
      showToast(err?.serverMessage || err?.message || 'Failed to delete task.', 'error');
    }
  };

  const openStarterTemplatesModal = async () => {
    setStarterModalOpen(true);
    setStarterLoading(true);
    setStarterError('');
    setStarterSkipped([]);
    setStarterOverrides({});
    try {
      const res = await dispatch(
        fetchProjectTaskTemplates({ id: projectId }),
      ).unwrap();
      const list = Array.isArray(res?.items) ? res.items : [];
      const existingSet = new Set(
        (Array.isArray(tasks) ? tasks : [])
          .map((t) => String(t?.title || '').trim().toLowerCase())
          .filter(Boolean),
      );
      setStarterCategory(res?.category || project?.category || 'General');
      setStarterTemplates(list);
      setStarterSelectedKeys(
        list
          .filter((item) => !existingSet.has(String(item.title || '').trim().toLowerCase()))
          .map((item) => item.key),
      );
    } catch (err) {
      setStarterTemplates([]);
      setStarterSelectedKeys([]);
      setStarterError(err?.serverMessage || err?.message || 'Failed to load starter task templates.');
    } finally {
      setStarterLoading(false);
    }
  };

  const handleToggleStarterKey = (key) => {
    setStarterError('');
    setStarterSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleToggleAllStarterKeys = (selectableKeys) => {
    setStarterError('');
    const allSelected =
      selectableKeys.length > 0 &&
      selectableKeys.every((k) => starterSelectedKeys.includes(k));
    setStarterSelectedKeys(allSelected ? [] : selectableKeys);
  };

  const handleStarterOverrideChange = (key, nextVal) => {
    setStarterError('');
    setStarterOverrides((prev) => ({
      ...prev,
      [key]: nextVal,
    }));
  };

  const handleApplyStarterTasks = async () => {
    const existingSet = new Set(
      (Array.isArray(tasks) ? tasks : [])
        .map((t) => String(t?.title || '').trim().toLowerCase())
        .filter(Boolean),
    );
    const activeKeys = starterSelectedKeys.filter((key) => {
      const tpl = starterTemplates.find((item) => item.key === key);
      if (!tpl) return false;
      const ov = starterOverrides[key] || {};
      const resolvedTitle = String(ov.title !== undefined ? ov.title : tpl.title).trim().toLowerCase();
      return !existingSet.has(String(tpl.title || '').trim().toLowerCase()) && !existingSet.has(resolvedTitle);
    });

    if (activeKeys.length === 0) {
      setStarterError('Select at least one starter task to add.');
      return;
    }

    for (const key of activeKeys) {
      const tpl = starterTemplates.find((item) => item.key === key);
      const ov = starterOverrides[key] || {};
      const title = String(ov.title !== undefined ? ov.title : tpl?.title || '').trim();
      const description = String(ov.description !== undefined ? ov.description : tpl?.description || '').trim();
      if (
        title.length < STARTER_TASK_CONSTRAINTS.minTitleLength ||
        title.length > STARTER_TASK_CONSTRAINTS.maxTitleLength
      ) {
        setStarterError(
          `Title must be ${STARTER_TASK_CONSTRAINTS.minTitleLength} to ${STARTER_TASK_CONSTRAINTS.maxTitleLength} characters.`,
        );
        return;
      }
      if (
        description.length < STARTER_TASK_CONSTRAINTS.minDescriptionLength ||
        description.length > STARTER_TASK_CONSTRAINTS.maxDescriptionLength
      ) {
        setStarterError(
          `Description must be ${STARTER_TASK_CONSTRAINTS.minDescriptionLength} to ${STARTER_TASK_CONSTRAINTS.maxDescriptionLength} characters.`,
        );
        return;
      }
    }

    setApplyingStarterTasks(true);
    setStarterError('');
    setStarterSkipped([]);
    try {
      const payloadOverrides = {};
      for (const key of activeKeys) {
        if (starterOverrides[key]) {
          payloadOverrides[key] = starterOverrides[key];
        }
      }
      const actionRes = await dispatch(
        applyProjectTaskTemplates({
          id: projectId,
          payload: {
            keys: activeKeys,
            ...(Object.keys(payloadOverrides).length > 0 ? { overrides: payloadOverrides } : {}),
          },
        }),
      ).unwrap();
      const res = actionRes?.res;
      const createdList = Array.isArray(res?.created) ? res.created : [];
      const skippedList = Array.isArray(res?.skipped) ? res.skipped : [];

      if (createdList.length > 0) {
        dispatch(upsertTasks(createdList));
        showToast(`Added ${createdList.length} starter task(s) to project.`, 'success');
      }

      if (skippedList.length > 0) {
        setStarterSkipped(skippedList);
        const firstCode = skippedList[0]?.code;
        setStarterError(formatStarterTaskError(firstCode, skippedList[0]?.reason));
        const createdKeys = new Set(createdList.map((t) => t.starterTemplateKey).filter(Boolean));
        setStarterSelectedKeys((prev) => prev.filter((k) => !createdKeys.has(k)));
      } else {
        setStarterModalOpen(false);
      }
    } catch (err) {
      const code = err?.code || err?.data?.code;
      setStarterError(formatStarterTaskError(code, err?.serverMessage || err?.message));
    } finally {
      setApplyingStarterTasks(false);
    }
  };

  const handleOpenEditProjectModal = () => {
    if (!project) return;
    setEditProjectForm({
      title: project.title || project.name || '',
      description: project.description || project.desc || '',
      skills: Array.isArray(project.skills || project.requiredSkills)
        ? (project.skills || project.requiredSkills).join(', ')
        : '',
      teamSize: Number(project.teamSize || project.maxCollaborators || 5),
      dueDate: project.dueDate || '',
    });
    setEditProjectError('');
    setEditProjectModalOpen(true);
  };

  const handleConfirmEditProject = async () => {
    if (!editProjectForm.title.trim()) {
      setEditProjectError('Project title is required.');
      return;
    }
    const sizeNum = Number(editProjectForm.teamSize);
    if (isNaN(sizeNum) || sizeNum < 1) {
      setEditProjectError('Team size must be at least 1.');
      return;
    }
    if (!editProjectForm.dueDate) {
      setEditProjectError('Project due date is required.');
      return;
    }
    const selectedDate = new Date(editProjectForm.dueDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    if (selectedDate < tomorrow) {
      setEditProjectError('Due date must be at least tomorrow.');
      return;
    }
    setSavingProjectSettings(true);
    setEditProjectError('');
    try {
      const skillsArr = editProjectForm.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const patch = {
        title: editProjectForm.title.trim(),
        description: editProjectForm.description.trim(),
        skills: skillsArr,
        teamSize: sizeNum,
        maxCollaborators: sizeNum,
        dueDate: new Date(editProjectForm.dueDate).toISOString(),
      };
      await dispatch(
        updateProject({
          id: projectId,
          payload: {
            title: patch.title,
            description: patch.description,
            skills: patch.skills,
            teamSize: patch.teamSize,
            dueDate: patch.dueDate,
          },
        }),
      ).unwrap();
      dispatch(updateOne({ id: projectId, changes: patch }));
      setEditProjectModalOpen(false);
      showToast('Project settings updated successfully.', 'success');
    } catch (err) {
      const code = err.code || err.serverError || err.response?.data?.code;
      const msg = err.serverMessage || err.message || 'Failed to update project settings.';
      if (code === 'TEAM_SIZE_BELOW_MEMBERS') {
        setEditProjectError(`TEAM_SIZE_BELOW_MEMBERS: ${msg}`);
      } else {
        setEditProjectError(msg);
      }
    } finally {
      setSavingProjectSettings(false);
    }
  };

  const handleOpenChangeDeadlineModal = () => {
    setNewDeadlineDate(project?.dueDate || '');
    setChangeDeadlineReason('');
    setChangeDeadlineError('');
    setShiftTasks(false);
    setChangeDeadlineModalOpen(true);
  };

  const handleConfirmChangeDeadline = async () => {
    if (isLocked) {
      setChangeDeadlineError('Cannot change deadline of a completed or closed project.');
      return;
    }
    if (!newDeadlineDate) {
      setChangeDeadlineError('New project deadline is required.');
      return;
    }
    const dueTime = new Date(newDeadlineDate).getTime();
    if (isNaN(dueTime)) {
      setChangeDeadlineError('Invalid deadline date.');
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueTime <= today.getTime()) {
      setChangeDeadlineError('New project deadline must be in the future.');
      return;
    }

    if (!shiftTasks) {
      const tasksWithDueDate = (tasks || []).filter((t) => t.dueDate);
      for (const t of tasksWithDueDate) {
        const taskDue = new Date(t.dueDate).getTime();
        if (dueTime < taskDue) {
          setChangeDeadlineError(`New project deadline cannot be earlier than task due date (${formatMemberSince(t.dueDate)}) for "${t.title}".`);
          return;
        }
      }
    }

    const trimmedReason = changeDeadlineReason.trim();
    if (!trimmedReason || trimmedReason.length < 10) {
      setChangeDeadlineError('A reason of at least 10 characters is required to change the project deadline.');
      return;
    }

    setChangingDeadline(true);
    setChangeDeadlineError('');
    try {
      await dispatch(
        changeProjectDeadline({
          id: projectId,
          payload: {
            dueDate: new Date(newDeadlineDate).toISOString(),
            reason: trimmedReason,
            shiftTasks: Boolean(shiftTasks),
          },
        }),
      ).unwrap();
      if (shiftTasks) {
        await dispatch(fetchTasksByProject({ projectId, force: true }))
          .unwrap()
          .catch(() => null);
      }
      setChangeDeadlineModalOpen(false);
      showToast('Project deadline updated successfully. Collaborators and mentor notified.', 'success');
    } catch (err) {
      setChangeDeadlineError(err.message || 'Failed to change project deadline.');
    } finally {
      setChangingDeadline(false);
    }
  };

  const handleViewApplicantProfile = async (userId, reqObj) => {
    setTargetRequest(reqObj || null);
    setApplicantModalOpen(true);
    setLoadingProfile(true);
    setProfileError('');
    setApplicantProfile(null);
    try {
      const data = await dispatch(fetchPublicProfile(userId)).unwrap();
      setApplicantProfile(data);
    } catch (err) {
      console.error('Failed to load applicant profile:', err);
      setProfileError(err.message || 'Unable to load applicant profile.');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleOpenDeclineModal = (req) => {
    setRejectTargetRequest(req);
    setRejectReason('');
    setRejectError('');
    setRejectModalOpen(true);
  };

  const handleConfirmDecline = async () => {
    if (!rejectTargetRequest) return;
    const trimmed = rejectReason.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      setRejectError('A decline reason of 10 to 500 characters is required.');
      return;
    }
    setRejecting(true);
    setRejectError('');
    try {
      await dispatch(
        respondJoinRequest({
          id: rejectTargetRequest.id,
          status: 'rejected',
          reasonOrRole: { reason: trimmed },
          projectId,
        }),
      ).unwrap();
      setRejectModalOpen(false);
      showToast('Join request declined.', 'info');
    } catch (err) {
      setRejectError(err.message || 'Failed to decline request.');
    } finally {
      setRejecting(false);
    }
  };

  const handleRespondJoinRequest = async (requestId, status) => {
    if (isLocked) return;
    try {
      const targetReq = joinRequests.find((r) => r.id === requestId);
      await dispatch(
        respondJoinRequest({ id: requestId, status, projectId }),
      ).unwrap();

      if (status === 'Approved' && targetReq) {
        const existingCollabs = Array.isArray(project?.collaborators) ? project.collaborators : [];
        const isAlreadyAdded = existingCollabs.some(
          (c) => (typeof c === 'string' ? c === targetReq.userId || c === targetReq.userName : c.id === targetReq.userId)
        );
        if (!isAlreadyAdded) {
          const newCollab = {
            id: targetReq.userId,
            name: targetReq.userName || 'Collaborator',
            role: targetReq.role || 'Collaborator',
          };
          const updatedCollabs = [...existingCollabs, newCollab];
          dispatch(updateOne({ id: projectId, changes: { collaborators: updatedCollabs } }));
        }
      }
    } catch (err) {
      console.error('Failed to respond to join request:', err);
      showToast(err?.serverMessage || err?.message || 'Failed to respond to join request.', 'error');
    }
  };

  // Leave request approval & rejection handlers (Part 1: Leave with owner approval)
  const handleApproveLeaveRequest = async (requestId) => {
    if (processingLeaveId || isLocked) return;
    setProcessingLeaveId(requestId);
    try {
      await dispatch(approveLeaveRequest({ requestId, projectId })).unwrap();
      showToast('Leave request approved. Member has left the project.', 'success');
    } catch (err) {
      console.error('Failed to approve leave request:', err);
      showToast(err.serverMessage || err.message || 'Failed to approve leave request.', 'error');
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const handleOpenRejectLeaveModal = (leaveReq) => {
    if (isLocked) return;
    setRejectingLeaveRequest(leaveReq);
    setRejectLeaveModalOpen(true);
  };

  const handleConfirmRejectLeaveRequest = async ({ reasons, explanation }) => {
    if (!rejectingLeaveRequest) return;
    const reqId = rejectingLeaveRequest.id;
    try {
      await dispatch(
        rejectLeaveRequest({
          requestId: reqId,
          payload: { reasons, explanation },
          projectId,
        }),
      ).unwrap();
      showToast('Leave request rejected. Member remains on the project with 24h cooldown.', 'info');
      setRejectLeaveModalOpen(false);
      setRejectingLeaveRequest(null);
    } catch (err) {
      console.error('Failed to reject leave request:', err);
      showToast(err.serverMessage || err.message || 'Failed to reject leave request.', 'error');
      throw err;
    }
  };

  // Phase 15: Direct Invite handlers + Export Markdown + Clone Draft
  const handleInviteSearchChange = async (e) => {
    const val = e.target.value;
    if (project && getProjectSeatCounts(project).isFull) {
      setInviteSearchResults([]);
      return;
    }
    setInviteQuery(val);
    setInviteFeedback(null);
    const trimmed = val.trim().replace(/^@/, '');
    if (trimmed.length < 2) {
      setInviteSearchResults([]);
      return;
    }
    setSearchingInviteUsers(true);
    try {
      const searchRes = await dispatch(searchUsersThunk(trimmed)).unwrap();
      const list = Array.isArray(searchRes?.items) ? searchRes.items : [];
      setInviteSearchResults(list);
      const missingIds = list.map((u) => String(u.id || '')).filter((id) => id && !trustSummaries[id]);
      if (missingIds.length > 0) {
        dispatch(fetchTrustSummaries(missingIds.slice(0, 50)));
      }
    } catch {
      setInviteSearchResults([]);
    } finally {
      setSearchingInviteUsers(false);
    }
  };

  const handleSendDirectInvite = async (usernameOverride) => {
    const clean = String(usernameOverride || inviteQuery || '').trim().replace(/^@/, '');
    if (!clean) return;
    setSendingInvite(true);
    setInviteFeedback(null);
    try {
      const res = await dispatch(
        sendProjectInvite({ projectId, username: clean }),
      ).unwrap();
      const created = res?.invite || res;
      setInviteQuery('');
      setInviteSearchResults([]);
      setInviteFeedback({ type: 'success', message: `Invitation sent to @${created?.invitedUsername || clean}.` });
    } catch (err) {
      setInviteFeedback({ type: 'error', message: err?.serverMessage || err?.message || 'Failed to send invitation.' });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCancelDirectInvite = async (inviteId) => {
    if (isLocked) return;
    try {
      await dispatch(cancelProjectInvite({ projectId, inviteId })).unwrap();
      showToast('Invitation cancelled.', 'success');
    } catch (err) {
      showToast(err?.serverMessage || err?.message || 'Failed to cancel invitation.', 'error');
    }
  };

  const handlePublishProject = async (e) => {
    e.preventDefault();
    setPublishError('');
    if (isLocked) {
      setPublishError('Project is already completed and locked.');
      return;
    }

    const trimmed = (finishedLink || '').trim();
    if (!trimmed) {
      setPublishError('Please enter a valid final project URL.');
      return;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error();
      }
    } catch {
      setPublishError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    const unapproved = tasks.filter(
      (t) => t.status !== 'Completed' && String(t.status || '').toLowerCase() !== 'completed'
    );
    if (unapproved.length > 0) {
      setPublishError(
        `All project tasks must be approved before completing the project (${unapproved.length} task${unapproved.length > 1 ? 's' : ''} remaining).`
      );
      return;
    }

    setPublishing(true);
    try {
      const actionRes = await dispatch(
        completeProject({
          id: projectId,
          payload: {
            finalLink: trimmed,
            finishedLink: trimmed,
          },
        }),
      ).unwrap();
      const res = actionRes?.res;

      if (res?.badgeAwarded === false) {
        const reasonMsg =
          res?.badgeReason || 'Project completed without a completion badge.';
        setCompletionBadgeNotice({
          badgeAwarded: false,
          badgeReason: reasonMsg,
        });
        showToast(reasonMsg, 'warning');
      } else if (res?.badgeAwarded === true) {
        const awardedMsg =
          res?.badgeReason || 'Completion badge awarded (+250 XP, +15 Rep).';
        setCompletionBadgeNotice({
          badgeAwarded: true,
          badgeReason: awardedMsg,
        });
        showToast(awardedMsg, 'success');
      }

      setPublishModalOpen(false);
      setPublishError('');
    } catch (err) {
      setPublishError(err?.message || 'Failed to publish project.');
      console.error('Failed to publish project:', err);
    } finally {
      setPublishing(false);
    }
  };

  const handleOpenRemoveMember = (member) => {
    setRemoveMemberTarget(member);
    setRemoveReason('');
    setRemoveError('');
    setRemoveBlockers([]);
  };

  const handleConfirmRemoveMember = async (e) => {
    if (e) e.preventDefault();
    if (!removeMemberTarget || isLocked) return;
    const trimmed = removeReason.trim();
    if (trimmed.length < 10) {
      setRemoveError('Reason must be at least 10 characters long.');
      return;
    }

    const memberId =
      typeof removeMemberTarget === 'object' && removeMemberTarget !== null
        ? removeMemberTarget.id || removeMemberTarget.userId || removeMemberTarget.name
        : removeMemberTarget;
    const memberName =
      typeof removeMemberTarget === 'object' && removeMemberTarget !== null
        ? removeMemberTarget.name || removeMemberTarget.id
        : removeMemberTarget;

    setRemovingMember(true);
    setRemoveError('');
    try {
      await dispatch(
        removeProjectMember({
          projectId,
          memberId,
          memberName,
          reason: trimmed,
          role: 'Project Owner',
          userId: user?.id,
        }),
      ).unwrap();

      // 2. Unapproved member tasks are automatically reset inside tasksSlice on removeProjectMember.fulfilled

      // 4. Refresh remaining tasks & join requests (project detail refreshed inside thunk)
      Promise.all([
        dispatch(fetchTasksByProject({ projectId, force: true })).unwrap().catch(() => null),
        dispatch(fetchJoinRequests({ projectId, force: true })).unwrap().catch(() => null),
      ]).then(() => {
        fetchRemovalChecks();
      });

      showToast(`Team member ${memberName} removed successfully.`, 'success');
      setRemoveMemberTarget(null);
      setRemoveReason('');
      setRemoveBlockers([]);
    } catch (err) {
      console.error('Failed to remove member:', err);
      const rawBlockers =
        err?.blockers ||
        err?.response?.data?.blockers ||
        (err?.data && err.data.blockers) ||
        [];
      if (Array.isArray(rawBlockers) && rawBlockers.length > 0) {
        setRemoveBlockers(rawBlockers);
        setRemoveError(
          err?.serverMessage ||
          err?.message ||
          'Review these submitted tasks first: approve them or send them back with feedback. Then you can remove this member.'
        );
        const memberIdStr = String(memberId);
        dispatch(
          setRemovalCheckEntry({
            projectId,
            userId: memberIdStr,
            check: {
              allowed: false,
              blockers: rawBlockers,
              tasksToRelease: removalChecks[memberIdStr]?.tasksToRelease || [],
              tasksKept: removalChecks[memberIdStr]?.tasksKept || [],
            },
          }),
        );
      } else {
        const errMsg = err?.serverMessage || err?.message?.replace(/^(Access Forbidden|Validation Error):\s*/, '') || 'Failed to remove member.';
        setRemoveError(errMsg);
      }
    } finally {
      setRemovingMember(false);
    }
  };

  const getMemberReleasableTasks = (memberObj) => {
    if (!memberObj) return [];
    const mId = String(memberObj.id || memberObj.userId || '');
    const mName = String(memberObj.name || '');
    return tasks.filter((t) => {
      if (!t) return false;
      const matchesAssignee =
        (mId && (String(t.assigneeId || '') === mId || String(t.assignedTo || '') === mId)) ||
        (mName && (t.assignee === mName || t.assigneeName === mName));
      if (!matchesAssignee) return false;
      const st = String(t.status || '').toLowerCase();
      return st === 'open' || st === 'to do' || st === 'todo' || st === 'in progress' || st === 'in_progress';
    });
  };

  const handleConfirmReleaseTasks = async () => {
    if (!releaseTasksTarget || releasingTasks) return;
    const memberId = String(releaseTasksTarget.id || releaseTasksTarget.userId);
    const memberName = releaseTasksTarget.name || memberId;
    setReleasingTasks(true);
    setReleaseTasksError('');
    try {
      const actionRes = await dispatch(
        releaseMemberTasks({ projectId, memberId }),
      ).unwrap();
      const res = actionRes?.res;
      const releasedCount = res?.released ?? 0;
      showToast(`Released ${releasedCount} task(s) from ${memberName}.`, 'success');
      setReleaseTasksTarget(null);
    } catch (err) {
      setReleaseTasksError(err?.serverMessage || err?.message || 'Failed to release tasks.');
    } finally {
      setReleasingTasks(false);
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
          senderName: user?.name || 'Project Owner',
          senderRole: 'Owner',
          role: 'Project Owner',
          userId: user?.id,
        }),
      ).unwrap();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  if (loading) {
    return (
      <div className="tf-owned-ws-container">
        <div className="tf-owned-ws-card">
          <p>Loading project workspace...</p>
        </div>
      </div>
    );
  }

  if (tombstoneData) {
    return (
      <div className="tf-owned-ws-container">
        <button
          type="button"
          className="tf-owned-ws-back-btn"
          onClick={() => navigate('/my-projects')}
        >
          <BackArrowIcon /> Back to My Projects
        </button>
        <ProjectTombstone project={tombstoneData} onNavigate={(path) => navigate(path)} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="tf-owned-ws-container">
        <button
          type="button"
          className="tf-owned-ws-back-btn"
          onClick={() => navigate('/my-projects')}
        >
          <BackArrowIcon /> Back to My Projects
        </button>
        <div className="tf-owned-ws-card">
          <h2>Project not found</h2>
          <p>The requested project workspace does not exist or you do not have permission.</p>
        </div>
      </div>
    );
  }

  const ownerName = typeof project.owner === 'object' && project.owner !== null
    ? (project.owner.name || project.owner.id || 'You')
    : (project.owner || 'You');
  const mentorName = typeof project.mentor === 'object' && project.mentor !== null
    ? (project.mentor.name || project.mentor.title || 'Assigned Mentor')
    : (project.mentor && project.mentor !== 'None assigned yet' ? project.mentor : null);
  const mentorObj = (mentorName || project.mentorId) ? {
    id: String(project.mentorId || 'mentor'),
    name: mentorName || 'Assigned Mentor',
    role: 'Mentor',
  } : null;

  // Single canonical members list from the API response
  const apiMembers = Array.isArray(project.members) && project.members.length > 0
    ? project.members
    : [
        { id: String(project.ownerId || 'owner'), userId: String(project.ownerId || 'owner'), name: ownerName, role: 'Owner' },
        ...(Array.isArray(project.collaborators)
          ? project.collaborators.map((c, i) => {
              const base = typeof c === 'object' && c !== null ? c : {};
              const cId = typeof c === 'string' ? c : (c.id || c.userId || `c-${i}`);
              return {
                ...base,
                id: cId,
                userId: base.userId || cId,
                name: typeof c === 'string' ? c : (c.name || 'Collaborator'),
                role: 'Collaborator',
              };
            })
          : []),
        ...(mentorObj ? [{ ...mentorObj, userId: mentorObj.id }] : []),
      ];
  const allMembers = apiMembers;
  const members = apiMembers.filter((m) => String(m.role || '').toLowerCase() === 'collaborator');
  const {
    used: approvedCollabCount,
    limit: maxCollaboratorLimit,
    isFull: isProjectFull,
  } = getProjectSeatCounts(project);
  const {
    items: allItems,
    pendingItems,
    approvedItems,
    rejectedItems,
    counts: requestCounts,
  } = combinedRequestsData;

  const totalPendingCount = requestCounts.pending ?? pendingItems.length;
  const pendingRequests = pendingItems;
  const unapprovedTasks = tasks.filter(
    (t) => t && t.status !== 'Completed' && String(t.status || '').toLowerCase() !== 'completed'
  );
  const allTasksApproved = unapprovedTasks.length === 0;
  const progress = calculateProjectProgress(tasks);

  return (
    <div className="tf-owned-ws-container">
      <button
        type="button"
        className="tf-owned-ws-back-btn"
        onClick={() => navigate('/my-projects')}
      >
        <BackArrowIcon /> Back to My Projects
      </button>

      {/* Main Header Card */}
      <div className="tf-owned-ws-card">
        <div className="tf-owned-ws-header-row">
          <div className="tf-owned-ws-title-group">
            <div className="tf-owned-ws-title-flex">
              <h1 className="tf-owned-ws-title">{project.title || project.name}</h1>
              <span className="tf-owned-ws-owner-badge">Project Owner</span>
              {isProjectFull && <Badge variant="warning">Full</Badge>}
            </div>
            <p className="tf-owned-ws-desc">{project.description || project.desc}</p>
            <div className="tf-owned-ws-meta">
              Owned by <strong>{ownerName}</strong>{mentorName ? <> · Mentor: <strong>{mentorName}</strong></> : null} · 👥 {approvedCollabCount}/{maxCollaboratorLimit} {isProjectFull ? 'Collaborators (Full)' : 'Collaborators'}{project?.dueDate ? <> · 📅 <strong>{formatProjectDueDate(project.dueDate)}</strong></> : null}
            </div>
            <div className="tf-owned-ws-skills">
              {(project.skills || project.requiredSkills || []).map((s, i) => (
                <span key={i} className="tf-owned-ws-skill-tag">
                  {typeof s === 'object' && s !== null ? (s.name || s.title || String(s)) : String(s)}
                </span>
              ))}
            </div>
          </div>

          <div className="tf-owned-ws-progress-box">
            <ProgressBar value={progress} size="md" />
          </div>
        </div>

        {/* Hint banner when all tasks are approved but project is not yet published */}
        {!isLocked && allTasksApproved && tasks.length > 0 && (
          <div style={{ marginBottom: '16px', padding: '12px 18px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>🎉 All tasks approved. Publish the project to finish!</span>
            <button
              type="button"
              className="tf-owned-ws-btn-primary tf-owned-ws-btn-success"
              onClick={() => setPublishModalOpen(true)}
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              Publish Project
            </button>
          </div>
        )}

        {/* Phase 12: Zombie project 48h countdown banner */}
        {(() => {
          const bannerPendingCount = joinRequests.length > 0 ? pendingRequests.length : Number(project.pendingRequestsCount || 0);
          if (isLocked || !project.pausedAt || bannerPendingCount <= 0) return null;
          const expiresMs = project.pendingReviewGraceExpiresAt
            ? new Date(project.pendingReviewGraceExpiresAt).getTime()
            : new Date(project.pausedAt).getTime() + 48 * 60 * 60 * 1000;
          const remMs = Math.max(0, expiresMs - nowTs);
          const remHours = Math.floor(remMs / (60 * 60 * 1000));
          const remMins = Math.floor((remMs % (60 * 60 * 1000)) / (60 * 1000));
          return (
            <div
              data-testid="workspace-zombie-banner"
              style={{
                marginBottom: '16px',
                padding: '12px 18px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <strong>Decide on pending requests within {remHours}h {remMins}m or this project will close.</strong>
                <div style={{ fontSize: '0.85rem', marginTop: '2px' }}>
                  {bannerPendingCount} pending join request{bannerPendingCount === 1 ? '' : 's'} must be approved or rejected to keep the project active.
                </div>
              </div>
              <button
                type="button"
                className="tf-owned-ws-btn-primary"
                onClick={() => setActiveTab('members')}
                style={{ background: '#dc2626', borderColor: '#dc2626', fontSize: '0.85rem', padding: '6px 14px' }}
              >
                Review Requests
              </button>
            </div>
          );
        })()}

        {/* Phase 22: Project completion badge / withholding status banner */}
        {(() => {
          const effectiveNotice =
            completionBadgeNotice ||
            (project?.badgeReason
              ? {
                  badgeAwarded: project?.badgeAwarded === true,
                  badgeReason: project.badgeReason,
                }
              : null);
          if (!effectiveNotice || !effectiveNotice.badgeReason) return null;
          const awarded = effectiveNotice.badgeAwarded === true;
          return (
            <div
              data-testid="completion-badge-status"
              role="status"
              style={{
                marginBottom: '16px',
                padding: '12px 18px',
                borderRadius: '8px',
                background: awarded ? '#ecfdf5' : '#fffbeb',
                border: awarded ? '1px solid #a7f3d0' : '1px solid #fcd34d',
                color: awarded ? '#065f46' : '#92400e',
                fontSize: '0.92rem',
                fontWeight: 500,
              }}
            >
              <strong>{awarded ? '🏆 Completion Badge Awarded:' : 'ℹ️ Completion Badge Not Awarded:'}</strong>{' '}
              <span>{effectiveNotice.badgeReason}</span>
            </div>
          );
        })()}

        {/* Workspace Toolbar & Tabs */}
        <div className="tf-owned-ws-toolbar">
          <FilterTabs
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'tasks', label: 'Tasks', count: tasks.length },
              { id: 'members', label: 'Members', count: pendingRequests.length > 0 ? pendingRequests.length : undefined },
              { id: 'chat', label: 'Chat' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          <div style={{ display: 'flex', gap: '8px' }}>
            {!isLocked && (
              <>
                <button
                  type="button"
                  className="tf-owned-ws-btn-secondary"
                  data-testid="edit-project-settings-btn"
                  onClick={handleOpenEditProjectModal}
                >
                  ⚙️ Edit Settings
                </button>
                {!tasksForbidden && (
                  <button
                    type="button"
                    className="tf-owned-ws-btn-primary"
                    onClick={() => setCreateTaskModalOpen(true)}
                  >
                    <PlusIcon /> Create Task
                  </button>
                )}
                <button
                  type="button"
                  className="tf-owned-ws-btn-primary"
                  style={{ backgroundColor: '#4f46e5' }}
                  onClick={handleOpenChangeDeadlineModal}
                >
                  📅 Change Deadline
                </button>
                <button
                  type="button"
                  className="tf-owned-ws-btn-primary tf-owned-ws-btn-success"
                  data-testid="publish-project-toolbar-btn"
                  disabled={tasks.length === 0 || !allTasksApproved}
                  title={
                    tasks.length === 0
                      ? "Add at least one task to complete this project"
                      : !allTasksApproved
                      ? "All tasks must be approved before completing this project"
                      : "Publish Project"
                  }
                  onClick={() => setPublishModalOpen(true)}
                >
                  {tasks.length === 0
                    ? "Add at least one task to complete this project"
                    : !allTasksApproved
                    ? "All tasks must be approved before completing this project"
                    : "Publish Project"}
                </button>
              </>
            )}
            {isLocked && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="tf-owned-ws-owner-badge" style={{ alignSelf: 'center', backgroundColor: '#e2e8f0', color: '#475569' }}>
                  🔒 {project.deletionScheduledAt ? 'Scheduled for Deletion (Read-only)' : 'Completed (Read-only)'}
                </span>
              </div>
            )}
            <button
              type="button"
              data-testid="owner-delete-project-btn"
              className="tf-owned-ws-btn-outline"
              disabled={Boolean(project?.isCompleted || project?.status?.toLowerCase() === 'completed')}
              title={
                (project?.isCompleted || project?.status?.toLowerCase() === 'completed')
                  ? 'Completed projects are part of member work history and cannot be deleted.'
                  : 'Delete project'
              }
              style={{
                color: (project?.isCompleted || project?.status?.toLowerCase() === 'completed') ? '#94a3b8' : '#dc2626',
                borderColor: (project?.isCompleted || project?.status?.toLowerCase() === 'completed') ? '#e2e8f0' : '#fecaca',
                cursor: (project?.isCompleted || project?.status?.toLowerCase() === 'completed') ? 'not-allowed' : 'pointer',
              }}
              onClick={() => {
                if (project?.isCompleted || project?.status?.toLowerCase() === 'completed') return;
                setDeleteProjectDialogOpen(true);
              }}
            >
              Delete project
            </button>
          </div>
        </div>

        {/* Scheduled Deletion Notice Banner */}
        {project?.deletionScheduledAt && (
          <div
            data-testid="owner-scheduled-deletion-banner"
            style={{
              padding: '14px 18px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              margin: '16px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.4rem' }}>⏳</span>
              <div>
                <strong style={{ color: '#991b1b', fontSize: '0.95rem' }}>
                  This project is scheduled for deletion on {new Date(project.deletionScheduledAt).toLocaleString()} by the owner.
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#b91c1c' }}>
                  The project is currently locked to read-only. Members have been notified.
                </p>
              </div>
            </div>
            <button
              type="button"
              data-testid="cancel-project-deletion-btn"
              className="tf-owned-ws-btn-outline"
              style={{
                backgroundColor: '#ffffff',
                borderColor: '#dc2626',
                color: '#dc2626',
                fontWeight: 600,
              }}
              disabled={cancellingDeletion}
              onClick={handleCancelDeletion}
            >
              {cancellingDeletion ? 'Cancelling...' : 'Cancel deletion'}
            </button>
          </div>
        )}

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div>
            <h3>Project Overview</h3>
            <p className="tf-owned-ws-desc">{project.description || project.desc}</p>
            {project.objectives && (
              <div style={{ marginTop: '12px' }}>
                <h4>Key Objectives</h4>
                <p className="tf-owned-ws-desc">{project.objectives}</p>
              </div>
            )}
            <div className="tf-owned-ws-meta" style={{ marginTop: '16px' }}>
              <p>Mentor: <strong>{mentorName || 'None assigned yet'}</strong></p>
              <p>Status: <strong>{project.status || 'Active'}</strong></p>
              {project.dueDate && <p><strong>{formatProjectDueDate(project.dueDate)}</strong></p>}
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
          <div className="tf-owned-ws-tasks-list">
            {!isLocked && !tasksForbidden && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '0.88rem', color: '#475569', fontWeight: 600 }}>
                  Project Tasks ({tasks.length})
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="tf-owned-ws-btn-secondary"
                    data-testid="add-starter-tasks-btn"
                    onClick={openStarterTemplatesModal}
                  >
                    ✨ Add starter tasks
                  </button>
                  <button
                    type="button"
                    className="tf-owned-ws-btn-primary"
                    onClick={() => setCreateTaskModalOpen(true)}
                  >
                    <PlusIcon /> Create Task
                  </button>
                </div>
              </div>
            )}
            {taskFilter && (
              <div
                data-testid="task-filter-banner"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  marginBottom: '14px',
                  borderRadius: '8px',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1e40af',
                  fontSize: '0.875rem',
                }}
              >
                <span>
                  Showing submitted task(s) waiting for review{taskFilter.memberName ? ` for ${taskFilter.memberName}` : ''} ({displayTasks.length})
                </span>
                <button
                  type="button"
                  className="tf-owned-ws-btn-secondary"
                  data-testid="clear-task-filter-btn"
                  style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                  onClick={() => setTaskFilter(null)}
                >
                  Clear filter
                </button>
              </div>
            )}
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
            ) : displayTasks.length > 0 ? (
              displayTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  userRole="Project Owner"
                  isLocked={isLocked}
                  members={members}
                  onAssign={handleAssignTask}
                  onApprove={handleApproveTask}
                  onReject={handleRejectTask}
                  onDelete={handleDeleteTask}
                />
              ))
            ) : (
              <EmptyState
                title={taskFilter ? "No tasks matching filter" : "No tasks created yet"}
                message={taskFilter ? "There are no tasks waiting for review for this filter." : (isLocked ? "No tasks were recorded for this project." : "Click 'Create Task' above to assign deliverables to your team members.")}
                actionLabel={taskFilter ? "Show All Tasks" : (!isLocked ? "Create First Task" : undefined)}
                onAction={taskFilter ? () => setTaskFilter(null) : (!isLocked ? () => setCreateTaskModalOpen(true) : undefined)}
              />
            )}
          </div>
        )}

        {/* Tab 3: Members & Join Requests */}
        {activeTab === 'members' && (
          <div className="tf-owned-ws-members-tab">
            {/* Sub-navigation tabs: All, Team, Requests */}
            <div style={{ marginBottom: '20px' }}>
              <FilterTabs
                tabs={[
                  { id: 'all', label: 'All' },
                  { id: 'team', label: 'Team', count: allMembers.length },
                  { id: 'requests', label: 'Requests', count: pendingRequests.length > 0 ? pendingRequests.length : joinRequests.length },
                ]}
                activeTab={membersSubSection}
                onChange={setMembersSubSection}
              />
            </div>

            {/* Section: Requests */}
            {(membersSubSection === 'all' || membersSubSection === 'requests') && (
              <div
                className="tf-owned-ws-requests-section"
                id="requests-section"
                data-testid="requests-section"
                style={{ marginBottom: '28px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
                    Join Requests {totalPendingCount > 0 ? `(${totalPendingCount} pending)` : `(${allItems.length})`}
                  </h4>
                  <FilterTabs
                    tabs={[
                      { id: 'all', label: 'All', count: requestCounts.all ?? allItems.length },
                      { id: 'pending', label: 'Pending', count: requestCounts.pending ?? pendingItems.length },
                      { id: 'approved', label: 'Approved', count: requestCounts.approved ?? approvedItems.length },
                      { id: 'rejected', label: 'Rejected', count: requestCounts.rejected ?? rejectedItems.length },
                    ]}
                    activeTab={requestStatusFilter}
                    onChange={setRequestStatusFilter}
                  />
                </div>

                {filteredItems.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredItems.map((item) => (
                      <JoinRequestCard
                        key={item.id}
                        request={item}
                        trustSummary={trustSummaries[item.userId || item.applicantId || item.id]}
                        isLocked={isLocked}
                        onViewProfile={handleViewApplicantProfile}
                        onAccept={(id) => handleRespondJoinRequest(id, 'Approved')}
                        onReject={(_id, reqObj) => handleOpenDeclineModal(reqObj || item)}
                        onCancelInvite={(id) => handleCancelDirectInvite(id)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    data-testid="requests-empty-state"
                    title={
                      requestStatusFilter === 'all'
                        ? 'No items found'
                        : `No ${requestStatusFilter} items`
                    }
                    message={
                      requestStatusFilter === 'all'
                        ? 'No applications or invitations found for this project.'
                        : `No ${requestStatusFilter} items.`
                    }
                  />
                )}
              </div>
            )}

            {/* Section: Team */}
            {(membersSubSection === 'all' || membersSubSection === 'team') && (
              <div
                className="tf-owned-ws-team-section"
                id="team-section"
                data-testid="team-section"
              >
                {/* Phase 15: Direct Invitations Panel & Ranked Username Picker */}
                {!isLocked && (
                  <div
                    data-testid="invite-collaborator-section"
                    style={{
                      marginTop: '10px',
                      marginBottom: '20px',
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <h4 style={{ marginTop: 0, marginBottom: '10px', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                      Invite Collaborator Directly
                    </h4>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', position: 'relative' }}>
                      <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                        <input
                          type="text"
                          data-testid="invite-search-input"
                          value={isProjectFull ? '' : inviteQuery}
                          disabled={isProjectFull}
                          onChange={handleInviteSearchChange}
                          placeholder={
                            isProjectFull
                              ? 'Team is full — invite disabled'
                              : 'Search by username or name (min 2 chars)...'
                          }
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.9rem',
                            backgroundColor: isProjectFull ? '#e2e8f0' : '#ffffff',
                            cursor: isProjectFull ? 'not-allowed' : 'text',
                          }}
                        />
                        {searchingInviteUsers && !isProjectFull && (
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                            Searching...
                          </div>
                        )}
                        {!isProjectFull && inviteSearchResults.length > 0 && (
                          <div
                            data-testid="invite-search-results"
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: '100%',
                              zIndex: 20,
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              marginTop: '4px',
                              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
                              maxHeight: '220px',
                              overflowY: 'auto',
                            }}
                          >
                            {inviteSearchResults
                              .filter((u) => {
                                const uid = String(u.id || u.userId || '');
                                const uname = String(u.username || '').toLowerCase();
                                return !allMembers.some((m) => {
                                  const mId = String(m.id || m.userId || '');
                                  const mUname = String(m.username || '').toLowerCase();
                                  return (uid && mId === uid) || (uname && mUname === uname);
                                });
                              })
                              .map((u) => {
                              const hasUserApplied = joinRequests.some((r) => {
                                if (!r || String(r.status || '').toLowerCase() !== 'pending') return false;
                                const rUid = String(r.userId || r.applicantId || '');
                                const rUname = String(r.userName || r.username || '').toLowerCase();
                                return (u.id && rUid === String(u.id)) || (u.username && rUname === String(u.username).toLowerCase());
                              });

                              return (
                                <div
                                  key={u.id}
                                  data-testid={`invite-search-result-${u.username || u.id}`}
                                  onClick={() => {
                                    setInviteQuery(u.username || '');
                                    setInviteSearchResults([]);
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    borderBottom: '1px solid #f1f5f9',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>
                                      {highlightMatch(u.name, inviteQuery)}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                                      @{highlightMatch(u.username, inviteQuery)}
                                      {u.university ? ` · ${u.university}` : ''}
                                    </div>
                                    {trustSummaries[u.id] && (
                                      <div style={{ marginTop: '4px' }}>
                                        <UserTrustCard summary={trustSummaries[u.id]} variant="compact" />
                                      </div>
                                    )}
                                  </div>
                                  {hasUserApplied ? (
                                    <button
                                      type="button"
                                      data-testid={`applied-review-btn-${u.username || u.id}`}
                                      className="tf-owned-ws-btn-outline"
                                      style={{ fontSize: '0.78rem', padding: '3px 8px', borderColor: '#f59e0b', color: '#b45309', whiteSpace: 'nowrap' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMembersSubSection('requests');
                                        setRequestStatusFilter('pending');
                                        setInviteSearchResults([]);
                                      }}
                                    >
                                      Applied: review application
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      data-testid={`invite-user-btn-${u.username || u.id}`}
                                      className="tf-owned-ws-btn-primary"
                                      style={{ fontSize: '0.78rem', padding: '3px 8px', whiteSpace: 'nowrap' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSendDirectInvite(u.username);
                                      }}
                                    >
                                      Invite
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {(() => {
                        const cleanQ = inviteQuery.trim().replace(/^@/, '').toLowerCase();
                        const queryHasApplied = cleanQ && joinRequests.some((r) => {
                          if (!r || String(r.status || '').toLowerCase() !== 'pending') return false;
                          const rUname = String(r.userName || r.username || '').toLowerCase();
                          const rUid = String(r.userId || r.applicantId || '').toLowerCase();
                          return cleanQ === rUname || cleanQ === rUid;
                        });

                        if (queryHasApplied && !isProjectFull) {
                          return (
                            <button
                              type="button"
                              data-testid="applied-review-query-btn"
                              className="tf-owned-ws-btn-outline"
                              style={{ borderColor: '#f59e0b', color: '#b45309', fontWeight: 600 }}
                              onClick={() => {
                                setMembersSubSection('requests');
                                setRequestStatusFilter('pending');
                              }}
                            >
                              Applied: review application
                            </button>
                          );
                        }

                        return (
                          <button
                            type="button"
                            data-testid="send-invite-btn"
                            className="tf-owned-ws-btn-primary"
                            disabled={
                              isProjectFull ||
                              sendingInvite ||
                              storeSendInviteStatus === 'loading' ||
                              !inviteQuery.trim()
                            }
                            onClick={() => handleSendDirectInvite()}
                          >
                            {sendingInvite || storeSendInviteStatus === 'loading' ? 'Sending...' : 'Send Invite'}
                          </button>
                        );
                      })()}
                    </div>
                    {isProjectFull && (
                      <div
                        data-testid="invite-full-note"
                        style={{
                          marginTop: '10px',
                          fontSize: '0.86rem',
                          color: '#b45309',
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '6px',
                        }}
                      >
                        <span>
                          {`Team is full (${approvedCollabCount} of ${maxCollaboratorLimit}). Increase the collaborator limit in project settings, or remove a collaborator, to invite more people.`}
                        </span>
                        <button
                          type="button"
                          data-testid="invite-full-edit-settings-link"
                          onClick={handleOpenEditProjectModal}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#2563eb',
                            textDecoration: 'underline',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: 'inherit',
                          }}
                        >
                          Edit settings
                        </button>
                      </div>
                    )}
                    {inviteFeedback && (
                      <div
                        role="alert"
                        style={{
                          marginTop: '8px',
                          fontSize: '0.84rem',
                          color: inviteFeedback.type === 'success' ? '#047857' : '#b91c1c',
                        }}
                      >
                        {inviteFeedback.message}
                      </div>
                    )}
                  </div>
                )}

                {/* Leave requests section (Part 1: Collaborator leaves with owner approval) */}
                {pendingLeaveRequests.length > 0 && (
                  <div
                    data-testid="leave-requests-section"
                    style={{
                      marginTop: '20px',
                      marginBottom: '24px',
                      padding: '18px 20px',
                      borderRadius: '12px',
                      border: '1px solid #fecdd3',
                      backgroundColor: '#fff1f2',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>🚪</span>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#9f1239' }}>
                          Leave Requests ({pendingLeaveRequests.length})
                        </h4>
                      </div>
                      <span style={{ fontSize: '0.82rem', color: '#be123c', fontWeight: 500 }}>
                        Collaborators requesting approval to leave project
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {pendingLeaveRequests.map((req) => {
                        const memberUser = (project?.members || []).find(
                          (m) => String(m.userId || m.id) === String(req.userId)
                        );
                        const displayName = req.userName || memberUser?.name || req.userId;
                        const taskSum = req.taskSummary || { open: 0, inProgress: 0, inReview: 0, approved: 0 };
                        const isProcessing =
                          processingLeaveId === req.id || Boolean(leaveProcessingIds[req.id]);

                        return (
                          <div
                            key={req.id}
                            data-testid={`leave-request-card-${req.id}`}
                            style={{
                              padding: '16px',
                              borderRadius: '8px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #fecaca',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Avatar name={displayName} src={req.userAvatar || memberUser?.avatarUrl} size="md" />
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '0.98rem', color: '#0f172a' }}>
                                    {displayName}
                                  </div>
                                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                                    Requested on {formatMemberSince(req.createdAt)}
                                  </div>
                                </div>
                              </div>
                              {!isLocked && (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    className="tf-owned-ws-btn-primary"
                                    style={{ backgroundColor: '#10b981', borderColor: '#10b981', padding: '6px 14px', fontSize: '0.85rem' }}
                                    disabled={isProcessing}
                                    onClick={() => handleApproveLeaveRequest(req.id)}
                                    data-testid={`approve-leave-btn-${req.id}`}
                                  >
                                    {isProcessing ? 'Approving...' : 'Approve'}
                                  </button>
                                  <button
                                    type="button"
                                    className="tf-owned-ws-btn-outline"
                                    style={{ borderColor: '#f43f5e', color: '#e11d48', padding: '6px 14px', fontSize: '0.85rem' }}
                                    disabled={isProcessing}
                                    onClick={() => handleOpenRejectLeaveModal(req)}
                                    data-testid={`reject-leave-btn-${req.id}`}
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Reasons & Explanation */}
                            <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '6px', fontSize: '0.88rem', border: '1px solid #e2e8f0' }}>
                              {Array.isArray(req.reasons) && req.reasons.length > 0 && (
                                <div style={{ marginBottom: req.explanation ? '6px' : 0 }}>
                                  <strong style={{ color: '#334155' }}>Reason: </strong>
                                  <span style={{ color: '#0f172a' }}>{req.reasons.join(', ')}</span>
                                </div>
                              )}
                              {req.explanation && (
                                <div>
                                  <strong style={{ color: '#334155' }}>Explanation: </strong>
                                  <span style={{ color: '#475569' }}>&ldquo;{req.explanation}&rdquo;</span>
                                </div>
                              )}
                            </div>

                            {/* Task summary */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                              <span style={{ color: '#64748b', fontWeight: 600 }}>Active Tasks:</span>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                                Open: <strong>{taskSum.open}</strong>
                              </span>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                                In Progress: <strong>{taskSum.inProgress}</strong>
                              </span>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                                In Review: <strong>{taskSum.inReview}</strong>
                              </span>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                                Approved: <strong>{taskSum.approved}</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <h4 style={{ marginTop: '24px', marginBottom: '12px', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
                  Project Members ({allMembers.length})
                </h4>
                <div className="tf-owned-ws-members-grid">
                  {allMembers.map((member) => {
                    if (!member) return null;
                    const memberId = String(member.userId || member.id || '');
                    const name = member.name || memberId || 'Member';
                    const role = member.role || 'Collaborator';
                    const isOwnerRole = role === 'Owner';
                    const isMentorRole = role === 'Mentor';

                    if (isOwnerRole) {
                      return (
                        <div key={`${memberId}-Owner`} className="tf-owned-ws-member-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Avatar name={name} src={member.avatarUrl || member.avatar} version={member.updatedAt} size="md" />
                            <div>
                              <h4 className="tf-owned-ws-member-name">{name}</h4>
                              <p className="tf-owned-ws-member-role">Project Lead</p>
                              {trustSummaries[memberId] && (
                                <div style={{ marginTop: '4px' }}>
                                  <UserTrustCard summary={trustSummaries[memberId]} variant="compact" />
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge variant="success">Owner</Badge>
                        </div>
                      );
                    }

                    if (isMentorRole) {
                      const activeReview = mentorAbandonmentInfo?.review?.status === 'open'
                        ? mentorAbandonmentInfo.review
                        : (mentorAbandonmentInfo?.status === 'open' ? mentorAbandonmentInfo : null);
                      const inactiveDays = mentorAbandonmentInfo?.inactiveDays ?? 0;
                      const lastActivityAt = mentorAbandonmentInfo?.lastActivityAt;
                      const activityLabel = lastActivityAt
                        ? `Last active ${inactiveDays} day${inactiveDays === 1 ? '' : 's'} ago`
                        : mentorAbandonmentInfo?.assignedAt
                        ? `No activity yet (${inactiveDays} day${inactiveDays === 1 ? '' : 's'} since assignment)`
                        : 'Activity tracked once mentor engages';
                      const remainingMs = activeReview?.deadlineAt
                        ? Math.max(0, new Date(activeReview.deadlineAt).getTime() - nowTs)
                        : 0;
                      const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
                      const remainingMins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

                      return (
                        <div key={`${memberId}-Mentor`} className="tf-owned-ws-member-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <Avatar name={name} src={member.avatarUrl || member.avatar} version={member.updatedAt} size="md" />
                              <div>
                                <h4 className="tf-owned-ws-member-name">{name}</h4>
                                <p className="tf-owned-ws-member-role">
                                  Project Mentor · <span data-testid="mentor-activity-status">{activityLabel}</span>
                                </p>
                                {trustSummaries[memberId] && (
                                  <div style={{ marginTop: '4px' }}>
                                    <UserTrustCard summary={trustSummaries[memberId]} variant="compact" />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <Badge variant="warning">Mentor</Badge>
                              {!isLocked && !activeReview && (
                                <button
                                  type="button"
                                  data-testid="report-inactive-mentor-btn"
                                  className="tf-owned-ws-btn-outline"
                                  style={{ fontSize: '0.8rem', padding: '5px 10px', borderColor: '#fca5a5', color: '#b91c1c' }}
                                  disabled={Boolean(mentorAbandonmentInfo && inactiveDays < 7)}
                                  title={inactiveDays < 7 ? 'Available once mentor has 7 days with no activity' : 'Open a 48-hour abandonment review'}
                                  onClick={() => {
                                    dispatch(openReportMentorModal());
                                  }}
                                >
                                  Report inactive mentor
                                </button>
                              )}
                            </div>
                          </div>
                          {activeReview && (
                            <div
                              data-testid="abandonment-review-banner"
                              style={{
                                padding: '10px 14px',
                                borderRadius: '8px',
                                backgroundColor: '#fef3c7',
                                border: '1px solid #f59e0b',
                                color: '#92400e',
                                fontSize: '0.85rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '8px',
                              }}
                            >
                              <span>
                                ⏳ <strong>Abandonment review open:</strong> Mentor notified to confirm activity within 48 hours ({remainingHours}h {remainingMins}m remaining).
                              </span>
                              {activeReview.deadlineAt && (
                                <span style={{ fontSize: '0.78rem' }}>
                                  Deadline: {formatDateTime(activeReview.deadlineAt)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Collaborator row
                    const memberCheck = removalChecks[memberId];
                    const isBlocked = Boolean(memberCheck && (!memberCheck.allowed || (memberCheck.blockers && memberCheck.blockers.length > 0)));
                    const blockers = memberCheck?.blockers || [];
                    const blockerCount = blockers.length;

                    const computedDaysFromTs =
                      typeof member === 'object' && member.lastActivityAt && !Number.isNaN(new Date(member.lastActivityAt).getTime())
                        ? Math.floor((nowTs - new Date(member.lastActivityAt).getTime()) / (24 * 60 * 60 * 1000))
                        : 0;
                    const inactiveDays =
                      typeof member === 'object' && typeof member.inactiveDays === 'number'
                        ? member.inactiveDays
                        : Math.max(0, computedDaysFromTs);
                    const isMemberInactive = typeof member === 'object' && Boolean(member.isInactive || inactiveDays >= 7);

                    return (
                      <div key={`${memberId}-Collaborator`} className="tf-owned-ws-member-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Avatar name={name || 'Collaborator'} src={member.avatarUrl || member.avatar} version={member.updatedAt} size="md" />
                          <div>
                            <h4 className="tf-owned-ws-member-name">{name}</h4>
                            <p className="tf-owned-ws-member-role">{role}</p>
                            {trustSummaries[memberId] && (
                              <div style={{ marginTop: '4px' }}>
                                <UserTrustCard summary={trustSummaries[memberId]} variant="compact" />
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          {isMemberInactive && (
                            <Badge variant="warning" data-testid={`member-inactive-badge-${memberId}`}>
                              No activity for {inactiveDays} {inactiveDays === 1 ? 'day' : 'days'}
                            </Badge>
                          )}
                          <Badge variant="info">Collaborator</Badge>
                          {!isLocked && isMemberInactive && (
                            <button
                              type="button"
                              className="tf-owned-ws-btn-outline"
                              data-testid={`release-tasks-btn-${memberId}`}
                              style={{ color: '#b45309', borderColor: '#fcd34d', fontSize: '0.85rem', padding: '6px 14px' }}
                              onClick={() => {
                                setReleaseTasksTarget(typeof member === 'object' ? member : { id: memberId, name });
                                setReleaseTasksError('');
                              }}
                            >
                              Release tasks
                            </button>
                          )}
                          {!isLocked && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              {isBlocked && (
                                <button
                                  type="button"
                                  className="tf-owned-ws-btn-link"
                                  data-testid={`review-tasks-link-${memberId}`}
                                  style={{
                                    fontSize: '0.85rem',
                                    color: '#0284c7',
                                    textDecoration: 'underline',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '0 4px',
                                  }}
                                  onClick={() => {
                                    setTaskFilter({
                                      memberId,
                                      taskIds: blockers.map((b) => b.taskId),
                                      memberName: name,
                                    });
                                    setActiveTab('tasks');
                                  }}
                                >
                                  Review tasks
                                </button>
                              )}
                              <button
                                type="button"
                                className="tf-owned-ws-btn-outline"
                                data-testid={`remove-member-btn-${memberId}`}
                                title={isBlocked ? `${blockerCount} submitted task(s) waiting for your review` : undefined}
                                style={{
                                  color: '#e11d48',
                                  borderColor: '#fecdd3',
                                  fontSize: '0.85rem',
                                  padding: '6px 14px',
                                  cursor: isBlocked ? 'not-allowed' : 'pointer',
                                  opacity: isBlocked ? 0.6 : 1,
                                }}
                                disabled={isBlocked}
                                onClick={() => {
                                  if (!isBlocked) {
                                    handleOpenRemoveMember(member);
                                  }
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {allMembers.length === 0 && (
                    <EmptyState
                      title="No members yet"
                      message="Team members will appear here."
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Chat (Rendered via reusable ChatBox) */}
        {activeTab === 'chat' && (
          <ChatBox
            projectId={projectId}
            messages={messages}
            currentUserId={user?.id}
            currentUserName={user?.name || 'Project Owner'}
            currentUserRole="Owner"
            onSendMessage={handleSendMessage}
            onRefresh={() => dispatch(fetchProjectMessages({ projectId, force: true }))}
            sending={sendingMsg}
            isForbidden={chatForbidden}
            forbiddenMessage={chatForbiddenMessage}
          />
        )}
      </div>

      {/* Modal: Create Task */}
      <Modal
        isOpen={createTaskModalOpen}
        title="Create New Task"
        onClose={() => setCreateTaskModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="tf-owned-ws-btn-outline"
              onClick={() => setCreateTaskModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-owned-ws-btn-primary"
              disabled={creatingTask}
              onClick={handleCreateTask}
            >
              {creatingTask ? 'Creating...' : 'Create Task'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateTask}>
          {taskFormError && (
            <div
              role="alert"
              data-testid="task-form-error"
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                marginBottom: '12px',
                fontSize: '0.86rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
              }}
            >
              {taskFormError}
            </div>
          )}
          <FormInput
            label="Task Title"
            name="taskTitle"
            value={taskForm.title}
            onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. Implement user authentication API"
            required
          />

          <FormInput
            label="Description"
            name="taskDesc"
            value={taskForm.description}
            onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Detailed requirements or deliverables..."
            multiline
            rows={3}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="tf-form-group">
              <label className="tf-form-label">Priority</label>
              <select
                className="tf-form-control"
                value={taskForm.priority || 'Medium'}
                onChange={(e) => {
                  const prio = e.target.value;
                  setTaskForm((prev) => ({
                    ...prev,
                    priority: prio,
                    difficulty: prio,
                    xpReward: getTaskReward(prio).xp,
                  }));
                }}
              >
                <option value="High">High (40 XP, +8 Rep)</option>
                <option value="Medium">Medium (20 XP, +8 Rep)</option>
                <option value="Low">Low (10 XP, +8 Rep)</option>
              </select>
            </div>

            <FormInput
              label="XP Reward"
              name="taskXp"
              type="number"
              value={taskForm.xpReward}
              disabled
              readOnly
              helperText="Set by Priority (+8 Reputation)"
            />
          </div>

          <div className="tf-form-group">
            <label className="tf-form-label">Assignee</label>
            <select
              className="tf-form-control"
              value={taskForm.assigneeId || ''}
              onChange={(e) => {
                const val = e.target.value;
                const member = members.find((m) => String(m.id || m.userId) === String(val));
                setTaskForm((prev) => ({
                  ...prev,
                  assigneeId: val,
                  assigneeName: member?.name || 'Unassigned',
                  assignee: member?.name || 'Unassigned',
                }));
              }}
            >
              <option value="">Unassigned</option>
              {members.map((m, i) => {
                if (!m) return null;
                const mId = m.id || m.userId || `mem-${i}`;
                const name = typeof m === 'string' ? m : (m.name || m.id || 'Collaborator');
                return (
                  <option key={String(mId) || i} value={String(mId)}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>

          <DatePicker
            label="Due Date"
            name="taskDueDate"
            value={taskForm.dueDate}
            onChange={(val) => {
              setTaskForm((prev) => ({ ...prev, dueDate: val }));
              if (taskFormError) setTaskFormError('');
            }}
            minDate={minTaskDate}
            maxDate={project?.dueDate ? new Date(project.dueDate) : undefined}
            required
            helperText={project?.dueDate ? `Must be on or before project due date (${formatMemberSince(project.dueDate)})` : 'Select deliverable deadline'}
            error={taskFormError}
          />
        </form>
      </Modal>

      {/* Modal: Publish Project */}
      <Modal
        isOpen={publishModalOpen}
        title="Publish Finished Project"
        onClose={() => {
          setPublishModalOpen(false);
          setPublishError('');
        }}
        footer={
          <>
            <button
              type="button"
              className="tf-owned-ws-btn-outline"
              onClick={() => {
                setPublishModalOpen(false);
                setPublishError('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-owned-ws-btn-primary tf-owned-ws-btn-success"
              disabled={isLocked || !allTasksApproved || publishing}
              onClick={handlePublishProject}
            >
              {publishing ? 'Publishing...' : 'Publish & Complete'}
            </button>
          </>
        }
      >
        <form onSubmit={handlePublishProject}>
          <p className="tf-owned-ws-desc">
            Publishing marks the project 100% complete and finalizes contributions for all team members. Once completed, the project will be locked and read-only.
          </p>

          {!allTasksApproved && (
            <div style={{ padding: '10px 14px', marginBottom: '16px', borderRadius: '6px', backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', fontSize: '0.9rem' }}>
              ⚠️ All project tasks must be approved before completing ({unapprovedTasks.length} task{unapprovedTasks.length > 1 ? 's' : ''} not yet approved).
            </div>
          )}

          <FormInput
            label="Live Project Link (GitHub / Demo URL)"
            name="finishedLink"
            value={finishedLink}
            onChange={(e) => {
              setFinishedLink(e.target.value);
              setPublishError('');
            }}
            placeholder="https://github.com/..."
            required
            helperText="Enter the repository URL or deployed live URL (must start with http:// or https://)."
          />

          {publishError && (
            <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '6px', backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', fontSize: '0.9rem' }}>
              {publishError}
            </div>
          )}
        </form>
      </Modal>

      {/* Modal: Remove Member */}
      {Boolean(removeMemberTarget) && (
        <Modal
          isOpen={Boolean(removeMemberTarget)}
          title="Remove Team Member"
          onClose={() => {
            if (!removingMember) {
              setRemoveMemberTarget(null);
              setRemoveReason('');
              setRemoveError('');
              setRemoveBlockers([]);
            }
          }}
          footer={
            <>
              <button
                type="button"
                className="tf-owned-ws-btn-outline"
                disabled={removingMember}
                onClick={() => {
                  setRemoveMemberTarget(null);
                  setRemoveReason('');
                  setRemoveError('');
                  setRemoveBlockers([]);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tf-owned-ws-btn-primary"
                style={{ backgroundColor: '#e11d48', borderColor: '#e11d48' }}
                disabled={removingMember || removeReason.trim().length < 10 || removeBlockers.length > 0}
                onClick={handleConfirmRemoveMember}
              >
                {removingMember ? 'Removing...' : 'Confirm Remove'}
              </button>
            </>
          }
        >
          <form onSubmit={handleConfirmRemoveMember}>
            <p className="tf-owned-ws-desc" style={{ marginBottom: '16px' }}>
              Are you sure you want to remove{' '}
              <strong>
                {typeof removeMemberTarget === 'object' && removeMemberTarget !== null
                  ? removeMemberTarget.name || removeMemberTarget.id || 'Member'
                  : removeMemberTarget || 'Member'}
              </strong>{' '}
              from this project?
            </p>
            {(() => {
              const targetId = typeof removeMemberTarget === 'object' && removeMemberTarget !== null
                ? String(removeMemberTarget.id || removeMemberTarget.userId || removeMemberTarget.name || '')
                : String(removeMemberTarget || '');
              const check = removalChecks[targetId];
              const tasksToReleaseCount = check?.tasksToRelease ? check.tasksToRelease.length : getMemberReleasableTasks(removeMemberTarget).length;

              return (
                <p className="text-sm text-muted" style={{ marginBottom: '16px', color: '#64748b', fontSize: '0.875rem', lineHeight: '1.4' }}>
                  <strong>{tasksToReleaseCount}</strong> unfinished task{tasksToReleaseCount === 1 ? '' : 's'} assigned to this collaborator will be reset to <strong>Unassigned</strong> and <strong>Open</strong>. Completed tasks and awarded XP/reputation will not be affected. The user will be barred from re-applying to this project.
                </p>
              );
            })()}

            {removeBlockers.length > 0 && (
              <div
                data-testid="removal-blockers-container"
                style={{
                  marginBottom: '16px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#fff1f2',
                  color: '#9f1239',
                  border: '1px solid #fecdd3',
                  fontSize: '0.875rem',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>
                  Review these submitted tasks first: approve them or send them back with feedback. Then you can remove this member.
                </div>
                <ul style={{ margin: '8px 0 12px 18px', padding: 0 }}>
                  {removeBlockers.map((b) => (
                    <li key={b.taskId} style={{ marginBottom: '4px' }}>
                      <strong>{b.title}</strong>
                      {b.submittedAt && (
                        <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '6px' }}>
                          (Submitted: {new Date(b.submittedAt).toLocaleDateString()})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="tf-owned-ws-btn-secondary"
                  data-testid="modal-review-tasks-btn"
                  style={{ fontSize: '0.82rem', padding: '5px 12px' }}
                  onClick={() => {
                    const targetId = typeof removeMemberTarget === 'object' && removeMemberTarget !== null
                      ? String(removeMemberTarget.id || removeMemberTarget.userId || removeMemberTarget.name || '')
                      : String(removeMemberTarget || '');
                    const targetName = typeof removeMemberTarget === 'object' ? removeMemberTarget.name : undefined;
                    const bList = [...removeBlockers];
                    setRemoveMemberTarget(null);
                    setRemoveReason('');
                    setRemoveError('');
                    setRemoveBlockers([]);
                    setTaskFilter({
                      memberId: targetId,
                      taskIds: bList.map((b) => b.taskId),
                      memberName: targetName,
                    });
                    setActiveTab('tasks');
                  }}
                >
                  Review Submitted Tasks
                </button>
              </div>
            )}

            <FormInput
              label="Reason for Removal (minimum 10 characters)"
              name="removeReason"
              value={removeReason}
              onChange={(e) => {
                setRemoveReason(e.target.value);
                if (removeError && e.target.value.trim().length >= 10) {
                  setRemoveError('');
                }
              }}
              placeholder="Please specify why this member is being removed from the team..."
              multiline
              rows={3}
              required
              helperText={`${removeReason.trim().length} / 10 characters minimum`}
            />

            {removeError && (
              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '6px', backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', fontSize: '0.9rem' }}>
                {removeError}
              </div>
            )}
          </form>
        </Modal>
      )}
      {/* Modal: View Applicant Profile */}
      <Modal
        isOpen={applicantModalOpen}
        title="Applicant Profile Inspection"
        onClose={() => setApplicantModalOpen(false)}
        footer={
          <>
            {targetRequest && targetRequest.status === 'Pending' && !isLocked && (
              <>
                <button
                  type="button"
                  className="tf-owned-ws-btn-outline"
                  style={{ color: '#e11d48', borderColor: '#fecdd3' }}
                  onClick={() => {
                    handleRespondJoinRequest(targetRequest.id, 'Rejected');
                    setApplicantModalOpen(false);
                  }}
                >
                  Decline Application
                </button>
                <button
                  type="button"
                  className="tf-owned-ws-btn-primary tf-owned-ws-btn-success"
                  onClick={() => {
                    handleRespondJoinRequest(targetRequest.id, 'Approved');
                    setApplicantModalOpen(false);
                  }}
                >
                  Accept Application
                </button>
              </>
            )}
            <button
              type="button"
              className="tf-owned-ws-btn-outline"
              onClick={() => setApplicantModalOpen(false)}
            >
              Close
            </button>
          </>
        }
      >
        {loadingProfile && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
            <p>Loading applicant profile...</p>
          </div>
        )}

        {profileError && (
          <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}>
            {profileError}
          </div>
        )}

        {!loadingProfile && !profileError && applicantProfile && (
          <div className="tf-applicant-profile-modal">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <Avatar name={applicantProfile.name} src={applicantProfile.avatarUrl || applicantProfile.avatar} version={applicantProfile.updatedAt} size="lg" />
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                  {applicantProfile.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>@{applicantProfile.username || 'applicant'}</span>
                  <Badge variant="info">{applicantProfile.role || 'Collaborator'}</Badge>
                  {applicantProfile.university && (
                    <span style={{ fontSize: '0.85rem', color: '#334155' }}>🎓 {applicantProfile.university}</span>
                  )}
                  {applicantProfile.memberSince && (
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>📅 Member since: {formatMemberSince(applicantProfile.memberSince)}</span>
                  )}
                </div>
                {applicantProfile.linkedIn && (
                  <div style={{ marginTop: '4px' }}>
                    <SafeLink
                      href={
                        /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(String(applicantProfile.linkedIn).trim())
                          ? String(applicantProfile.linkedIn).trim()
                          : `https://${String(applicantProfile.linkedIn).trim()}`
                      }
                      style={{ fontSize: '0.85rem', color: '#0284c7', textDecoration: 'underline' }}
                    >
                      🔗 LinkedIn Profile
                    </SafeLink>
                  </div>
                )}
              </div>
            </div>

            {applicantProfile.bio && (
              <div style={{ marginTop: '14px' }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  About
                </h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.5 }}>
                  {applicantProfile.bio}
                </p>
              </div>
            )}

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>⚡ {applicantProfile.xp || 0}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>XP</div>
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#6366f1' }}>🛡️ {applicantProfile.rep || 0}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Reputation</div>
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0ea5e9' }}>📁 {applicantProfile.projectsCount || 0}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Projects</div>
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>✅ {applicantProfile.tasksCompleted || 0}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Tasks Done</div>
              </div>
            </div>

            {/* Skills */}
            {Array.isArray(applicantProfile.skills) && applicantProfile.skills.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Skills
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {applicantProfile.skills.map((s, idx) => (
                    <span key={idx} className="tf-owned-ws-skill-tag">
                      {typeof s === 'object' ? (s.name || String(s)) : String(s)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendation Badges */}
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Mentor Recommendation Badges
              </h4>
              {Array.isArray(applicantProfile.recommendationBadges) && applicantProfile.recommendationBadges.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {applicantProfile.recommendationBadges.map((badge, idx) => (
                    <div key={idx} style={{ padding: '8px 12px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '6px', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, color: '#5b21b6' }}>🏅 {badge.title || badge.badgeName || 'Recommendation'}</span>
                      {badge.comments && <span style={{ color: '#4c1d95', marginLeft: '6px' }}>— "{badge.comments}"</span>}
                      {badge.mentorName && <div style={{ fontSize: '0.75rem', color: '#6d28d9', marginTop: '2px' }}>Awarded by {badge.mentorName}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  No mentor recommendation badges yet.
                </p>
              )}
            </div>

            {/* Completed Projects with Links */}
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Completed Projects Portfolio
              </h4>
              {Array.isArray(applicantProfile.completedProjects) && applicantProfile.completedProjects.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {applicantProfile.completedProjects.map((p, idx) => (
                    <div key={idx} style={{ padding: '10px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: '#065f46', fontSize: '0.9rem' }}>{p.title}</span>
                        <Badge variant="success">Completed</Badge>
                      </div>
                      {p.description && <p style={{ margin: '4px 0', fontSize: '0.82rem', color: '#047857' }}>{p.description}</p>}
                      {p.link && (
                        <div style={{ marginTop: '4px' }}>
                          <SafeLink href={p.link} style={{ fontSize: '0.82rem', color: '#059669', textDecoration: 'underline', fontWeight: 500 }}>
                            🔗 View Finished Project →
                          </SafeLink>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  No completed projects recorded yet.
                </p>
              )}
            </div>

            {/* Completed Mentored Projects (Public View) */}
            {Array.isArray(applicantProfile.mentoredProjects) && applicantProfile.mentoredProjects.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Completed Mentored Projects
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {applicantProfile.mentoredProjects.map((mp, idx) => (
                    <div key={mp.projectId || idx} style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{mp.title || mp.name}</span>
                        <Badge variant="completed">Completed</Badge>
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '0.82rem', color: '#475569' }}>
                        Owner: {mp.ownerName || mp.owner || 'Project Owner'}
                        {mp.completedAt ? ` · ${new Date(mp.completedAt).toLocaleDateString()}` : ''}
                      </p>
                      {mp.finalLink && (
                        <div style={{ marginTop: '4px' }}>
                          <SafeLink href={mp.finalLink} style={{ fontSize: '0.82rem', color: '#2563eb', textDecoration: 'underline', fontWeight: 500 }}>
                            Final Link →
                          </SafeLink>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contribution History */}
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Contribution History
              </h4>
              {Array.isArray(applicantProfile.contributionHistory) && applicantProfile.contributionHistory.length > 0 ? (
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '6px 10px' }}>Date</th>
                        <th style={{ padding: '6px 10px' }}>Contribution</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Reward</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applicantProfile.contributionHistory.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 10px', color: '#64748b' }}>{formatMemberSince(item.date)}</td>
                          <td style={{ padding: '6px 10px', color: '#1e293b' }}>{item.reason}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                            +{item.xp} XP / +{item.rep} Rep
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  No contribution entries recorded yet.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Change Project Deadline Modal */}
      <Modal
        isOpen={changeDeadlineModalOpen}
        title="Change Project Deadline"
        onClose={() => {
          if (!changingDeadline) {
            setChangeDeadlineModalOpen(false);
          }
        }}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="tf-owned-ws-btn-secondary"
              disabled={changingDeadline}
              onClick={() => setChangeDeadlineModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-owned-ws-btn-primary"
              disabled={changingDeadline || !newDeadlineDate || changeDeadlineReason.trim().length < 10}
              onClick={handleConfirmChangeDeadline}
            >
              {changingDeadline ? 'Saving...' : 'Update Deadline'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
            Current Deadline: <strong>{project?.dueDate ? formatMemberSince(project.dueDate) : 'None'}</strong>.
            All project collaborators and the mentor will be notified of the change and reason.
          </p>

          <DatePicker
            label="New Project Deadline"
            id="newProjectDeadline"
            name="newProjectDeadline"
            value={newDeadlineDate}
            onChange={(val) => {
              setNewDeadlineDate(val);
              if (changeDeadlineError) setChangeDeadlineError('');
            }}
            minDate={minProjectDeadline}
            required
            helperText="Must be in the future and not earlier than any active task due date."
            error={changeDeadlineError && changeDeadlineError.includes('deadline') ? changeDeadlineError : undefined}
          />

          {(() => {
            const curDate = project?.dueDate ? new Date(project.dueDate) : null;
            const nextDate = newDeadlineDate ? new Date(newDeadlineDate) : null;
            const curMid = curDate && !isNaN(curDate.getTime()) ? Date.UTC(curDate.getUTCFullYear(), curDate.getUTCMonth(), curDate.getUTCDate()) : 0;
            const nextMid = nextDate && !isNaN(nextDate.getTime()) ? Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), nextDate.getUTCDate()) : 0;
            const diffDays = (curMid && nextMid > curMid) ? Math.round((nextMid - curMid) / (1000 * 60 * 60 * 24)) : 0;
            if (diffDays > 0) {
              return (
                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: '#1e293b', fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      id="shift-tasks-checkbox"
                      data-testid="shift-tasks-checkbox"
                      checked={shiftTasks}
                      onChange={(e) => setShiftTasks(e.target.checked)}
                    />
                    <span>Shift open tasks by {diffDays} {diffDays === 1 ? 'day' : 'days'}</span>
                  </label>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '24px', marginTop: '2px' }}>
                    Automatically extends the due dates of all open tasks by {diffDays} days. Approved tasks are never shifted.
                  </div>
                </div>
              );
            }
            return null;
          })()}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="change-deadline-reason" style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>
              Reason for changing deadline <span style={{ color: '#dc2626' }}>*</span> (10+ characters)
            </label>
            <textarea
              id="change-deadline-reason"
              rows={3}
              value={changeDeadlineReason}
              onChange={(e) => {
                setChangeDeadlineReason(e.target.value);
                if (changeDeadlineError) setChangeDeadlineError('');
              }}
              placeholder="Explain why the project deadline is being adjusted (e.g. scope extension, unexpected blockers)..."
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}>
              <span>Minimum 10 characters required</span>
              <span>{changeDeadlineReason.trim().length} characters</span>
            </div>
          </div>

          {changeDeadlineError && (
            <div style={{ color: '#dc2626', fontSize: '0.85rem', background: '#fef2f2', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
              ⚠️ {changeDeadlineError}
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Project Settings Modal */}
      <Modal
        isOpen={editProjectModalOpen}
        title="Edit Project Settings"
        onClose={() => {
          if (!savingProjectSettings) {
            setEditProjectModalOpen(false);
          }
        }}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="tf-owned-ws-btn-secondary"
              disabled={savingProjectSettings}
              onClick={() => setEditProjectModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-owned-ws-btn-primary"
              disabled={savingProjectSettings}
              onClick={handleConfirmEditProject}
            >
              {savingProjectSettings ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {editProjectError && (
            <div
              className="tf-error-banner"
              data-testid="team-size-error"
              style={{
                color: '#dc2626',
                background: '#fef2f2',
                padding: '10px 14px',
                borderRadius: '6px',
                border: '1px solid #fecaca',
                fontSize: '0.875rem',
              }}
            >
              ⚠️ {editProjectError}
            </div>
          )}

          <FormInput
            label="Project Title"
            name="title"
            value={editProjectForm.title}
            onChange={(e) => setEditProjectForm((prev) => ({ ...prev, title: e.target.value }))}
            required
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>
              Project Description
            </label>
            <textarea
              rows={4}
              value={editProjectForm.description}
              onChange={(e) => setEditProjectForm((prev) => ({ ...prev, description: e.target.value }))}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <FormInput
            label="Required Skills (comma separated)"
            name="skills"
            value={editProjectForm.skills}
            onChange={(e) => setEditProjectForm((prev) => ({ ...prev, skills: e.target.value }))}
            placeholder="React, TypeScript, Node.js..."
          />

          <FormInput
            label="Team Size (Capacity)"
            name="teamSize"
            type="number"
            min="1"
            value={editProjectForm.teamSize}
            onChange={(e) => setEditProjectForm((prev) => ({ ...prev, teamSize: e.target.value }))}
            helperText="Maximum number of active collaborators allowed on this project."
            required
          />

          <DatePicker
            label="Project Due Date"
            required
            value={editProjectForm.dueDate}
            onChange={(val) => setEditProjectForm((prev) => ({ ...prev, dueDate: val || '' }))}
            minDate={minProjectDeadline}
            placeholder="DD/MM/YYYY"
          />
        </div>
      </Modal>

      {/* Starter Task Templates Picker Modal */}
      <Modal
        isOpen={starterModalOpen}
        title="Add Starter Tasks"
        closeDisabled={applyingStarterTasks}
        onClose={() => {
          if (!applyingStarterTasks) {
            setStarterModalOpen(false);
          }
        }}
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="tf-owned-ws-btn-secondary"
              disabled={applyingStarterTasks}
              onClick={() => setStarterModalOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="tf-owned-ws-btn-primary"
              data-testid="confirm-apply-starter-tasks-btn"
              disabled={applyingStarterTasks || starterLoading}
              onClick={handleApplyStarterTasks}
            >
              {applyingStarterTasks
                ? 'Adding Starter Tasks...'
                : 'Add Selected Starter Tasks'}
            </button>
          </div>
        }
      >
        <StarterTaskPicker
          category={starterCategory}
          templates={starterTemplates}
          loading={starterLoading}
          existingTitles={tasks.map((t) => t.title)}
          selectedKeys={starterSelectedKeys}
          overrides={starterOverrides}
          onToggleKey={handleToggleStarterKey}
          onToggleAll={handleToggleAllStarterKeys}
          onChangeOverride={handleStarterOverrideChange}
          error={starterError}
          skipped={starterSkipped}
        />
      </Modal>

      {/* Decline Join Request Modal */}
      <Modal
        isOpen={rejectModalOpen}
        title="Decline Join Request"
        onClose={() => {
          if (!rejecting) {
            setRejectModalOpen(false);
            setRejectTargetRequest(null);
          }
        }}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="tf-owned-ws-btn-secondary"
              disabled={rejecting}
              onClick={() => {
                setRejectModalOpen(false);
                setRejectTargetRequest(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-owned-ws-btn-primary"
              style={{ backgroundColor: '#dc2626' }}
              disabled={rejecting || rejectReason.trim().length < 10 || rejectReason.trim().length > 500}
              onClick={handleConfirmDecline}
            >
              {rejecting ? 'Declining...' : 'Confirm Decline'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
            Decline join request from <strong>{rejectTargetRequest?.userName || 'Applicant'}</strong>.
            Please provide constructive feedback explaining why their application was not accepted.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="decline-reason" style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>
              Reason for declining <span style={{ color: '#dc2626' }}>*</span> (10 to 500 characters)
            </label>
            <textarea
              id="decline-reason"
              rows={4}
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                if (rejectError) setRejectError('');
              }}
              placeholder="Explain why this request is declined..."
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}>
              <span>{rejectReason.trim().length} / 500 characters (min 10)</span>
            </div>
          </div>

          {rejectError && (
            <div style={{ color: '#dc2626', fontSize: '0.85rem', background: '#fef2f2', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
              ⚠️ {rejectError}
            </div>
          )}
        </div>
      </Modal>

      {/* Release Member Tasks Confirmation Modal */}
      <Modal
        isOpen={Boolean(releaseTasksTarget)}
        onClose={() => !releasingTasks && setReleaseTasksTarget(null)}
        title={`Release Tasks — ${releaseTasksTarget?.name || 'Collaborator'}`}
        footer={
          <>
            <button
              type="button"
              className="tf-owned-ws-btn-outline"
              disabled={releasingTasks}
              onClick={() => setReleaseTasksTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-owned-ws-btn-primary"
              data-testid="confirm-release-tasks-btn"
              disabled={releasingTasks}
              onClick={handleConfirmReleaseTasks}
            >
              {releasingTasks ? 'Releasing...' : 'Confirm Release'}
            </button>
          </>
        }
      >
        {(() => {
          const releasable = getMemberReleasableTasks(releaseTasksTarget);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-testid="release-tasks-modal-body">
              <p style={{ margin: 0, fontSize: '0.92rem', color: '#475569' }}>
                This keeps <strong>{releaseTasksTarget?.name || 'this member'}</strong> on the team while returning their Open and In Progress tasks to the unassigned pool. Tasks currently <strong>In Review</strong> or <strong>Completed</strong> stay unchanged.
              </p>
              {releasable.length > 0 ? (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Tasks to be released ({releasable.length}):
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.86rem', color: '#1e293b' }}>
                    {releasable.map((t) => (
                      <li key={t.id}>
                        {t.title} <span style={{ color: '#64748b' }}>({t.status})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b' }}>
                  No Open or In Progress tasks are currently assigned to this member.
                </p>
              )}
              {releaseTasksError && (
                <div style={{ color: '#dc2626', fontSize: '0.85rem', background: '#fef2f2', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                  ⚠️ {releaseTasksError}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Send Task Back for Revision Modal (Mandatory 10-500 char Reason) */}
      {(() => {
        const creditInfo = getRejectionReviewCreditInfo(
          rejectTaskTarget,
          project,
          rejectModalOpenedAt,
        );
        const requiresExtension = Boolean(creditInfo?.requiresProjectExtension);
        const isConfirmDisabled =
          rejectingTask ||
          rejectTaskReason.trim().length < 10 ||
          rejectTaskReason.trim().length > 500 ||
          (requiresExtension && (
            !rejectExtendedProjectDueDate ||
            rejectProjectExtensionReason.trim().length < 10
          ));

        return (
          <Modal
            isOpen={Boolean(rejectTaskTarget)}
            onClose={() => !rejectingTask && setRejectTaskTarget(null)}
            title={`Send Task Back for Revision — ${rejectTaskTarget?.title || 'Task'}`}
            footer={
              <>
                <button
                  type="button"
                  className="tf-owned-ws-btn-outline"
                  disabled={rejectingTask}
                  onClick={() => setRejectTaskTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="tf-owned-ws-btn-primary"
                  data-testid="confirm-task-reject-btn"
                  style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                  disabled={isConfirmDisabled}
                  onClick={handleConfirmRejectTask}
                >
                  {rejectingTask ? 'Sending...' : 'Send Back for Revision'}
                </button>
              </>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-testid="task-reject-modal">
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
                Explain clearly what needs to be changed so the collaborator can address the feedback and resubmit.
              </p>

              {creditInfo && (
                <div
                  data-testid="task-review-duration-banner"
                  style={{
                    padding: '10px 14px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.86rem',
                    color: '#334155',
                  }}
                >
                  <div><strong>Review duration:</strong> {creditInfo.formattedDuration}</div>
                  {creditInfo.creditMs > 0 && creditInfo.newTaskDueIso && (
                    <div style={{ marginTop: '4px' }}>
                      <strong>New calculated task deadline:</strong> {formatDateTime(creditInfo.newTaskDueIso)}
                    </div>
                  )}
                </div>
              )}

              {requiresExtension && (
                <div
                  data-testid="project-deadline-cascade-warning"
                  style={{
                    padding: '12px 14px',
                    background: '#fffbeb',
                    borderRadius: '8px',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    fontSize: '0.86rem',
                    lineHeight: '1.4',
                  }}
                >
                  ⚠️ This review took {creditInfo.formattedDuration}. Task deadline will move to {formatDateTime(creditInfo.newTaskDueIso)}. Because this exceeds project deadline ({formatDateTime(creditInfo.projectDueDate)}), you must extend the project deadline below.
                </div>
              )}

              {requiresExtension && (
                <div
                  data-testid="extend-project-deadline-section"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                    Extend Project Deadline *
                  </div>
                  <div>
                    <label
                      htmlFor="extended-project-due-date"
                      style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}
                    >
                      New Project Deadline (minimum: {creditInfo.newTaskDueIso ? new Date(creditInfo.newTaskDueIso).toLocaleDateString() : ''}) *
                    </label>
                    <input
                      id="extended-project-due-date"
                      type="date"
                      data-testid="extended-project-due-input"
                      value={rejectExtendedProjectDueDate}
                      min={creditInfo.newTaskDueIso ? new Date(creditInfo.newTaskDueIso).toISOString().split('T')[0] : ''}
                      onChange={(e) => setRejectExtendedProjectDueDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="project-extension-reason"
                      style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}
                    >
                      Project Extension Reason (at least 10 characters) *
                    </label>
                    <textarea
                      id="project-extension-reason"
                      data-testid="project-extension-reason-input"
                      rows={2}
                      value={rejectProjectExtensionReason}
                      onChange={(e) => setRejectProjectExtensionReason(e.target.value)}
                      placeholder="e.g., Extending project deadline due to review delay on this task..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        resize: 'vertical',
                      }}
                    />
                    <div
                      data-testid="project-extension-reason-counter"
                      style={{
                        marginTop: '2px',
                        fontSize: '0.75rem',
                        color: rejectProjectExtensionReason.trim().length >= 10 ? '#059669' : '#64748b',
                      }}
                    >
                      {rejectProjectExtensionReason.trim().length} / 10 characters minimum
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="task-reject-reason-textarea"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                >
                  Revision Reason (10 to 500 characters) *
                </label>
                <textarea
                  id="task-reject-reason-textarea"
                  data-testid="task-reject-reason-input"
                  rows={4}
                  value={rejectTaskReason}
                  onChange={(e) => {
                    setRejectTaskReason(e.target.value);
                    if (rejectTaskError && e.target.value.trim().length >= 10 && e.target.value.trim().length <= 500) {
                      setRejectTaskError('');
                    }
                  }}
                  placeholder="e.g., Please add unit tests for the new validation path and update README..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
                <div
                  data-testid="task-reject-counter"
                  style={{
                    marginTop: '4px',
                    fontSize: '0.78rem',
                    color:
                      rejectTaskReason.trim().length >= 10 && rejectTaskReason.trim().length <= 500
                        ? '#059669'
                        : '#64748b',
                  }}
                >
                  {rejectTaskReason.trim().length} / 500 characters (minimum 10)
                </div>
              </div>
              {rejectTaskError && (
                <div
                  data-testid="task-reject-error"
                  style={{ color: '#dc2626', fontSize: '0.85rem', background: '#fef2f2', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fecaca' }}
                >
                  ⚠️ {rejectTaskError}
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* Phase 14: Report Inactive Mentor Modal */}
      <Modal
        isOpen={reportMentorModalOpen}
        title="Report Inactive Mentor"
        onClose={() => !reportingMentor && dispatch(closeReportMentorModal())}
        footer={
          <>
            <button
              type="button"
              className="tf-owned-ws-btn-outline"
              disabled={reportingMentor}
              onClick={() => dispatch(closeReportMentorModal())}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="confirm-report-mentor-btn"
              className="tf-owned-ws-btn-primary"
              style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
              disabled={reportingMentor}
              onClick={async () => {
                if (reportingMentor) return;
                try {
                  await dispatch(
                    openAbandonmentReview({
                      projectId,
                      reason: reportMentorReason.trim() || undefined,
                    }),
                  ).unwrap();
                  showToast('Abandonment review opened. Mentor has 48 hours to confirm activity.', 'success');
                } catch {
                  // Friendly error stored in abandonmentReviews.working.reportError
                }
              }}
            >
              {reportingMentor ? 'Opening Review...' : 'Open 48h Abandonment Review'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
            Opening an abandonment review sends a high-priority notice to <strong>{mentorName || 'your mentor'}</strong> giving them 48 hours to confirm they are still active. If they do not confirm, the mentor is released and non-completed sessions are refunded in full.
          </p>
          <div>
            <label htmlFor="report-mentor-reason" style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px' }}>
              Optional Note
            </label>
            <textarea
              id="report-mentor-reason"
              rows={3}
              value={reportMentorReason}
              onChange={(e) => dispatch(setReportMentorReason(e.target.value))}
              placeholder="Describe how long the mentor has been unreachable..."
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
          </div>
          {reportMentorError && (
            <div data-testid="report-mentor-error" style={{ color: '#dc2626', fontSize: '0.85rem', background: '#fef2f2', padding: '8px 12px', borderRadius: '6px' }}>
              ⚠️ {reportMentorError}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Project Dialog (Enhanced Deletion Policy) */}
      <DeleteProjectDialog
        isOpen={deleteProjectDialogOpen}
        projectId={projectId}
        projectTitle={project?.title || project?.name}
        isAdmin={false}
        onClose={() => setDeleteProjectDialogOpen(false)}
        onSuccess={(result) => {
          if (result?.mode === 'scheduled') {
            showToast('Project deletion scheduled for 48 hours from now. Members have been notified.', 'success');
            if (!result.project) {
              dispatch(fetchProjectById({ id: projectId, force: true }));
            }
          } else {
            showToast('Project deleted successfully.', 'success');
            navigate('/owner/projects');
          }
        }}
        onCloseProject={() => {
          showToast('To close the project, you can request project closure.', 'info');
        }}
        onReviewTasks={() => {
          setActiveTab('tasks');
        }}
      />

      {/* Reject Leave Request Modal */}
      <UniversalReasonModal
        isOpen={rejectLeaveModalOpen}
        onClose={() => {
          setRejectLeaveModalOpen(false);
          setRejectingLeaveRequest(null);
        }}
        onConfirm={handleConfirmRejectLeaveRequest}
        actionType="REJECT_LEAVE_REQUEST"
        title="Reject Leave Request"
        description={`Select reasons for declining the leave request for ${rejectingLeaveRequest?.userName || 'this collaborator'} and explain why they need to stay.`}
        confirmLabel="Confirm Rejection"
        entityName={rejectingLeaveRequest?.userName || 'Collaborator'}
      />

      {toast.visible && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: toast.type === 'error' ? '#ef4444' : '#10b981',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.95rem',
            fontWeight: 500,
          }}
        >
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

const OwnedWorkspace = OwnedWorkspaceContent;
export default OwnedWorkspace;
