import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import usersApi from '../../services/usersApi';
import projectsApi from '../../services/projectsApi';
import mentorRequestsApi from '../../services/mentorRequestsApi';
import './mentorsDirectory.css';

/* ── Extracted SVG Sub-components ── */
const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const MentorsDirectory = () => {
  const { user } = useContext(AuthContext);

  const [mentors, setMentors] = useState([]);
  const [ownedProjects, setOwnedProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Request Mentorship modal state
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [requestMsg, setRequestMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    fetchDirectoryData();
  }, [user]);

  const fetchDirectoryData = async () => {
    setLoading(true);
    try {
      const [allUsers, allProjects] = await Promise.all([
        usersApi.list().catch(() => []),
        projectsApi.list().catch(() => []),
      ]);

      const mentorUsers = (Array.isArray(allUsers) ? allUsers : []).filter(
        (u) => u.role === 'Mentor' || u.role === 'mentor'
      );

      // If no mentor users returned from DB yet, provide seed defaults
      const finalMentors = mentorUsers.length > 0 ? mentorUsers : [
        {
          id: 'm-1',
          name: 'Rohan Mehta',
          profile: { bio: 'UI/UX Lead & Full Stack Architect', xp: 1200, rep: 94 },
          skills: ['UI/UX', 'Figma', 'React', 'Design Systems'],
        },
        {
          id: 'm-2',
          name: 'Sneha Iyer',
          profile: { bio: 'DevOps & Cloud Engineer', xp: 950, rep: 89 },
          skills: ['DevOps', 'AWS', 'Docker', 'Kubernetes'],
        },
        {
          id: 'm-3',
          name: 'Neha Gupta',
          profile: { bio: 'Data Scientist & ML Researcher', xp: 1400, rep: 96 },
          skills: ['Python', 'TensorFlow', 'Data Science', 'PyTorch'],
        },
      ];

      setMentors(finalMentors);

      const owned = (Array.isArray(allProjects) ? allProjects : []).filter(
        (p) => p.ownerId === user?.id || p.owner === user?.name
      );
      setOwnedProjects(owned);
      if (owned.length > 0) setSelectedProjectId(owned[0].id);
    } catch (err) {
      console.error('Failed to load mentors directory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRequest = (mentor) => {
    setSelectedMentor(mentor);
    setFeedback(null);
    setRequestMsg('');
  };

  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setFeedback({ type: 'error', message: 'Please select one of your projects.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      await mentorRequestsApi.create({
        mentorId: selectedMentor.id,
        projectId: selectedProjectId,
        projectOwnerId: user?.id,
        message: requestMsg || 'I would like guidance on my project architecture and deliverables.',
        status: 'Pending',
      });

      setFeedback({ type: 'success', message: `Mentorship request sent to ${selectedMentor.name}!` });
      setTimeout(() => {
        setSelectedMentor(null);
        setFeedback(null);
      }, 1400);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to send mentorship request.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="page-mentors" className="tf-mentors-container">
      <div className="tf-mentors-header">
        <h1 className="tf-mentors-title">Mentors</h1>
        <p className="tf-mentors-subtitle">Connect with experienced mentors for your projects.</p>
      </div>

      {loading ? (
        <p>Loading mentors directory...</p>
      ) : (
        <div id="mentors-grid" className="tf-mentors-grid">
          {mentors.map((m) => {
            const initials = (m.name || 'M')
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            const xp = m.profile?.xp || 800;
            const rep = m.profile?.rep || 85;
            const skills = m.skills || ['Mentorship', 'Software Architecture'];

            return (
              <div key={m.id} className="tf-mentors-card">
                <div>
                  <div className="tf-mentors-card-top">
                    <div className="tf-mentors-avatar">{initials}</div>
                    <div className="tf-mentors-info">
                      <h3>{m.name}</h3>
                      <p>{m.profile?.bio || 'Verified Mentor'}</p>
                    </div>
                  </div>

                  <div className="tf-mentors-skills-wrap">
                    {skills.map((s, idx) => (
                      <span key={idx} className="tf-mentors-skill-tag">
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="tf-mentors-stats-row">
                    <span>⚡ {xp} XP</span>
                    <span><StarIcon /> {rep} Rep</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="tf-mentors-btn-primary"
                  onClick={() => handleOpenRequest(m)}
                >
                  Request Mentorship
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Request Mentorship Modal */}
      {selectedMentor && (
        <div
          className="tf-mentors-modal-overlay"
          onClick={() => setSelectedMentor(null)}
        >
          <div
            className="tf-mentors-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-mentors-modal-header">
              <h2 className="tf-mentors-modal-title">
                Request Mentorship: {selectedMentor.name}
              </h2>
              <button
                type="button"
                className="tf-collab-ws-btn-outline"
                onClick={() => setSelectedMentor(null)}
              >
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleSendRequest}>
              <div className="tf-mentors-form-group">
                <label className="tf-mentors-form-label">Select Your Project</label>
                {ownedProjects.length > 0 ? (
                  <select
                    className="tf-mentors-input"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                  >
                    {ownedProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title || p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="tf-myproj-card-meta">
                    You have not created any projects yet. Please create a project first!
                  </p>
                )}
              </div>

              <div className="tf-mentors-form-group">
                <label className="tf-mentors-form-label">Message / Goals</label>
                <textarea
                  className="tf-mentors-input"
                  rows={3}
                  placeholder="Explain what guidance you are seeking from this mentor..."
                  value={requestMsg}
                  onChange={(e) => setRequestMsg(e.target.value)}
                />
              </div>

              {feedback && (
                <p className="tf-myproj-card-meta" style={{ color: feedback.type === 'success' ? 'green' : 'red' }}>
                  {feedback.message}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="tf-myproj-btn-primary"
                  style={{ background: '#9ca3af' }}
                  onClick={() => setSelectedMentor(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tf-mentors-btn-primary"
                  style={{ width: 'auto' }}
                  disabled={submitting || ownedProjects.length === 0}
                >
                  {submitting ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorsDirectory;
