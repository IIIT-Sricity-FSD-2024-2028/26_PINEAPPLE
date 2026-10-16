import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi, { isProjectLocked } from '../../services/projectsApi';
import joinRequestsApi from '../../services/joinRequestsApi';
import ProjectCard from '../../components/features/ProjectCard';
import SearchBar from '../../components/common/SearchBar';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import EmptyState from '../../components/common/EmptyState';
import './projectsMarketplace.css';

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

  const [refreshKey, setRefreshKey] = useState(0);

  const currentUserName = user?.name || user?.username || 'Collaborator';
  const currentUserId = user?.id || (typeof localStorage !== 'undefined' && localStorage.getItem('teamforge.backendUserId')) || '1';

  useEffect(() => {
    let isMounted = true;
    const loadMarketplaceData = async () => {
      try {
        const [fetchedProjects, fetchedRequests] = await Promise.all([
          projectsApi.list().catch(() => []),
          joinRequestsApi.list({ userId: user?.id }).catch(() => []),
        ]);
        if (isMounted) {
          setProjects(Array.isArray(fetchedProjects) ? fetchedProjects : []);
          setMyApplications(Array.isArray(fetchedRequests) ? fetchedRequests : []);
        }
      } catch (err) {
        console.error('Failed to load marketplace projects:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadMarketplaceData();

    return () => {
      isMounted = false;
    };
  }, [user?.id, refreshKey]);

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

  const hasAlreadyApplied = (projId) => {
    return myApplications.some((a) => a.projectId === projId);
  };

  const getApplicationStatus = (projId) => {
    const app = myApplications.find((a) => a.projectId === projId);
    return app?.status || '';
  };

  const getRemovedRecord = (proj) => {
    if (!proj || !Array.isArray(proj.removedUsers)) return null;
    return proj.removedUsers.find(
      (r) =>
        String(r.userId) === String(currentUserId) ||
        (currentUserName && r.userName && r.userName.toLowerCase() === currentUserName.toLowerCase())
    );
  };

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
    if (isProjectLocked(previewProject)) {
      setStatusFeedback({ type: 'error', message: 'This project is completed and locked. Applications are closed.' });
      return;
    }
    const removedRec = getRemovedRecord(previewProject);
    if (removedRec) {
      setStatusFeedback({
        type: 'error',
        message: `You were removed from this project with reason: "${removedRec.reason}". Re-applying is not permitted.`,
      });
      return;
    }
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
      setRefreshKey((k) => k + 1);
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

  return (
    <div className="tf-market-container">
      <div className="tf-market-header">
        <h1 className="tf-market-title">Projects</h1>
        <p className="tf-market-subtitle">Discover and join projects that match your skills.</p>
      </div>

      <div className="tf-market-search-wrapper">
        <SearchBar
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
          placeholder="Search projects by title, owner, skill, or keyword..."
        />
      </div>

      {!searchQuery && recommendedProjects.length > 0 && (
        <div id="proj-recommended" className="tf-market-section">
          <div className="tf-market-section-title">Recommended For You</div>
          <div id="proj-recommended-cards" className="tf-market-grid-2">
            {recommendedProjects.map((p) => {
              const removedRecord = getRemovedRecord(p);
              return (
                <ProjectCard
                  key={p.id}
                  project={p}
                  variant="marketplace"
                  onSelect={handleCardClick}
                  onApply={handleCardClick}
                  hasApplied={hasAlreadyApplied(p.id) || Boolean(removedRecord)}
                  applicationStatus={removedRecord ? 'Removed' : getApplicationStatus(p.id)}
                />
              );
            })}
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
            {allProjects.map((p) => {
              const removedRecord = getRemovedRecord(p);
              return (
                <ProjectCard
                  key={p.id}
                  project={p}
                  variant="marketplace"
                  onSelect={handleCardClick}
                  onApply={handleCardClick}
                  hasApplied={hasAlreadyApplied(p.id) || Boolean(removedRecord)}
                  applicationStatus={removedRecord ? 'Removed' : getApplicationStatus(p.id)}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No projects match your search"
            message="Try searching with different keywords, skill sets, or clear your query."
            actionLabel={searchQuery ? 'Clear Search' : undefined}
            onAction={() => setSearchQuery('')}
          />
        )}
      </div>

      {/* Project Preview & Apply Modal */}
      <Modal
        isOpen={Boolean(previewProject)}
        title={previewProject?.title || previewProject?.name || 'Project Details'}
        onClose={() => setPreviewProject(null)}
        footer={(() => {
          const removedRec = getRemovedRecord(previewProject);
          if (isProjectLocked(previewProject)) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>🔒 Project is completed and locked. Applications closed.</span>
                <button
                  type="button"
                  className="tf-market-btn-outline"
                  onClick={() => setPreviewProject(null)}
                >
                  Close
                </button>
              </div>
            );
          }
          if (removedRec) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '0.85rem', color: '#be123c', fontWeight: 500 }}>
                  ⚠️ Removed from project. Re-applying is not permitted.
                </span>
                <button
                  type="button"
                  className="tf-market-btn-outline"
                  onClick={() => setPreviewProject(null)}
                >
                  Close
                </button>
              </div>
            );
          }
          if (!hasAlreadyApplied(previewProject?.id)) {
            return (
              <>
                <button
                  type="button"
                  className="tf-market-btn-outline"
                  onClick={() => setPreviewProject(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="tf-market-btn-primary"
                  disabled={submittingApply}
                  onClick={handleApply}
                >
                  {submittingApply ? 'Applying...' : 'Apply to Project'}
                </button>
              </>
            );
          }
          return (
            <button
              type="button"
              className="tf-market-btn-outline"
              onClick={() => setPreviewProject(null)}
            >
              Close
            </button>
          );
        })()}
      >
        {previewProject && (
          <div>
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

            {getRemovedRecord(previewProject) && (
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#fff1f2',
                  border: '1px solid #fecdd3',
                  color: '#be123c',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>
                  ⚠️ Removed from Project
                </div>
                <div style={{ fontSize: '0.875rem' }}>
                  You were removed from this project by the owner.
                  <br />
                  <strong>Reason:</strong> &ldquo;{getRemovedRecord(previewProject).reason}&rdquo;
                  <br />
                  Re-applying to this project is not permitted.
                </div>
              </div>
            )}

            {!isProjectLocked(previewProject) && !getRemovedRecord(previewProject) && !hasAlreadyApplied(previewProject.id) && (
              <div style={{ marginTop: '1.25rem' }}>
                <FormInput
                  label="Application Message"
                  name="applyMessage"
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  placeholder="Tell the project owner why you would be a great fit..."
                  multiline
                  rows={3}
                  helperText="Highlight your skills and what you want to learn or contribute."
                />
              </div>
            )}

            {statusFeedback && (
              <div
                className={`tf-market-alert ${
                  statusFeedback.type === 'success'
                    ? 'tf-market-alert-success'
                    : 'tf-market-alert-error'
                }`}
                style={{ marginTop: '1rem' }}
              >
                {statusFeedback.message}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProjectsMarketplace;
