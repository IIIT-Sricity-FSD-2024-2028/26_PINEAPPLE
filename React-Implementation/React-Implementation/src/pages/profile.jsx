import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import usersApi from '../services/usersApi';
import projectsApi, { isProjectActive, isProjectLocked } from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import joinRequestsApi from '../services/joinRequestsApi';
import mentorshipApi from '../services/mentorshipApi';
import Avatar from '../components/common/Avatar';
import Badge from '../components/common/Badge';
import DataTable from '../components/common/DataTable';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import { getTaskReward } from '../utils/workflow';
import "./profile.css";

// --- SVGs ---
const BadgeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="prof-badge-icon">
    <path d="M12 15.2l-3.5 2.1 1-4-3.1-2.6 4.1-.3L12 6.7l1.5 3.7 4.1.3-3.1 2.6 1 4z" />
    <path d="M21 11a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" fill="none" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const XPIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

const RepIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 4h10"></path>
    <path d="M17 4v8a5 5 0 0 1-10 0V4"></path>
    <path d="M4 4h3v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h3"></path>
  </svg>
);

const ProjectsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

const TasksIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="prof-link-icon">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>
);

// --- Component ---
const Profile = () => {
  const { user } = useContext(AuthContext);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userId = localStorage.getItem("teamforge.backendUserId") || user?.id || "";
        if (!userId) {
          setLoading(false);
          return;
        }

        const [data, allProjectsRes, joinRequestsRes, badgesRes] = await Promise.all([
          usersApi.get(userId).catch(() => ({})),
          projectsApi.list().catch(() => []),
          joinRequestsApi.list({ userId }).catch(() => []),
          mentorshipApi.getBadges(userId).catch(() => []),
        ]);

        const allProjects = Array.isArray(allProjectsRes) ? allProjectsRes : (allProjectsRes?.data || []);
        const userJoinRequests = Array.isArray(joinRequestsRes) ? joinRequestsRes : (joinRequestsRes?.data || []);

        const currentUserIdStr = String(userId);
        const resolvedName = (user?.name || data?.name || data?.profile?.fullName || "").toLowerCase();
        const userEmail = (user?.email || data?.email || "").toLowerCase();

        // Relevant projects
        const relevantProjectIds = new Set();
        const projectMap = new Map();
        const ownedProjects = [];
        const joinedProjects = [];

        allProjects.forEach((p) => {
          const pid = String(p.id);
          projectMap.set(pid, p);
          const isOwner = String(p.ownerId) === currentUserIdStr || (p.owner && p.owner.toLowerCase() === resolvedName);
          const isCollab = Array.isArray(p.collaborators) && p.collaborators.some((c) => {
            if (typeof c === "string") {
              return c === currentUserIdStr || c.toLowerCase() === resolvedName || c.toLowerCase() === userEmail;
            }
            return (
              String(c.id || c.userId) === currentUserIdStr ||
              (c.name && c.name.toLowerCase() === resolvedName) ||
              (c.email && c.email.toLowerCase() === userEmail)
            );
          });
          if (isOwner) {
            ownedProjects.push(p);
            relevantProjectIds.add(pid);
          } else if (isCollab) {
            joinedProjects.push(p);
            relevantProjectIds.add(pid);
          }
        });

        userJoinRequests.forEach((req) => {
          const status = (req.status || "").toLowerCase();
          if ((status === "approved" || status === "accepted" || status === "completed") && req.projectId) {
            relevantProjectIds.add(String(req.projectId));
          }
        });

        // Tasks across relevant projects
        let userTasks = [];
        if (relevantProjectIds.size > 0) {
          try {
            const rawTasks = await tasksApi.listForProjects(Array.from(relevantProjectIds));
            const allTasks = Array.isArray(rawTasks) ? rawTasks : [];
            userTasks = allTasks.filter((t) => {
              const aId = String(t.assigneeId || "");
              const aName = (t.assignee || t.assignedTo || "").toLowerCase();
              return aId === currentUserIdStr || aName === resolvedName || aName === userEmail;
            });
          } catch (err) {
            console.warn("Could not load tasks for projects:", err);
          }
        }

        // Contributions list
        const contributionList = [];
        const seenKeys = new Set();

        // 1. Tasks
        userTasks.forEach((t) => {
          const rawStatus = (t.status || "").toLowerCase();
          const isApproved = rawStatus === "completed" || rawStatus === "approved" || rawStatus === "done";
          const proj = projectMap.get(String(t.projectId));
          const projName = proj ? (proj.title || proj.name) : (t.projectName || "Project");
          const key = `task-${t.id}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            const reward = getTaskReward(t.priority || t.difficulty);
            contributionList.push({
              id: key,
              projectName: projName,
              title: t.title || "Task contribution",
              status: isApproved ? "Approved" : (rawStatus === "submitted" || rawStatus === "in review" || rawStatus === "inreview") ? "In Review" : "In Progress",
              xp: isApproved ? reward.xp : 0,
              date: t.updatedAt || t.createdAt || new Date().toISOString(),
              proofLink: t.proofLink || t.proofUrl || null,
            });
          }
        });

        // 2. Owned projects / deliverables
        ownedProjects.forEach((p) => {
          const key = `owned-proj-${p.id}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            const isCompleted = (p.status || "").toLowerCase() === "completed";
            contributionList.push({
              id: key,
              projectName: p.title || p.name,
              title: isCompleted ? "Deliverable published & project completed" : "Project created & managed",
              status: isCompleted ? "Approved" : "Active",
              xp: 0,
              date: p.completedAt || p.updatedAt || p.createdAt || new Date().toISOString(),
              proofLink: p.deliverableUrl || p.finalLink || null,
            });
          }
        });

        // 3. Mentored projects
        if (Array.isArray(data.data?.mentoredProjects)) {
          data.data.mentoredProjects.forEach((mp, idx) => {
            const key = `mentor-${idx}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              contributionList.push({
                id: key,
                projectName: mp.name,
                title: mp.contribution || `Mentored ${mp.owner}'s project`,
                status: mp.status === "Completed" ? "Approved" : mp.status || "Completed",
                xp: 0,
                date: new Date().toISOString(),
                proofLink: null,
              });
            }
          });
        }

        // Sort by newest first
        contributionList.sort((a, b) => new Date(b.date) - new Date(a.date));

        const totalProjectsCount = ownedProjects.length + joinedProjects.length;
        const approvedUserTasks = userTasks.filter((t) => {
          const s = (t.status || "").toLowerCase();
          return s === "completed" || s === "approved" || s === "done";
        });
        const derivedXp = approvedUserTasks.reduce(
          (sum, t) => sum + getTaskReward(t.priority || t.difficulty).xp,
          0
        );
        const derivedRep = approvedUserTasks.length * 8;
        const totalXp = userTasks.length > 0 ? derivedXp : Number(data.profile?.xp ?? data.xp ?? 0);
        const totalRep = userTasks.length > 0 ? derivedRep : Number(data.profile?.rep ?? data.rep ?? 0);
        const totalApprovedTasksCount = approvedUserTasks.length;

        const rawBadges = Array.isArray(badgesRes) && badgesRes.length > 0
          ? badgesRes
          : (Array.isArray(data.data?.mentorRecommendations) ? data.data.mentorRecommendations : []);

        const normalizedRecommendations = rawBadges.map((b, idx) => ({
          id: b.id || `rec-${idx}`,
          badgeName: b.badgeName || b.badgeType || "Technical Excellence",
          mentorName: b.mentorName || b.mentor || "Mentor",
          projectTitle: b.projectTitle || b.project || "Project",
          comment: b.comment || b.note || "",
          awardedAt: b.awardedAt || b.timestamp || null,
        }));

        const hasAnyBadge = normalizedRecommendations.length > 0 || Boolean(data.profile?.hasMentorBadge);

        setProfileData({
          name: user?.name || user?.profile?.fullName || data.profile?.fullName || data.name || "User",
          bio: data.profile?.bio || user?.profile?.bio || user?.bio || "No bio available.",
          avatarUrl: user?.avatarUrl || user?.profile?.avatarUrl || data.profile?.avatarUrl || data.avatarUrl || null,
          initials: (user?.name || user?.profile?.fullName || data.profile?.fullName || data.name || "US").substring(0, 2).toUpperCase(),
          hasMentorBadge: hasAnyBadge,
          
          title: data.profile?.title || "Team Member",
          uni: data.profile?.uni || "Unknown Organization",
          joined: data.profile?.joined || "Unknown Date",

          stats: {
            xp: totalXp,
            rep: totalRep,
            projects: totalProjectsCount || (data.data?.projects?.length || 0),
            tasks: totalApprovedTasksCount,
          },
          skills: data.profile?.skills || user?.profile?.skills || [],
          
          activeProjects: [...ownedProjects, ...joinedProjects].filter(isProjectActive),
          completedProjects: [...ownedProjects, ...joinedProjects].filter(isProjectLocked),

          mentorRecommendations: normalizedRecommendations,
          mentoredProjects: data.data?.mentoredProjects || [],
          contributions: contributionList,
        });

      } catch (error) {
        console.error("Failed to fetch profile from API:", error);
        
        setProfileData({
          name: user?.name || user?.profile?.fullName || "User",
          title: "Team Member",
          uni: "Unknown",
          joined: "N/A",
          bio: "No bio available.",
          initials: (user?.name || user?.profile?.fullName || "US").substring(0, 2).toUpperCase(),
          hasMentorBadge: false,
          stats: { xp: 0, rep: 0, projects: 0, tasks: 0 },
          activeProjects: [],
          skills: [],
          completedProjects: [],
          mentorRecommendations: [],
          mentoredProjects: [],
          contributions: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    const handleFocus = () => {
      fetchProfile();
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("teamforge:badge_awarded", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("teamforge:badge_awarded", handleFocus);
    };
  }, [user]);

  if (loading || !profileData) {
    return (
      <div className="profile-page" style={{ textAlign: 'center', marginTop: '50px' }}>
        <p style={{ color: '#6b7280', fontWeight: 600 }}>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      
      {/* Header Profile Card */}
      <div className="prof-glass-card">
        <div className="prof-header-wrap">
          {/* Avatar */}
          <Avatar
            src={profileData.avatarUrl ? (profileData.avatarUrl.startsWith('http') || profileData.avatarUrl.startsWith('data:') || profileData.avatarUrl.startsWith('blob:') ? profileData.avatarUrl : `http://localhost:3000${profileData.avatarUrl}`) : null}
            name={profileData.name}
            size="xl"
            className="prof-avatar-lg"
          />
          
          {/* Info */}
          <div className="prof-info-col">
            <div className="prof-name-row">
              <h1 className="prof-name">{profileData.name}</h1>
              {profileData.hasMentorBadge && (
                <span className="prof-mentor-badge">
                  <BadgeIcon /> Mentor Recommended
                </span>
              )}
            </div>
            <div className="prof-title-text">
              {profileData.title} &middot; {profileData.uni}
            </div>
            <div className="prof-joined-text">
              Member since {profileData.joined}
            </div>
            <p className="prof-bio-text">
              {profileData.bio}
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="prof-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '20px' }}>
          <StatCard
            icon={<XPIcon />}
            label="XP Points"
            value={profileData.stats.xp.toLocaleString()}
          />
          <StatCard
            icon={<RepIcon />}
            label="Reputation"
            value={profileData.stats.rep}
          />
          <StatCard
            icon={<ProjectsIcon />}
            label="Projects"
            value={profileData.stats.projects}
          />
          <StatCard
            icon={<TasksIcon />}
            label="Tasks"
            value={profileData.stats.tasks}
          />
        </div>
      </div>

      {/* Row 2: Active Projects & Skills */}
      <div className="prof-grid-400">
        
        {/* Active Projects */}
        <div className="prof-glass-card">
          <h3 className="prof-sub-title">Active Projects</h3>
          {profileData.activeProjects.length ? profileData.activeProjects.map((proj, idx) => (
            <div key={idx} className="prof-proj-row">
              <div className="prof-proj-title">{proj.name}</div>
              <div className="prof-proj-desc">{proj.role || "Member"} &middot; {proj.contribution || "Contributor"}</div>
            </div>
          )) : (
            <EmptyState
              icon="📁"
              title="No active projects"
              message="You are not currently active on any ongoing projects."
            />
          )}
        </div>

        {/* Skills */}
        <div className="prof-glass-card">
          <h3 className="prof-sub-title">Skills</h3>
          <div className="prof-skills-container">
            {profileData.skills.length ? profileData.skills.map((skill, idx) => (
              <span key={idx} className="prof-skill-tag">
                {skill}
              </span>
            )) : <div className="prof-empty-state">No skills added yet.</div>}
          </div>
        </div>

      </div>

      {/* Row 3: Completed Projects & Mentor Recommendations */}
      <div className="prof-grid-400">
        
        {/* Completed Projects */}
        <div className="prof-glass-card">
          <h3 className="prof-sub-title">Completed Projects</h3>
          {profileData.completedProjects.length ? profileData.completedProjects.map((proj, idx) => (
            <div key={idx} className="prof-proj-row prof-proj-row-flex">
              <div>
                <div className="prof-proj-title">{proj.name}</div>
                <div className="prof-proj-desc">{proj.role || "Member"} &middot; {proj.contribution || "Contributor"}</div>
              </div>
              {proj.finalLink && (
                <a href={proj.finalLink} className="prof-link">
                  Final Link <LinkIcon />
                </a>
              )}
            </div>
          )) : <div className="prof-empty-state">No completed projects available.</div>}
        </div>

        {/* Mentor Recommendations */}
        <div className="prof-glass-card">
          <h3 className="prof-sub-title">
            Mentor Recommendations {profileData.mentorRecommendations.length > 0 ? `(${profileData.mentorRecommendations.length})` : ''}
          </h3>
          {profileData.mentorRecommendations.length > 0 ? (
            <div className="prof-recommendations-list">
              {profileData.mentorRecommendations.map((rec, idx) => (
                <div key={rec.id || idx} className="prof-badge-row">
                  <div className="prof-badge-header">
                    <span className="prof-badge-chip">
                      <BadgeIcon /> {rec.badgeName}
                    </span>
                    {rec.awardedAt && (
                      <span className="prof-badge-date">
                        {new Date(rec.awardedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                  <div className="prof-badge-meta">
                    <span className="prof-badge-giver">
                      Given by <strong>{rec.mentorName}</strong>
                    </span>
                    <span className="prof-badge-sep">&bull;</span>
                    <span className="prof-badge-project">{rec.projectTitle}</span>
                  </div>
                  {rec.comment && (
                    <div className="prof-badge-quote">
                      &ldquo;{rec.comment}&rdquo;
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="prof-empty-state">No recommendation badges yet.</div>
          )}
        </div>

      </div>

      {/* Contribution History */}
      <div className="prof-glass-card">
        <h3 className="prof-sub-title">Contribution History</h3>
        <DataTable
          columns={[
            {
              header: 'Project',
              key: 'projectName',
              render: (item) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{item.projectName}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted-fg, #6b7280)' }}>{item.title}</div>
                </div>
              ),
            },
            {
              header: 'Date & XP',
              key: 'date',
              render: (item) => (
                <div>
                  <span>{new Date(item.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  {item.xp > 0 && <span style={{ marginLeft: '0.5rem', color: '#2563eb', fontWeight: 600 }}>+{item.xp} XP</span>}
                </div>
              ),
            },
            {
              header: 'Proof',
              key: 'proofLink',
              render: (item) => (
                item.proofLink ? (
                  <a href={item.proofLink} target="_blank" rel="noreferrer" className="prof-link">
                    Proof <LinkIcon />
                  </a>
                ) : <span style={{ color: '#9ca3af' }}>—</span>
              ),
            },
            {
              header: 'Status',
              key: 'status',
              align: 'right',
              render: (item) => (
                <Badge variant={item.status === 'Approved' || item.status === 'Completed' ? 'completed' : 'in-progress'}>
                  {item.status}
                </Badge>
              ),
            },
          ]}
          data={profileData.contributions || []}
          emptyTitle="No contributions yet."
          emptyMessage="Complete tasks and submit approved deliverables to earn XP and record your contributions."
        />
      </div>

      {/* Row 4: Mentored Projects */}
      <div className="prof-glass-card">
        <h3 className="prof-sub-title">Mentored Projects</h3>
        {profileData.mentoredProjects.length ? profileData.mentoredProjects.map((proj, idx) => (
          <div key={idx} className="prof-proj-row">
            <div className="prof-proj-title">{proj.name}</div>
            <div className="prof-proj-desc">Owner: {proj.owner} &middot; {proj.status}</div>
            <div className="prof-proj-meta">{proj.contribution}</div>
          </div>
        )) : <div className="prof-empty-state">No mentored projects yet.</div>}
      </div>

    </div>
  );
};

export default Profile;
