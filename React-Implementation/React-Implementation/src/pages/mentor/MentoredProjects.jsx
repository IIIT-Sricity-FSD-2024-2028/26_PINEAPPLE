import { useState, useEffect, useContext } from 'react';
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
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadMentoredProjects = async () => {
      try {
        const currentUserName = (user?.name || user?.username || '').trim().toLowerCase();
        const currentUserId = String(user?.id || '').trim();
        const currentUserEmail = String(user?.email || '').trim().toLowerCase();

        const [allProjects, mentorReqs, marketplaceSessions] = await Promise.all([
          projectsApi.list().catch(() => []),
          mentorRequestsApi.list().catch(() => []),
          mentorMarketplaceApi.mentorSessions().catch(() => []),
        ]);

        const projectsList = Array.isArray(allProjects) ? allProjects : [];

        // Set of project IDs approved via direct requests or sessions
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

        // Filter projects that match the mentor criteria strictly for this user
        const filtered = projectsList.filter((project) => {
          const projId = String(project.id);
          if (approvedProjectIds.has(projId)) return true;

          // Check project members array for role "Mentor" assigned to current user
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

          // Check if project object has mentor property assigned to current user
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

        // Mentored Projects must be empty until the person accepts a booking / is assigned
        if (isMounted) {
          setMentoredProjects(filtered);
        }
      } catch (err) {
        console.error('Failed to load mentored projects:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadMentoredProjects();

    return () => {
      isMounted = false;
    };
  }, [user?.email, user?.id, user?.name, user?.username]);

  const isCompletedProject = (p) => isProjectLocked(p);
  const activeProjects = mentoredProjects.filter(isProjectActive);
  const completedProjects = mentoredProjects
    .filter(isCompletedProject)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

  let displayedProjects = mentoredProjects;
  if (filter === 'active') {
    displayedProjects = activeProjects;
  } else if (filter === 'completed') {
    displayedProjects = completedProjects;
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

      <div style={{ marginBottom: '24px' }}>
        <FilterTabs
          tabs={[
            { id: 'all', label: 'All', count: mentoredProjects.length },
            { id: 'active', label: 'Active', count: activeProjects.length },
            { id: 'completed', label: 'Completed', count: completedProjects.length }
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
            const progress = Number(p.progress) || 0;
            const isCompleted = isCompletedProject(p);
            return (
              <ProjectCard
                key={p.id}
                project={{
                  ...p,
                  status: isCompleted ? 'Completed' : 'Mentoring',
                }}
                variant="mentored"
                progress={progress}
                onSelect={() => handleCardClick(p.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MentoredProjects;

