import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi, { isProjectLocked } from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import communicationApi from '../../services/communicationApi';
import TaskCard from '../../components/features/TaskCard';
import ChatBox from '../../components/features/ChatBox';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import EmptyState from '../../components/common/EmptyState';
import Avatar from '../../components/common/Avatar';
import ProgressBar from '../../components/common/ProgressBar';
import FilterTabs from '../../components/common/FilterTabs';
import { calculateProjectProgress } from '../../utils/progress';
import './collaboratorWorkspace.css';

const BackArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8.00065 12.6668L3.33398 8.00016L8.00065 3.3335" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.6673 8H3.33398" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
  const [proofUrlInput, setProofUrlInput] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [sendingMsg, setSendingMsg] = useState(false);

  // Leave project modal state
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  useEffect(() => {
    let isMounted = true;
    if (!projectId) return;

    const fetchWorkspace = async () => {
      try {
        const [projData, tasksData, msgsData] = await Promise.all([
          projectsApi.get(projectId).catch(() => null),
          tasksApi.list({ projectId }).catch(() => []),
          communicationApi.getMessages(projectId).catch(() => []),
        ]);
        if (isMounted) {
          setProject(projData);
          setTasks(Array.isArray(tasksData) ? tasksData : []);
          setMessages(Array.isArray(msgsData) ? msgsData : []);
        }
      } catch (err) {
        console.error('Failed to load project workspace:', err);
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

  const isLocked = isProjectLocked(project);

  const handleStartTask = async (taskId) => {
    if (isLocked) return;
    try {
      const updated = await tasksApi.updateStatus(taskId, { status: 'In Progress' });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...(updated || {}), status: 'In Progress' } : t))
      );
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (isLocked || !proofTask) return;
    setSubmittingProof(true);
    setFeedback(null);

    try {
      const finalUrl = proofUrlInput.trim();

      if (!finalUrl) {
        setFeedback({ type: 'error', message: 'Please provide a valid proof URL (e.g., GitHub pull request, Figma, or demo).' });
        setSubmittingProof(false);
        return;
      }

      // Validate URL format
      try {
        const parsed = new URL(finalUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error();
        }
      } catch {
        setFeedback({ type: 'error', message: 'Please enter a valid URL starting with http:// or https://' });
        setSubmittingProof(false);
        return;
      }

      const updated = await tasksApi.updateStatus(proofTask.id, {
        status: 'In Review',
        proofUrl: finalUrl,
        proofLink: finalUrl,
        notes: proofNotes,
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.id === proofTask.id
            ? { ...t, ...(updated || {}), status: 'In Review', proofUrl: finalUrl, proofLink: finalUrl, notes: proofNotes }
            : t
        )
      );

      setFeedback({ type: 'success', message: 'Proof submitted! Task is now In Review.' });
      setTimeout(() => {
        setProofTask(null);
        setProofUrlInput('');
        setProofNotes('');
        setFeedback(null);
      }, 1400);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to submit task proof.' });
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleSendMessage = async (text) => {
    setSendingMsg(true);
    try {
      const newMsg = await communicationApi.sendMessage({
        projectId,
        text,
        senderName: user?.name || 'Collaborator',
      }, 'Collaborator', user?.id);

      if (newMsg) {
        setMessages((prev) => [...prev, newMsg]);
      }

      const fresh = await communicationApi.getMessages(projectId);
      if (Array.isArray(fresh)) {
        setMessages(fresh);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleLeaveProject = async () => {
    if (isLocked || isOwner) return;
    setLeaving(true);
    setLeaveError('');
    try {
      await projectsApi.leave(projectId, 'Collaborator', user?.id);
      navigate('/my-work');
    } catch (err) {
      console.error('Failed to leave project:', err);
      setLeaveError(err.message || 'Failed to leave project.');
    } finally {
      setLeaving(false);
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

  const progress = calculateProjectProgress(tasks);
  const isOwner = project.owner === user?.name || project.ownerId === user?.id;
  const rawCollaborators = Array.isArray(project.collaborators) ? project.collaborators : [];
  const ownerName = typeof project.owner === 'object' && project.owner !== null
    ? (project.owner.name || project.owner.id || 'Project Owner')
    : (project.owner || 'Project Owner');
  const mentorName = typeof project.mentor === 'object' && project.mentor !== null
    ? (project.mentor.name || project.mentor.title || 'Assigned Mentor')
    : (project.mentor && project.mentor !== 'None assigned yet' ? project.mentor : null);
  const mentorObj = (mentorName || project.mentorId) ? {
    id: String(project.mentorId || 'mentor'),
    name: mentorName || 'Assigned Mentor',
    role: 'Mentor',
  } : null;
  const allMembers = [
    { id: String(project.ownerId || (typeof project.owner === 'object' ? project.owner?.id : '') || 'owner'), name: ownerName, role: 'Owner' },
    ...rawCollaborators.map((m, i) => {
      const id = typeof m === 'object' ? String(m.id || m.userId || `c-${i}`) : String(m);
      const name = typeof m === 'object' ? (m.name || id) : id;
      const role = typeof m === 'object' && m.role ? m.role : 'Collaborator';
      return { id, name, role };
    }),
    ...(mentorObj ? [mentorObj] : []),
  ];

  return (
    <div className="tf-collab-ws-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button
          type="button"
          className="tf-collab-ws-back-btn"
          style={{ marginBottom: 0 }}
          onClick={() => navigate('/my-work')}
        >
          <BackArrowIcon /> Back
        </button>
        {!isLocked && !isOwner && (
          <button
            type="button"
            className="tf-collab-ws-back-btn"
            style={{ marginBottom: 0, color: '#e11d48', borderColor: '#fecdd3' }}
            onClick={() => {
              setLeaveModalOpen(true);
              setLeaveError('');
            }}
          >
            Leave Project
          </button>
        )}
      </div>

      {/* Main Workspace Card */}
      <div className="tf-collab-ws-card">
        <div className="tf-collab-ws-header-row">
          <div className="tf-collab-ws-title-group">
            <div className="tf-collab-ws-title-flex">
              <h1 className="tf-collab-ws-title">{project.title || project.name}</h1>
              <span className="tf-collab-ws-role-badge">
                {isOwner ? 'Project Owner' : 'Collaborator'}
              </span>
              {isLocked && (
                <span className="tf-collab-ws-role-badge" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>
                  🔒 Locked / Completed
                </span>
              )}
            </div>
            <p className="tf-collab-ws-desc">{project.description || project.desc}</p>
            <div className="tf-collab-ws-meta">
              Owned by <strong>{ownerName}</strong>{mentorName ? <> · Mentor: <strong>{mentorName}</strong></> : null} · {allMembers.length} members
            </div>
            <div className="tf-collab-ws-skills">
              {(project.skills || project.requiredSkills || []).map((s, i) => (
                <span key={i} className="tf-collab-ws-skill-tag">{s}</span>
              ))}
            </div>
          </div>

          <div className="tf-collab-ws-progress-box">
            <ProgressBar value={progress} size="md" />
          </div>
        </div>

        {/* Workspace Tabs */}
        <FilterTabs
          className="mb-4"
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'tasks', label: 'Tasks', count: tasks.length },
            { id: 'members', label: 'Members', count: allMembers.length },
            { id: 'chat', label: 'Chat' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

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
              <p>Mentor: <strong>{mentorName || 'None assigned yet'}</strong></p>
              <p>Duration: <strong>{project.duration || 'Flexible'}</strong></p>
              {(project.finishedLink || project.finalLink) && (
                <p>
                  Published Link:{' '}
                  <a href={project.finishedLink || project.finalLink} target="_blank" rel="noopener noreferrer">
                    {project.finishedLink || project.finalLink}
                  </a>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Tasks (Rendered via TaskCard) */}
        {activeTab === 'tasks' && (
          <div className="tf-collab-ws-tasks-list">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  userRole="Collaborator"
                  isLocked={isLocked}
                  currentUserId={user?.id}
                  currentUserName={user?.name}
                  onStart={handleStartTask}
                  onSubmitProof={(t) => setProofTask(t)}
                />
              ))
            ) : (
              <EmptyState
                title="No tasks assigned yet"
                message="Your project owner hasn't published tasks for this workspace yet."
              />
            )}
          </div>
        )}

        {/* Tab 3: Members */}
        {activeTab === 'members' && (
          <div>
            <h4 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
              Project Members ({allMembers.length})
            </h4>
            <div className="tf-collab-ws-members-grid">
              <div className="tf-collab-ws-member-card">
                <Avatar name={ownerName} size="md" />
                <div className="tf-collab-ws-member-info">
                  <h4>{ownerName}</h4>
                  <p>Project Lead</p>
                </div>
              </div>

              {rawCollaborators.map((member, i) => {
                const name = typeof member === 'string' ? member : member.name || 'Collaborator';
                const role = typeof member === 'object' && member.role ? member.role : 'Collaborator';
                return (
                  <div key={i} className="tf-collab-ws-member-card">
                    <Avatar name={name} size="md" />
                    <div className="tf-collab-ws-member-info">
                      <h4>{name}</h4>
                      <p>{role}</p>
                    </div>
                  </div>
                );
              })}

              {mentorObj && (
                <div className="tf-collab-ws-member-card">
                  <Avatar name={mentorObj.name} size="md" />
                  <div className="tf-collab-ws-member-info">
                    <h4>{mentorObj.name}</h4>
                    <p>Project Mentor</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Chat (Rendered via reusable ChatBox) */}
        {activeTab === 'chat' && (
          <ChatBox
            messages={messages}
            currentUserId={user?.id}
            currentUserName={user?.name}
            currentUserRole="Collaborator"
            onSendMessage={handleSendMessage}
            onRefresh={() => communicationApi.getMessages(projectId).then((m) => Array.isArray(m) && setMessages(m)).catch(() => {})}
            sending={sendingMsg}
          />
        )}
      </div>

      {/* Task Proof Submission Modal */}
      <Modal
        isOpen={Boolean(proofTask)}
        title="Submit Task Proof"
        onClose={() => setProofTask(null)}
        footer={
          <>
            <button
              type="button"
              className="tf-collab-ws-btn-outline"
              onClick={() => setProofTask(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-collab-ws-btn-primary"
              disabled={submittingProof}
              onClick={handleSubmitProof}
            >
              {submittingProof ? 'Submitting...' : 'Submit for Review'}
            </button>
          </>
        }
      >
        {proofTask && (
          <div>
            <p className="tf-collab-ws-desc">
              Provide live URL or repository link for <strong>{proofTask.title}</strong> for owner review.
            </p>

            <FormInput
              label="Proof URL (Pull Request, Live Demo, Figma, etc.)"
              name="proofUrl"
              value={proofUrlInput}
              onChange={(e) => setProofUrlInput(e.target.value)}
              placeholder="https://github.com/... or https://..."
            />

            <FormInput
              label="Submission Notes (Optional)"
              name="proofNotes"
              value={proofNotes}
              onChange={(e) => setProofNotes(e.target.value)}
              placeholder="Provide context, pull request link, or notes for the owner..."
              multiline
              rows={3}
            />

            {feedback && (
              <div
                className={`tf-collab-ws-feedback ${
                  feedback.type === 'success'
                    ? 'tf-collab-ws-feedback-success'
                    : 'tf-collab-ws-feedback-error'
                }`}
              >
                {feedback.message}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal: Leave Project */}
      <Modal
        isOpen={leaveModalOpen}
        title="Leave Project"
        onClose={() => {
          if (!leaving) {
            setLeaveModalOpen(false);
            setLeaveError('');
          }
        }}
        footer={
          <>
            <button
              type="button"
              className="tf-collab-ws-btn-outline"
              disabled={leaving}
              onClick={() => {
                setLeaveModalOpen(false);
                setLeaveError('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-collab-ws-btn-primary"
              style={{ backgroundColor: '#e11d48', borderColor: '#e11d48' }}
              disabled={leaving}
              onClick={handleLeaveProject}
            >
              {leaving ? 'Leaving...' : 'Confirm Leave'}
            </button>
          </>
        }
      >
        <p className="tf-collab-ws-desc" style={{ marginBottom: '16px' }}>
          Are you sure you want to leave <strong>{project.title || project.name}</strong>?
        </p>
        <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: '1.4' }}>
          Any unapproved tasks assigned to you will be reset to <strong>Unassigned</strong> and <strong>Open</strong> so other contributors can pick them up. Tasks you already completed and their awarded XP/reputation will remain on your profile.
        </p>
        {leaveError && (
          <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '6px', backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', fontSize: '0.9rem' }}>
            {leaveError}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CollaboratorWorkspace;
