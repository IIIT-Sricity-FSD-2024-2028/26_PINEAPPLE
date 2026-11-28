import { createSelector } from '@reduxjs/toolkit';
import {
  adminUsersAdapter,
  createInitialAdminUsersWorking,
  createInitialDashboardStats,
  createInitialUserCounts,
} from '../slices/adminUsersSlice';
import { formatDateTime, formatMemberSince } from '../../utils/dateFormatter';
import { toText } from '../../utils/toText';
import { selectUserActiveWarningsCount } from './warningsSelectors';
import { selectAdminMentorFeedbackById } from './sessionFeedbackSelectors';

const EMPTY_IDS = [];
const EMPTY_MAP = {};
const EMPTY_LIST = [];
const FALLBACK_WORKING = createInitialAdminUsersWorking();
const FALLBACK_STATS = createInitialDashboardStats();
const FALLBACK_COUNTS = createInitialUserCounts();
const FALLBACK_REP = { items: [], total: 0 };

export const selectAdminUsersState = (state) => state?.adminUsers;

export const adminUsersEntitySelectors =
  adminUsersAdapter.getSelectors(selectAdminUsersState);

export const selectAdminUserEntities = (state) =>
  state?.adminUsers?.entities || EMPTY_MAP;

export const selectAdminUserIds = (state) =>
  state?.adminUsers?.ids || EMPTY_IDS;

