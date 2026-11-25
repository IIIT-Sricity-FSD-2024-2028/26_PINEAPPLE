import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi, { isProjectLocked } from '../../services/projectsApi';
import joinRequestsApi from '../../services/joinRequestsApi';
import usersApi from '../../services/usersApi';
import ProjectCard from '../../components/features/ProjectCard';
import SearchBar from '../../components/common/SearchBar';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import EmptyState from '../../components/common/EmptyState';
import { getRequestControlConfig } from '../../utils/requestState';
import { formatProjectDueDate } from '../../utils/dateFormatter';
import storage from '../../utils/storage';
import useReasonAction from '../../hooks/useReasonAction';
import './projectsMarketplace.css';

const ProjectsMarketplace = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewProject, setPreviewProject] = useState(null);
  const [skillMatch, setSkillMatch] = useState(null);
  const [loadingSkillMatch, setLoadingSkillMatch] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [submittingApply, setSubmittingApply] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);
  const [myApplications, setMyApplications] = useState([]);
  const [myInvites, setMyInvites] = useState([]);
  const [ownerResponseTimes, setOwnerResponseTimes] = useState({});

  const [refreshKey, setRefreshKey] = useState(0);

  const applyResetTimerRef = useRef(null);

  const {
    renderModal: renderReasonModal,
    handleDeclineInvite,
    handleAcceptInvite,
  } = useReasonAction();

  useEffect(() => {
    return () => {
      if (applyResetTimerRef.current) clearTimeout(applyResetTimerRef.current);
    };
  }, []);

  const currentUserName = user?.name || user?.username || 'Collaborator';
  const currentUserId = user?.id || storage.getBackendUserId() || '1';
  const preselectApplyId = searchParams.get('apply');

  useEffect(() => {
    let isMounted = true;
    const loadMarketplaceData = async () => {
      try {
        const [fetchedProjects, fetchedRequests, fetchedInvites] = await Promise.all([
          projectsApi.list().catch(() => []),
          joinRequestsApi.getMyRequests().catch(() => joinRequestsApi.list({ userId: user?.id }).catch(() => [])),
          typeof projectsApi.getMyInvites === 'function'
            ? projectsApi.getMyInvites().then((res) => (Array.isArray(res) ? res : res?.invites || [])).catch(() => [])
            : Promise.resolve([]),
        ]);
        if (isMounted) {
          const list = Array.isArray(fetchedProjects) ? fetchedProjects : [];
          setProjects(list);
          setMyApplications(Array.isArray(fetchedRequests) ? fetchedRequests : []);
          setMyInvites(Array.isArray(fetchedInvites) ? fetchedInvites : []);
          if (preselectApplyId && list.length > 0) {
            const matchProj = list.find((p) => String(p.id) === String(preselectApplyId));
            if (matchProj) {
              setPreviewProject(matchProj);
              if (typeof projectsApi.getMatch === 'function') {
                setLoadingSkillMatch(true);
                projectsApi.getMatch(matchProj.id)
                  .then((m) => { if (isMounted) setSkillMatch(m || null); })
                  .catch(() => { if (isMounted) setSkillMatch(null); })
                  .finally(() => { if (isMounted) setLoadingSkillMatch(false); });
              }
            }
          }
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
  }, [user?.id, refreshKey, preselectApplyId]);

  const applicableProjects = projects.filter((p) => {
    if (
      isProjectLocked(p) ||
      p.isCompleted ||
      p.completedAt ||
      p.finalLink ||
      String(p.status || '').toLowerCase() === 'completed' ||
      p.deletedAt ||
      p.isDeleted
    ) {
      return false;
    }
    return true;
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = applicableProjects.filter((p) => {
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

  // Fetch owner response times for projects displayed
  useEffect(() => {
    if (!applicableProjects || applicableProjects.length === 0) return;
    const ownerIds = [...new Set(applicableProjects.map((p) => p.ownerId).filter(Boolean))];
    ownerIds.forEach(async (id) => {
      setOwnerResponseTimes((prev) => {
        if (prev[id]) return prev;
        usersApi.getResponseTime(id)
          .then((res) => {
            if (res && res.sample >= 3) {
              const days = Math.max(1, Math.round(res.medianHours / 24));
              setOwnerResponseTimes((p2) => ({
                ...p2,
                [id]: `Usually replies in ${days} ${days === 1 ? 'day' : 'days'}`,
              }));
            }
          })
          .catch(() => {});
        return prev;
      });
    });
  }, [applicableProjects]);

  const getRemovedRecord = (proj) => {
    if (!proj || !Array.isArray(proj.removedUsers)) return null;
    return proj.removedUsers.find(
      (r) =>
        String(r.userId) === String(currentUserId) ||
        (currentUserName && r.userName && r.userName.toLowerCase() === currentUserName.toLowerCase())
    );
  };

  const resolveRequestConfig = (project) => {
    if (!project) return getRequestControlConfig({ state: 'none' });
    if (project.myRequestStatus) {
      return getRequestControlConfig(project.myRequestStatus);
    }
    const isOwner = String(project.ownerId || '') === String(currentUserId) || (typeof project.owner === 'object' && String(project.owner?.id || '') === String(currentUserId));
    if (isOwner) {
      return getRequestControlConfig({ state: 'member' });
    }
    const isMentor = String(project.mentorId || '') === String(currentUserId) || (typeof project.mentor === 'object' && String(project.mentor?.id || '') === String(currentUserId));
    if (isMentor) {
      return getRequestControlConfig({ state: 'member' });
    }
    const isCollab = Array.isArray(project.members)
      ? project.members.some((m) => String(m.id || m.userId) === String(currentUserId))
      : (Array.isArray(project.collaborators) && project.collaborators.some((c) => String(typeof c === 'string' ? c : (c?.id || c?.userId)) === String(currentUserId)));
    if (isCollab) {
      return getRequestControlConfig({ state: 'member' });
    }
    const pendingInvite = Array.isArray(myInvites)
      ? myInvites.find(
          (inv) => String(inv.projectId) === String(project.id) && String(inv.status).toLowerCase() === 'pending'
        )
      : null;
    if (pendingInvite) {
      return getRequestControlConfig({ state: 'invited', inviteId: pendingInvite.id });
    }
    const statusLower = String(project.status || '').toLowerCase();
    if (statusLower === 'completed' || project.deletedAt || project.isDeleted) {
      return getRequestControlConfig({ state: 'not_accepting', lastReason: project.closureReason });
    }
    if (isProjectLocked(project) || statusLower === 'closed') {
      return getRequestControlConfig({ state: 'closed', lastReason: project.closureReason });
    }
    const removedRec = getRemovedRecord(project);
    if (removedRec) {
      return getRequestControlConfig({ state: 'banned', lastReason: removedRec.reason });
    }
    const approvedCollabs = Array.isArray(project.collaborators)
      ? project.collaborators.filter((c) => {
          const id = typeof c === 'string' ? String(c) : String(c.id || c.userId || '');
          return id && id !== String(project.ownerId || '');
        }).length
      : (Number(project.approvedCollaboratorCount ?? project.collaboratorCount) || 0);
    const maxLimit = Number(project.maxCollaborators) > 0 ? Number(project.maxCollaborators) : 5;
    if (project.isFull || approvedCollabs >= maxLimit) {
      return getRequestControlConfig({ state: 'full' });
    }
    const projectApps = myApplications.filter((a) => a.projectId === project.id);
    if (projectApps.length === 0) {
      return getRequestControlConfig({ state: 'none' });
    }
    const activeApp = projectApps.find((a) => String(a.status).toLowerCase() === 'pending');
    if (activeApp) {
      return getRequestControlConfig({ state: 'pending' });
    }
    const approvedApp = projectApps.find((a) => String(a.status).toLowerCase() === 'approved');
    if (approvedApp) {
      return getRequestControlConfig({ state: 'member' });
    }
    const rejectedApps = projectApps.filter((a) => String(a.status).toLowerCase() === 'rejected');
    if (rejectedApps.length > 0) {
      const lastApp = rejectedApps[rejectedApps.length - 1];
      const used = typeof lastApp.requestsUsed === 'number' ? lastApp.requestsUsed : rejectedApps.length;
      const left = typeof lastApp.requestsLeft === 'number' ? lastApp.requestsLeft : Math.max(0, 2 - used);
      const lastReason = lastApp.rejectionReason || lastApp.reason || '';
      return getRequestControlConfig({
        state: left <= 0 ? 'rejected_final' : 'rejected_can_retry',
        requestsLeft: left,
        requestsUsed: used,
        lastReason,
      });
    }
    return getRequestControlConfig({ state: 'none' });
  };

  const handleCardClick = (project) => {
    const isOwner = project.owner === currentUserName || project.ownerId === currentUserId;
    if (isOwner) {
      navigate(`/workspace/${project.id}`);
      return;
    }
    setPreviewProject(project);
    setStatusFeedback(null);
    setSkillMatch(null);

    if (typeof projectsApi.getMatch === 'function') {
      setLoadingSkillMatch(true);
      projectsApi.getMatch(project.id)
        .then((res) => setSkillMatch(res || null))
        .catch(() => setSkillMatch(null))
        .finally(() => setLoadingSkillMatch(false));
    }

    // Ensure owner response time is fetched for this preview
    const oId = project.ownerId || (typeof project.owner === 'object' ? project.owner?.id : '');
    if (oId && !ownerResponseTimes[oId]) {
      usersApi.getResponseTime(oId)
        .then((res) => {
          if (res && res.sample >= 3) {
            const days = Math.max(1, Math.round(res.medianHours / 24));
            setOwnerResponseTimes((prev) => ({
              ...prev,
              [oId]: `Usually replies in ${days} ${days === 1 ? 'day' : 'days'}`,
            }));
          }
        })
        .catch(() => {});
    }
  };

  const handleMarketAcceptInvite = async (inviteId) => {
    try {
      await handleAcceptInvite(inviteId);
      setStatusFeedback({ type: 'success', message: 'Invitation accepted! You are now a project member.' });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setStatusFeedback({
        type: 'error',
        message: err?.serverMessage || err?.message || 'Failed to accept invitation.',
      });
    }
  };

  const handleMarketDeclineInvite = (inviteId, projectName) => {
    handleDeclineInvite(inviteId, {
      projectName: projectName || 'Project Invitation',
      onSuccess: () => {
        setStatusFeedback({ type: 'success', message: 'Invitation declined.' });
        setRefreshKey((k) => k + 1);
      },
    }).catch((err) => {
      setStatusFeedback({
        type: 'error',
        message: err?.serverMessage || err?.message || 'Failed to decline invitation.',
      });
    });
  };

  const handleApply = async () => {
    if (!previewProject) return;
    const statusLower = String(previewProject.status || '').toLowerCase();
    if (previewProject.deletedAt || statusLower === 'completed') {
      setStatusFeedback({ type: 'error', message: 'Project is not accepting join requests.' });
      return;
    }
    if (isProjectLocked(previewProject) || statusLower === 'closed') {
      setStatusFeedback({ type: 'error', message: 'This project is closed. Applications are not being accepted.' });
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
      if (applyResetTimerRef.current) clearTimeout(applyResetTimerRef.current);
      applyResetTimerRef.current = setTimeout(() => {
        setPreviewProject(null);
        setApplyMessage('');
        setStatusFeedback(null);
      }, 1500);
    } catch (err) {
      const capProjects =
        err?.code === 'ACTIVE_PROJECT_CAP' && Array.isArray(err?.projects)
          ? err.projects
          : null;
      const errMsg =
        err?.serverMessage ||
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        'Failed to submit application.';
      setStatusFeedback({
        type: 'error',
        message: errMsg,
        projects: capProjects,
      });
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
              const reqConfig = resolveRequestConfig(p);
              const ownerResp = ownerResponseTimes[p.ownerId];
              return (
                <div key={p.id}>
                  <ProjectCard
                    project={{
                      ...p,
                      ownerResponseTime: ownerResp,
                      onAcceptInvite: handleMarketAcceptInvite,
                      onDeclineInvite: (invId) => handleMarketDeclineInvite(invId, p.title || p.name),
                      myRequestStatus: p.myRequestStatus || {
                        state: reqConfig.state,
                        inviteId: reqConfig.inviteId,
                        requestsLeft: reqConfig.requestsLeft,
                        requestsUsed: reqConfig.requestsUsed,
                        lastReason: reqConfig.reason,
                      },
                    }}
                    variant="marketplace"
                    onSelect={handleCardClick}
                    onApply={handleCardClick}
                    onAcceptInvite={handleMarketAcceptInvite}
                    onDeclineInvite={(invId) => handleMarketDeclineInvite(invId, p.title || p.name)}
                    hasApplied={!reqConfig.canApply}
                    applicationStatus={reqConfig.label}
                    ownerResponseTime={ownerResp}
                  />
                </div>
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
              const reqConfig = resolveRequestConfig(p);
              const ownerResp = ownerResponseTimes[p.ownerId];
              return (
                <div key={p.id}>
                  <ProjectCard
                    project={{
                      ...p,
                      ownerResponseTime: ownerResp,
                      onAcceptInvite: handleMarketAcceptInvite,
                      onDeclineInvite: (invId) => handleMarketDeclineInvite(invId, p.title || p.name),
                      myRequestStatus: p.myRequestStatus || {
                        state: reqConfig.state,
                        inviteId: reqConfig.inviteId,
                        requestsLeft: reqConfig.requestsLeft,
                        requestsUsed: reqConfig.requestsUsed,
                        lastReason: reqConfig.reason,
                      },
                    }}
                    variant="marketplace"
                    onSelect={handleCardClick}
                    onApply={handleCardClick}
                    onAcceptInvite={handleMarketAcceptInvite}
                    onDeclineInvite={(invId) => handleMarketDeclineInvite(invId, p.title || p.name)}
                    hasApplied={!reqConfig.canApply}
                    applicationStatus={reqConfig.label}
                    ownerResponseTime={ownerResp}
                  />
                </div>
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
          const reqConfig = resolveRequestConfig(previewProject);
          if (reqConfig.canApply) {
            return (
              <>
                <button
                  type="button"
                  className="tf-market-btn-outline"
                  onClick={() => setPreviewProject(null)}
                >
                  Cancel
                </button>
                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <button
                    type="button"
                    className="tf-market-btn-primary"
                    disabled={submittingApply}
                    onClick={handleApply}
                  >
                    {submittingApply ? 'Applying...' : 'Apply to Project'}
                  </button>
                  {reqConfig.hint && (
                    <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500 }}>
                      {reqConfig.hint}
                    </span>
                  )}
                </div>
              </>
            );
          }
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ fontSize: '0.85rem', color: reqConfig.variant === 'danger' ? '#be123c' : '#6b7280', fontWeight: 500 }}>
                {reqConfig.hint ? `${reqConfig.label} (${reqConfig.hint})` : reqConfig.label}
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
        })()}
      >
        {previewProject && (
          <div>
            <div className="tf-market-modal-meta">
              <span>Owner: <strong>{previewProject.owner || 'Community'}</strong></span>
              {ownerResponseTimes[previewProject.ownerId] && (
                <span className="tf-owner-response-time" style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  ⏱️ {ownerResponseTimes[previewProject.ownerId]}
                </span>
              )}
              {previewProject.dueDate && <span><strong>{formatProjectDueDate(previewProject.dueDate)}</strong></span>}
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

            {loadingSkillMatch && (
              <div style={{ marginTop: '10px', fontSize: '0.82rem', color: '#64748b' }}>
                Checking your skill match...
              </div>
            )}

            {!loadingSkillMatch && skillMatch && skillMatch.percent !== null && skillMatch.percent !== undefined && (
              <div
                data-testid="apply-skill-match"
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', gap: '8px', flexWrap: 'wrap' }}>
                  <span>Skill Match: {skillMatch.percent}%</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#475569' }}>
                    This is a hint, you can still apply
                  </span>
                </div>
                <div style={{ marginTop: '6px', height: '6px', borderRadius: '999px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, skillMatch.percent))}%`,
                      height: '100%',
                      backgroundColor: skillMatch.percent >= 70 ? '#16a34a' : skillMatch.percent >= 40 ? '#d97706' : '#64748b',
                    }}
                  />
                </div>
                {Array.isArray(skillMatch.missing) && skillMatch.missing.length > 0 && (
                  <div data-testid="apply-missing-skills" style={{ marginTop: '6px', fontSize: '0.8rem', color: '#475569' }}>
                    Missing skills: {skillMatch.missing.join(', ')}
                  </div>
                )}
              </div>
            )}

            {(() => {
              const reqConfig = resolveRequestConfig(previewProject);
              if (reqConfig.state === 'banned') {
                return (
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
                      {reqConfig.reason && (
                        <>
                          <br />
                          <strong>Reason:</strong> &ldquo;{reqConfig.reason}&rdquo;
                        </>
                      )}
                      <br />
                      Re-applying to this project is not permitted.
                    </div>
                  </div>
                );
              }
              if (reqConfig.state === 'rejected_can_retry') {
                return (
                  <div
                    style={{
                      marginTop: '1.25rem',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                      color: '#b45309',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                      ⚠️ Previous Application Declined
                    </div>
                    {reqConfig.reason && (
                      <div style={{ fontStyle: 'italic', marginBottom: '4px' }}>
                        Reason: &ldquo;{reqConfig.reason}&rdquo;
                      </div>
                    )}
                    <div>You have <strong>1 request left</strong> for this project.</div>
                  </div>
                );
              }
              if (reqConfig.state === 'rejected_final') {
                return (
                  <div
                    style={{
                      marginTop: '1.25rem',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#fff1f2',
                      border: '1px solid #fecdd3',
                      color: '#be123c',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                      🚫 Application Request Limit Reached
                    </div>
                    {reqConfig.reason && (
                      <div style={{ fontStyle: 'italic', marginBottom: '4px' }}>
                        Rejection reason: &ldquo;{reqConfig.reason}&rdquo;
                      </div>
                    )}
                    <div>You have reached the maximum of 2 requests allowed for this project.</div>
                  </div>
                );
              }
              if (reqConfig.state === 'pending') {
                return (
                  <div
                    style={{
                      marginTop: '1.25rem',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      color: '#0369a1',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                      ⏳ Request Pending
                    </div>
                    <div>Your application is awaiting review by the project owner.</div>
                  </div>
                );
              }
              return null;
            })()}

            {resolveRequestConfig(previewProject).canApply && (
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
                <div>{statusFeedback.message}</div>
                {Array.isArray(statusFeedback.projects) && statusFeedback.projects.length > 0 && (
                  <ul data-testid="active-cap-projects-list" style={{ marginTop: '6px', marginBottom: 0, paddingLeft: '18px', fontSize: '0.84rem' }}>
                    {statusFeedback.projects.map((ap) => (
                      <li key={ap.id}>{ap.title} ({ap.status})</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
      {/* Universal Reason Modal for Declining Project Invitations (Fix 4 / Phase 9) */}
      {renderReasonModal()}
    </div>
  );
};

export default ProjectsMarketplace;
