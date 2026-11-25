import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi, { isProjectLocked, isProjectActive } from '../../services/projectsApi';
import mentorRequestsApi from '../../services/mentorRequestsApi';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import EmptyState from '../../components/common/EmptyState';
import FilterTabs from '../../components/common/FilterTabs';
import ProjectCard from '../../components/features/ProjectCard';
import './mentoredProjects.css';

const MentoredProjects = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [mentoredProjects, setMentoredProjects] = useState([]);
  const [counts, setCounts] = useState({ all: 0, active: 0, completed: 0 });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [openAbandonmentReviews, setOpenAbandonmentReviews] = useState([]);
  const [confirmingReviewId, setConfirmingReviewId] = useState(null);

  const loadMentoredProjects = useCallback(async () => {
    try {
      // 1. Fetch abandonment review alerts if available
      if (typeof mentorMarketplaceApi.getMyAbandonmentReviews === 'function') {
        try {
          const myReviews = await mentorMarketplaceApi.getMyAbandonmentReviews();
          setOpenAbandonmentReviews(Array.isArray(myReviews) ? myReviews : []);
        } catch {
          // Ignore alert fetch failure
        }
      }

      // 2. Canonical single backend endpoint for mentored projects
      let backendRes;
      if (typeof mentorMarketplaceApi.getMentoredProjects === 'function') {
        try {
          backendRes = await mentorMarketplaceApi.getMentoredProjects();
        } catch {
          // If network error or endpoint unavailable, fall back
        }
      }

      if (backendRes && Array.isArray(backendRes.items)) {
        const items = backendRes.items;
        const resCounts = backendRes.counts || {
          all: items.length,
          active: items.filter((p) => p.tab === 'active').length,
          completed: items.filter((p) => p.tab === 'completed').length,
        };
        setMentoredProjects(items);
        setCounts(resCounts);
        return;
      }

      // 3. Fallback for environments / legacy tests with partial mock sets
      const currentUserName = (user?.name || user?.username || '').trim().toLowerCase();
      const currentUserId = String(user?.id || '').trim();
      const currentUserEmail = String(user?.email || '').trim().toLowerCase();

      const [allProjects, mentorReqs, marketplaceSessions] = await Promise.all([
        typeof projectsApi.list === 'function' ? projectsApi.list().catch(() => []) : [],
        typeof mentorRequestsApi.list === 'function' ? mentorRequestsApi.list().catch(() => []) : [],
        typeof mentorMarketplaceApi.mentorSessions === 'function'
          ? mentorMarketplaceApi.mentorSessions().catch(() => [])
          : [],
      ]);

      const projectsList = Array.isArray(allProjects) ? allProjects : [];
      const approvedProjectIds = new Set();

      if (Array.isArray(mentorReqs)) {
        mentorReqs.forEach((req) => {
          const reqStatus = String(req.status || '').toLowerCase();
          const reqMentorId = String(req.mentorId || '').trim();
          const reqMentorEmail = String(req.mentorEmail || '').trim().toLowerCase();
          const reqMentorName = String(req.mentorName || '').trim().toLowerCase();

          const isMyMentorReq =
            (currentUserId && reqMentorId === currentUserId) ||
            (currentUserEmail && reqMentorEmail === currentUserEmail) ||
            (currentUserName && reqMentorName === currentUserName);

          if ((reqStatus === 'accepted' || reqStatus === 'approved') && isMyMentorReq && req.projectId) {
            approvedProjectIds.add(String(req.projectId));
          }
        });
      }

      if (Array.isArray(marketplaceSessions)) {
        marketplaceSessions.forEach((s) => {
          const sStatus = String(s.status || '').toLowerCase();
          const sessionMentorId = String(s.mentorId || '').trim();
          const sessionMentorEmail = String(s.mentorEmail || '').trim().toLowerCase();

          const isMySession =
            (currentUserId && sessionMentorId === currentUserId) ||
            (currentUserEmail && sessionMentorEmail === currentUserEmail);

          if (
            (sStatus === 'active' || sStatus === 'completed' || sStatus === 'in_progress' || sStatus === 'accepted') &&
            isMySession &&
            s.projectId
          ) {
            approvedProjectIds.add(String(s.projectId));
          }
        });
      }

      const filtered = projectsList.filter((project) => {
        const projId = String(project.id);
        if (approvedProjectIds.has(projId)) return true;

        if (Array.isArray(project.members)) {
          const isMemberMentor = project.members.some((member) => {
            const memberRole = String(member.role || '').trim().toLowerCase();
            if (memberRole !== 'mentor') return false;

            const memberId = String(member.userId || member.id || '').trim();
            const memberEmail = String(member.email || '').trim().toLowerCase();
            const memberName = String(member.name || '').trim().toLowerCase();

            return (
              (currentUserId && memberId === currentUserId) ||
              (currentUserEmail && memberEmail === currentUserEmail) ||
              (currentUserName && memberName === currentUserName)
            );
          });
          if (isMemberMentor) return true;
        }

        if (project.mentor) {
          const mentorObj = typeof project.mentor === 'object' ? project.mentor : null;
          const mentorName = String(mentorObj?.name || project.mentor).trim().toLowerCase();
          const mentorId = String(mentorObj?.userId || mentorObj?.id || '').trim();
          const mentorEmail = String(mentorObj?.email || '').trim().toLowerCase();

          const matchesMentor =
            (currentUserId && mentorId === currentUserId) ||
            (currentUserEmail && mentorEmail === currentUserEmail) ||
            (currentUserName && mentorName === currentUserName);

          if (matchesMentor) return true;
        }

        return false;
      });

      const activeCount = filtered.filter(isProjectActive).length;
      const completedCount = filtered.filter(isProjectLocked).length;

      setMentoredProjects(filtered);
      setCounts({
        all: filtered.length,
        active: activeCount,
        completed: completedCount,
      });
    } catch (err) {
      console.error('Failed to load mentored projects:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?.id, user?.name, user?.username]);

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

  let displayedProjects = mentoredProjects;
  if (filter === 'active') {
    displayedProjects = mentoredProjects.filter(
      (p) => p.tab === 'active' || (p.tab !== 'completed' && isProjectActive(p))
    );
  } else if (filter === 'completed') {
    displayedProjects = mentoredProjects.filter(
      (p) => p.tab === 'completed' || isProjectLocked(p)
    );
  }

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
                disabled={confirmingReviewId === rev.id}
                onClick={async () => {
                  setConfirmingReviewId(rev.id);
                  try {
                    await mentorMarketplaceApi.confirmAbandonmentReview(rev.id);
                    setOpenAbandonmentReviews((prev) => prev.filter((item) => item.id !== rev.id));
                  } catch {
                    // Preserve banner if network confirmation fails
                  } finally {
                    setConfirmingReviewId(null);
                  }
                }}
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
                {confirmingReviewId === rev.id ? 'Confirming...' : 'Still active'}
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
          onChange={setFilter}
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

export default MentoredProjects;
