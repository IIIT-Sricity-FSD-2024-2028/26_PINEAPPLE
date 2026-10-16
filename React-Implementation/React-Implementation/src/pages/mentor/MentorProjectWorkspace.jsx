import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi, { isProjectLocked } from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import communicationApi from '../../services/communicationApi';
import mentorshipApi from '../../services/mentorshipApi';
import TaskCard from '../../components/features/TaskCard';
import ChatBox from '../../components/features/ChatBox';
import EmptyState from '../../components/common/EmptyState';
import Avatar from '../../components/common/Avatar';
import FilterTabs from '../../components/common/FilterTabs';
import StatCard from '../../components/common/StatCard';
import { calculateProjectProgress } from '../../utils/progress';
import './mentorProjectWorkspace.css';

/* ── Extracted SVG Functional Components ── */
const BackArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.6673 8H3.33398" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AwardIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="7" />
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
  </svg>
);

const MentorProjectWorkspace = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  // Recommendation Badge Modal state
  const [badgeModalMember, setBadgeModalMember] = useState(null);
  const [badgeType, setBadgeType] = useState('Technical Excellence');
  const [badgeComment, setBadgeComment] = useState('');
  const [submittingBadge, setSubmittingBadge] = useState(false);
  const [awardedMembers, setAwardedMembers] = useState(new Set());
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!projectId) return;

    const fetchWorkspace = async () => {
      try {
        const [projData, tasksData, msgsData, badgesData] = await Promise.all([
          projectsApi.get(projectId).catch(() => null),
          tasksApi.list({ projectId }).catch(() => []),
          communicationApi.getMessages(projectId).catch(() => []),
          mentorshipApi.getBadgesByProject(projectId).catch(() => []),
        ]);

        if (isMounted) {
          setProject(projData);
          setTasks(Array.isArray(tasksData) ? tasksData : []);
          setMessages(Array.isArray(msgsData) ? msgsData : []);
          const existingAwarded = new Set();
          if (Array.isArray(badgesData)) {
            badgesData.forEach((b) => {
              if (b.recipientId) existingAwarded.add(String(b.recipientId).toLowerCase());
              if (b.recipientName) existingAwarded.add(String(b.recipientName).toLowerCase());
              if (b.collaboratorId) existingAwarded.add(String(b.collaboratorId).toLowerCase());
            });
          }
          setAwardedMembers(existingAwarded);
        }
      } catch (err) {
        console.error('Failed to load mentor workspace:', err);
        if (isMounted) {
          setFeedback({ type: 'error', message: 'Failed to load project details.' });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchWorkspace();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // Real-time chat polling (polls every 3 seconds while on chat tab)
  useEffect(() => {
    if (!projectId || activeTab !== 'chat') return;
    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const fresh = await communicationApi.getMessages(projectId);
        if (isMounted && Array.isArray(fresh)) {
          setMessages(fresh);
        }
      } catch {
        /* non-critical background poll */
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [projectId, activeTab]);



  /* ── Issue Recommendation Badge Handler ── */
  const handleOpenBadgeModal = (member) => {
    setBadgeModalMember(member);
    setBadgeType('Technical Excellence');
    setBadgeComment('Demonstrated exceptional technical skill and problem-solving.');
  };

  const handleIssueBadge = async (e) => {
    e.preventDefault();
    if (!badgeModalMember) return;
    setSubmittingBadge(true);
    try {
      const targetId = badgeModalMember.id || badgeModalMember.userId || badgeModalMember.name;
      await mentorshipApi.issueBadge({
        projectId,
        recipientId: targetId,
        collaboratorId: targetId,
        badgeName: badgeType,
        badgeType: badgeType,
        comment: badgeComment || 'Exceptional mentorship recommendation.',
        note: badgeComment || 'Exceptional mentorship recommendation.',
      });

      const memberNameKey = String(badgeModalMember.name || '').toLowerCase();
      const memberIdKey = String(targetId).toLowerCase();

      setAwardedMembers((prev) => new Set([...prev, memberNameKey, memberIdKey]));
      setFeedback({
        type: 'success',
        message: `Recommendation badge "${badgeType}" awarded to ${badgeModalMember.name}!`,
      });
      setBadgeModalMember(null);
    } catch (err) {
      console.error('Failed to issue badge:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to issue recommendation badge.';
      setFeedback({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setSubmittingBadge(false);
    }
  };


  /* ── Chat Message Handler ── */
  const handleSendMessage = async (text) => {
    if (!text || !text.trim()) return;
    const messageText = text.trim();
    setSendingMsg(true);

    try {
      const res = await communicationApi.sendMessage({
        projectId,
        content: messageText,
        text: messageText,
        senderName: user?.name || user?.username || 'Mentor',
      }, 'Mentor', user?.id);

      if (res) {
        setMessages((prev) => [...prev, res]);
      }

      const fresh = await communicationApi.getMessages(projectId);
      if (Array.isArray(fresh)) {
        setMessages(fresh);
      }
    } catch (err) {
      console.error('Failed to send chat message:', err);
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading) {
    return (
      <div className="tf-mentor-ws-container">
        <p className="text-sm text-muted">Loading mentor workspace...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="tf-mentor-ws-container">
        <button
          type="button"
          className="tf-mentor-ws-back-btn"
          onClick={() => navigate('/mentor/projects')}
        >
          <BackArrowIcon />
          <span>Back to Mentored Projects</span>
        </button>
        <div className="tf-mentor-ws-card">
          <h2>Project Not Found</h2>
          <p className="text-sm text-muted">This project could not be found or you do not have mentor permissions.</p>
        </div>
      </div>
    );
  }

  const ownerMember = project.owner ? [{
    id: project.ownerId || 'owner',
    name: typeof project.owner === 'object' ? (project.owner.name || 'Owner') : project.owner,
    role: 'Owner',
    initials: (typeof project.owner === 'object' ? (project.owner.name || 'OW') : project.owner).slice(0, 2).toUpperCase(),
  }] : [];
  const collabs = Array.isArray(project.collaborators)
    ? project.collaborators.map((c) =>
        typeof c === 'string'
          ? { id: c, name: c, role: 'Collaborator', initials: c.slice(0, 2).toUpperCase() }
          : { ...c, role: c.role || 'Collaborator', initials: (c.name || 'CL').slice(0, 2).toUpperCase() }
      )
    : [];
  const membersList = (Array.isArray(project.members) && project.members.length > 0)
    ? project.members
    : [...ownerMember, ...collabs];

  const inReviewCount = tasks.filter((t) => {
    const s = String(t.status || '').toLowerCase();
    return s === 'in review' || s === 'under review' || s === 'submitted' || Boolean(t.proofLink && s !== 'completed');
  }).length;
  const completedCount = tasks.filter((t) => {
    const s = String(t.status || '').toLowerCase();
    return s === 'completed' || s === 'approved' || s === 'done';
  }).length;
  const progressPercent = calculateProjectProgress(tasks);
  const isLocked = isProjectLocked(project);

  return (
    <div className="tf-mentor-ws-container">
      {/* Back button */}
      <button
        type="button"
        className="tf-mentor-ws-back-btn"
        onClick={() => navigate('/mentor/projects')}
      >
        <BackArrowIcon />
        <span>Back to Mentored Projects</span>
      </button>

      {/* Hero card */}
      <div className="tf-mentor-ws-hero">
        <div className="tf-mentor-ws-hero-left">
          <div className="tf-mentor-ws-title-row">
            <h1 className="tf-mentor-ws-title">{project.name || project.title}</h1>
            <span className="tf-mentor-ws-badge warning">Mentor View</span>
            {isLocked && (
              <span className="tf-mentor-ws-badge" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>
                🔒 Locked / Completed
              </span>
            )}
          </div>

          <p className="tf-mentor-ws-desc">
            {project.desc || project.description || 'Project managed on TeamForge.'}
          </p>

        </div>

        <div className="tf-mentor-ws-hero-meta">
          <div className="tf-mentor-ws-metric">{progressPercent}%</div>
          <div className="tf-mentor-ws-metric-sub">
            {isLocked ? 'Completed (Locked)' : 'In progress'}
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`tf-mentor-ws-feedback ${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      {/* Tabs */}
      <div className="tf-mentor-ws-tabs-wrapper" style={{ margin: '16px 0' }}>
        <FilterTabs
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'tasks', label: 'Tasks', count: tasks.length },
            { id: 'members', label: 'Members', count: membersList.length },
            { id: 'chat', label: 'Chat' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          ariaLabel="Mentor workspace sections"
        />
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <div>
          <div className="tf-mentor-ws-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <StatCard
              label="Total Tasks"
              value={tasks.length}
            />
            <StatCard
              label="Awaiting Review"
              value={inReviewCount}
              subtext={inReviewCount > 0 ? "Pending mentor input" : "All clear"}
            />
            <StatCard
              label="Approved Tasks"
              value={completedCount}
            />
            <StatCard
              label="Team Members"
              value={membersList.length}
            />
          </div>

          <div className="tf-mentor-ws-card">
            <div className="tf-mentor-ws-card-header">
              <h2 className="tf-mentor-ws-card-title">Contribution History &amp; Submissions</h2>
              <p className="tf-mentor-ws-card-subtitle">Recent task milestone updates across the team.</p>
            </div>

            {tasks.length === 0 ? (
              <p className="text-sm text-muted">No task submissions recorded yet.</p>
            ) : (
              <div>
                {tasks.slice(0, 6).map((t, idx) => {
                  const s = String(t.status || '').toLowerCase();
                  const isDone = s === 'completed' || s === 'approved' || s === 'done';
                  const isRev = s === 'in review' || s === 'under review' || s === 'submitted';
                  return (
                    <div key={idx} className="tf-mentor-ws-history-row">
                      <div>
                        <div className="font-semibold text-sm">{t.title}</div>
                        <div className="text-xs text-muted">
                          Assigned to: {t.assignedTo || t.assignee || 'Unassigned'}
                          {t.proofLink && ' · Proof submitted'}
                        </div>
                      </div>
                      <span
                        className={`tf-mentor-ws-badge ${
                          isDone ? 'success' : isRev ? 'warning' : 'secondary'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tasks Tab Content */}
      {activeTab === 'tasks' && (
        <div className="tf-mentor-ws-card">
          <div className="tf-mentor-ws-card-header">
            <h2 className="tf-mentor-ws-card-title">Project Tasks</h2>
            <p className="tf-mentor-ws-card-subtitle">
              Read-only view of deliverables and current task progress for this project.
            </p>
          </div>

          <div className="tf-mentor-ws-tasks-list">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  userRole="Mentor"
                  isLocked={isLocked}
                />
              ))
            ) : (
              <EmptyState
                title="No tasks found"
                message="No deliverables have been created for this project yet."
              />
            )}
          </div>
        </div>
      )}

      {/* Members Tab Content */}
      {activeTab === 'members' && (
        <div className="tf-mentor-ws-card">
          <div className="tf-mentor-ws-card-header">
            <h2 className="tf-mentor-ws-card-title">Project Members</h2>
            <p className="tf-mentor-ws-card-subtitle">
              Team members contributing to this project. As mentor, you can assign recommendation badges to outstanding collaborators.
            </p>
          </div>

          <div className="tf-mentor-ws-members-list">
            {membersList.map((member, mIdx) => {
              const isOwner = member.name === project.owner;
              const isSelf = member.name === user?.name || String(member.id || member.userId) === String(user?.id);
              const mName = String(member.name || '').toLowerCase();
              const mId = String(member.id || member.userId || '').toLowerCase();
              const hasBadge = awardedMembers.has(mName) || (mId && awardedMembers.has(mId));

              return (
                <div key={mIdx} className="tf-mentor-ws-member-row">
                  <div className="tf-mentor-ws-member-info">
                    <Avatar name={member.name} size="md" />
                    <div>
                      <div className="tf-mentor-ws-member-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{member.name}</span>
                        {hasBadge && (
                          <span
                            className="tf-mentor-ws-badge warning"
                            style={{ fontSize: '0.72rem', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Recommendation badge awarded for this project"
                          >
                            <AwardIcon /> Badge Awarded
                          </span>
                        )}
                      </div>
                      <div className="tf-mentor-ws-member-role">{member.role || 'Collaborator'}</div>
                    </div>
                  </div>

                  {!isOwner && !isSelf && (
                    <div>
                      {hasBadge ? (
                        <span className="tf-mentor-ws-badge warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <AwardIcon /> Badge Assigned
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="tf-mentor-ws-btn-badge"
                          onClick={() => handleOpenBadgeModal(member)}
                        >
                          <AwardIcon />
                          <span>Assign Badge</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat Tab Content */}
      {activeTab === 'chat' && (
        <div className="tf-mentor-ws-card" style={{ padding: '1.25rem' }}>
          <ChatBox
            messages={messages}
            currentUserId={user?.id}
            currentUserName={user?.name || user?.username || 'Mentor'}
            currentUserRole="Mentor"
            onSendMessage={handleSendMessage}
            onRefresh={() => communicationApi.getMessages(projectId).then((m) => Array.isArray(m) && setMessages(m)).catch(() => {})}
            sending={sendingMsg}
          />
        </div>
      )}

      {/* ── Assign Recommendation Badge Modal ── */}
      {badgeModalMember && (
        <div
          className="tf-mentor-ws-modal-overlay"
          onClick={() => setBadgeModalMember(null)}
        >
          <div
            className="tf-mentor-ws-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-mentor-ws-modal-header">
              <h3 className="tf-mentor-ws-modal-title">Award Recommendation Badge</h3>
              <button
                type="button"
                className="tf-mentor-ws-modal-close"
                onClick={() => setBadgeModalMember(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleIssueBadge}>
              <div className="tf-mentor-ws-modal-body">
                <p className="text-sm text-muted" style={{ margin: '0 0 14px 0' }}>
                  Recognize <strong>{badgeModalMember.name}</strong> for outstanding contribution to {project.name}.
                </p>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Badge Category
                  </label>
                  <select
                    value={badgeType}
                    onChange={(e) => setBadgeType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="Technical Excellence">Technical Excellence</option>
                    <option value="Leadership">Leadership</option>
                    <option value="Team Player">Team Player</option>
                    <option value="Innovator">Innovator</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Mentor Recommendation Note
                  </label>
                  <textarea
                    rows={3}
                    value={badgeComment}
                    onChange={(e) => setBadgeComment(e.target.value)}
                    placeholder="Describe how this member exceeded expectations..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div className="tf-mentor-ws-modal-footer">
                <button
                  type="button"
                  className="tf-mentor-ws-btn-cancel"
                  onClick={() => setBadgeModalMember(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tf-mentor-ws-chat-send-btn"
                  disabled={submittingBadge}
                >
                  <AwardIcon />
                  <span>{submittingBadge ? 'Awarding...' : 'Award Badge'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorProjectWorkspace;

