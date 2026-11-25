import { useState, useCallback } from 'react';
import UniversalReasonModal from '../components/common/UniversalReasonModal';
import projectsApi from '../services/projectsApi';
import joinRequestsApi from '../services/joinRequestsApi';
import tasksApi from '../services/tasksApi';
import mentorMarketplaceApi from '../services/mentorMarketplaceApi';

/**
 * Single canonical action API helpers module.
 * In accordance with Phase 9 guard rules, components route negative actions
 * and accept actions through this unified hook module rather than calling
 * the raw API helpers directly.
 */
export const actionApi = {
  declineInvite: (inviteId, payload) => projectsApi.declineInvite(inviteId, payload),
  acceptInvite: (inviteId) => projectsApi.acceptInvite(inviteId),
  withdrawApplication: (requestId, payload) => joinRequestsApi.remove(requestId, payload),
  leaveProject: (projectId, payload) => projectsApi.leave(projectId, payload),
  dropTask: (taskId, payload) => tasksApi.unassign(taskId, payload),
  rejectWork: (taskId, payload) => tasksApi.review(taskId, payload),
  removeMember: (projectId, memberId, reason) => projectsApi.removeMember(projectId, memberId, reason),
  cancelBooking: (sessionId, payload) => mentorMarketplaceApi.cancelSession(sessionId, payload),
  declineBooking: (sessionId, payload) => mentorMarketplaceApi.declineSession(sessionId, payload),
  acceptBooking: (sessionId) => mentorMarketplaceApi.acceptSession(sessionId),
};

/**
 * Custom React hook for triggering actions that require reasons and feedback (Fix 4 / Phase 9).
 * Returns `requestReason`, `renderModal`, and unified action handlers.
 */
