/**
 * Canonical project visibility predicate (Phase 18: Soft Delete).
 * Soft-deleted projects (deletedAt set) are hidden from all standard lists,
 * searches, marketplace views, leaderboards, and active-project counts unless
 * includeDeleted is explicitly enabled for administrators.
 */
export function isVisibleProject(
  project: ({ deletedAt?: string | Date | null; deletionScheduledAt?: string | Date | null } & Record<string, any>) | null | undefined,
  options?: { includeDeleted?: boolean },
): boolean {
  if (!project) return false;
  if (project.deletedAt || project.deletionScheduledAt) {
    return Boolean(options?.includeDeleted);
  }
  return true;
}

const NON_LIVE_PROJECT_STATUSES = new Set([
  'closed',
  'completed',
  'cancelled',
]);

/**
 * Canonical live-project predicate (Phase 24).
 * Returns true only when the project exists, is not soft-deleted, is not
 * scheduled for deletion, is not completed, and has a status other than closed, completed, or cancelled.
 */
export function isLiveProject(
  project:
    | ({
        deletedAt?: string | Date | null;
        deletionScheduledAt?: string | Date | null;
        status?: string;
        isCompleted?: boolean;
      } & Record<string, any>)
    | null
    | undefined,
): boolean {
  if (!project) return false;
  if (project.deletedAt) return false;
  if (project.deletionScheduledAt) return false;
  if (project.isCompleted === true) return false;
  const statusLower =
    typeof project.status === 'string' ? project.status.toLowerCase().trim() : '';
  if (NON_LIVE_PROJECT_STATUSES.has(statusLower)) return false;
  return true;
}

export function isProjectLocked(
  project?: ({ deletedAt?: string | Date | null; deletionScheduledAt?: string | Date | null; status?: string; isCompleted?: boolean } & Record<string, any>) | null,
): boolean {
  if (!project) return false;
  if (project.deletedAt) return true;
  if (project.deletionScheduledAt) return true;
  if (project.isCompleted === true) return true;
  const status = typeof project.status === 'string' ? project.status.toLowerCase().trim() : '';
  if (status === 'completed' || status === 'closed') return true;
  return false;
}
