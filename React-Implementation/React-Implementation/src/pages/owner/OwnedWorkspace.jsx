import { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import joinRequestsApi from '../../services/joinRequestsApi';
import communicationApi from '../../services/communicationApi';
import './ownedWorkspace.css';

/* ── Extracted SVG Sub-components ── */
const BackArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.6673 8H3.33398" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const OwnedWorkspace = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Create Task Modal state
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    xpReward: 50,
    assignee: '',
    difficulty: 'Medium',
  });
  const [creatingTask, setCreatingTask] = useState(false);

  // Publish Finished Project Modal state
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [finishedLink, setFinishedLink] = useState('');

  // Chat input state
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef(null);

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const [projData, tasksData, reqsData, msgsData] = await Promise.all([
        projectsApi.get(projectId).catch(() => null),
        tasksApi.list({ projectId }).catch(() => []),
        joinRequestsApi.list({ projectId }).catch(() => []),
        communicationApi.getMessages(projectId).catch(() => []),
      ]);

      setProject(projData);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setJoinRequests(Array.isArray(reqsData) ? reqsData : []);
      setMessages(Array.isArray(msgsData) ? msgsData : []);
      if (projData?.finishedLink) {
        setFinishedLink(projData.finishedLink);
      }
    } catch (err) {
      console.error('Failed to load owned project workspace:', err);
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
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    setCreatingTask(true);
    try {
      const newTask = await tasksApi.create({
        projectId,
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        xpReward: Number(taskForm.xpReward) || 50,
        assignee: taskForm.assignee || 'Unassigned',
        difficulty: taskForm.difficulty,
        status: 'To Do',
      });

      setTasks((prev) => [...prev, newTask]);
      setCreateTaskModalOpen(false);
      setTaskForm({
        title: '',
        description: '',
        xpReward: 50,
        assignee: '',
        difficulty: 'Medium',
      });
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleApproveTask = async (taskId) => {
    try {
      await tasksApi.updateStatus(taskId, { status: 'Completed' });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'Completed' } : t))
      );
    } catch (err) {
      console.error('Failed to approve task:', err);
    }
  };

  const handleRespondJoinRequest = async (requestId, status) => {
    try {
      const targetReq = joinRequests.find((r) => r.id === requestId);
      await joinRequestsApi.respond(requestId, status);

      if (status === 'Approved' && targetReq) {
        const existingCollabs = Array.isArray(project?.collaborators) ? project.collaborators : [];
        const isAlreadyAdded = existingCollabs.some(
          (c) => (typeof c === 'string' ? c === targetReq.userId || c === targetReq.userName : c.id === targetReq.userId)
        );
        if (!isAlreadyAdded) {
          const newCollab = {
            id: targetReq.userId,
            name: targetReq.userName || 'Collaborator',
            role: targetReq.role || 'Collaborator',
          };
          const updatedCollabs = [...existingCollabs, newCollab];
          await projectsApi.update(projectId, { collaborators: updatedCollabs }).catch(() => null);
        }
      }

      setJoinRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status } : r))
      );
      // Reload workspace to reflect member additions
      loadWorkspace();
    } catch (err) {
      console.error('Failed to respond to join request:', err);
    }
  };

  const handlePublishProject = async (e) => {
    e.preventDefault();
    try {
      await projectsApi.update(projectId, {
        status: 'Completed',
        progress: 100,
        finishedLink,
      });
      setProject((prev) => ({ ...prev, status: 'Completed', progress: 100, finishedLink }));
      setPublishModalOpen(false);
    } catch (err) {
      console.error('Failed to publish project:', err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || sendingMsg) return;
    setSendingMsg(true);

    try {
      const newMsg = await communicationApi.sendMessage({
        projectId,
        text: chatInput.trim(),
        senderName: user?.name || 'Project Owner',
      });

      setMessages((prev) => [
        ...prev,
        newMsg || {
          id: Date.now().toString(),
          text: chatInput.trim(),
          senderName: user?.name || 'You',
          senderId: user?.id,
          createdAt: new Date().toISOString(),
        },
      ]);
      setChatInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading) {
    return (
      <div className="tf-owned-ws-container">
        <div className="tf-owned-ws-card">
          <p>Loading project workspace...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="tf-owned-ws-container">
        <button
          type="button"
          className="tf-owned-ws-back-btn"
          onClick={() => navigate('/my-projects')}
        >
          <BackArrowIcon /> Back to My Projects
        </button>
        <div className="tf-owned-ws-card">
          <h2>Project not found</h2>
          <p>The requested project workspace does not exist or you do not have permission.</p>
        </div>
      </div>
    );
  }

  const existingMembers = Array.isArray(project.collaborators) ? project.collaborators : [];
  const approvedMembersFromReqs = joinRequests
    .filter((r) => r.status === 'Approved')
    .map((r) => ({ id: r.userId, name: r.userName || 'Collaborator', role: r.role || 'Collaborator' }));
  const memberMap = new Map();
  existingMembers.forEach((m) => {
    const key = typeof m === 'string' ? m : m.id || m.name;
    memberMap.set(key, m);
  });
  approvedMembersFromReqs.forEach((m) => {
    if (!memberMap.has(m.id) && !memberMap.has(m.name)) {
      memberMap.set(m.id, m);
    }
  });
  const members = Array.from(memberMap.values());
  const pendingRequests = joinRequests.filter((r) => r.status === 'Pending');
  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : (Number(project.progress) || 0);

  return (
    <div className="tf-owned-ws-container">
      <button
        type="button"
        className="tf-owned-ws-back-btn"
        onClick={() => navigate('/my-projects')}
      >
        <BackArrowIcon /> Back to My Projects
      </button>

      {/* Main Header Card */}
      <div className="tf-owned-ws-card">
        <div className="tf-owned-ws-header-row">
          <div className="tf-owned-ws-title-group">
            <div className="tf-owned-ws-title-flex">
              <h1 className="tf-owned-ws-title">{project.title || project.name}</h1>
              <span className="tf-owned-ws-owner-badge">Project Owner</span>
            </div>
            <p className="tf-owned-ws-desc">{project.description || project.desc}</p>
            <div className="tf-owned-ws-meta">
              Owned by <strong>{project.owner || 'You'}</strong> · {members.length} collaborators · {project.duration || 'Ongoing'}
            </div>
            <div className="tf-owned-ws-skills">
              {(project.skills || project.requiredSkills || []).map((s, i) => (
                <span key={i} className="tf-owned-ws-skill-tag">{s}</span>
              ))}
            </div>
          </div>

          <div className="tf-owned-ws-progress-box">
            <div className="tf-owned-ws-progress-info">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="tf-owned-ws-progress-bar">
              <div
                className="tf-owned-ws-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Workspace Toolbar & Tabs */}
        <div className="tf-owned-ws-toolbar">
          <div className="tf-owned-ws-tabs">
            <button
              type="button"
              className={`tf-owned-ws-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              className={`tf-owned-ws-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setActiveTab('tasks')}
            >
              Tasks ({tasks.length})
            </button>
            <button
              type="button"
              className={`tf-owned-ws-tab-btn ${activeTab === 'members' ? 'active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              Members ({members.length}) {pendingRequests.length > 0 && `(🔔 ${pendingRequests.length})`}
            </button>
            <button
              type="button"
              className={`tf-owned-ws-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              Chat
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="tf-owned-ws-btn-primary"
              onClick={() => setCreateTaskModalOpen(true)}
            >
              <PlusIcon /> Create Task
            </button>
            <button
              type="button"
              className="tf-owned-ws-btn-primary tf-owned-ws-btn-success"
              onClick={() => setPublishModalOpen(true)}
            >
              Publish Project
            </button>
          </div>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div>
            <h3>Project Overview</h3>
            <p className="tf-owned-ws-desc">{project.description || project.desc}</p>
            {project.objectives && (
              <div style={{ marginTop: '12px' }}>
                <h4>Key Objectives</h4>
                <p className="tf-owned-ws-desc">{project.objectives}</p>
              </div>
            )}
            <div className="tf-owned-ws-meta" style={{ marginTop: '16px' }}>
              <p>Mentor: <strong>{project.mentor || 'None assigned yet'}</strong></p>
              <p>Status: <strong>{project.status || 'Active'}</strong></p>
              {project.finishedLink && (
                <p>
                  Published Link:{' '}
                  <a href={project.finishedLink} target="_blank" rel="noopener noreferrer">
                    {project.finishedLink}
                  </a>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Tasks */}
        {activeTab === 'tasks' && (
          <div className="tf-owned-ws-tasks-list">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <div key={task.id} className="tf-owned-ws-task-card">
                  <div className="tf-owned-ws-task-left">
                    <h4 className="tf-owned-ws-task-title">{task.title}</h4>
                    <p className="tf-owned-ws-task-desc">{task.description}</p>
                    <div className="tf-owned-ws-task-meta">
                      <span className="tf-owned-ws-xp-badge">+{task.xpReward || 50} XP</span>
                      <span>Assignee: <strong>{task.assignee || 'Unassigned'}</strong></span>
                      <span>Status: <strong>{task.status || 'To Do'}</strong></span>
                    </div>
                  </div>

                  <div>
                    {task.proofUrl && task.status !== 'Completed' && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <a
                          href={task.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tf-owned-ws-btn-outline"
                        >
                          View Proof ↗
                        </a>
                        <button
                          type="button"
                          className="tf-owned-ws-btn-primary tf-owned-ws-btn-success"
                          onClick={() => handleApproveTask(task.id)}
                        >
                          Approve & Award XP
                        </button>
                      </div>
                    )}
                    {task.status === 'Completed' && (
                      <span className="tf-owned-ws-owner-badge">Completed ✓</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="tf-owned-ws-desc">
                No tasks created yet. Click "Create Task" above to add deliverables for your team!
              </p>
            )}
          </div>
        )}

        {/* Tab 3: Members & Join Requests */}
        {activeTab === 'members' && (
          <div>
            {pendingRequests.length > 0 && (
              <div className="tf-owned-ws-requests-section">
                <h4>🔔 Pending Join Requests ({pendingRequests.length})</h4>
                {pendingRequests.map((req) => (
                  <div key={req.id} className="tf-owned-ws-request-row">
                    <div>
                      <strong>User #{req.userId || 'Applicant'}</strong> applied for role{' '}
                      <em>{req.role || 'Collaborator'}</em>
                      {req.message && <p className="tf-owned-ws-desc" style={{ margin: '4px 0 0' }}>"{req.message}"</p>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="tf-owned-ws-btn-primary tf-owned-ws-btn-success"
                        onClick={() => handleRespondJoinRequest(req.id, 'Approved')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="tf-owned-ws-btn-outline"
                        onClick={() => handleRespondJoinRequest(req.id, 'Rejected')}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h3>Team Members ({members.length + 1})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              <div className="tf-owned-ws-task-card">
                <div>
                  <strong>{project.owner || 'You'}</strong> (Project Lead)
                </div>
                <span className="tf-owned-ws-owner-badge">Owner</span>
              </div>
              {members.map((member, i) => {
                const name = typeof member === 'string' ? member : member.name || 'Collaborator';
                return (
                  <div key={i} className="tf-owned-ws-task-card">
                    <div>
                      <strong>{name}</strong>
                    </div>
                    <span>Collaborator</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Chat */}
        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '420px' }}>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '14px',
                background: '#f9fafb',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '14px',
              }}
            >
              {messages.length > 0 ? (
                messages.map((msg, index) => {
                  const isMe = msg.senderId === user?.id || msg.senderName === user?.name;
                  return (
                    <div
                      key={msg.id || index}
                      style={{
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        background: isMe ? '#5f513f' : '#ffffff',
                        color: isMe ? '#ffffff' : '#111827',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        maxWidth: '75%',
                        border: isMe ? 'none' : '1px solid #e5e7eb',
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', opacity: 0.8, marginBottom: '4px' }}>
                        {isMe ? 'You (Owner)' : msg.senderName || 'Collaborator'}
                      </div>
                      <div>{msg.text || msg.message}</div>
                    </div>
                  );
                })
              ) : (
                <p className="tf-owned-ws-desc">No messages yet. Send a kickoff message to your team!</p>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="tf-owned-ws-input"
                placeholder="Type a message to the project team..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button
                type="submit"
                className="tf-owned-ws-btn-primary"
                disabled={sendingMsg || !chatInput.trim()}
              >
                <SendIcon />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {createTaskModalOpen && (
        <div
          className="tf-owned-ws-modal-overlay"
          onClick={() => setCreateTaskModalOpen(false)}
        >
          <div
            className="tf-owned-ws-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3>Create Task for Team</h3>
              <button
                type="button"
                className="tf-owned-ws-btn-outline"
                onClick={() => setCreateTaskModalOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div className="tf-owned-ws-form-group">
                <label className="tf-owned-ws-form-label">Task Title</label>
                <input
                  type="text"
                  className="tf-owned-ws-input"
                  placeholder="e.g. Implement OAuth Flow"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="tf-owned-ws-form-group">
                <label className="tf-owned-ws-form-label">Description</label>
                <textarea
                  className="tf-owned-ws-input"
                  rows={2}
                  placeholder="Detail requirements and deliverables..."
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="tf-owned-ws-form-group">
                  <label className="tf-owned-ws-form-label">XP Reward</label>
                  <input
                    type="number"
                    min={10}
                    max={200}
                    className="tf-owned-ws-input"
                    value={taskForm.xpReward}
                    onChange={(e) => setTaskForm({ ...taskForm, xpReward: e.target.value })}
                  />
                </div>

                <div className="tf-owned-ws-form-group">
                  <label className="tf-owned-ws-form-label">Difficulty</label>
                  <select
                    className="tf-owned-ws-input"
                    value={taskForm.difficulty}
                    onChange={(e) => setTaskForm({ ...taskForm, difficulty: e.target.value })}
                  >
                    <option value="Easy">Easy (10-30 XP)</option>
                    <option value="Medium">Medium (40-70 XP)</option>
                    <option value="Hard">Hard (80-120 XP)</option>
                  </select>
                </div>
              </div>

              <div className="tf-owned-ws-form-group">
                <label className="tf-owned-ws-form-label">Assignee (Optional)</label>
                <input
                  type="text"
                  className="tf-owned-ws-input"
                  placeholder="Collaborator name or leave blank for open claim"
                  value={taskForm.assignee}
                  onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="tf-owned-ws-btn-outline"
                  onClick={() => setCreateTaskModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tf-owned-ws-btn-primary"
                  disabled={creatingTask}
                >
                  {creatingTask ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish Finished Project Modal */}
      {publishModalOpen && (
        <div
          className="tf-owned-ws-modal-overlay"
          onClick={() => setPublishModalOpen(false)}
        >
          <div
            className="tf-owned-ws-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Publish Finished Project</h3>
            <p className="tf-owned-ws-desc">
              Mark this project as complete and publish the final live URL or GitHub repository.
            </p>

            <form onSubmit={handlePublishProject}>
              <div className="tf-owned-ws-form-group">
                <label className="tf-owned-ws-form-label">Live Project or Repo Link</label>
                <input
                  type="url"
                  className="tf-owned-ws-input"
                  placeholder="https://github.com/... or https://myapp.com"
                  value={finishedLink}
                  onChange={(e) => setFinishedLink(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="tf-owned-ws-btn-outline"
                  onClick={() => setPublishModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tf-owned-ws-btn-primary tf-owned-ws-btn-success"
                >
                  Complete & Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnedWorkspace;
