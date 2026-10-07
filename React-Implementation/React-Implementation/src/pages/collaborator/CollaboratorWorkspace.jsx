import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import communicationApi from '../../services/communicationApi';
import uploadsApi from '../../services/uploadsApi';
import './collaboratorWorkspace.css';

/* ── Extracted SVG Sub-components ── */
const BackArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.6673 8H3.33398" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UploadCloudIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const CollaboratorWorkspace = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Proof submission modal state
  const [proofTask, setProofTask] = useState(null);
  const [selectedProofFile, setSelectedProofFile] = useState(null);
  const [proofNotes, setProofNotes] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Chat input state
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (projectId) {
      loadWorkspace();
    }
  }, [projectId]);

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
      console.error('Failed to load project workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTask = async (taskId) => {
    try {
      await tasksApi.updateStatus(taskId, { status: 'In Progress' });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'In Progress' } : t))
      );
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (!proofTask) return;
    setSubmittingProof(true);
    setFeedback(null);

    try {
      let fileUrl = '';
      if (selectedProofFile) {
        const uploadRes = await uploadsApi.uploadTaskProof(selectedProofFile);
        fileUrl = uploadRes?.url || '';
      }

      // Update task to completed with optional submission details
      await tasksApi.updateStatus(proofTask.id, {
        status: 'Completed',
        proofUrl: fileUrl,
        notes: proofNotes,
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.id === proofTask.id ? { ...t, status: 'Completed', proofUrl: fileUrl } : t
        )
      );

      setFeedback({ type: 'success', message: 'Proof submitted! Task marked Completed.' });
      setTimeout(() => {
        setProofTask(null);
        setSelectedProofFile(null);
        setProofNotes('');
        setFeedback(null);
      }, 1400);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to submit task proof.' });
    } finally {
      setSubmittingProof(false);
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
        senderName: user?.name || 'Collaborator',
      });

      setMessages((prev) => [...prev, newMsg || {
        id: Date.now().toString(),
        text: chatInput.trim(),
        senderName: user?.name || 'You',
        senderId: user?.id,
        createdAt: new Date().toISOString(),
      }]);
      setChatInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading) {
    return (
      <div className="tf-collab-ws-container">
        <div className="tf-collab-ws-card">
          <p>Loading project workspace...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="tf-collab-ws-container">
        <button
          type="button"
          className="tf-collab-ws-back-btn"
          onClick={() => navigate('/my-work')}
        >
          <BackArrowIcon /> Back to My Work
        </button>
        <div className="tf-collab-ws-card">
          <h2>Project not found</h2>
          <p>The requested project workspace does not exist or you do not have permission.</p>
        </div>
      </div>
    );
  }

  const progress = Number(project.progress) || 0;
  const isOwner = project.owner === user?.name || project.ownerId === user?.id;
  const members = Array.isArray(project.collaborators) ? project.collaborators : [];

  return (
    <div className="tf-collab-ws-container">
      <button
        type="button"
        className="tf-collab-ws-back-btn"
        onClick={() => navigate('/my-work')}
      >
        <BackArrowIcon /> Back
      </button>

      {/* Main Workspace Card */}
      <div className="tf-collab-ws-card">
        <div className="tf-collab-ws-header-row">
          <div className="tf-collab-ws-title-group">
            <div className="tf-collab-ws-title-flex">
              <h1 className="tf-collab-ws-title">{project.title || project.name}</h1>
              <span className="tf-collab-ws-role-badge">
                {isOwner ? 'Project Owner' : 'Collaborator'}
              </span>
            </div>
            <p className="tf-collab-ws-desc">{project.description || project.desc}</p>
            <div className="tf-collab-ws-meta">
              Owned by <strong>{project.owner || 'Lead'}</strong> · {members.length + 1} members
            </div>
            <div className="tf-collab-ws-skills">
              {(project.skills || project.requiredSkills || []).map((s, i) => (
                <span key={i} className="tf-collab-ws-skill-tag">{s}</span>
              ))}
            </div>
          </div>

          <div className="tf-collab-ws-progress-box">
            <div className="tf-collab-ws-progress-info">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="tf-collab-ws-progress-bar">
              <div
                className="tf-collab-ws-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Workspace Tabs */}
        <div className="tf-collab-ws-tabs">
          <button
            type="button"
            className={`tf-collab-ws-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`tf-collab-ws-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            Tasks ({tasks.length})
          </button>
          <button
            type="button"
            className={`tf-collab-ws-tab-btn ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Members ({members.length + 1})
          </button>
          <button
            type="button"
            className={`tf-collab-ws-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div>
            <h3>Project Overview</h3>
            <p className="tf-collab-ws-desc">
              {project.description || project.desc}
            </p>
            {project.objectives && (
              <div>
                <h4>Key Objectives</h4>
                <p className="tf-collab-ws-desc">{project.objectives}</p>
              </div>
            )}
            <div className="tf-collab-ws-meta">
              <p>Mentor: <strong>{project.mentor || 'None assigned yet'}</strong></p>
              <p>Duration: <strong>{project.duration || 'Flexible'}</strong></p>
            </div>
          </div>
        )}

        {/* Tab 2: Tasks */}
        {activeTab === 'tasks' && (
          <div className="tf-collab-ws-tasks-list">
            {tasks.length > 0 ? (
              tasks.map((task) => {
                const isMyTask = task.assigneeId === user?.id || task.assignee === user?.name;
                return (
                  <div key={task.id} className="tf-collab-ws-task-card">
                    <div className="tf-collab-ws-task-left">
                      <h4 className="tf-collab-ws-task-title">{task.title}</h4>
                      <p className="tf-collab-ws-task-desc">{task.description}</p>
                      <div className="tf-collab-ws-task-meta">
                        <span className="tf-collab-ws-xp-badge">+{task.xpReward || 50} XP</span>
                        <span>Assignee: <strong>{task.assignee || 'Unassigned'}</strong></span>
                        <span>Status: <strong>{task.status || 'To Do'}</strong></span>
                      </div>
                    </div>

                    <div className="tf-collab-ws-task-right">
                      {isMyTask && task.status === 'To Do' && (
                        <button
                          type="button"
                          className="tf-collab-ws-btn-primary"
                          onClick={() => handleStartTask(task.id)}
                        >
                          Start Task
                        </button>
                      )}
                      {isMyTask && task.status === 'In Progress' && (
                        <button
                          type="button"
                          className="tf-collab-ws-btn-primary"
                          onClick={() => setProofTask(task)}
                        >
                          <UploadCloudIcon /> Submit Proof
                        </button>
                      )}
                      {task.status === 'Completed' && (
                        <span className="tf-collab-ws-role-badge">Completed ✓</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="tf-collab-ws-desc">No tasks available for this project yet.</p>
            )}
          </div>
        )}

        {/* Tab 3: Members */}
        {activeTab === 'members' && (
          <div className="tf-collab-ws-members-grid">
            <div className="tf-collab-ws-member-card">
              <div className="tf-collab-ws-avatar">
                {(project.owner || 'O').slice(0, 2).toUpperCase()}
              </div>
              <div className="tf-collab-ws-member-info">
                <h4>{project.owner || 'Project Owner'}</h4>
                <p>Project Lead</p>
              </div>
            </div>

            {members.map((member, i) => {
              const name = typeof member === 'string' ? member : member.name || 'Collaborator';
              const role = typeof member === 'object' && member.role ? member.role : 'Collaborator';
              return (
                <div key={i} className="tf-collab-ws-member-card">
                  <div className="tf-collab-ws-avatar">
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="tf-collab-ws-member-info">
                    <h4>{name}</h4>
                    <p>{role}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 4: Chat */}
        {activeTab === 'chat' && (
          <div className="tf-collab-ws-chat-container">
            <div className="tf-collab-ws-messages-feed">
              {messages.length > 0 ? (
                messages.map((msg, index) => {
                  const isMe = msg.senderId === user?.id || msg.senderName === user?.name;
                  return (
                    <div
                      key={msg.id || index}
                      className={`tf-collab-ws-msg-bubble ${
                        isMe ? 'tf-collab-ws-msg-me' : 'tf-collab-ws-msg-other'
                      }`}
                    >
                      <div className="tf-collab-ws-msg-author">
                        {isMe ? 'You' : msg.senderName || 'Team Member'}
                      </div>
                      <div>{msg.text || msg.message}</div>
                    </div>
                  );
                })
              ) : (
                <p className="tf-collab-ws-desc">No messages yet. Start the conversation!</p>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="tf-collab-ws-chat-input-bar">
              <input
                type="text"
                className="tf-collab-ws-chat-input"
                placeholder="Type a message to the team..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button
                type="submit"
                className="tf-collab-ws-btn-primary"
                disabled={sendingMsg || !chatInput.trim()}
              >
                <SendIcon />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Task Proof Submission Modal */}
      {proofTask && (
        <div
          id="modal-task-proof"
          className="tf-collab-ws-modal-overlay"
          onClick={() => setProofTask(null)}
        >
          <div
            className="tf-collab-ws-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Submit Task Proof</h3>
            <p className="tf-collab-ws-desc">
              Upload evidence for <strong>{proofTask.title}</strong> to mark it complete.
            </p>

            <form onSubmit={handleSubmitProof}>
              <div className="tf-collab-ws-form-group">
                <label className="tf-collab-ws-form-label">
                  Proof File (Image, PDF, ZIP — max 5MB)
                </label>
                <input
                  type="file"
                  className="tf-collab-ws-file-input"
                  accept="image/*,application/pdf,.zip"
                  onChange={(e) => setSelectedProofFile(e.target.files[0])}
                />
              </div>

              <div className="tf-collab-ws-form-group">
                <label className="tf-collab-ws-form-label">
                  PR Link or Live Demo URL (optional)
                </label>
                <input
                  type="text"
                  className="tf-collab-ws-chat-input"
                  placeholder="https://github.com/... or https://demo.com"
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value)}
                />
              </div>

              {feedback && (
                <p className="tf-collab-ws-meta">{feedback.message}</p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="tf-collab-ws-btn-outline"
                  onClick={() => setProofTask(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tf-collab-ws-btn-primary"
                  disabled={submittingProof}
                >
                  {submittingProof ? 'Uploading...' : 'Submit & Complete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaboratorWorkspace;
