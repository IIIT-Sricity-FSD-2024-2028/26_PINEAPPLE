import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/selectors/sessionSelectors';
import { isProjectLocked } from '../../utils/projectStatus';
import { fetchMentoredProjects } from '../../store/thunks/mentorSessionsThunks';
import { setMentoredFilter } from '../../store/slices/mentorSessionsSlice';
import {
  selectFilteredMentoredProjects,
  selectMentoredFilter,
  selectMentoredProjectsCounts,
  selectMentoredProjectsStatus,
} from '../../store/selectors/mentorSessionsSelectors';
import {
  confirmAbandonmentReview,
  fetchMyAbandonmentReviews,
} from '../../store/thunks/abandonmentReviewsThunks';
import {
  selectAbandonmentConfirmingIds,
  selectMyOpenAbandonmentReviews,
} from '../../store/selectors/abandonmentReviewsSelectors';
import EmptyState from '../../components/common/EmptyState';
import FilterTabs from '../../components/common/FilterTabs';
import ProjectCard from '../../components/features/ProjectCard';
import './mentoredProjects.css';

const MentoredProjectsContent = () => {
  const user = useSelector(selectCurrentUser);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const displayedProjects = useSelector(selectFilteredMentoredProjects);
  const counts = useSelector(selectMentoredProjectsCounts);
  const filter = useSelector(selectMentoredFilter);
  const status = useSelector(selectMentoredProjectsStatus);
  const openAbandonmentReviews = useSelector(selectMyOpenAbandonmentReviews);
  const confirmingIds = useSelector(selectAbandonmentConfirmingIds);
  const loading = status === 'idle' || status === 'loading';

  const loadMentoredProjects = useCallback(() => {
    dispatch(fetchMyAbandonmentReviews({ force: true }));
    dispatch(fetchMentoredProjects({ user, force: true }));
  }, [dispatch, user]);

  useEffect(() => {
    loadMentoredProjects();
  }, [loadMentoredProjects]);

  // Refetch on tab focus
  useEffect(() => {
    const handleFocus = () => {
      loadMentoredProjects();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadMentoredProjects]);

  const handleCardClick = (projectId) => {
    navigate(`/mentor/workspace/${projectId}`);
  };

  return (
    <div className="tf-mentored-container">
      <div className="tf-mentored-header">
        <h1 className="tf-mentored-title">Mentored Projects</h1>
        <p className="tf-mentored-subtitle">Projects you're currently mentoring.</p>
      </div>

      {openAbandonmentReviews.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }} data-testid="mentor-abandonment-alerts">
          {openAbandonmentReviews.map((rev) => (
            <div
              key={rev.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: '#fef3c7',
                border: '1px solid #f59e0b',
                color: '#92400e',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: '0.9rem' }}>
                ⚠️ <strong>Inactivity Check Open:</strong> Project{' '}
                <strong>{rev.projectTitle || rev.projectId}</strong> opened an abandonment review. Confirm within 48 hours or your mentorship slot will be released.
              </div>
              <button
                type="button"
                data-testid={`mentor-confirm-active-btn-${rev.id}`}
                disabled={Boolean(confirmingIds[rev.id])}
                onClick={() => dispatch(confirmAbandonmentReview(rev.id))}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {confirmingIds[rev.id] ? 'Confirming...' : 'Still active'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <FilterTabs
          tabs={[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'active', label: 'Active', count: counts.active },
            { id: 'completed', label: 'Completed', count: counts.completed }
          ]}
          activeTab={filter}
          onChange={(nextTab) => dispatch(setMentoredFilter(nextTab))}
        />
      </div>

      {loading ? (
        <div className="tf-mentored-loading">Loading mentored projects...</div>
      ) : displayedProjects.length === 0 ? (
        <EmptyState
          title={
            filter === 'completed'
              ? 'No Completed Mentored Projects'
              : filter === 'active'
              ? 'No Active Mentored Projects'
              : 'No Mentored Projects Yet'
          }
          message={
            filter === 'completed'
              ? 'Projects you have successfully guided to completion will be recorded here.'
              : 'Accept incoming bookings from project owners to start mentoring teams.'
          }
          actionLabel={filter !== 'completed' ? 'Review Incoming Requests' : undefined}
          onAction={() => navigate('/mentor/requests')}
        />
      ) : (
        <div className="tf-mentored-grid">
          {displayedProjects.map((p) => {
            const cardId = p.projectId || p.id;
            const progress = Number(p.progress) || 0;
            const isClosed = String(p.status || '').toLowerCase() === 'closed';
            const isCompleted = isClosed || p.isCompleted || String(p.status || '').toLowerCase() === 'completed' || isProjectLocked(p);
            const cardStatus = isClosed ? 'Closed' : (isCompleted ? 'Completed' : 'Mentoring');

            return (
              <ProjectCard
                key={cardId}
                project={{
                  ...p,
                  id: cardId,
                  dueDate: p.dueDate || p.projectDueDate,
                  status: cardStatus,
                  closureReason: p.closedReason || p.closureReason,
                  owner: p.ownerName || p.owner,
                }}
                variant="mentored"
                progress={progress}
                onSelect={() => handleCardClick(cardId)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const MentoredProjects = MentoredProjectsContent;
export default MentoredProjects;
