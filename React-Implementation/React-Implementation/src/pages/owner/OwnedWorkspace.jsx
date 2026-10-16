import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import projectsApi, { isProjectLocked } from '../../services/projectsApi';
import tasksApi from '../../services/tasksApi';
import joinRequestsApi from '../../services/joinRequestsApi';
import communicationApi from '../../services/communicationApi';
import TaskCard from '../../components/features/TaskCard';
import JoinRequestCard from '../../components/features/JoinRequestCard';
import ChatBox from '../../components/features/ChatBox';
import Modal from '../../components/common/Modal';
import FormInput from '../../components/common/FormInput';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import ProgressBar from '../../components/common/ProgressBar';
import FilterTabs from '../../components/common/FilterTabs';
import { calculateProjectProgress } from '../../utils/progress';
import { getTaskReward } from '../../utils/workflow';
import './ownedWorkspace.css';

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
    priority: 'Medium',
    xpReward: 20,
    assigneeId: '',
    assigneeName: '',
    assignee: '',
    difficulty: 'Medium',
  });
  const [creatingTask, setCreatingTask] = useState(false);

  // Publish Finished Project Modal state
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [finishedLink, setFinishedLink] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Remove Member Modal state
  const [removeMemberTarget, setRemoveMemberTarget] = useState(null);
  const [removeReason, setRemoveReason] = useState('');
  const [removingMember, setRemovingMember] = useState(false);
  const [removeError, setRemoveError] = useState('');

  useEffect(() => {
    let isMounted = true;
    if (!projectId) return;

    const fetchWorkspace = async () => {
      try {
        const [projData, tasksData, reqsData, msgsData] = await Promise.all([
          projectsApi.get(projectId).catch(() => null),
          tasksApi.list({ projectId }).catch(() => []),
          joinRequestsApi.list({ projectId }).catch(() => []),
          communicationApi.getMessages(projectId).catch(() => []),
        ]);

        if (isMounted) {
          if (
            projData &&
            (projData.isCompleted || String(projData.status).toLowerCase() === 'completed') &&
            !projData.finalLink &&
            !projData.finishedLink
          ) {
            projData.isCompleted = false;
            projData.status = 'In Progress';
          }
          setProject(projData);
          setTasks(Array.isArray(tasksData) ? tasksData : []);
          setJoinRequests(Array.isArray(reqsData) ? reqsData : []);
          setMessages(Array.isArray(msgsData) ? msgsData : []);
          if (projData?.finishedLink || projData?.finalLink) {
            setFinishedLink(projData.finishedLink || projData.finalLink);
          }
        }
      } catch (err) {
        console.error('Failed to load owned project workspace:', err);
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

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (isLocked || !taskForm.title.trim()) return;

    setCreatingTask(true);
    try {
      const priority = taskForm.priority || 'Medium';
      const reward = getTaskReward(priority);
      const xpReward = reward.xp;
      const selectedMember = members.find((m) => {
        const mId = m.id || m.userId;
        return String(mId) === String(taskForm.assigneeId);
      });
      const assigneeId = selectedMember ? String(selectedMember.id || selectedMember.userId) : (taskForm.assigneeId || undefined);
      const assigneeName = selectedMember?.name || (taskForm.assigneeId ? taskForm.assignee : 'Unassigned');

      const newTask = await tasksApi.create({
        projectId,
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        priority,
        xpReward,
        assigneeId: assigneeId || undefined,
        assigneeName: assigneeName || 'Unassigned',
        assignee: assigneeName || 'Unassigned',
        difficulty: taskForm.difficulty || priority,
        status: 'To Do',
      });

      setTasks((prev) => [...prev, newTask]);
      setCreateTaskModalOpen(false);
      setTaskForm({
        title: '',
        description: '',
        priority: 'Medium',
        xpReward: 20,
        assigneeId: '',
        assigneeName: '',
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
    if (isLocked) return;
    try {
      const taskObj = tasks.find((t) => t.id === taskId);
      const reward = getTaskReward(taskObj?.priority || taskObj?.difficulty);
      await tasksApi.updateStatus(taskId, { status: 'Completed' });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'Completed', xpAwarded: true, xpReward: reward.xp } : t))
      );
    } catch (err) {
      console.error('Failed to approve task:', err);
    }
  };

  const handleRejectTask = async (taskId) => {
    if (isLocked) return;
    try {
      await tasksApi.updateStatus(taskId, { status: 'Open' });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'Open' } : t))
      );
    } catch (err) {
      console.error('Failed to reject task:', err);
    }
  };

  const handleAssignTask = async (taskId, assigneeId, assigneeName) => {
    if (isLocked) return;
    try {
      const payload = {
        assigneeId: assigneeId || undefined,
        assigneeName: assigneeName || 'Unassigned',
        assignee: assigneeName || 'Unassigned',
      };
      const updated = await tasksApi.update(taskId, payload);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                ...(updated || {}),
                assigneeId: assigneeId || '',
                assigneeName: assigneeName || 'Unassigned',
                assignee: assigneeName || 'Unassigned',
              }
            : t
        )
      );
    } catch (err) {
      console.error('Failed to assign task:', err);
    }
  };

  const handleRespondJoinRequest = async (requestId, status) => {
    if (isLocked) return;
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
          setProject((prev) => (prev ? { ...prev, collaborators: updatedCollabs } : prev));
        }
      }

      setJoinRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status } : r))
      );
    } catch (err) {
      console.error('Failed to respond to join request:', err);
    }
  };

  const handlePublishProject = async (e) => {
    e.preventDefault();
    setPublishError('');
    if (isLocked) {
      setPublishError('Project is already completed and locked.');
      return;
    }

    const trimmed = (finishedLink || '').trim();
    if (!trimmed) {
      setPublishError('Please enter a valid final project URL.');
      return;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error();
      }
    } catch {
      setPublishError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    const unapproved = tasks.filter(
      (t) => t.status !== 'Completed' && String(t.status || '').toLowerCase() !== 'completed'
    );
    if (unapproved.length > 0) {
      setPublishError(
        `All project tasks must be approved before completing the project (${unapproved.length} task${unapproved.length > 1 ? 's' : ''} remaining).`
      );
      return;
    }

    setPublishing(true);
    try {
      const res = await projectsApi.complete(projectId, {
        finalLink: trimmed,
        finishedLink: trimmed,
      });

      const completedAt = res?.completedAt || new Date().toISOString();

      // Rule 6: Completion writes the final state before re-rendering
      setProject((prev) => ({
        ...prev,
        status: 'Completed',
        progress: 100,
        finishedLink: trimmed,
        finalLink: trimmed,
        isCompleted: true,
        completedAt,
      }));

      // Rule 6: Applied rows that were Approved become Completed
      setJoinRequests((prev) =>
        prev.map((r) =>
          String(r.status || '').toLowerCase() === 'approved'
            ? { ...r, status: 'Completed' }
            : r
        )
      );

      setPublishModalOpen(false);
      setPublishError('');
    } catch (err) {
      setPublishError(err?.message || 'Failed to publish project.');
      console.error('Failed to publish project:', err);
    } finally {
      setPublishing(false);
    }
  };

  const handleOpenRemoveMember = (member) => {
    setRemoveMemberTarget(member);
    setRemoveReason('');
    setRemoveError('');
  };

  const handleConfirmRemoveMember = async (e) => {
    if (e) e.preventDefault();
    if (!removeMemberTarget || isLocked) return;
    const trimmed = removeReason.trim();
    if (trimmed.length < 10) {
      setRemoveError('Reason must be at least 10 characters long.');
      return;
    }

    const memberId =
      typeof removeMemberTarget === 'object' && removeMemberTarget !== null
        ? removeMemberTarget.id || removeMemberTarget.userId || removeMemberTarget.name
        : removeMemberTarget;
    const memberName =
      typeof removeMemberTarget === 'object' && removeMemberTarget !== null
        ? removeMemberTarget.name || removeMemberTarget.id
        : removeMemberTarget;

    setRemovingMember(true);
    setRemoveError('');
    try {
      await projectsApi.removeMember(projectId, memberId, trimmed, 'Project Owner', user?.id);

      // 1. Update local members
      setProject((prev) => {
        if (!prev) return prev;
        const currentCollabs = Array.isArray(prev.collaborators) ? prev.collaborators : [];
        const nextCollabs = currentCollabs.filter((c) => {
          if (typeof c === 'string') return c !== memberId && c !== memberName;
          return c.id !== memberId && c.name !== memberName && c.userId !== memberId;
        });
        const currentRemoved = Array.isArray(prev.removedUsers) ? prev.removedUsers : [];
        return {
          ...prev,
          collaborators: nextCollabs,
          removedUsers: [
            ...currentRemoved,
            { userId: memberId, userName: memberName, reason: trimmed, removedAt: new Date().toISOString() },
          ],
        };
      });

      // 2. Reset unapproved tasks assigned to this member to Unassigned and Open
      setTasks((prev) =>
        prev.map((t) => {
          const isAssigned =
            t.assignee === memberName ||
            t.assignee === memberId ||
            t.assigneeId === memberId;
          const isNotCompleted =
            t.status !== 'Completed' && String(t.status || '').toLowerCase() !== 'completed';
          if (isAssigned && isNotCompleted) {
            return {
              ...t,
              assignee: 'Unassigned',
              assigneeId: null,
              status: 'Open',
            };
          }
          return t;
        })
      );

      setRemoveMemberTarget(null);
      setRemoveReason('');
    } catch (err) {
      console.error('Failed to remove member:', err);
      setRemoveError(err.message || 'Failed to remove member.');
    } finally {
      setRemovingMember(false);
    }
  };

  const handleSendMessage = async (text) => {
    setSendingMsg(true);
    try {
      const newMsg = await communicationApi.sendMessage({
        projectId,
        text,
        senderName: user?.name || 'Project Owner',
      }, 'Project Owner', user?.id);

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
    .filter((r) => r && (r.status === 'Approved' || r.status === 'approved'))
    .map((r) => ({ id: String(r.userId), name: r.userName || 'Collaborator', role: r.role || 'Collaborator' }));
  const memberMap = new Map();
  existingMembers.forEach((m) => {
    if (!m) return;
    if (typeof m === 'object') {
      const id = String(m.id || m.userId || m.name);
      const name = m.name || m.id || m.userId || 'Collaborator';
      memberMap.set(id, { ...m, id, name, role: m.role || 'Collaborator' });
    } else {
      const str = String(m);
      memberMap.set(str, { id: str, name: str, role: 'Collaborator' });
    }
  });
  approvedMembersFromReqs.forEach((m) => {
    if (!m) return;
    if (!memberMap.has(m.id)) {
      memberMap.set(m.id, m);
    }
  });
  const members = Array.from(memberMap.values());
  const ownerName = typeof project.owner === 'object' && project.owner !== null
    ? (project.owner.name || project.owner.id || 'You')
    : (project.owner || 'You');
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
    ...members,
    ...(mentorObj ? [mentorObj] : []),
  ];
  const pendingRequests = joinRequests.filter((r) => r && r.status === 'Pending');
  const unapprovedTasks = tasks.filter(
    (t) => t && t.status !== 'Completed' && String(t.status || '').toLowerCase() !== 'completed'
  );
  const allTasksApproved = unapprovedTasks.length === 0;
  const progress = calculateProjectProgress(tasks);

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
              Owned by <strong>{ownerName}</strong>{mentorName ? <> · Mentor: <strong>{mentorName}</strong></> : null} · {allMembers.length} members · {project.duration || 'Ongoing'}
            </div>
            <div className="tf-owned-ws-skills">
              {(project.skills || project.requiredSkills || []).map((s, i) => (
                <span key={i} className="tf-owned-ws-skill-tag">
                  {typeof s === 'object' && s !== null ? (s.name || s.title || String(s)) : String(s)}
                </span>
              ))}
            </div>
          </div>

          <div className="tf-owned-ws-progress-box">
            <ProgressBar value={progress} size="md" />
          </div>
        </div>

        {/* Hint banner when all tasks are approved but project is not yet published */}
        {!isLocked && allTasksApproved && tasks.length > 0 && (
          <div style={{ marginBottom: '16px', padding: '12px 18px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>🎉 All tasks approved. Publish the project to finish!</span>
            <button
              type="button"
              className="tf-owned-ws-btn-primary tf-owned-ws-btn-success"
              onClick={() => setPublishModalOpen(true)}
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              Publish Project
            </button>
          </div>
        )}

        {/* Workspace Toolbar & Tabs */}
        <div className="tf-owned-ws-toolbar">
          <FilterTabs
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'tasks', label: 'Tasks', count: tasks.length },
              { id: 'members', label: pendingRequests.length > 0 ? `Members (🔔 ${pendingRequests.length})` : 'Members', count: allMembers.length },
              { id: 'chat', label: 'Chat' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          <div style={{ display: 'flex', gap: '8px' }}>
            {!isLocked && (
              <>
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
              </>
            )}
            {isLocked && (
              <span className="tf-owned-ws-owner-badge" style={{ alignSelf: 'center', backgroundColor: '#e2e8f0', color: '#475569' }}>
                🔒 Locked / Completed
              </span>
            )}
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
              <p>Mentor: <strong>{mentorName || 'None assigned yet'}</strong></p>
              <p>Status: <strong>{project.status || 'Active'}</strong></p>
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
          <div className="tf-owned-ws-tasks-list">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  userRole="Project Owner"
                  isLocked={isLocked}
                  members={members}
                  onAssign={handleAssignTask}
                  onApprove={handleApproveTask}
                  onReject={handleRejectTask}
                />
              ))
            ) : (
              <EmptyState
                title="No tasks created yet"
                message={isLocked ? "No tasks were recorded for this project." : "Click 'Create Task' above to assign deliverables to your team members."}
                actionLabel={!isLocked ? "Create First Task" : undefined}
                onAction={!isLocked ? () => setCreateTaskModalOpen(true) : undefined}
              />
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
                  <JoinRequestCard
                    key={req.id}
                    request={req}
                    isLocked={isLocked}
                    onAccept={(id) => handleRespondJoinRequest(id, 'Approved')}
                    onReject={(id) => handleRespondJoinRequest(id, 'Rejected')}
                  />
                ))}
              </div>
            )}

            <h4 style={{ marginTop: '24px', marginBottom: '12px', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
              Project Members ({allMembers.length})
            </h4>
            <div className="tf-owned-ws-members-grid">
              {/* Owner first */}
              <div className="tf-owned-ws-member-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Avatar name={ownerName} size="md" />
                  <div>
                    <h4 className="tf-owned-ws-member-name">{ownerName}</h4>
                    <p className="tf-owned-ws-member-role">Project Lead</p>
                  </div>
                </div>
                <Badge variant="success">Owner</Badge>
              </div>

              {/* Accepted Collaborators */}
              {members.length > 0 && (
                members.map((member, i) => {
                  if (!member) return null;
                  const name = typeof member === 'string' ? member : (member.name || member.id || 'Collaborator');
                  const role = typeof member === 'object' && member.role ? member.role : 'Collaborator';
                  return (
                    <div key={i} className="tf-owned-ws-member-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Avatar name={name || 'Collaborator'} size="md" />
                        <div>
                          <h4 className="tf-owned-ws-member-name">{name}</h4>
                          <p className="tf-owned-ws-member-role">{role}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Badge variant="info">Collaborator</Badge>
                        {!isLocked && (
                          <button
                            type="button"
                            className="tf-owned-ws-btn-outline"
                            style={{ color: '#e11d48', borderColor: '#fecdd3', fontSize: '0.85rem', padding: '6px 14px' }}
                            onClick={() => handleOpenRemoveMember(member)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Mentor */}
              {mentorObj && (
                <div className="tf-owned-ws-member-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Avatar name={mentorObj.name} size="md" />
                    <div>
                      <h4 className="tf-owned-ws-member-name">{mentorObj.name}</h4>
                      <p className="tf-owned-ws-member-role">Project Mentor</p>
                    </div>
                  </div>
                  <Badge variant="warning">Mentor</Badge>
                </div>
              )}

              {members.length === 0 && !mentorObj && (
                <EmptyState
                  title="No collaborators yet"
                  message="Pending applicants will appear in requests above. When approved, team members show up here."
                />
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Chat (Rendered via reusable ChatBox) */}
        {activeTab === 'chat' && (
          <ChatBox
            messages={messages}
            currentUserId={user?.id}
            currentUserName={user?.name || 'Project Owner'}
            currentUserRole="Owner"
            onSendMessage={handleSendMessage}
            onRefresh={() => communicationApi.getMessages(projectId).then((m) => Array.isArray(m) && setMessages(m)).catch(() => {})}
            sending={sendingMsg}
          />
        )}
      </div>

      {/* Modal: Create Task */}
      <Modal
        isOpen={createTaskModalOpen}
        title="Create New Task"
        onClose={() => setCreateTaskModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="tf-owned-ws-btn-outline"
              onClick={() => setCreateTaskModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-owned-ws-btn-primary"
              disabled={creatingTask}
              onClick={handleCreateTask}
            >
              {creatingTask ? 'Creating...' : 'Create Task'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateTask}>
          <FormInput
            label="Task Title"
            name="taskTitle"
            value={taskForm.title}
            onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. Implement user authentication API"
            required
          />

          <FormInput
            label="Description"
            name="taskDesc"
            value={taskForm.description}
            onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Detailed requirements or deliverables..."
            multiline
            rows={3}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="tf-form-group">
              <label className="tf-form-label">Priority</label>
              <select
                className="tf-form-control"
                value={taskForm.priority || 'Medium'}
                onChange={(e) => {
                  const prio = e.target.value;
                  setTaskForm((prev) => ({
                    ...prev,
                    priority: prio,
                    difficulty: prio,
                    xpReward: getTaskReward(prio).xp,
                  }));
                }}
              >
                <option value="High">High (40 XP, +8 Rep)</option>
                <option value="Medium">Medium (20 XP, +8 Rep)</option>
                <option value="Low">Low (10 XP, +8 Rep)</option>
              </select>
            </div>

            <FormInput
              label="XP Reward"
              name="taskXp"
              type="number"
              value={taskForm.xpReward}
              disabled
              readOnly
              helperText="Set by Priority (+8 Reputation)"
            />
          </div>

          <div className="tf-form-group">
            <label className="tf-form-label">Assignee</label>
            <select
              className="tf-form-control"
              value={taskForm.assigneeId || ''}
              onChange={(e) => {
                const val = e.target.value;
                const member = members.find((m) => String(m.id || m.userId) === String(val));
                setTaskForm((prev) => ({
                  ...prev,
                  assigneeId: val,
                  assigneeName: member?.name || 'Unassigned',
                  assignee: member?.name || 'Unassigned',
                }));
              }}
            >
              <option value="">Unassigned</option>
              {members.map((m, i) => {
                if (!m) return null;
                const mId = m.id || m.userId || `mem-${i}`;
                const name = typeof m === 'string' ? m : (m.name || m.id || 'Collaborator');
                return (
                  <option key={String(mId) || i} value={String(mId)}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>
        </form>
      </Modal>

      {/* Modal: Publish Project */}
      <Modal
        isOpen={publishModalOpen}
        title="Publish Finished Project"
        onClose={() => {
          setPublishModalOpen(false);
          setPublishError('');
        }}
        footer={
          <>
            <button
              type="button"
              className="tf-owned-ws-btn-outline"
              onClick={() => {
                setPublishModalOpen(false);
                setPublishError('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tf-owned-ws-btn-primary tf-owned-ws-btn-success"
              disabled={isLocked || !allTasksApproved || publishing}
              onClick={handlePublishProject}
            >
              {publishing ? 'Publishing...' : 'Publish & Complete'}
            </button>
          </>
        }
      >
        <form onSubmit={handlePublishProject}>
          <p className="tf-owned-ws-desc">
            Publishing marks the project 100% complete and finalizes contributions for all team members. Once completed, the project will be locked and read-only.
          </p>

          {!allTasksApproved && (
            <div style={{ padding: '10px 14px', marginBottom: '16px', borderRadius: '6px', backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', fontSize: '0.9rem' }}>
              ⚠️ All project tasks must be approved before completing ({unapprovedTasks.length} task{unapprovedTasks.length > 1 ? 's' : ''} not yet approved).
            </div>
          )}

          <FormInput
            label="Live Project Link (GitHub / Demo URL)"
            name="finishedLink"
            value={finishedLink}
            onChange={(e) => {
              setFinishedLink(e.target.value);
              setPublishError('');
            }}
            placeholder="https://github.com/..."
            required
            helperText="Enter the repository URL or deployed live URL (must start with http:// or https://)."
          />

          {publishError && (
            <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '6px', backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', fontSize: '0.9rem' }}>
              {publishError}
            </div>
          )}
        </form>
      </Modal>

      {/* Modal: Remove Member */}
      {Boolean(removeMemberTarget) && (
        <Modal
          isOpen={Boolean(removeMemberTarget)}
          title="Remove Team Member"
          onClose={() => {
            if (!removingMember) {
              setRemoveMemberTarget(null);
              setRemoveReason('');
              setRemoveError('');
            }
          }}
          footer={
            <>
              <button
                type="button"
                className="tf-owned-ws-btn-outline"
                disabled={removingMember}
                onClick={() => {
                  setRemoveMemberTarget(null);
                  setRemoveReason('');
                  setRemoveError('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tf-owned-ws-btn-primary"
                style={{ backgroundColor: '#e11d48', borderColor: '#e11d48' }}
                disabled={removingMember || removeReason.trim().length < 10}
                onClick={handleConfirmRemoveMember}
              >
                {removingMember ? 'Removing...' : 'Confirm Remove'}
              </button>
            </>
          }
        >
          <form onSubmit={handleConfirmRemoveMember}>
            <p className="tf-owned-ws-desc" style={{ marginBottom: '16px' }}>
              Are you sure you want to remove{' '}
              <strong>
                {typeof removeMemberTarget === 'object' && removeMemberTarget !== null
                  ? removeMemberTarget.name || removeMemberTarget.id || 'Member'
                  : removeMemberTarget || 'Member'}
              </strong>{' '}
              from this project?
            </p>
            <p className="text-sm text-muted" style={{ marginBottom: '16px', color: '#64748b', fontSize: '0.875rem', lineHeight: '1.4' }}>
              All unapproved tasks assigned to this collaborator will be reset to <strong>Unassigned</strong> and <strong>Open</strong>. Completed tasks and awarded XP/reputation will not be affected. The user will be barred from re-applying to this project.
            </p>

            <FormInput
              label="Reason for Removal (minimum 10 characters)"
              name="removeReason"
              value={removeReason}
              onChange={(e) => {
                setRemoveReason(e.target.value);
                if (removeError && e.target.value.trim().length >= 10) {
                  setRemoveError('');
                }
              }}
              placeholder="Please specify why this member is being removed from the team..."
              multiline
              rows={3}
              required
              helperText={`${removeReason.trim().length} / 10 characters minimum`}
            />

            {removeError && (
              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '6px', backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', fontSize: '0.9rem' }}>
                {removeError}
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
};

export default OwnedWorkspace;
