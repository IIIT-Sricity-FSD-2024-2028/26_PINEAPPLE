import { formatMemberSince, formatDateTime } from '../utils/dateFormatter';
import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isProjectActive } from '../utils/projectStatus';
import { fetchProjects } from '../store/thunks/projectsThunks';
import { selectAllProjects } from '../store/selectors/projectsSelectors';
import { fetchTasksForProjects } from '../store/thunks/tasksThunks';
import { selectTasksMapByProject } from '../store/selectors/tasksSelectors';
import { fetchJoinRequests } from '../store/thunks/joinRequestsThunks';
import { selectAllJoinRequests } from '../store/selectors/joinRequestsSelectors';
import { fetchMyProfile } from '../store/thunks/profilesThunks';
import { selectOwnProfile } from '../store/selectors/profilesSelectors';
import {
  fetchGamificationLedger,
  fetchUserBadges,
} from '../store/thunks/gamificationThunks';
import {
  fetchMyReputation,
  fetchMyTrust,
} from '../store/thunks/reputationThunks';
import { setReputationFilters } from '../store/slices/reputationSlice';
import {
  selectAdminPermissions,
  selectCurrentUser,
  selectIsSuperUser,
} from '../store/selectors/sessionSelectors';
import {
  selectAllReputationEntries,
  selectMyTrust,
  selectReputationTotal,
  selectReputationWorking,
} from '../store/selectors/reputationSelectors';
import {
  selectUserBadges,
  selectUserGamificationLedger,
} from '../store/selectors/gamificationSelectors';
import Avatar from '../components/common/Avatar';
import Badge from '../components/common/Badge';
import DataTable from '../components/common/DataTable';
import StatCard from '../components/common/StatCard';
import UserTrustCard from '../components/features/UserTrustCard';
import EmptyState from '../components/common/EmptyState';
import { getTaskReward } from '../utils/workflow';
import { getProjectRole } from '../utils/projectRole';
import SafeLink from '../components/common/SafeLink';
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

