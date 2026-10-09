import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi from '../../services/projectsApi';
import joinRequestsApi from '../../services/joinRequestsApi';
import './projectsMarketplace.css';

/* ── Extracted SVG Sub-components ── */
const UsersIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ProjectsMarketplace = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewProject, setPreviewProject] = useState(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [submittingApply, setSubmittingApply] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);
  const [myApplications, setMyApplications] = useState([]);

  useEffect(() => {
    fetchMarketplaceData();
  }, []);

  const fetchMarketplaceData = async () => {
    setLoading(true);
    try {
      const [fetchedProjects, fetchedRequests] = await Promise.all([
        projectsApi.list().catch(() => []),
        joinRequestsApi.list({ userId: user?.id }).catch(() => []),
      ]);
      setProjects(Array.isArray(fetchedProjects) ? fetchedProjects : []);
      setMyApplications(Array.isArray(fetchedRequests) ? fetchedRequests : []);
    } catch (err) {
      console.error('Failed to load marketplace projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentUserName = user?.name || user?.username || 'Collaborator';
  const currentUserId = user?.id || (typeof localStorage !== 'undefined' && localStorage.getItem('teamforge.backendUserId')) || '1';

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = projects.filter((p) => {
    if (!normalizedQuery) return true;
    const titleMatch = (p.title || p.name || '').toLowerCase().includes(normalizedQuery);
    const descMatch = (p.description || p.desc || '').toLowerCase().includes(normalizedQuery);
    const skillsMatch = Array.isArray(p.skills || p.requiredSkills)
      ? (p.skills || p.requiredSkills).some((s) => s.toLowerCase().includes(normalizedQuery))
      : false;
    const ownerMatch = (p.owner || p.ownerId || '').toLowerCase().includes(normalizedQuery);
    return titleMatch || descMatch || skillsMatch || ownerMatch;
  });

  const recommendedProjects = filteredProjects.slice(0, 2);
  const allProjects = searchQuery ? filteredProjects : filteredProjects.slice(2);

  const handleCardClick = (project) => {
    const isOwner = project.owner === currentUserName || project.ownerId === currentUserId;
    if (isOwner) {
      navigate(`/workspace/${project.id}`);
      return;
    }
    setPreviewProject(project);
    setStatusFeedback(null);
  };

  const handleApply = async () => {
    if (!previewProject) return;
    setSubmittingApply(true);
    setStatusFeedback(null);
    try {
      await joinRequestsApi.create({
        projectId: previewProject.id,
        userId: currentUserId,
        userName: currentUserName,
        role: 'Collaborator',
        message: applyMessage || 'I would love to contribute to this project!',
        status: 'Pending',
      });
      setStatusFeedback({ type: 'success', message: 'Application submitted successfully!' });
      fetchMarketplaceData();
      setTimeout(() => {
        setPreviewProject(null);
        setApplyMessage('');
        setStatusFeedback(null);
      }, 1500);
    } catch (err) {
      setStatusFeedback({ type: 'error', message: err.message || 'Failed to submit application.' });
    } finally {
      setSubmittingApply(false);
    }
  };

  const renderProjectCard = (project) => {
    const isOwned = project.owner === currentUserName || project.ownerId === currentUserId;
    const skills = project.skills || project.requiredSkills || [];
    const progress = Number(project.progress) || 0;
    const collaboratorsCount = Array.isArray(project.collaborators)
      ? project.collaborators.length
      : Number(project.collaborators) || 0;

    return (
      <div
        key={project.id}
        className="tf-market-card"
        onClick={() => handleCardClick(project)}
      >
        <div>
          <h3 className="tf-market-card-title">{project.title || project.name}</h3>
          <p className="tf-market-card-desc">{project.description || project.desc}</p>
          {isOwned && <div className="tf-market-owner-badge">You own this project</div>}
          <div className="tf-market-skills-wrap">
            {skills.map((skill, idx) => (
              <span key={idx} className="tf-market-skill-badge">
                {skill}
              </span>
            ))}
          </div>
        </div>
        <div className="tf-market-card-footer">
          <div className="tf-market-progress-info">
            <span>{progress}% complete</span>
            <span className="tf-market-collaborators-count">
              <UsersIcon />
              {collaboratorsCount}
            </span>
          </div>
          <div className="tf-market-progress-bar">
            <div
              className="tf-market-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  const hasAlreadyApplied = (projId) => {
    return myApplications.some((a) => a.projectId === projId);
  };

  return (
    <div className="tf-market-container">
      <div className="tf-market-header">
        <h1 className="tf-market-title">Projects</h1>
        <p className="tf-market-subtitle">Discover and join projects that match your skills.</p>
      </div>

      <div className="tf-market-search-wrapper">
        <input
          id="proj-search"
          type="text"
          className="tf-market-search-input"
          placeholder="Search projects by title, owner, skill, or keyword"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {!searchQuery && recommendedProjects.length > 0 && (
        <div id="proj-recommended" className="tf-market-section">
          <div className="tf-market-section-title">Recommended For You</div>
          <div id="proj-recommended-cards" className="tf-market-grid-2">
            {recommendedProjects.map((p) => renderProjectCard(p))}
          </div>
        </div>
      )}

      <div className="tf-market-section">
        <div id="proj-section-label" className="tf-market-section-title">
          {searchQuery ? `Results (${filteredProjects.length})` : 'All Projects'}
        </div>
        {loading ? (
          <p className="tf-market-empty-text">Loading projects...</p>
        ) : allProjects.length > 0 ? (
          <div id="proj-all-cards" className="tf-market-grid-3">
            {allProjects.map((p) => renderProjectCard(p))}
          </div>
        ) : (
          <p className="tf-market-empty-text">No projects match your search.</p>
        )}
      </div>

      {/* Project Preview & Apply Modal */}
      {previewProject && (
        <div
          className="tf-market-modal-overlay"
          onClick={() => setPreviewProject(null)}
        >
          <div
            className="tf-market-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-market-modal-header">
              <h2 className="tf-market-modal-title">
                {previewProject.title || previewProject.name}
              </h2>
              <button
                type="button"
                className="tf-market-modal-close-btn"
                onClick={() => setPreviewProject(null)}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="tf-market-modal-meta">
              <span>Owner: <strong>{previewProject.owner || 'Community'}</strong></span>
              {previewProject.duration && <span>Duration: <strong>{previewProject.duration}</strong></span>}
              {previewProject.difficulty && <span>Difficulty: <strong>{previewProject.difficulty}</strong></span>}
            </div>

            <p className="tf-market-modal-desc">
              {previewProject.description || previewProject.desc}
            </p>

            <div className="tf-market-skills-wrap">
              {(previewProject.skills || previewProject.requiredSkills || []).map((s, i) => (
                <span key={i} className="tf-market-skill-badge">{s}</span>
              ))}
            </div>

            {statusFeedback && (
              <div
                className={`tf-market-alert ${
                  statusFeedback.type === 'success'
                    ? 'tf-market-alert-success'
                    : 'tf-market-alert-error'
                }`}
              >
                {statusFeedback.message}
              </div>
            )}

            {!hasAlreadyApplied(previewProject.id) ? (
              <div className="tf-market-modal-actions">
                <button
                  type="button"
                  className="tf-market-btn-outline"
                  onClick={() => setPreviewProject(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="tf-market-btn-primary"
                  disabled={submittingApply}
                  onClick={handleApply}
                >
                  {submittingApply ? 'Applying...' : 'Apply to Project'}
                </button>
              </div>
            ) : (
              <div className="tf-market-modal-actions">
                <span className="tf-market-owner-badge">Already applied</span>
                <button
                  type="button"
                  className="tf-market-btn-outline"
                  onClick={() => setPreviewProject(null)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsMarketplace;
