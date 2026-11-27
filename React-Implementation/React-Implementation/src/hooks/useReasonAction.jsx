import { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import UniversalReasonModal from '../components/common/UniversalReasonModal';
import {
  acceptProjectInvite,
  declineProjectInvite,
} from '../store/thunks/invitesThunks';

/**
 * Custom React hook for triggering actions that require reasons and feedback (Fix 4 / Phase 9).
 * All actions route strictly through Redux thunks via useDispatch.
 */
export function useReasonAction() {
  const dispatch = useDispatch();
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
          const res = await dispatch(declineProjectInvite({ inviteId, payload }))
            .unwrap()
            .then((r) => r?.res ?? r);
          if (typeof options.onSuccess === 'function') {
            await options.onSuccess(res);
          }
          return res;
        },
      });
    },
    [requestReason, dispatch],
  );

  // 2. Unified Accept Invite Handler
  const handleAcceptInvite = useCallback(
    async (inviteOrId, options = {}) => {
      const inviteId =
        typeof inviteOrId === 'object' && inviteOrId !== null
          ? inviteOrId.id || inviteOrId.inviteId
          : inviteOrId;
      const projectId =
        typeof inviteOrId === 'object' && inviteOrId !== null
          ? inviteOrId.projectId
          : options.projectId;
      const res = await dispatch(acceptProjectInvite({ inviteId, projectId }))
        .unwrap()
        .then((r) => r?.res ?? r);
      if (typeof options.onSuccess === 'function') {
        await options.onSuccess(res);
      }
      return res;
    },
    [dispatch],
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
    renderModal,
    renderReasonModal: renderModal,
    handleDeclineInvite,
    handleAcceptInvite,
  };
}

export default useReasonAction;