export const MentoredProjectsCard = ({ mentoredProjects = [], loading = false, isPublic = false }) => {
  const list = Array.isArray(mentoredProjects) ? mentoredProjects : [];
  const visibleProjects = isPublic
    ? list.filter((p) => p?.tab === 'completed' || String(p?.status || '').toLowerCase() === 'completed')
    : list;

  return (
    <div className="prof-glass-card" data-testid="profile-mentored-projects-card">
      <h3 className="prof-sub-title">Mentored Projects</h3>
      {loading ? (
        <div className="prof-empty-state">Loading mentored projects...</div>
      ) : visibleProjects.length > 0 ? (
        visibleProjects.map((proj, idx) => {
          const isCompleted =
            proj?.tab === 'completed' || String(proj?.status || '').toLowerCase() === 'completed';
          const title = proj?.title || proj?.name || 'Untitled Project';
          const ownerName = proj?.ownerName || proj?.owner || 'Project Owner';
          const rawDate = isCompleted
            ? (proj?.completedAt || proj?.acceptedAt)
            : (proj?.acceptedAt || proj?.completedAt);
          const formattedDate = rawDate ? formatMemberSince(rawDate) : '';
          const datePrefix = isCompleted ? 'Completed' : 'Accepted';
          const finalLink = isCompleted ? (proj?.finalLink || proj?.deliverableLink || null) : null;

          return (
            <div key={proj?.projectId || proj?.id || idx} className="prof-proj-row">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div className="prof-proj-title">{title}</div>
                <Badge variant={isCompleted ? 'completed' : 'active'}>
                  {isCompleted ? 'Completed' : 'Active'}
                </Badge>
              </div>
              <div className="prof-proj-desc">
                Owner: {ownerName}
                {formattedDate ? ` · ${datePrefix} ${formattedDate}` : ''}
              </div>
              {finalLink && (
                <div className="prof-proj-meta">
                  <SafeLink href={finalLink} className="prof-link">
                    Final Link <LinkIcon />
                  </SafeLink>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="prof-empty-state">No mentored projects yet.</div>
      )}
    </div>
  );
};

// --- Component ---
const Profile = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const resolvedUserId = user?.id || user?.uid || "";
  const isSuperUser = useSelector(selectIsSuperUser);
  const adminPermissions = useSelector(selectAdminPermissions);
  const isAdminViewer = Boolean(
    isSuperUser ||
      (Array.isArray(adminPermissions) && adminPermissions.length > 0) ||
      user?.role === 'admin' ||
      user?.role === 'superuser',
  );

  const [loading, setLoading] = useState(true);
  const [isLedgerExpanded, setIsLedgerExpanded] = useState(true);

  const storeOwnProfile = useSelector(selectOwnProfile);
  const storeAllProjects = useSelector(selectAllProjects);
  const storeTasksByProject = useSelector(selectTasksMapByProject);
  const storeJoinRequests = useSelector(selectAllJoinRequests);

  const repWorking = useSelector(selectReputationWorking);
  const repTypeFilter = repWorking.typeFilter || 'all';
  const repPage = repWorking.page || 1;
  const ledgerGroup = repWorking.groupFilter || 'all';
  const setRepTypeFilter = (typeVal) =>
    dispatch(setReputationFilters({ typeFilter: typeVal, page: 1 }));
  const setRepPage = (updater) => {
    const next = typeof updater === 'function' ? updater(repPage) : updater;
    dispatch(setReputationFilters({ page: next }));
  };
  const setLedgerGroup = (groupVal) =>
    dispatch(setReputationFilters({ groupFilter: groupVal }));

  const storeReputationEntries = useSelector(selectAllReputationEntries);
  const storeRepTotal = useSelector(selectReputationTotal);
  const storeTrustSummary = useSelector(selectMyTrust);
  const storeLedgerEntries = useSelector((state) => selectUserGamificationLedger(state, resolvedUserId));
  const storeBadges = useSelector((state) => selectUserBadges(state, resolvedUserId));

  const reputationEntries = storeReputationEntries;
  const repTotal = storeRepTotal;
  const trustSummary = storeTrustSummary;
  const ledgerEntries = storeLedgerEntries;

  useEffect(() => {
    dispatch(fetchMyReputation({ page: repPage, limit: 20, type: repTypeFilter }));
  }, [dispatch, repPage, repTypeFilter]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userId = resolvedUserId;
        if (!userId) {
          setLoading(false);
          return;
        }

        const [
          ,
          projectsPayload,
          joinReqPayload,
        ] = await Promise.all([
          dispatch(fetchMyProfile()).unwrap().catch(() => ({})),
          dispatch(fetchProjects({ params: { status: 'all' }, force: true }))
            .unwrap()
            .catch(() => ({ items: [] })),
          dispatch(fetchJoinRequests({ userId, force: true }))
            .unwrap()
            .catch(() => ({ items: [] })),
          dispatch(fetchUserBadges({ userId })).unwrap().catch(() => ({ badges: [] })),
          dispatch(fetchGamificationLedger({ userId })).unwrap().catch(() => ({ items: [] })),
          dispatch(fetchMyTrust()).unwrap().catch(() => null),
        ]);

        const joinRequestsRes = Array.isArray(joinReqPayload?.items) ? joinReqPayload.items : [];
        const allProjects = Array.isArray(projectsPayload?.items)
          ? projectsPayload.items
          : Array.isArray(projectsPayload)
            ? projectsPayload
            : [];
        const userJoinRequests = Array.isArray(joinRequestsRes)
          ? joinRequestsRes
          : (joinRequestsRes?.data || []);

        const currentUserIdStr = String(userId);
        const resolvedName = (user?.name || user?.profile?.fullName || '').toLowerCase();
        const relevantProjectIds = new Set();

        allProjects.forEach((p) => {
          const pid = String(p.id);
          const projectRole = getProjectRole(p, currentUserIdStr, resolvedName);
          if (projectRole === 'Owner' || projectRole === 'Mentor' || projectRole === 'Collaborator') {
            relevantProjectIds.add(pid);
          }
        });

        userJoinRequests.forEach((req) => {
          const status = (req.status || '').toLowerCase();
          if ((status === 'approved' || status === 'accepted' || status === 'completed') && req.projectId) {
            relevantProjectIds.add(String(req.projectId));
          }
        });

        if (relevantProjectIds.size > 0) {
          await dispatch(
            fetchTasksForProjects({
              projectIds: Array.from(relevantProjectIds),
              force: true,
            }),
          )
            .unwrap()
            .catch(() => ({ items: [] }));
        }
      } catch (error) {
        console.error('Failed to fetch profile from API:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    const handleFocus = () => {
      fetchProfile();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchProfile();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dispatch, resolvedUserId, user?.name, user?.profile?.fullName]);

  const profileData = useMemo(() => {
    const data = storeOwnProfile || {};
    const currentUserIdStr = String(resolvedUserId || '');
    const resolvedName = (user?.name || data?.name || data?.profile?.fullName || '').toLowerCase();
    const userEmail = (user?.email || data?.email || '').toLowerCase();

    const allProjects = Array.isArray(storeAllProjects) ? storeAllProjects : [];
    const userJoinRequests = Array.isArray(storeJoinRequests) ? storeJoinRequests : [];
    const badgesRes = Array.isArray(storeBadges) ? storeBadges : [];

    const relevantProjectIds = new Set();
    const projectMap = new Map();
    const ownedProjects = [];
    const joinedProjects = [];
    const mentoredProjects = [];

    allProjects.forEach((p) => {
      const pid = String(p.id);
      projectMap.set(pid, p);
      const projectRole = getProjectRole(p, currentUserIdStr, resolvedName);
      if (projectRole === 'Owner') {
        ownedProjects.push({ ...p, name: p.title || p.name, role: 'Owner', projectRole: 'Owner' });
        relevantProjectIds.add(pid);
      } else if (projectRole === 'Mentor') {
        mentoredProjects.push({ ...p, name: p.title || p.name, role: 'Mentor', projectRole: 'Mentor' });
        relevantProjectIds.add(pid);
      } else if (projectRole === 'Collaborator') {
        joinedProjects.push({ ...p, name: p.title || p.name, role: 'Collaborator', projectRole: 'Collaborator' });
        relevantProjectIds.add(pid);
      }
    });

    userJoinRequests.forEach((req) => {
      const status = (req.status || '').toLowerCase();
      if ((status === 'approved' || status === 'accepted' || status === 'completed') && req.projectId) {
        relevantProjectIds.add(String(req.projectId));
      }
    });

    const rawTasks = Array.from(relevantProjectIds).flatMap(
      (pid) => storeTasksByProject?.[pid] || [],
    );
    const userTasks = rawTasks.filter((t) => {
      const aId = String(t.assigneeId || '');
      const aName = (t.assignee || t.assignedTo || '').toLowerCase();
      return aId === currentUserIdStr || aName === resolvedName || aName === userEmail;
    });

    const contributionList = [];
    const seenKeys = new Set();

    userTasks.forEach((t) => {
      const rawStatus = (t.status || '').toLowerCase();
      const isApproved = rawStatus === 'completed' || rawStatus === 'approved' || rawStatus === 'done';
      const proj = projectMap.get(String(t.projectId));
      const projName = proj ? (proj.title || proj.name) : (t.projectName || 'Project');
      const key = `task-${t.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const reward = getTaskReward(t.priority || t.difficulty);
        contributionList.push({
          id: key,
          projectName: projName,
          title: t.title || 'Task contribution',
          status: isApproved
            ? 'Approved'
            : rawStatus === 'submitted' || rawStatus === 'in review' || rawStatus === 'inreview'
              ? 'In Review'
              : 'In Progress',
          xp: isApproved ? reward.xp : 0,
          date: t.updatedAt || t.createdAt || new Date().toISOString(),
          proofLink: t.proofLink || t.proofUrl || null,
        });
      }
    });

    ownedProjects.forEach((p) => {
      const key = `owned-proj-${p.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const isCompleted = (p.status || '').toLowerCase() === 'completed';
        contributionList.push({
          id: key,
          projectName: p.title || p.name,
          title: isCompleted ? 'Deliverable published & project completed' : 'Project created & managed',
          status: isCompleted ? 'Approved' : 'Active',
          xp: 0,
          date: p.completedAt || p.updatedAt || p.createdAt || new Date().toISOString(),
          proofLink: p.deliverableUrl || p.finalLink || null,
        });
      }
    });

    const liveMentoredProjects = Array.isArray(data.mentoredProjects)
      ? data.mentoredProjects
      : Array.isArray(data.data?.mentoredProjects)
        ? data.data.mentoredProjects
        : [];
    liveMentoredProjects.forEach((mp, idx) => {
      const projectTitle = mp.title || mp.name;
      const ownerLabel = mp.ownerName || mp.owner || 'Owner';
      const key = `mentor-${mp.projectId || idx}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        contributionList.push({
          id: key,
          projectName: projectTitle,
          title: mp.contribution || `Mentored ${ownerLabel}'s project`,
          status:
            mp.tab === 'completed' || String(mp.status || '').toLowerCase() === 'completed'
              ? 'Approved'
              : mp.status || 'Active',
          xp: 0,
          date: mp.completedAt || mp.acceptedAt || new Date().toISOString(),
          proofLink: mp.finalLink || null,
        });
      }
    });

    contributionList.sort((a, b) => new Date(b.date) - new Date(a.date));

    const allUserProjects = [...ownedProjects, ...joinedProjects, ...mentoredProjects];

    const userCompletedProjects = allUserProjects
      .filter((p) => {
        if (!p) return false;
        if (p.deletedAt || p.deletionScheduledAt || String(p.status || '').toLowerCase() === 'deleted') {
          return false;
        }
        const statusLower = String(p.status || '').toLowerCase().trim();
        const isCompleted = p.isCompleted === true || p.is_completed === true || statusLower === 'completed';
        if (!isCompleted) return false;

        const role = p.projectRole || p.role || getProjectRole(p, currentUserIdStr, resolvedName);
        if (role === 'Owner' || role === 'Mentor') {
          return true;
        }

        if (role === 'Collaborator') {
          return userTasks.some((t) => {
            if (String(t.projectId) !== String(p.id)) return false;
            const ts = String(t.status || '').toLowerCase().trim();
            return ts === 'completed' || ts === 'approved' || ts === 'done';
          });
        }

        return false;
      })
      .map((p) => {
        const role = p.projectRole || p.role || 'Collaborator';
        return {
          ...p,
          name: p.title || p.name || 'Untitled Project',
          role,
          projectRole: role,
          contribution: role === 'Owner' ? 'Project Owner' : (p.contribution || 'Contributor'),
          finalLink: p.finalLink || p.finishedLink || p.deliverableUrl || null,
        };
      });

    const userActiveProjects = allUserProjects.filter(isProjectActive);
    const verifiedProjectsCount = userActiveProjects.length + userCompletedProjects.length;

    const approvedUserTasks = userTasks.filter((t) => {
      const s = (t.status || '').toLowerCase();
      return s === 'completed' || s === 'approved' || s === 'done';
    });
    const totalXp = Number(data.profile?.xp ?? data.xp ?? 0);
    const totalRep = Number(data.profile?.rep ?? data.rep ?? 0);
    const totalApprovedTasksCount =
      approvedUserTasks.length > 0 ? approvedUserTasks.length : Number(data.profile?.tasksCount ?? 0);

    const rawBadges = Array.isArray(badgesRes) && badgesRes.length > 0
      ? badgesRes
      : (Array.isArray(data.data?.mentorRecommendations) ? data.data.mentorRecommendations : []);

    const normalizedRecommendations = rawBadges.map((b, idx) => ({
      id: b.id || `rec-${idx}`,
      badgeName: b.badgeName || b.badgeType || 'Technical Excellence',
      mentorName: b.mentorName || b.mentor || 'Mentor',
      projectTitle: b.projectTitle || b.project || 'Project',
      comment: b.comment || b.note || '',
      awardedAt: b.awardedAt || b.timestamp || null,
    }));

    const hasAnyBadge = normalizedRecommendations.length > 0 || Boolean(data.profile?.hasMentorBadge);

    const viewingSelf = !resolvedUserId || String(resolvedUserId) === String(user?.id || user?.uid);
    const resolvedAvatarUrl = viewingSelf
      ? (user?.avatarUrl || user?.profile?.avatarUrl || user?.avatar || data.avatarUrl || data.profile?.avatarUrl || data.avatar || null)
      : (data.avatarUrl || data.profile?.avatarUrl || data.avatar || data.profile?.avatar || null);
    const resolvedUpdatedAt = viewingSelf
      ? (user?.updatedAt || data.updatedAt || null)
      : (data.updatedAt || null);

    return {
      name: user?.name || user?.profile?.fullName || data.profile?.fullName || data.name || 'User',
      bio: data.profile?.bio || user?.profile?.bio || user?.bio || 'No bio available.',
      avatarUrl: resolvedAvatarUrl,
      updatedAt: resolvedUpdatedAt,
      initials: (user?.name || user?.profile?.fullName || data.profile?.fullName || data.name || 'US')
        .substring(0, 2)
        .toUpperCase(),
      hasMentorBadge: hasAnyBadge,
      title: data.profile?.title || 'Team Member',
      uni: data.university || data.profile?.university || data.profile?.uni || user?.university || user?.profile?.university || user?.profile?.uni || '',
      joined: formatMemberSince(data.createdAt || data.profile?.createdAt || data.profile?.joined || user?.createdAt),
      phone: data.phone || data.profile?.phone || user?.phone || user?.profile?.phone || '',
      phoneVerified: Boolean(data.phoneVerified ?? data.profile?.phoneVerified ?? user?.phoneVerified ?? user?.profile?.phoneVerified),
      stats: {
        xp: totalXp,
        rep: totalRep,
        projects: verifiedProjectsCount,
        tasks: totalApprovedTasksCount,
      },
      skills: data.profile?.skills || user?.profile?.skills || [],
      activeProjects: userActiveProjects,
      completedProjects: userCompletedProjects,
      mentorRecommendations: normalizedRecommendations,
      mentoredProjects: liveMentoredProjects,
      contributions: contributionList,
    };
  }, [resolvedUserId, storeAllProjects, storeBadges, storeJoinRequests, storeOwnProfile, storeTasksByProject, user]);

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
            src={profileData.avatarUrl}
            version={profileData.updatedAt}
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
              {profileData.title}{profileData.uni ? ` · ${profileData.uni}` : ""}
            </div>
            <div className="prof-joined-text">
              Member since {profileData.joined}
            </div>
            {profileData.phone && (
              <div className="prof-phone-text" style={{ fontSize: '0.85rem', color: '#475569', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📞 {profileData.phone}</span>
                {profileData.phoneVerified ? (
                  <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.8rem' }} title="Verified Phone Number">
                    ✓ Verified
                  </span>
                ) : (
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                    (Not verified)
                  </span>
                )}
              </div>
            )}
            <p className="prof-bio-text">
              {profileData.bio}
            </p>
          </div>
        </div>

        {/* User Trust Card */}
        {trustSummary ? (
          <div style={{ marginTop: '20px' }}>
            <UserTrustCard
              summary={trustSummary}
              variant="expanded"
              isSelf={true}
              isAdminViewer={isAdminViewer}
            />
          </div>
        ) : (
          <div className="prof-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '20px' }}>
            <StatCard
              icon={<XPIcon />}
              label="XP Points"
              value={profileData.stats.xp.toLocaleString()}
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
        )}
      </div>

      {/* Row 2: Active Projects & Skills */}
      <div className="prof-grid-400">
        
        {/* Active Projects */}
        <div className="prof-glass-card">
          <h3 className="prof-sub-title">Active Projects</h3>
          {profileData.activeProjects.length ? profileData.activeProjects.map((proj, idx) => (
            <div key={idx} className="prof-proj-row">
              <div className="prof-proj-title">{proj.name}</div>
              <div className="prof-proj-desc">{proj.projectRole || proj.role || "Collaborator"} &middot; {proj.contribution || "Contributor"}</div>
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
                <div className="prof-proj-desc">{proj.projectRole || proj.role || "Collaborator"} &middot; {proj.contribution || "Contributor"}</div>
              </div>
              {proj.finalLink && (
                <SafeLink href={proj.finalLink} className="prof-link">
                  Final Link <LinkIcon />
                </SafeLink>
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

      {/* XP & Reputation Ledger */}
      <div className="prof-glass-card" data-testid="reputation-ledger-card">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 className="prof-sub-title" style={{ margin: 0 }}>
              XP & Reputation Ledger ({repTotal || ledgerEntries.length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Showing {reputationEntries.length > 0 ? `${(repPage - 1) * 20 + 1}-${Math.min(repPage * 20, repTotal)} of ${repTotal}` : `${ledgerEntries.length} entries`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="prof-rep-filter" style={{ fontSize: '0.82rem', fontWeight: 500, color: '#4b5563' }}>Type:</label>
              <select
                id="prof-rep-filter"
                data-testid="reputation-type-filter"
                value={repTypeFilter}
                onChange={(e) => {
                  setRepTypeFilter(e.target.value);
                  setRepPage(1);
                }}
                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.82rem' }}
              >
                <option value="all">All</option>
                <option value="initial">Initial signup</option>
                <option value="task_approved">Task approved</option>
                <option value="project_completed">Project completed</option>
                <option value="warning">Warning penalty</option>
                <option value="warning_removed">Appeal accepted</option>
                <option value="deadline_missed">Deadline penalty</option>
                <option value="recovery">Good conduct recovery</option>
                <option value="seed">Starting reputation (Seed)</option>
              </select>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsLedgerExpanded(!isLedgerExpanded)}
              style={{ fontSize: '0.82rem', padding: '4px 10px', cursor: 'pointer' }}
            >
              {isLedgerExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        {isLedgerExpanded && (
          <>
            {/* Group Tabs: All, Standing Changes, Contribution */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${ledgerGroup === 'all' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                onClick={() => setLedgerGroup('all')}
              >
                All Entries
              </button>
              <button
                type="button"
                className={`btn btn-sm ${ledgerGroup === 'standing' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                onClick={() => setLedgerGroup('standing')}
              >
                Standing Changes
              </button>
              <button
                type="button"
                className={`btn btn-sm ${ledgerGroup === 'contribution' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                onClick={() => setLedgerGroup('contribution')}
              >
                Contributions (Tasks & Projects)
              </button>
            </div>

            <DataTable
              columns={[
                {
                  header: 'Date',
                  key: 'date',
                  render: (item) => (
                    <span>
                      {formatDateTime(item.createdAt || item.date)}
                    </span>
                  ),
                },
                {
                  header: 'Type',
                  key: 'type',
                  render: (item) => {
                    const rawType = item.type || 'xp_ledger';
                    const typeLabels = {
                      seed: 'seed',
                      initial: 'initial',
                      task_approved: 'task_approved',
                      project_completed: 'project_completed',
                      warning: 'warning',
                      warning_removed: 'warning_removed',
                      deadline_missed: 'deadline_missed',
                      recovery: 'recovery',
                    };
                    return (
                      <span
                        data-testid={`reputation-entry-type-${rawType}`}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#334155',
                          background: '#f1f5f9',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {typeLabels[rawType] || rawType}
                      </span>
                    );
                  },
                },
                {
                  header: 'Reason',
                  key: 'reason',
                  render: (item) => {
                    const label =
                      item.type === 'recovery'
                        ? 'Good conduct recovery'
                        : item.type === 'seed'
                        ? 'Starting reputation'
                        : item.reason || (
                          item.type === 'task_approved' ? `Task approved: ${item.refId || ''}` :
                          item.type === 'project_completed' ? `Project completed: ${item.refId || ''}` :
                          item.type === 'warning' ? `Account warning penalty: ${item.refId || ''}` :
                          item.type === 'warning_removed' ? `Warning appeal accepted: ${item.refId || ''}` :
                          item.type === 'deadline_missed' ? `Missed deadline penalty: ${item.refId || ''}` :
                          item.type === 'initial' ? 'Initial signup reputation' :
                          item.type || 'Ledger event'
                        );
                    const taskId = item.taskId || item.refId;
                    return (
                      <div>
                        <span style={{ fontWeight: 500 }}>{label}</span>
                        {taskId && (
                          <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#6b7280', background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                            Ref: {taskId}
                          </span>
                        )}
                      </div>
                    );
                  },
                },
                {
                  header: 'XP',
                  key: 'xp',
                  align: 'right',
                  render: (item) => {
                    const xpVal = Number(item.xp || 0);
                    return (
                      <span style={{ fontWeight: 600, color: xpVal > 0 ? '#2563eb' : '#6b7280' }}>
                        {xpVal > 0 ? `+${xpVal}` : xpVal || '—'} XP
                      </span>
                    );
                  },
                },
                {
                  header: 'Reputation',
                  key: 'rep',
                  align: 'right',
                  render: (item) => {
                    const isContrib =
                      item.entryClass === 'contribution' ||
                      item.type === 'task_approved' ||
                      item.type === 'project_completed';
                    if (isContrib) {
                      return <span style={{ color: '#94a3b8' }}>—</span>;
                    }
                    const repVal = item.delta !== undefined ? Number(item.delta) : Number(item.rep || 0);
                    return (
                      <span style={{ fontWeight: 600, color: repVal > 0 ? '#16a34a' : repVal < 0 ? '#dc2626' : '#6b7280' }}>
                        {repVal > 0 ? `+${repVal}` : repVal || '0'} Rep
                      </span>
                    );
                  },
                },
              ]}
              data={(reputationEntries.length > 0 || repTypeFilter !== 'all' ? reputationEntries : ledgerEntries).filter((item) => {
                if (ledgerGroup === 'all') return true;
                const isContrib =
                  item.entryClass === 'contribution' ||
                  item.type === 'task_approved' ||
                  item.type === 'project_completed';
                if (ledgerGroup === 'contribution') return isContrib;
                if (ledgerGroup === 'standing') return !isContrib;
                return true;
              })}
              emptyTitle="No ledger entries recorded yet."
              emptyMessage="XP and reputation are awarded when submitted tasks are approved by project owners."
            />

            {(repTotal > 20 || (reputationEntries.length > 0 && repPage > 1)) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={repPage <= 1}
                  onClick={() => setRepPage((p) => Math.max(1, p - 1))}
                  data-testid="reputation-prev-page"
                  style={{ cursor: repPage <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  Previous
                </button>
                <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                  Page {repPage} of {Math.ceil(repTotal / 20) || 1}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={repPage >= Math.ceil(repTotal / 20)}
                  onClick={() => setRepPage((p) => p + 1)}
                  data-testid="reputation-next-page"
                  style={{ cursor: repPage >= Math.ceil(repTotal / 20) ? 'not-allowed' : 'pointer' }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
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
                  <SafeLink href={item.proofLink} className="prof-link">
                    Proof <LinkIcon />
                  </SafeLink>
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
      <MentoredProjectsCard
        mentoredProjects={profileData.mentoredProjects}
        loading={false}
        isPublic={false}
      />

    </div>
  );
};

const ProfilePage = Profile;

export default ProfilePage;
