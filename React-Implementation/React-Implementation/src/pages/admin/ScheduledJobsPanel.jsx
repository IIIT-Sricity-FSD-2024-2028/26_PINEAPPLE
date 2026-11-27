import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchJobRuns,
  triggerJobTick,
} from '../../store/thunks/jobRunsThunks';
import {
  selectJobRun,
  setJobConfirmModalOpen,
} from '../../store/slices/jobRunsSlice';
import {
  selectAllJobRuns,
  selectJobRunsStatus,
  selectJobRunsWorking,
  selectSelectedJobRun,
} from '../../store/selectors/jobRunsSelectors';
import {
  canAccess,
  selectIsSessionConfigured,
  selectSession,
} from '../../store/selectors/sessionSelectors';
import { formatDateTime, formatDuration, getNextExpectedRun } from '../../utils/jobFormatter';
import Modal from '../../components/common/Modal';
import { useVisibilityPoll } from '../../hooks/useVisibilityPoll';
import './ScheduledJobsPanel.css';

const ScheduledJobsPanelContent = ({ isSuperUser = false }) => {
  const dispatch = useDispatch();

  const runs = useSelector(selectAllJobRuns);
  const runsStatus = useSelector(selectJobRunsStatus);
  const working = useSelector(selectJobRunsWorking);
  const selectedRun = useSelector(selectSelectedJobRun);
  const session = useSelector(selectSession);
  const isSessionConfigured = useSelector(selectIsSessionConfigured);

  const canTriggerTick = isSessionConfigured
    ? canAccess(session, 'jobs_tick')
    : Boolean(isSuperUser);
  const showRunNowButton = canTriggerTick || isSessionConfigured;

  const loading = runsStatus === 'idle' || (runsStatus === 'loading' && runs.length === 0);
  const showConfirmModal = Boolean(working.showConfirmModal);
  const isTriggering = Boolean(working.isTriggering);
  const errorMessage = working.errorMessage || '';
  const successMessage = working.successMessage || '';

  const fetchRuns = useCallback(() => {
    return dispatch(fetchJobRuns(50));
  }, [dispatch]);

  useVisibilityPoll(fetchRuns, 15000, {
    enabled: true,
    immediate: true,
    triggerOnVisible: true,
  });

  const handleTriggerTick = () => {
    if (!canTriggerTick) return;
    dispatch(triggerJobTick());
  };

  const isAnyRunInProgress = runs.some((r) => r.status === 'running') || isTriggering;
  const lastRun = runs.length > 0 ? runs[0] : null;

  return (
    <div id="scheduled-jobs-panel" className="scheduled-jobs-panel">
      <div className="jobs-header">
        <div className="jobs-title-group">
          <h2>
            <span>⏱️</span> Scheduled Jobs Monitor
          </h2>
          <div className="jobs-subtitle">
            Hourly automated policy engine: closes empty projects after 5 days, declines unanswered mentor bookings after 3 days, and applies missed deadline penalties.
          </div>
        </div>

        <div className="jobs-actions">
          {showRunNowButton && (
            <button
              id="run-now-btn"
              data-testid="run-now-btn"
              className="btn btn-primary"
              disabled={!canTriggerTick || isAnyRunInProgress}
              title={!canTriggerTick ? 'Super User permission required' : undefined}
              onClick={() => canTriggerTick && dispatch(setJobConfirmModalOpen(true))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                padding: '8px 18px',
                borderRadius: '10px',
              }}
            >
              <span>▶️</span> {isAnyRunInProgress ? 'Running...' : 'Run Now'}
            </button>
          )}

          <button
            className="btn btn-secondary"
            onClick={fetchRuns}
            style={{ padding: '8px 14px', borderRadius: '10px' }}
            title="Refresh runs list"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          data-testid="job-error-banner"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '0.9rem',
          }}
        >
          <strong>Notice:</strong> {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          data-testid="job-success-banner"
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10b981',
            color: '#059669',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '0.9rem',
          }}
        >
          {successMessage}
        </div>
      )}

      <div className="jobs-telemetry-grid">
        <div className="jobs-telemetry-card">
          <div className="telemetry-card-label">Last Execution</div>
          <div className="telemetry-card-value">
            {lastRun ? (
              <>
                <span className={`status-badge status-${lastRun.status}`}>
                  {lastRun.status}
                </span>
                <span style={{ fontSize: '0.85rem' }}>{formatDateTime(lastRun.startedAt)}</span>
              </>
            ) : (
              <span style={{ color: 'var(--muted-fg, #6b7280)' }}>Never</span>
            )}
          </div>
          <div className="telemetry-card-sub">
            {lastRun ? `Trigger: ${lastRun.trigger} (${formatDuration(lastRun.durationMs)})` : 'No runs executed yet'}
          </div>
        </div>

        <div className="jobs-telemetry-card">
          <div className="telemetry-card-label">Next Expected Run</div>
          <div className="telemetry-card-value">{getNextExpectedRun()}</div>
          <div className="telemetry-card-sub">Scheduled hourly cadence (@hourly cron)</div>
        </div>

        <div className="jobs-telemetry-card">
          <div className="telemetry-card-label">Recorded History</div>
          <div className="telemetry-card-value">{runs.length} Runs</div>
          <div className="telemetry-card-sub">In-memory rolling buffer (last 200 kept)</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--muted-fg, #6b7280)' }}>
          Loading scheduled jobs history...
        </div>
      ) : runs.length === 0 ? (
        <div className="jobs-empty-state" data-testid="empty-state">
          <div className="jobs-empty-icon">⏱️</div>
          <div className="jobs-empty-title">No scheduled jobs have run yet</div>
          <div className="jobs-empty-desc">
            The background scheduler executes time-dependent policies every hour. Super Users can also trigger an immediate execution using the &quot;Run Now&quot; action.
          </div>
        </div>
      ) : (
        <div className="jobs-table-container">
          <table className="jobs-table" data-testid="runs-table">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Trigger</th>
                <th>Started At</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Jobs Executed</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} data-testid={`run-row-${run.id}`}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{run.id}</td>
                  <td>
                    <span className={`trigger-badge trigger-${run.trigger}`}>
                      {run.trigger}
                    </span>
                  </td>
                  <td>{formatDateTime(run.startedAt)}</td>
                  <td>{formatDuration(run.durationMs)}</td>
                  <td>
                    <span className={`status-badge status-${run.status}`}>
                      {run.status}
                    </span>
                  </td>
                  <td>{run.jobs ? `${run.jobs.length} jobs` : '0 jobs'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      data-testid={`view-run-${run.id}`}
                      style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
                      onClick={() => dispatch(selectJobRun(run.id))}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Run Detail Drawer / Modal */}
      <Modal
        isOpen={Boolean(selectedRun)}
        title={selectedRun ? `Run Details: ${selectedRun.id}` : 'Run Details'}
        onClose={() => dispatch(selectJobRun(null))}
        size="lg"
        testId="run-detail-drawer"
      >
        {selectedRun && (
          <div>
            <div className="drawer-body">
              <div className="drawer-meta-grid">
                <div className="drawer-meta-item">
                  <label>Status</label>
                  <span>
                    <span className={`status-badge status-${selectedRun.status}`}>
                      {selectedRun.status}
                    </span>
                  </span>
                </div>
                <div className="drawer-meta-item">
                  <label>Trigger</label>
                  <span>
                    <span className={`trigger-badge trigger-${selectedRun.trigger}`}>
                      {selectedRun.trigger}
                    </span>
                  </span>
                </div>
                <div className="drawer-meta-item">
                  <label>Started At</label>
                  <span>{formatDateTime(selectedRun.startedAt)}</span>
                </div>
                <div className="drawer-meta-item">
                  <label>Finished At</label>
                  <span>{formatDateTime(selectedRun.finishedAt)}</span>
                </div>
                <div className="drawer-meta-item">
                  <label>Duration</label>
                  <span>{formatDuration(selectedRun.durationMs)}</span>
                </div>
                <div className="drawer-meta-item">
                  <label>Total Jobs</label>
                  <span>{selectedRun.jobs?.length || 0}</span>
                </div>
              </div>

              <div className="jobs-breakdown-title">Job Execution Breakdown</div>

              {selectedRun.jobs && selectedRun.jobs.length > 0 ? (
                selectedRun.jobs.map((job, idx) => {
                  const hasErrors = job.errors && job.errors.length > 0;
                  return (
                    <div className="job-item-card" key={idx}>
                      <div className="job-item-header">
                        <span className="job-item-name">{job.name}</span>
                        <span
                          className="job-item-badge"
                          style={{
                            background: hasErrors ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: hasErrors ? '#dc2626' : '#059669',
                          }}
                        >
                          {job.itemsProcessed} processed
                        </span>
                      </div>

                      {job.counts && Object.keys(job.counts).length > 0 && (
                        <div
                          data-testid={`job-counts-${job.name}`}
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px',
                            marginTop: '6px',
                            marginBottom: '6px',
                            fontSize: '0.78rem',
                            color: '#475569',
                          }}
                        >
                          {job.counts.dryRun ? (
                            <span
                              data-testid={`job-dryrun-badge-${job.name}`}
                              style={{
                                background: '#fef3c7',
                                color: '#92400e',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                fontWeight: 600,
                              }}
                            >
                              Dry-run (no deletions)
                            </span>
                          ) : null}
                          {Object.entries(job.counts)
                            .filter(([key]) => key !== 'dryRun')
                            .map(([key, val]) => {
                              const labelMap = {
                                orphanUploadsRemoved: 'Orphan uploads removed',
                                expiredExportsRemoved: 'Expired exports removed',
                                orphanExportsRemoved: 'Orphan exports removed',
                                deletedAccountCvsRemoved: 'Deleted-account CVs removed',
                                projectTombstonesRemoved: 'Project tombstones purged',
                                keptReferencedUploads: 'Referenced uploads kept',
                                keptRecentUploads: 'Recent uploads (<24h) kept',
                                keptProjectsNeededByEscrow: 'Escrow-linked projects kept',
                              };
                              return (
                                <span
                                  key={key}
                                  style={{
                                    background: '#f1f5f9',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                  }}
                                >
                                  {labelMap[key] || key}: <strong>{val}</strong>
                                </span>
                              );
                            })}
                        </div>
                      )}

                      {hasErrors ? (
                        <div className="job-item-errors">
                          <strong>Errors encountered:</strong>
                          {job.errors.map((err, errIdx) => (
                            <div key={errIdx} className="job-error-entry">
                              • {typeof err === 'string' ? err : JSON.stringify(err)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: '#059669' }}>
                          ✓ Completed successfully with 0 errors
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ color: 'var(--muted-fg, #6b7280)', fontSize: '0.875rem' }}>
                  No per-job records captured for this run.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Manual Execution Modal */}
      <Modal
        isOpen={showConfirmModal}
        title="Confirm Manual Execution"
        onClose={() => {
          if (!isTriggering) dispatch(setJobConfirmModalOpen(false));
        }}
        closeDisabled={isTriggering}
        size="sm"
        testId="confirm-tick-modal"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dispatch(setJobConfirmModalOpen(false))}
              disabled={isTriggering}
              style={{ padding: '8px 16px', borderRadius: '8px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              id="confirm-run-btn"
              data-testid="confirm-run-btn"
              className="btn btn-primary"
              onClick={handleTriggerTick}
              disabled={isTriggering}
              style={{ padding: '8px 18px', borderRadius: '8px', fontWeight: 600 }}
            >
              Confirm &amp; Run
            </button>
          </div>
        }
      >
        <p style={{ color: 'var(--muted-fg, #6b7280)', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
          Are you sure you want to trigger the hourly scheduled jobs now? This will immediately execute all time-based policies (5-day project auto-closure, 3-day mentor booking timeouts, and task deadline penalties).
        </p>
      </Modal>
    </div>
  );
};

const ScheduledJobsPanel = ScheduledJobsPanelContent;
export default ScheduledJobsPanel;
