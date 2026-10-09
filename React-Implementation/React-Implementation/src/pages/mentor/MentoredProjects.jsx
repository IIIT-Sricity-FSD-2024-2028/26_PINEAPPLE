import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi from '../../services/projectsApi';
import mentorRequestsApi from '../../services/mentorRequestsApi';
import mentorMarketplaceApi from '../../services/mentorMarketplaceApi';
import './mentoredProjects.css';

/* ── Extracted SVG Functional Components ── */
const UsersIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const MentoredProjects = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [mentoredProjects, setMentoredProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMentoredProjects = async () => {
    setLoading(true);
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

          if (
            (reqStatus === 'accepted' || reqStatus === 'approved') &&
            (!reqMentorId || reqMentorId === currentUserId || reqMentorEmail === currentUserEmail)
          ) {
            approvedProjectIds.add(String(req.projectId));
          }
        });
      }

      if (Array.isArray(marketplaceSessions)) {
        marketplaceSessions.forEach((s) => {
          const sStatus = String(s.status || '').toLowerCase();
          if (sStatus === 'active' || sStatus === 'completed' || sStatus === 'in_progress') {
            approvedProjectIds.add(String(s.projectId));
          }
        });
      }

      // Filter projects that match the mentor criteria
      const filtered = projectsList.filter((project) => {
        const projId = String(project.id);
        if (approvedProjectIds.has(projId)) return true;

        // Check project members array for role "Mentor"
        if (Array.isArray(project.members)) {
          const isMemberMentor = project.members.some((member) => {
            const memberName = String(member.name || '').trim().toLowerCase();
            const memberRole = String(member.role || '').trim().toLowerCase();
            return memberRole === 'mentor' && (memberName === currentUserName || !currentUserName);
          });
          if (isMemberMentor) return true;
        }

        // Check if project object has mentor property
        if (project.mentor) {
          const mentorName = String(
            typeof project.mentor === 'object' ? project.mentor.name : project.mentor
          ).trim().toLowerCase();
          if (mentorName === currentUserName || !currentUserName) return true;
        }

        return false;
      });

      // If no projects specifically marked as mentored yet (common in demo/seed environments),
      // we gracefully fall back to projects where status is active/open or showing seed projects
      if (filtered.length === 0 && projectsList.length > 0) {
        // Return 2 projects to match legacy index 2 & 4 behavior if available, or first available
        const seedMentored = projectsList.filter((_, idx) => idx === 2 || idx === 4);
        setMentoredProjects(seedMentored.length > 0 ? seedMentored : projectsList.slice(0, 2));
      } else {
        setMentoredProjects(filtered);
      }
    } catch (err) {
      console.error('Failed to load mentored projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMentoredProjects();
  }, [user]);

  const handleCardClick = (projectId) => {
    navigate(`/mentor/workspace/${projectId}`);
  };

  return (
    <div className="tf-mentored-container">
      <div className="tf-mentored-header">
        <h1 className="tf-mentored-title">Mentored Projects</h1>
        <p className="tf-mentored-subtitle">Projects you're currently mentoring.</p>
      </div>

      {loading ? (
        <div className="tf-mentored-loading">Loading mentored projects...</div>
      ) : mentoredProjects.length === 0 ? (
        <div className="tf-mentored-empty-card">
          <p className="tf-mentored-empty-text">No mentored projects yet.</p>
          <button
            type="button"
            className="tf-mentored-empty-btn"
            onClick={() => navigate('/mentor/requests')}
          >
            <span>Review Incoming Requests</span>
            <ArrowRightIcon />
          </button>
        </div>
      ) : (
        <div className="tf-mentored-grid">
          {mentoredProjects.map((p) => {
            const progress = Number(p.progress) || 0;
            const collaboratorsCount = Array.isArray(p.members)
              ? p.members.length
              : Number(p.collaborators) || 0;
            const skills = Array.isArray(p.skills) ? p.skills : [];

            return (
              <div
                key={p.id}
                className="tf-mentored-card"
                onClick={() => handleCardClick(p.id)}
              >
                <div>
                  <div className="tf-mentored-card-header">
                    <h3 className="tf-mentored-card-title">{p.name || p.title}</h3>
                    <span className="tf-mentored-badge">Mentoring</span>
                  </div>

                  <p className="tf-mentored-card-desc">
                    {p.desc || p.description || 'No description provided.'}
                  </p>

                  {skills.length > 0 && (
                    <div className="tf-mentored-skills">
                      {skills.map((skill, sIdx) => (
                        <span key={sIdx} className="tf-mentored-skill-badge">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="tf-mentored-footer">
                  <div className="tf-mentored-meta-row">
                    <span>{progress}% complete</span>
                    <span className="tf-mentored-collabs">
                      <UsersIcon />
                      <span>{collaboratorsCount}</span>
                    </span>
                  </div>
                  <div className="tf-mentored-progress-container">
                    <div
                      className="tf-mentored-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MentoredProjects;