export function useReasonAction() {
  const [modalState, setModalState] = useState({
    isOpen: false,
    actionType: null,
    title: null,
    description: null,
    confirmLabel: null,
    entityName: null,
    onConfirmCallback: null,
  });

  const requestReason = useCallback(
    ({
      actionType,
      title,
      description,
      confirmLabel,
      entityName,
      onConfirm,
    }) => {
      return new Promise((resolve, reject) => {
        setModalState({
          isOpen: true,
          actionType,
          title,
          description,
          confirmLabel,
          entityName,
          onConfirmCallback: async (feedbackPayload) => {
            try {
              if (onConfirm) {
                const res = await onConfirm(feedbackPayload);
                resolve(res);
                return res;
              } else {
                resolve(feedbackPayload);
                return feedbackPayload;
              }
            } catch (err) {
              reject(err);
              throw err;
            }
          },
        });
      });
    },
    [],
  );

  const closeModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // 1. Unified Decline Invite Handler (opens reason modal across Notifications & Projects Marketplace)
  const handleDeclineInvite = useCallback(
    async (inviteOrId, options = {}) => {
      const inviteId =
        typeof inviteOrId === 'object' && inviteOrId !== null
          ? inviteOrId.id || inviteOrId.inviteId
          : inviteOrId;
      const projectName =
        typeof inviteOrId === 'object' && inviteOrId !== null
          ? inviteOrId.projectName || inviteOrId.projectTitle || inviteOrId.title || inviteOrId.name
          : options.projectName || 'Project Invitation';

      return requestReason({
        actionType: 'DECLINE_INVITATION',
        title: 'Decline Project Invitation',
        entityName: projectName,
        onConfirm: async (feedbackPayload) => {
          const payload = feedbackPayload
            ? {
                block: Boolean(options.block),
                feedback: feedbackPayload,
                reasons: feedbackPayload.reasons,
                explanation: feedbackPayload.explanation,
              }
            : Boolean(options.block);
          const res = await actionApi.declineInvite(inviteId, payload);
          if (typeof options.onSuccess === 'function') {
            await options.onSuccess(res);
          }
          return res;
        },
      });
    },
    [requestReason],
  );

  // 2. Unified Accept Invite Handler
  const handleAcceptInvite = useCallback(
    async (inviteOrId, options = {}) => {
      const inviteId =
        typeof inviteOrId === 'object' && inviteOrId !== null
          ? inviteOrId.id || inviteOrId.inviteId
          : inviteOrId;
      const res = await actionApi.acceptInvite(inviteId);
      if (typeof options.onSuccess === 'function') {
        await options.onSuccess(res);
      }
      return res;
    },
    [],
  );

  // 3. Unified Withdraw Application Handler
  const handleWithdrawApplication = useCallback(
    async (requestOrId, options = {}) => {
      const requestId =
        typeof requestOrId === 'object' && requestOrId !== null
          ? requestOrId.id
          : requestOrId;
      const projectName =
        typeof requestOrId === 'object' && requestOrId !== null
          ? requestOrId.project || requestOrId.projectName
          : options.projectName || 'Application';

      return requestReason({
        actionType: 'WITHDRAW_APPLICATION',
        title: 'Withdraw Application',
        entityName: projectName,
        onConfirm: async (feedbackPayload) => {
          const res = await actionApi.withdrawApplication(requestId, feedbackPayload);
          if (typeof options.onSuccess === 'function') {
            await options.onSuccess(res);
          }
          return res;
        },
      });
    },
    [requestReason],
  );

  // 4. Unified Leave Project Handler
  const handleLeaveProject = useCallback(
    async (projectOrId, options = {}) => {
      const projectId =
        typeof projectOrId === 'object' && projectOrId !== null
          ? projectOrId.id
          : projectOrId;
      const projectName =
        typeof projectOrId === 'object' && projectOrId !== null
          ? projectOrId.title || projectOrId.name
          : options.projectName || 'Project';

      return requestReason({
        actionType: 'LEAVE_PROJECT',
        title: 'Leave Project',
        entityName: projectName,
        onConfirm: async (feedbackPayload) => {
          const res = await actionApi.leaveProject(projectId, feedbackPayload);
          if (typeof options.onSuccess === 'function') {
            await options.onSuccess(res);
          }
          return res;
        },
      });
    },
    [requestReason],
  );

  // 5. Unified Drop Task Handler
  const handleDropTask = useCallback(
    async (taskOrId, options = {}) => {
      const taskId =
        typeof taskOrId === 'object' && taskOrId !== null
          ? taskOrId.id
          : taskOrId;
      const taskTitle =
        typeof taskOrId === 'object' && taskOrId !== null
          ? taskOrId.title
          : options.taskTitle || 'Task';

      return requestReason({
        actionType: 'DROP_TASK',
        title: `Drop Task - ${taskTitle}`,
        entityName: taskTitle,
        onConfirm: async (feedbackPayload) => {
          const res = await actionApi.dropTask(taskId, feedbackPayload);
          if (typeof options.onSuccess === 'function') {
            await options.onSuccess(res);
          }
          return res;
        },
      });
    },
    [requestReason],
  );

  // 6. Unified Reject Work Handler
  const handleRejectWork = useCallback(
    async (taskOrId, options = {}) => {
      const taskId =
        typeof taskOrId === 'object' && taskOrId !== null
          ? taskOrId.id
          : taskOrId;
      const taskTitle =
        typeof taskOrId === 'object' && taskOrId !== null
          ? taskOrId.title
          : options.taskTitle || 'Task Submission';

      return requestReason({
        actionType: 'REJECT_WORK',
        title: `Reject Task Submission - ${taskTitle}`,
        entityName: taskTitle,
        onConfirm: async (feedbackPayload) => {
          const res = await actionApi.rejectWork(taskId, {
            decision: 'reject',
            ...(feedbackPayload || {}),
          });
          if (typeof options.onSuccess === 'function') {
            await options.onSuccess(res);
          }
          return res;
        },
      });
    },
    [requestReason],
  );

  // 7. Unified Remove Member Handler
  const handleRemoveMember = useCallback(
    async (projectId, memberOrId, options = {}) => {
      const memberId =
        typeof memberOrId === 'object' && memberOrId !== null
          ? memberOrId.id || memberOrId.userId
          : memberOrId;
      const memberName =
        typeof memberOrId === 'object' && memberOrId !== null
          ? memberOrId.name || memberOrId.username
          : options.memberName || 'Member';

      return requestReason({
        actionType: 'REMOVE_COLLABORATOR',
        title: `Remove Team Member - ${memberName}`,
        entityName: memberName,
        onConfirm: async (feedbackPayload) => {
          const res = await actionApi.removeMember(projectId, memberId, feedbackPayload);
          if (typeof options.onSuccess === 'function') {
            await options.onSuccess(res);
          }
          return res;
        },
      });
    },
    [requestReason],
  );

  // 8. Unified Cancel Booking Handler
  const handleCancelBooking = useCallback(
    async (sessionOrId, options = {}) => {
      const sessionId =
        typeof sessionOrId === 'object' && sessionOrId !== null
          ? sessionOrId.id
          : sessionOrId;
      const sessionTitle =
        typeof sessionOrId === 'object' && sessionOrId !== null
          ? sessionOrId.projectName || sessionOrId.mentorName
          : options.sessionTitle || 'Mentorship Session';

      return requestReason({
        actionType: 'STUDENT_CANCEL_MENTORSHIP',
        title: 'Cancel Mentorship Session',
        entityName: sessionTitle,
        onConfirm: async (feedbackPayload) => {
          const res = await actionApi.cancelBooking(sessionId, feedbackPayload);
          if (typeof options.onSuccess === 'function') {
            await options.onSuccess(res);
          }
          return res;
        },
      });
    },
    [requestReason],
  );

  // 9. Unified Decline Booking Handler
  const handleDeclineBooking = useCallback(
    async (sessionOrId, options = {}) => {
      const sessionId =
        typeof sessionOrId === 'object' && sessionOrId !== null
          ? sessionOrId.id
          : sessionOrId;
      const sessionTitle =
        typeof sessionOrId === 'object' && sessionOrId !== null
          ? sessionOrId.projectName
          : options.sessionTitle || 'Mentorship Booking';

      return requestReason({
        actionType: 'MENTOR_DECLINE_ASSIGNMENT',
        title: 'Decline Mentorship Booking',
        entityName: sessionTitle,
        onConfirm: async (feedbackPayload) => {
          const res = await actionApi.declineBooking(sessionId, feedbackPayload);
          if (typeof options.onSuccess === 'function') {
            await options.onSuccess(res);
          }
          return res;
        },
      });
    },
    [requestReason],
  );

  // 10. Unified Accept Booking Handler
  const handleAcceptBooking = useCallback(
    async (sessionOrId, options = {}) => {
      const sessionId =
        typeof sessionOrId === 'object' && sessionOrId !== null
          ? sessionOrId.id
          : sessionOrId;
      const res = await actionApi.acceptBooking(sessionId);
      if (typeof options.onSuccess === 'function') {
        await options.onSuccess(res);
      }
      return res;
    },
    [],
  );

  const renderModal = () => (
    <UniversalReasonModal
      isOpen={modalState.isOpen}
      onClose={closeModal}
      onConfirm={modalState.onConfirmCallback}
      actionType={modalState.actionType}
      title={modalState.title}
      description={modalState.description}
      confirmLabel={modalState.confirmLabel}
      entityName={modalState.entityName}
    />
  );

  return {
    requestReason,
    closeModal,
    modalState,
    renderModal,
    renderReasonModal: renderModal,
    handleDeclineInvite,
    handleAcceptInvite,
    handleWithdrawApplication,
    handleLeaveProject,
    handleDropTask,
    handleRejectWork,
    handleRemoveMember,
    handleCancelBooking,
    handleDeclineBooking,
    handleAcceptBooking,
  };
}

export default useReasonAction;
