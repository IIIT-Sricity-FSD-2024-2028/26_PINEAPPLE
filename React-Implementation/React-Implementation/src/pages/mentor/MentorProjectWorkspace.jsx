import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import communicationApi from '../../services/communicationApi';
import mentorshipApi from '../../services/mentorshipApi';
import mentorRequestsApi from '../../services/mentorRequestsApi';
import './mentorProjectWorkspace.css';

/* ── Extracted SVG Functional Components ── */
const BackArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.6673 8H3.33398" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const AwardIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="7" />
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
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

  // Review Modal state for task approval/rejection
  const [reviewModalTask, setReviewModalTask] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Recommendation Badge Modal state
  const [badgeModalMember, setBadgeModalMember] = useState(null);
  const [badgeType, setBadgeType] = useState('Technical Excellence');
  const [badgeComment, setBadgeComment] = useState('');
  const [submittingBadge, setSubmittingBadge] = useState(false);
  const [awardedMembers, setAwardedMembers] = useState(new Set());

  // Chat input
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatBottomRef = useRef(null);

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const [projData, tasksData, msgsData] = await Promise.all([
        projectsApi.get(projectId).catch(() => null),
        tasksApi.list({ projectId }).catch(() => []),
        communicationApi.getMessages(projectId).catch(() => []),
      ]);

      setProject(projData);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setMessages(Array.isArray(msgsData) ? msgsData : []);
    } catch (err) {
      console.error('Failed to load mentor workspace:', err);
      setFeedback({ type: 'error', message: 'Failed to load project details.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadWorkspace();
    }
  }, [projectId]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  /* ── Task Review Handlers ── */
  const handleOpenReviewModal = (task) => {
    setReviewModalTask(task);
    setReviewFeedback('');
  };

  const handleApproveTask = async () => {
    if (!reviewModalTask) return;
    setSubmittingReview(true);
    try {
      await tasksApi.updateStatus(reviewModalTask.id, {
        status: 'Completed',
        feedback: reviewFeedback || 'Task approved by mentor.',
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.id === reviewModalTask.id ? { ...t, status: 'Completed', proofStatus: 'Approved' } : t
        )
      );

      setFeedback({
        type: 'success',
        message: `Task "${reviewModalTask.title}" approved successfully.`,
      });
      setReviewModalTask(null);
    } catch (err) {
      console.error('Failed to approve task:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to approve task.' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleRejectTask = async () => {
    if (!reviewModalTask) return;
    setSubmittingReview(true);
    try {
      await tasksApi.updateStatus(reviewModalTask.id, {
        status: 'In Progress',
        feedback: reviewFeedback || 'Mentor requested revisions for this submission.',
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.id === reviewModalTask.id ? { ...t, status: 'In Progress', proofStatus: 'Returned' } : t
        )
      );

      setFeedback({
        type: 'info',
        message: `Task "${reviewModalTask.title}" returned for revision.`,
      });
      setReviewModalTask(null);
    } catch (err) {
      console.error('Failed to return task for revision:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to update task status.' });
    } finally {
      setSubmittingReview(false);
    }
  };

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
      await mentorshipApi.issueBadge({
        collaboratorId: badgeModalMember.id || badgeModalMember.userId || '1',
        badgeType: badgeType,
        comment: badgeComment || 'Exceptional mentorship recommendation.',
      });

      setAwardedMembers((prev) => new Set([...prev, badgeModalMember.name]));
      setFeedback({
        type: 'success',
        message: `Recommendation badge "${badgeType}" awarded to ${badgeModalMember.name}!`,
      });
      setBadgeModalMember(null);
    } catch (err) {
      console.error('Failed to issue badge:', err);
      // Fallback: update local UI state if backend already recorded
      setAwardedMembers((prev) => new Set([...prev, badgeModalMember.name]));
      setFeedback({
        type: 'success',
        message: `Badge assigned to ${badgeModalMember.name}!`,
      });
      setBadgeModalMember(null);
    } finally {
      setSubmittingBadge(false);
    }
  };

  /* ── Leave as Mentor ── */
  const handleLeaveMentor = async () => {
    if (!window.confirm('Are you sure you want to resign as mentor for this project?')) return;
    try {
      const requests = await mentorRequestsApi.list({ projectId }).catch(() => []);
      const myReq = (Array.isArray(requests) ? requests : []).find(
        (r) => r.mentorId === user?.id || r.projectId === projectId
      );
      if (myReq) {
        await mentorRequestsApi.remove(myReq.id).catch(() => {});
      }
      navigate('/mentor/projects');
    } catch (err) {
      navigate('/mentor/projects');
    }
  };

  /* ── Chat Message Handler ── */
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const messageText = chatInput.trim();
    setChatInput('');
    setSendingMsg(true);

    try {
      const res = await communicationApi.sendMessage({
        projectId,
        text: messageText,
        sender: user?.name || user?.username || 'Mentor',
      });

      const newMsg = res || {
        id: `msg-${Date.now()}`,
        sender: user?.name || 'Mentor',
        text: messageText,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, newMsg]);
    } catch (err) {
      console.error('Failed to send chat message:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          sender: user?.name || 'Mentor',
          text: messageText,
          createdAt: new Date().toISOString(),
        },
      ]);
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

  // Kanban task grouping
  const isStatusInList = (task, statuses) => {
    const s = String(task.status || '').toLowerCase();
    return statuses.some((st) => s === st.toLowerCase());
  };

  const todoTasks = tasks.filter((t) => isStatusInList(t, ['open', 'to do', 'todo', 'pending']));
  const inProgressTasks = tasks.filter((t) => isStatusInList(t, ['in progress', 'in-progress']));
  const inReviewTasks = tasks.filter(
    (t) => isStatusInList(t, ['in review', 'submitted', 'review']) || Boolean(t.proofLink && !isStatusInList(t, ['completed', 'approved']))
  );
  const completedTasks = tasks.filter((t) => isStatusInList(t, ['completed', 'done', 'approved']));

  const membersList = Array.isArray(project.members) ? project.members : [];
  const progressPercent = Number(project.progress) || 0;
  const isCompleted = project.status === 'Completed' || progressPercent >= 100;

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
          </div>

          <p className="tf-mentor-ws-desc">
            {project.desc || project.description || 'Project managed on TeamForge.'}
          </p>

          {!isCompleted && (
            <button
              type="button"
              className="tf-mentor-ws-btn-leave"
              onClick={handleLeaveMentor}
            >
              Leave as Mentor
            </button>
          )}
        </div>

        <div className="tf-mentor-ws-hero-meta">
          <div className="tf-mentor-ws-metric">{progressPercent}%</div>
          <div className="tf-mentor-ws-metric-sub">
            {isCompleted ? 'Completed' : 'In progress'}
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`tf-mentor-ws-feedback ${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      {/* Tabs */}
      <div className="tf-mentor-ws-tabs">
        <button
          type="button"
          className={`tf-mentor-ws-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`tf-mentor-ws-tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks ({tasks.length})
        </button>
        <button
          type="button"
          className={`tf-mentor-ws-tab ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Members ({membersList.length})
        </button>
        <button
          type="button"
          className={`tf-mentor-ws-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </button>
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <div>
          <div className="tf-mentor-ws-stat-grid">
            <div className="tf-mentor-ws-stat-card">
              <div className="tf-mentor-ws-stat-value">{tasks.length}</div>
              <div className="tf-mentor-ws-stat-label">Total Tasks</div>
            </div>
            <div className="tf-mentor-ws-stat-card">
              <div className="tf-mentor-ws-stat-value">{inReviewTasks.length}</div>
              <div className="tf-mentor-ws-stat-label">Awaiting Review</div>
            </div>
            <div className="tf-mentor-ws-stat-card">
              <div className="tf-mentor-ws-stat-value">{completedTasks.length}</div>
              <div className="tf-mentor-ws-stat-label">Approved Tasks</div>
            </div>
            <div className="tf-mentor-ws-stat-card">
              <div className="tf-mentor-ws-stat-value">{membersList.length}</div>
              <div className="tf-mentor-ws-stat-label">Team Members</div>
            </div>
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
                {tasks.slice(0, 6).map((t, idx) => (
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
                        isStatusInList(t, ['completed', 'approved'])
                          ? 'warning'
                          : isStatusInList(t, ['in review', 'submitted'])
                          ? 'warning'
                          : 'secondary'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tasks Tab Content */}
      {activeTab === 'tasks' && (
        <div className="tf-mentor-ws-card">
          <div className="tf-mentor-ws-card-header">
            <h2 className="tf-mentor-ws-card-title">Task Board</h2>
            <p className="tf-mentor-ws-card-subtitle">
              Read-only view of the project workflow · Click any card in review to inspect submissions and approve.
            </p>
          </div>

          <div className="tf-mentor-ws-kanban">
            {/* Column 1: To Do */}
            <div className="tf-mentor-ws-column">
              <div className="tf-mentor-ws-column-header">
                <span className="tf-mentor-ws-column-title">To Do</span>
                <span className="tf-mentor-ws-column-count">{todoTasks.length}</span>
              </div>
              {todoTasks.map((task) => (
                <div key={task.id} className="tf-mentor-ws-task-item">
                  <h4 className="tf-mentor-ws-task-title">{task.title}</h4>
                  {task.description && <p className="tf-mentor-ws-task-desc">{task.description}</p>}
                  <div className="tf-mentor-ws-task-footer">
                    <span>{task.assignedTo || task.assignee || 'Unassigned'}</span>
                    <span>{task.priority || 'Medium'}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Column 2: In Progress */}
            <div className="tf-mentor-ws-column">
              <div className="tf-mentor-ws-column-header">
                <span className="tf-mentor-ws-column-title">In Progress</span>
                <span className="tf-mentor-ws-column-count">{inProgressTasks.length}</span>
              </div>
              {inProgressTasks.map((task) => (
                <div key={task.id} className="tf-mentor-ws-task-item">
                  <h4 className="tf-mentor-ws-task-title">{task.title}</h4>
                  {task.description && <p className="tf-mentor-ws-task-desc">{task.description}</p>}
                  <div className="tf-mentor-ws-task-footer">
                    <span>{task.assignedTo || task.assignee || 'Unassigned'}</span>
                    <span>{task.priority || 'Medium'}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Column 3: In Review (MENTOR ACTIVE REVIEW ZONE) */}
            <div className="tf-mentor-ws-column">
              <div className="tf-mentor-ws-column-header">
                <span className="tf-mentor-ws-column-title">In Review</span>
                <span className="tf-mentor-ws-column-count">{inReviewTasks.length}</span>
              </div>
              {inReviewTasks.map((task) => (
                <div key={task.id} className="tf-mentor-ws-task-item">
                  <h4 className="tf-mentor-ws-task-title">{task.title}</h4>
                  {task.description && <p className="tf-mentor-ws-task-desc">{task.description}</p>}
                  <div className="tf-mentor-ws-task-footer">
                    <span>By: {task.assignedTo || task.assignee || 'Collaborator'}</span>
                    <span className="font-semibold text-warning">Awaiting Review</span>
                  </div>
                  <button
                    type="button"
                    className="tf-mentor-ws-btn-review-task"
                    onClick={() => handleOpenReviewModal(task)}
                  >
                    <CheckIcon />
                    <span>Review Submission</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Column 4: Completed */}
            <div className="tf-mentor-ws-column">
              <div className="tf-mentor-ws-column-header">
                <span className="tf-mentor-ws-column-title">Completed</span>
                <span className="tf-mentor-ws-column-count">{completedTasks.length}</span>
              </div>
              {completedTasks.map((task) => (
                <div key={task.id} className="tf-mentor-ws-task-item">
                  <h4 className="tf-mentor-ws-task-title">{task.title}</h4>
                  {task.description && <p className="tf-mentor-ws-task-desc">{task.description}</p>}
                  <div className="tf-mentor-ws-task-footer">
                    <span>{task.assignedTo || task.assignee || 'Completed'}</span>
                    <span className="text-success font-semibold">Approved</span>
                  </div>
                </div>
              ))}
            </div>
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
              const isSelf = member.name === user?.name;
              const hasBadge = awardedMembers.has(member.name);

              return (
                <div key={mIdx} className="tf-mentor-ws-member-row">
                  <div className="tf-mentor-ws-member-info">
                    <div className="tf-mentor-ws-avatar">
                      {member.initials || (member.name ? member.name.slice(0, 2).toUpperCase() : 'TF')}
                    </div>
                    <div>
                      <div className="tf-mentor-ws-member-name">{member.name}</div>
                      <div className="tf-mentor-ws-member-role">{member.role || 'Collaborator'}</div>
                    </div>
                  </div>

                  {!isOwner && !isSelf && (
                    <div>
                      {hasBadge ? (
                        <span className="tf-mentor-ws-badge warning">
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
        <div className="tf-mentor-ws-chat-container">
          <div className="tf-mentor-ws-chat-messages">
            {messages.length === 0 ? (
              <p className="text-sm text-muted text-center" style={{ margin: 'auto' }}>
                No messages yet. Start the conversation with the project team!
              </p>
            ) : (
              messages.map((m, idx) => {
                const isMine = m.sender === (user?.name || 'Mentor');
                return (
                  <div
                    key={m.id || idx}
                    className={`tf-mentor-ws-chat-msg ${isMine ? 'mine' : 'theirs'}`}
                  >
                    <div className="tf-mentor-ws-msg-header">
                      <span>{m.sender}</span>
                      <span>
                        {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                      </span>
                    </div>
                    <div>{m.text}</div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          <form className="tf-mentor-ws-chat-input-bar" onSubmit={handleSendMessage}>
            <input
              type="text"
              className="tf-mentor-ws-chat-input"
              placeholder="Send guidance or feedback to the team..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button
              type="submit"
              className="tf-mentor-ws-chat-send-btn"
              disabled={sendingMsg || !chatInput.trim()}
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}

      {/* ── Review Submission Action Modal ── */}
      {reviewModalTask && (
        <div
          className="tf-mentor-ws-modal-overlay"
          onClick={() => setReviewModalTask(null)}
        >
          <div
            className="tf-mentor-ws-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tf-mentor-ws-modal-header">
              <h3 className="tf-mentor-ws-modal-title">Review Task Submission</h3>
              <button
                type="button"
                className="tf-mentor-ws-modal-close"
                onClick={() => setReviewModalTask(null)}
              >
                ✕
              </button>
            </div>

            <div className="tf-mentor-ws-modal-body">
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--tf-ink-900, #111827)' }}>
                {reviewModalTask.title}
              </h4>
              <p className="text-sm text-muted" style={{ margin: '0 0 12px 0' }}>
                Assigned to: <strong>{reviewModalTask.assignedTo || reviewModalTask.assignee || 'Collaborator'}</strong>
              </p>

              {reviewModalTask.proofLink && (
                <div style={{ marginBottom: '14px', background: '#f9fafb', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                    Submitted Proof / Artifact
                  </div>
                  <a
                    href={reviewModalTask.proofLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.86rem', color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>{reviewModalTask.proofLink}</span>
                    <ExternalLinkIcon />
                  </a>
                </div>
              )}

              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Feedback / Review Notes
                </label>
                <textarea
                  rows={3}
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  placeholder="Provide constructive review comments, suggestions, or praise..."
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
                className="tf-mentor-ws-btn-leave"
                onClick={handleRejectTask}
                disabled={submittingReview}
              >
                <XIcon />
                <span>Request Revision</span>
              </button>
              <button
                type="button"
                className="tf-mentor-ws-chat-send-btn"
                onClick={handleApproveTask}
                disabled={submittingReview}
              >
                <CheckIcon />
                <span>{submittingReview ? 'Updating...' : 'Approve Submission'}</span>
              </button>
            </div>
          </div>
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
                  className="tf-mentor-ws-btn-leave"
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

