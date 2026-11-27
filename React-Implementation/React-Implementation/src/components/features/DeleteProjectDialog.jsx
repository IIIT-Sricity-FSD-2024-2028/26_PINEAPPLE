import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Modal from '../common/Modal';
import {
  checkProjectDeletion,
  deleteProject,
} from '../../store/thunks/projectsThunks';
import {
  selectDeleteProjectStatus,
  selectDeletionCheckStatus,
  selectProjectDeletionCheck,
  selectProjectsWorking,
} from '../../store/selectors/projectsSelectors';
import './DeleteProjectDialog.css';

const DELETE_REASONS = [
  { id: 'CREATED_BY_MISTAKE', label: 'Created by mistake' },
  { id: 'DUPLICATE_PROJECT', label: 'Duplicate project' },
  { id: 'PROJECT_NO_LONGER_REQUIRED', label: 'Project no longer required' },
  { id: 'LACK_OF_RESOURCES', label: 'Lack of resources' },
  { id: 'CHANGE_IN_PROJECT_DIRECTION', label: 'Change in project direction' },
  { id: 'INSUFFICIENT_PARTICIPATION', label: 'Insufficient participation' },
  { id: 'OTHER', label: 'Other' },
];

function DeleteProjectDialogContent({
  isOpen,
  projectId,
  projectTitle = '',
  isAdmin = false,
  onClose,
  onSuccess,
  onCloseProject,
  onReviewTasks,
}) {
  const dispatch = useDispatch();
  const checkResult = useSelector((state) =>
    isOpen && projectId ? selectProjectDeletionCheck(state, projectId) : null,
  );
  const checkStatus = useSelector(selectDeletionCheckStatus);
  const deleteStatus = useSelector(selectDeleteProjectStatus);
  const working = useSelector(selectProjectsWorking);

  const loading = Boolean(isOpen && projectId && checkStatus === 'loading');
  const submitting = deleteStatus === 'loading';
  const checkError = isOpen && projectId ? working.checkError || '' : '';

  const [confirmTitle, setConfirmTitle] = useState('');
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [explanation, setExplanation] = useState('');
  const [adminModeOverride, setAdminModeOverride] = useState(null); // 'scheduled' | 'immediate'
  const [submitError, setSubmitError] = useState('');

  const adminMode =
    adminModeOverride ??
    (checkResult?.mode === 'immediate' ? 'immediate' : 'scheduled');
  const setAdminMode = (mode) => setAdminModeOverride(mode);

  const resetDialogDraft = () => {
    setConfirmTitle('');
    setSelectedReasons([]);
    setExplanation('');
    setAdminModeOverride(null);
    setSubmitError('');
  };

  useEffect(() => {
    if (!isOpen || !projectId) {
      return undefined;
    }
    dispatch(checkProjectDeletion({ id: projectId }));
    return undefined;
  }, [dispatch, isOpen, projectId]);

  const toggleReason = (reasonId) => {
    setSelectedReasons((prev) =>
      prev.includes(reasonId)
        ? prev.filter((r) => r !== reasonId)
        : [...prev, reasonId],
    );
  };

  const hasBlockers = Boolean(checkResult?.blockers?.length);
  const isTitleMatch =
    confirmTitle.trim() === String(projectTitle || '').trim();

  const isOtherSelected = selectedReasons.includes('OTHER');
  const requiresReason = Boolean(checkResult?.requiresReason || isAdmin);

  let isExplanationValid = true;
  if (isAdmin) {
    const trimmed = explanation.trim();
    isExplanationValid = trimmed.length >= 10 && trimmed.length <= 500;
  } else if (isOtherSelected) {
    const trimmed = explanation.trim();
    isExplanationValid = trimmed.length >= 10 && trimmed.length <= 500;
  }

  const isFormValid =
    isTitleMatch &&
    (!requiresReason || selectedReasons.length > 0) &&
    isExplanationValid &&
    !hasBlockers;

  const effectiveMode = isAdmin ? adminMode : checkResult?.mode || 'immediate';

  const handleSubmit = async () => {
    if (!isFormValid || submitting) return;
    setSubmitError('');

    try {
      const payload = {
        confirmTitle: confirmTitle.trim(),
        mode: effectiveMode,
      };

      if (requiresReason || selectedReasons.length > 0 || explanation.trim()) {
        payload.reasons = selectedReasons;
        if (explanation.trim()) {
          payload.explanation = explanation.trim();
        }
      }

      const actionRes = await dispatch(
        deleteProject({ id: projectId, payload }),
      ).unwrap();
      const res = actionRes?.result;
      if (typeof onSuccess === 'function') {
        onSuccess(res);
      }
      resetDialogDraft();
      onClose();
    } catch (err) {
      if (err?.code === 'PROJECT_DELETE_LIMIT' || err?.statusCode === 429) {
        setSubmitError(
          'You have reached the deletion limit of 3 projects per 24 hours. Please try again later.',
        );
      } else if (err?.code === 'TITLE_MISMATCH') {
        setSubmitError('Project title does not match. Please retype accurately.');
      } else if (err?.code === 'REASON_REQUIRED') {
        setSubmitError('Please select at least one reason for deleting this project.');
      } else if (err?.code === 'EXPLANATION_REQUIRED') {
        setSubmitError('A written explanation between 10 and 500 characters is required.');
      } else {
        setSubmitError(
          err?.serverMessage ||
            err?.message ||
            'Failed to delete project. Please try again.',
        );
      }
    }
  };

  const handleDialogClose = () => {
    resetDialogDraft();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Delete Project"
      onClose={() => {
        if (!submitting) handleDialogClose();
      }}
      size="md"
      testId="delete-project-modal"
      footer={
        hasBlockers ? (
          <button
            type="button"
            className="tf-del-btn-secondary"
            onClick={handleDialogClose}
          >
            Close
          </button>
        ) : (
          <div className="tf-del-footer">
            <button
              type="button"
              className="tf-del-btn-secondary"
              disabled={submitting}
              onClick={handleDialogClose}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="confirm-delete-project-btn"
              className="tf-del-btn-danger"
              disabled={!isFormValid || submitting || loading}
              onClick={handleSubmit}
            >
              {submitting
                ? effectiveMode === 'scheduled'
                  ? 'Scheduling...'
                  : 'Deleting...'
                : effectiveMode === 'scheduled'
                  ? 'Schedule deletion (48h notice)'
                  : 'Delete project'}
            </button>
          </div>
        )
      }
    >
      <div className="tf-delete-dialog-content">
        {loading && (
          <div className="tf-del-loading" data-testid="delete-dialog-loading">
            <div className="tf-del-spinner" />
            <p>Evaluating deletion conditions and dependencies...</p>
          </div>
        )}

        {checkError && (
          <div className="tf-del-alert tf-del-alert-error" role="alert">
            <strong>Error:</strong> {checkError}
          </div>
        )}

        {!loading && checkResult && (
          <>
            {/* Hard Blockers View */}
            {hasBlockers ? (
              <div className="tf-del-blockers-container" data-testid="delete-dialog-blockers">
                <div className="tf-del-alert tf-del-alert-danger">
                  <div className="tf-del-alert-icon">⚠️</div>
                  <div>
                    <strong>This project cannot be deleted.</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
                      Please resolve the following dependencies before this project can be deleted:
                    </p>
                  </div>
                </div>

                <div className="tf-del-blockers-list">
                  {checkResult.blockers.map((blocker) => (
                    <div key={blocker.code} className="tf-del-blocker-card" data-testid={`blocker-${blocker.code}`}>
                      <div className="tf-del-blocker-info">
                        <span className="tf-del-blocker-badge">Blocked</span>
                        <p className="tf-del-blocker-msg">{blocker.message}</p>
                      </div>
                      <div className="tf-del-blocker-actions">
                        {blocker.code === 'PROJECT_HAS_HISTORY' && (
                          <button
                            type="button"
                            className="tf-del-action-btn"
                            onClick={() => {
                              onClose();
                              if (typeof onCloseProject === 'function') onCloseProject();
                            }}
                          >
                            Close project instead
                          </button>
                        )}
                        {blocker.code === 'TASKS_IN_REVIEW' && (
                          <button
                            type="button"
                            className="tf-del-action-btn"
                            onClick={() => {
                              onClose();
                              if (typeof onReviewTasks === 'function') onReviewTasks();
                            }}
                          >
                            Review tasks
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Allowed Deletion View */
              <div className="tf-del-allowed-container">
                {/* Impact Summary */}
                <div className="tf-del-impact-card" data-testid="delete-impact-summary">
                  <h4 style={{ margin: '0 0 8px', fontSize: '0.95rem', color: '#1e293b' }}>
                    Impact Summary
                  </h4>
                  {checkResult.impact?.activeCollaborators === 0 &&
                  !checkResult.impact?.mentorAssigned &&
                  checkResult.impact?.pendingRequests === 0 &&
                  checkResult.impact?.pendingInvites === 0 &&
                  checkResult.impact?.openTasks === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569' }}>
                      No active collaborators or mentor sessions will be affected. The project will be deleted immediately.
                    </p>
                  ) : (
                    <ul className="tf-del-impact-list">
                      {checkResult.impact?.activeCollaborators > 0 && (
                        <li>
                          <strong>{checkResult.impact.activeCollaborators}</strong> active collaborator(s) will lose access.
                        </li>
                      )}
                      {checkResult.impact?.openTasks > 0 && (
                        <li>
                          <strong>{checkResult.impact.openTasks}</strong> open task(s) will be released.
                        </li>
                      )}
                      {checkResult.impact?.pendingRequests > 0 && (
                        <li>
                          <strong>{checkResult.impact.pendingRequests}</strong> pending join request(s) will be closed.
                        </li>
                      )}
                      {checkResult.impact?.pendingInvites > 0 && (
                        <li>
                          <strong>{checkResult.impact.pendingInvites}</strong> pending invitation(s) will be cancelled.
                        </li>
                      )}
                      {checkResult.impact?.pendingSessionsToRefund > 0 && (
                        <li>
                          <strong>{checkResult.impact.pendingSessionsToRefund}</strong> pending mentor booking(s) will be cancelled & refunded.
                        </li>
                      )}
                    </ul>
                  )}
                </div>

                {/* Scheduled Notice Explanation */}
                {checkResult.mode === 'scheduled' && !isAdmin && (
                  <div className="tf-del-alert tf-del-alert-info" data-testid="scheduled-deletion-notice">
                    <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>⏳</span>
                    <div>
                      <strong>48-Hour Notice Period Required</strong>
                      <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: '#1e3a8a' }}>
                        Because collaborators or a mentor are active on this project, deletion cannot happen immediately.
                        A 48-hour notice period will start. During this time, the project will be locked to read-only,
                        members will be notified, and you can cancel the deletion at any time before the deadline.
                      </p>
                    </div>
                  </div>
                )}

                {/* Admin Mode Selector */}
                {isAdmin && (
                  <div className="tf-del-admin-mode-selector">
                    <label className="tf-del-section-label">Admin Deletion Mode</label>
                    <div className="tf-del-radio-group">
                      <label className="tf-del-radio-label">
                        <input
                          type="radio"
                          name="adminMode"
                          value="scheduled"
                          checked={adminMode === 'scheduled'}
                          onChange={() => setAdminMode('scheduled')}
                        />
                        Schedule deletion (48h notice period)
                      </label>
                      <label className="tf-del-radio-label">
                        <input
                          type="radio"
                          name="adminMode"
                          value="immediate"
                          checked={adminMode === 'immediate'}
                          onChange={() => setAdminMode('immediate')}
                        />
                        Delete immediately (Admin override)
                      </label>
                    </div>
                  </div>
                )}

                {/* Reason Selection */}
                {requiresReason && (
                  <div className="tf-del-reasons-section">
                    <label className="tf-del-section-label">
                      Reason for deletion <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <div className="tf-del-chips-grid">
                      {DELETE_REASONS.map((r) => {
                        const isSelected = selectedReasons.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            className={`tf-del-reason-chip ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleReason(r.id)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              tabIndex={-1}
                              style={{ marginRight: '6px' }}
                            />
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Explanation Field */}
                {(requiresReason || isOtherSelected || isAdmin) && (
                  <div className="tf-del-explanation-section">
                    <label className="tf-del-section-label">
                      Explanation{' '}
                      {isAdmin || isOtherSelected ? (
                        <span style={{ color: '#dc2626' }}>* (10–500 chars)</span>
                      ) : (
                        <span style={{ color: '#64748b', fontWeight: 'normal' }}>(Optional)</span>
                      )}
                    </label>
                    <textarea
                      data-testid="delete-project-explanation-input"
                      className="tf-del-textarea"
                      rows={3}
                      placeholder={
                        isAdmin
                          ? 'Explain the administrative rationale for deleting this project (10 to 500 characters)...'
                          : 'Provide additional details for the deletion notice...'
                      }
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                    />
                    <div className="tf-del-char-count">
                      {explanation.trim().length} / 500 characters
                      {(isAdmin || isOtherSelected) && explanation.trim().length < 10 && (
                        <span style={{ color: '#dc2626', marginLeft: '8px' }}>
                          (Minimum 10 characters required)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Title Confirmation Input */}
                <div className="tf-del-confirm-title-section">
                  <label className="tf-del-section-label" htmlFor="delete-confirm-title-input">
                    To confirm, please type the exact project title:{' '}
                    <strong style={{ color: '#0f172a' }}>{projectTitle}</strong>
                  </label>
                  <input
                    id="delete-confirm-title-input"
                    data-testid="delete-project-confirm-title-input"
                    type="text"
                    className="tf-del-input"
                    placeholder="Type project title to confirm"
                    value={confirmTitle}
                    onChange={(e) => setConfirmTitle(e.target.value)}
                    autoComplete="off"
                  />
                  {confirmTitle && !isTitleMatch && (
                    <span className="tf-del-input-hint tf-del-input-error">
                      Title does not match. Please match exact characters and casing.
                    </span>
                  )}
                  {isTitleMatch && (
                    <span className="tf-del-input-hint tf-del-input-success">
                      ✓ Title matches
                    </span>
                  )}
                </div>

                {submitError && (
                  <div
                    className="tf-del-alert tf-del-alert-error"
                    role="alert"
                    data-testid="delete-project-submit-error"
                  >
                    {submitError}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

const DeleteProjectDialog = DeleteProjectDialogContent;
export default DeleteProjectDialog;
