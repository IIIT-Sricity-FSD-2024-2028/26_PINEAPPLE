/**
 * Single canonical helper mapping request state into UI control properties.
 *
 * State values:
 * - 'none': User hasn't applied. Can apply.
 * - 'pending': Application pending review. Button disabled: "Request pending".
 * - 'rejected_can_retry': 1st rejection. Can re-apply: "Apply to Join" with hint "1 request left".
 * - 'rejected_final': 2nd rejection. Blocked: "Request rejected" (disabled).
 * - 'member': Already collaborator or owner. "Member" (disabled).
 * - 'banned': Removed by owner with reason. Blocked: "Removed" (disabled).
 * - 'full': Project at capacity. "Project full" (disabled).
 * - 'closed': Project closed. "Project closed" (disabled).
 */

export function getRequestControlConfig(statusObj) {
  if (!statusObj) {
    return {
      label: 'Apply',
      disabled: false,
      variant: 'primary',
      hint: null,
      reason: null,
      canApply: true,
      requestsLeft: 2,
      requestsUsed: 0,
      state: 'none',
    };
  }

  const { state = 'none', requestsLeft = 2, requestsUsed = 0, lastReason = '' } = statusObj;

  const base = {
    requestsLeft,
    requestsUsed,
    state,
  };

  switch (state) {
    case 'pending':
      return {
        ...base,
        label: 'Request pending',
        disabled: true,
        variant: 'secondary',
        hint: 'Pending owner review',
        reason: null,
        canApply: false,
        isPending: true,
      };

    case 'invited':
      return {
        ...base,
        label: 'Invited: respond',
        disabled: false,
        variant: 'warning',
        hint: 'The owner has invited you to join',
        reason: null,
        canApply: false,
        isInvited: true,
        inviteId: statusObj.inviteId,
      };

    case 'not_accepting':
      return {
        ...base,
        label: 'Not accepting requests',
        disabled: true,
        variant: 'secondary',
        hint: null,
        reason: lastReason || null,
        canApply: false,
      };

    case 'rejected_can_retry':
      return {
        ...base,
        label: 'Apply',
        disabled: false,
        variant: 'primary',
        hint: '1 request left',
        reason: lastReason || null,
        canApply: true,
      };

    case 'rejected_final':
      return {
        ...base,
        label: 'Request rejected',
        disabled: true,
        variant: 'danger',
        hint: 'No requests left',
        reason: lastReason || null,
        canApply: false,
      };

    case 'member':
      return {
        ...base,
        label: 'Member',
        disabled: true,
        variant: 'success',
        hint: null,
        reason: null,
        canApply: false,
      };

    case 'banned':
      return {
        ...base,
        label: 'Removed',
        disabled: true,
        variant: 'danger',
        hint: lastReason ? `Removed: ${lastReason}` : 'Removed by owner',
        reason: lastReason || null,
        canApply: false,
      };

    case 'full':
      return {
        ...base,
        label: 'Project full',
        disabled: true,
        variant: 'secondary',
        hint: null,
        reason: null,
        canApply: false,
      };

    case 'closed':
      return {
        ...base,
        label: 'Closed',
        disabled: true,
        variant: 'secondary',
        hint: null,
        reason: lastReason || null,
        canApply: false,
      };

    case 'none':
    default:
      return {
        ...base,
        label: 'Apply',
        disabled: false,
        variant: 'primary',
        hint: null,
        reason: null,
        canApply: true,
      };
  }
}