export const selectAllAdminUsers = createSelector(
  [selectAdminUserEntities, selectAdminUserIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectAdminDuplicateGroups = (state) =>
  state?.adminUsers?.duplicateGroups || EMPTY_LIST;

export const selectAdminTrustSummaries = (state) =>
  state?.adminUsers?.trustByUserId || EMPTY_MAP;

export const selectAdminUsersStatus = (state) =>
  state?.adminUsers?.listStatus || 'idle';

export const selectAdminUsersError = (state) =>
  state?.adminUsers?.listError || null;

export const selectAdminUserDetailsById = (userId) => (state) =>
  state?.adminUsers?.userDetailsById?.[String(userId)] || null;

export const selectAdminUserReputationById = (userId) => (state) =>
  state?.adminUsers?.reputationByUserId?.[String(userId)] || FALLBACK_REP;

export const selectDashboardStats = (state) =>
  state?.adminUsers?.dashboardStats || FALLBACK_STATS;

export const selectAdminUserCounts = createSelector(
  [(state) => state?.adminUsers?.userCounts, selectDashboardStats],
  (userCounts, stats) => {
    if (userCounts && typeof userCounts === 'object') {
      const hasNonZeroUserCounts =
        userCounts.total > 0 ||
        userCounts.active > 0 ||
        userCounts.suspended > 0 ||
        userCounts.flagged > 0 ||
        userCounts.warned > 0 ||
        userCounts.possibleDuplicates > 0 ||
        userCounts.pendingApprovals > 0;
      if (hasNonZeroUserCounts || (!stats?.counts && !stats?.totalUsers)) {
        return userCounts;
      }
    }
    if (stats?.counts && typeof stats.counts === 'object') {
      return stats.counts;
    }
    if (stats) {
      return {
        total: Number(stats.totalUsers ?? 0),
        active: Number(stats.activeUsers ?? 0),
        suspended: Number(stats.suspendedUsers ?? 0),
        flagged: Number(stats.flaggedUsers ?? stats.flaggedWarned ?? 0),
        warned: Number(stats.warnedUsers ?? 0),
        possibleDuplicates: Number(stats.possibleDuplicates ?? 0),
        pendingApprovals: Number(stats.pendingApprovals ?? 0),
      };
    }
    return FALLBACK_COUNTS;
  },
);

export const selectDashboardStatsStatus = (state) =>
  state?.adminUsers?.statsStatus || 'idle';

export const selectAdminUsersWorking = (state) =>
  state?.adminUsers?.working || FALLBACK_WORKING;

function resolveDisplayModerator(raw, fallback = 'Administrator') {
  if (raw && typeof raw === 'object') {
    const resolved = toText(raw, '');
    return resolved || fallback;
  }
  const text = toText(raw, '');
  if (!text) return fallback;
  if (text.toLowerCase() === 'system') return 'System';
  if (text === 'u-admin' || text === 'u-superuser' || text === 'admin') {
    return fallback;
  }
  return text;
}

/**
 * Maps raw admin user details + auxiliary slice state into a flat, primitive-safe
 * view model so UI components never render raw API objects directly.
 */
export function mapUserDetailsToViewModel(
  user,
  {
    userId = '',
    storeActiveWarningsCount = null,
    reputationState = FALLBACK_REP,
    mentorFeedbackData = null,
    usersWorking = FALLBACK_WORKING,
    duplicateGroups = EMPTY_LIST,
  } = {},
) {
  if (!user || typeof user !== 'object') return null;

  const uid = String(user.id || userId || '');
  const rawStatusSource =
    user.status && typeof user.status === 'object' && user.status.status !== undefined
      ? user.status.status
      : user.status;
  const rawStatusText = toText(rawStatusSource, 'Active');
  const rawStatusLower = rawStatusText.toLowerCase();
  const isDeleted = Boolean(
    user.isDeleted ||
      user.deletedAt ||
      rawStatusLower === 'deleted' ||
      rawStatusLower === 'anonymised' ||
      rawStatusLower === 'anonymized',
  );
  const status = isDeleted ? 'Deleted' : rawStatusText;
  const isSuspended = !isDeleted && rawStatusLower === 'suspended';
  const isFlagged = Boolean(
    user.flags === true || user.flagged === true || rawStatusLower === 'flagged',
  );

  const rawWarnings =
    Array.isArray(user.warningHistory) && user.warningHistory.length > 0
      ? user.warningHistory
      : Array.isArray(user.warnings)
      ? user.warnings
      : [];

  const warnings = rawWarnings.map((w, idx) => {
    const isObj = w && typeof w === 'object';
    const rawDate = isObj ? w.createdAt || w.issuedAt : null;
    const wStatus = isObj
      ? toText(w.status, w.active === false ? 'removed' : 'active').toLowerCase()
      : 'active';
    const isActive = wStatus === 'active';
    const isExpired = wStatus === 'expired';
    const badgeLabel = isActive
      ? 'Active'
      : isExpired
      ? 'Expired'
      : wStatus === 'cleared'
      ? 'Cleared'
      : 'Removed / Appealed';
    return {
      id: String((isObj && w.id) || idx),
      indexLabel: `Warning #${idx + 1}`,
      reason: toText(isObj ? w.reason ?? w.message : w, '—'),
      issuedAtFormatted: rawDate ? new Date(rawDate).toLocaleDateString() : '—',
      expiredAtFormatted:
        isExpired && isObj && w.expiredAt
          ? new Date(w.expiredAt).toLocaleDateString()
          : '',
      issuedByName: resolveDisplayModerator(
        isObj ? w.issuedByName ?? w.moderatorName ?? w.issuedBy : null,
        'Administrator',
      ),
      badgeLabel,
      badgeVariant: isActive ? 'warning' : 'secondary',
      isActive,
      isExpired,
    };
  });

  const activeWarningsCount =
    storeActiveWarningsCount ??
    user.activeWarningsCount ??
    user.warningsCount ??
    (Array.isArray(user.warnings)
      ? user.warnings.filter((w) => (typeof w === 'object' ? w.active !== false && w.status !== 'cleared' && w.status !== 'removed' && w.status !== 'expired' : true)).length
      : typeof user.warnings === 'number'
      ? user.warnings
      : warnings.filter((w) => w.isActive).length);

  const isWarned =
    !isSuspended &&
    !isDeleted &&
    (rawStatusLower === 'warned' ||
      activeWarningsCount > 0 ||
      warnings.length > 0);

  const rawPendingActions = Array.isArray(user.pendingModerationActions)
    ? user.pendingModerationActions
    : user.pendingModerationAction
    ? [user.pendingModerationAction]
    : [];
  const pendingModerationActions = rawPendingActions
    .filter((a) => a && typeof a === 'object')
    .map((act, idx) => ({
      id: String(act.id || idx),
      status: toText(act.status, 'pending').toLowerCase(),
      reason: toText(act.reason, '—'),
      requestedByName: resolveDisplayModerator(
        act.requestedByName ?? act.requestedBy,
        'Administrator',
      ),
      createdAtFormatted: act.createdAt ? formatDateTime(act.createdAt) : '—',
      expiresAtFormatted: act.expiresAt ? formatDateTime(act.expiresAt) : '—',
    }));
  const hasPendingSecondApproval = pendingModerationActions.some(
    (a) => a.status === 'pending',
  );

  const suspObj =
    user.suspension && typeof user.suspension === 'object' ? user.suspension : null;
  let suspension = null;
  if (isSuspended) {
    const rawReason = toText(
      suspObj?.reason ?? user.suspensionReason ?? user.suspendedReason,
      'No reason recorded',
    );
    const rawType = toText(
      suspObj?.type ?? user.suspensionType,
      '',
    ).toLowerCase();
    const isAutomatic =
      rawType === 'automatic' ||
      rawType === 'auto' ||
      rawReason === 'Automatic suspension after 4 warnings' ||
      String(suspObj?.suspendedBy ?? user.suspendedBy ?? '').toLowerCase() === 'system';
    const suspendedAtRaw = suspObj?.suspendedAt ?? user.suspendedAt ?? null;
    const appealRaw = toText(
      suspObj?.appealStatus ??
        user.appealStatus ??
        (Array.isArray(user.appeals) && user.appeals[0] ? user.appeals[0].status : null),
      '',
    );
    suspension = {
      reason: rawReason,
      type: isAutomatic ? 'automatic' : 'manual',
      typeLabel: isAutomatic ? 'Automatic after 4 warnings' : 'Manual',
      suspendedAtFormatted: suspendedAtRaw ? formatDateTime(suspendedAtRaw) : '—',
      suspendedByName: isAutomatic
        ? 'System'
        : resolveDisplayModerator(
            suspObj?.suspendedByName ??
              suspObj?.moderatorName ??
              suspObj?.suspendedBy ??
              user.suspendedByName ??
              user.suspendedBy,
            'Administrator',
          ),
      appealStatus: appealRaw,
      appealStatusLabel: appealRaw
        ? appealRaw.charAt(0).toUpperCase() + appealRaw.slice(1)
        : '',
    };
  }

  const reactivation =
    !isSuspended && (user.reactivatedAt || user.reactivationReason)
      ? {
          reason: toText(user.reactivationReason, ''),
          reactivatedAtFormatted: user.reactivatedAt
            ? formatDateTime(user.reactivatedAt)
            : '',
        }
      : null;

  const hasDuplicateFlag = Boolean(
    user.possibleDuplicate ||
      user.duplicateFlag ||
      (Array.isArray(duplicateGroups) &&
        duplicateGroups.some(
          (g) =>
            Array.isArray(g?.users) &&
            g.users.some((u) => String(u?.id || u?.userId || '') === uid),
        )),
  );

  const projects = (Array.isArray(user.projects) ? user.projects : [])
    .filter((p) => p && typeof p === 'object')
    .map((p, idx) => {
      const pStatus = toText(p.status, 'Active');
      const isCompleted = Boolean(p.isCompleted);
      return {
        id: String(p.id || idx),
        title: toText(p.title ?? p.name, 'Untitled Project'),
        role: toText(p.role, 'Collaborator'),
        difficulty: toText(p.difficulty, '—'),
        status: isCompleted ? 'Completed' : pStatus,
        badgeVariant: isCompleted ? 'completed' : pStatus.toLowerCase() || 'open',
        progress: Number(p.progress ?? 0) || 0,
      };
    });

  const contributions = (Array.isArray(user.contributions) ? user.contributions : [])
    .filter((t) => t && typeof t === 'object')
    .map((t, idx) => {
      const tStatus = toText(t.status, 'Open');
      return {
        id: String(t.id || idx),
        title: toText(t.title, 'Untitled Task'),
        projectName: toText(t.projectName, '—'),
        priority: toText(t.priority, 'Medium'),
        status: tStatus,
        badgeVariant: tStatus.toLowerCase() === 'approved' ? 'completed' : 'info',
        awardedXp: Number(t.awardedXp ?? 50) || 50,
      };
    });

  const skills = Array.isArray(user.skills)
    ? user.skills.map((s) => toText(s, '')).filter(Boolean)
    : [];

  const mentorRecommendations = (
    Array.isArray(user.mentorRecommendations) ? user.mentorRecommendations : []
  )
    .filter((rec) => rec && typeof rec === 'object')
    .map((rec, idx) => ({
      id: String(rec.id || idx),
      badgeName: toText(rec.badgeName ?? rec.badgeType, 'Recommendation'),
      awardedAtFormatted: rec.awardedAt
        ? new Date(rec.awardedAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : '',
      mentorName: toText(rec.mentorName ?? rec.mentor, 'Mentor'),
      projectTitle: toText(rec.projectTitle ?? rec.project, 'Project'),
      comment: toText(rec.comment ?? rec.note, ''),
    }));

  const recentActivity = (Array.isArray(user.recentActivity) ? user.recentActivity : [])
    .filter((item) => item && typeof item === 'object')
    .map((item, idx) => ({
      id: String(item.id || idx),
      eventText: toText(item.event ?? item.details ?? item.action, 'Activity recorded'),
      actionText: toText(item.action, 'event'),
      timestampFormatted: item.timestamp
        ? new Date(item.timestamp).toLocaleDateString()
        : '—',
    }));

  const repTypeFilter = toText(usersWorking?.repTypeFilter, 'all');
  const repPage = Number(usersWorking?.repPage || 1) || 1;
  const repTotal = Number(reputationState?.total || 0) || 0;
  const repItems = (Array.isArray(reputationState?.items) ? reputationState.items : [])
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, idx) => {
      const deltaVal = Number(entry.delta || 0) || 0;
      const entryType = toText(entry.type, '');
      const refIdText = toText(entry.refId, '');
      const label =
        entryType === 'seed'
          ? 'Starting reputation'
          : toText(entry.reason, '') ||
            (entryType === 'task_approved'
              ? `Task approved: ${refIdText}`
              : entryType === 'project_completed'
              ? `Project completed: ${refIdText}`
              : entryType === 'warning'
              ? `Warning penalty: ${refIdText}`
              : entryType === 'warning_removed'
              ? `Warning appeal accepted: ${refIdText}`
              : entryType === 'deadline_missed'
              ? `Missed deadline penalty: ${refIdText}`
              : entryType === 'initial'
              ? 'Initial signup reputation'
              : entryType || 'Reputation adjustment');
      return {
        id: String(entry.id || idx),
        label,
        type: entryType,
        deltaVal,
        deltaText: deltaVal > 0 ? `+${deltaVal}` : String(deltaVal),
        createdAtFormatted: formatDateTime(entry.createdAt),
      };
    });

  const mentorFeedback =
    mentorFeedbackData && typeof mentorFeedbackData === 'object'
      ? {
          averageRating: toText(mentorFeedbackData.averageRating, 'N/A'),
          totalFeedbackCount: Number(mentorFeedbackData.totalFeedbackCount || 0) || 0,
          abandonmentCount: Array.isArray(mentorFeedbackData.abandonmentHistory)
            ? mentorFeedbackData.abandonmentHistory.length
            : 0,
          feedback: (Array.isArray(mentorFeedbackData.feedback)
            ? mentorFeedbackData.feedback
            : []
          )
            .filter((fb) => fb && typeof fb === 'object')
            .map((fb, idx) => ({
              id: String(fb.id || idx),
              ownerName: toText(
                fb.ownerName ?? (fb.studentId ? `Owner #${fb.studentId}` : null),
                'Owner',
              ),
              rating: Number(fb.rating || 0) || 0,
              createdAtFormatted: fb.createdAt ? formatMemberSince(fb.createdAt) : '',
              comment: toText(fb.comment, ''),
            })),
          abandonmentHistory: (Array.isArray(mentorFeedbackData.abandonmentHistory)
            ? mentorFeedbackData.abandonmentHistory
            : []
          )
            .filter((inc) => inc && typeof inc === 'object')
            .map((inc, idx) => ({
              id: String(inc.reviewId || inc.id || idx),
              projectTitle: toText(inc.projectTitle ?? inc.projectId, 'Project'),
              releasedAtFormatted: inc.releasedAt
                ? formatMemberSince(inc.releasedAt)
                : '',
              reason: toText(inc.reason, ''),
            })),
        }
      : null;

  const roleText = toText(user.role, 'Collaborator');

  return {
    id: uid,
    name: toText(user.name, isDeleted ? 'Deleted User' : 'User'),
    email: toText(user.email, 'Not provided'),
    username: toText(user.username ?? user.name, isDeleted ? 'deleted' : 'user'),
    university: toText(user.university ?? user.uni, 'Not specified'),
    phone: toText(user.phone, ''),
    phoneVerified: Boolean(user.phoneVerified),
    avatarUrl:
      typeof (user.avatarUrl || user.avatar || user.profile?.avatarUrl) === 'string'
        ? user.avatarUrl || user.avatar || user.profile?.avatarUrl
        : '',
    updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : '',
    role: roleText,
    isMentorRole: Boolean(
      roleText.toLowerCase() === 'mentor' ||
        user.mentorUnlocked ||
        user.profile?.mentorUnlocked,
    ),
    status,
    statusBadgeVariant: isDeleted
      ? 'secondary'
      : isSuspended
      ? 'danger'
      : isWarned
      ? 'warning'
      : isFlagged
      ? 'warning'
      : 'success',
    isDeleted,
    isSuspended,
    isFlagged,
    isWarned,
    hasDuplicateFlag,
    hasPendingSecondApproval,
    pendingModerationActions,
    suspension,
    reactivation,
    activeWarningsCount: Number(activeWarningsCount || 0) || 0,
    joinedDateFormatted: formatMemberSince(
      user.createdAt ||
        user.joinedDate ||
        user.profile?.createdAt ||
        user.profile?.joined,
    ),
    xpFormatted: `${Number(user.xp || 0).toLocaleString()} XP`,
    repFormatted: `${Number(user.rep || 0).toLocaleString()} Rep`,
    projectsCount: Number(user.projectsCount ?? projects.length) || 0,
    completedTasksCount: Number(user.completedTasksCount || 0) || 0,
    mentorStatus: toText(user.mentorStatus, 'None'),
    actions: {
      canWarn: !isDeleted && !isSuspended,
      canSuspend: !isDeleted && !isSuspended && !hasPendingSecondApproval,
      canReactivate: !isDeleted && isSuspended,
      canToggleFlag: !isDeleted,
    },
    projects,
    contributions,
    skills,
    mentorRecommendations,
    warnings,
    recentActivity,
    reputation: {
      total: repTotal,
      page: repPage,
      totalPages: Math.ceil(repTotal / 20) || 1,
      typeFilter: repTypeFilter,
      items: repItems,
    },
    mentorFeedback,
  };
}

export const selectUserDetailsView = (userId) =>
  createSelector(
    [
      selectAdminUserDetailsById(userId),
      selectUserActiveWarningsCount(userId),
      selectAdminUserReputationById(userId),
      (state) => selectAdminMentorFeedbackById(state, userId),
      selectAdminUsersWorking,
      selectAdminDuplicateGroups,
    ],
    (
      user,
      storeActiveWarningsCount,
      reputationState,
      mentorFeedbackData,
      usersWorking,
      duplicateGroups,
    ) =>
      mapUserDetailsToViewModel(user, {
        userId,
        storeActiveWarningsCount,
        reputationState,
        mentorFeedbackData,
        usersWorking,
        duplicateGroups,
      }),
  );
