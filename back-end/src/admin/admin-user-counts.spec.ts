import { AdminService } from './admin.service';
import { isPlatformUser } from '../common/utils/platform-user.util';
import { UserRole, UserStatus } from '../users/dto/create-user.dto';

describe('isPlatformUser & AdminService.getUserCounts()', () => {
  it('isPlatformUser classifies user/collaborator/owner/mentor as true and admins/Super User/deleted/anonymised as false', () => {
    expect(isPlatformUser({ id: '10', role: 'user', status: 'Active' })).toBe(true);
    expect(isPlatformUser({ id: '11', role: UserRole.Collaborator, status: 'Active' })).toBe(true);
    expect(isPlatformUser({ id: '12', role: UserRole.ProjectOwner, status: 'Active' })).toBe(true);
    expect(isPlatformUser({ id: '13', role: 'owner', status: 'Suspended' })).toBe(true);
    expect(isPlatformUser({ id: '14', role: UserRole.Mentor, status: 'Warned' })).toBe(true);

    expect(isPlatformUser({ id: '1', role: UserRole.Administrator, status: 'Active' })).toBe(false);
    expect(isPlatformUser({ id: 'u-admin', role: 'admin', status: 'Active' })).toBe(false);
    expect(isPlatformUser({ id: 'u-superuser', role: UserRole.SuperUser, status: 'Active' })).toBe(false);
    expect(isPlatformUser({ id: '99', role: 'superuser', status: 'Active' })).toBe(false);
    expect(isPlatformUser({ id: 'pa-1', portalRole: 'admin', email: 'pa@teamforge.io' })).toBe(false);
    expect(isPlatformUser({ id: '15', role: UserRole.Collaborator, isDeleted: true })).toBe(false);
    expect(isPlatformUser({ id: '16', role: UserRole.Mentor, deletedAt: '2026-01-01T00:00:00.000Z' })).toBe(false);
    expect(isPlatformUser({ id: '17', role: 'user', name: 'Deleted user', email: 'deleted-abc@deleted.local' })).toBe(false);
    expect(isPlatformUser({ id: '18', role: 'user', anonymized: true })).toBe(false);
    expect(isPlatformUser({ id: '19', role: 'user', isDuplicate: true })).toBe(false);
    expect(isPlatformUser({ id: '20', role: 'user', isHidden: true })).toBe(false);
  });

  it('getUserCounts excludes 2 admins, 1 Super User, deleted, and anonymised accounts so 9 platform users give total=9 (never 12)', () => {
    const fixtureUsers = [
      // 9 platform users (collaborators, owners, mentors; mix of active/warned/flagged/suspended)
      { id: '2', name: 'Collab 1', role: UserRole.Collaborator, status: UserStatus.Active, flags: false },
      { id: '3', name: 'Mentor 1', role: UserRole.Mentor, status: UserStatus.Active, flags: false },
      { id: '4', name: 'Owner 1', role: UserRole.ProjectOwner, status: UserStatus.Active, flags: false },
      { id: '5', name: 'Warned User', role: UserRole.Collaborator, status: UserStatus.Warned, activeWarningsCount: 1, flags: true },
      { id: '6', name: 'Flagged User', role: UserRole.Mentor, status: UserStatus.Flagged, flags: true },
      { id: '7', name: 'Suspended User', role: UserRole.Collaborator, status: UserStatus.Suspended, flags: false },
      { id: '8', name: 'User 7', role: 'user', status: UserStatus.Active, flags: false },
      { id: 'u-collab', name: 'Aditya', role: UserRole.Collaborator, status: UserStatus.Active, flags: false },
      { id: 'u-owner', name: 'Jathin', role: UserRole.ProjectOwner, status: UserStatus.Active, flags: false },
      // 2 admins + 1 Super User (must never be counted)
      { id: '1', name: 'Priya Patel', role: UserRole.Administrator, status: UserStatus.Active, flags: false },
      { id: 'u-admin', name: 'Default Admin', role: UserRole.Administrator, status: UserStatus.Active, flags: false },
      { id: 'u-superuser', name: 'Super User', role: UserRole.SuperUser, status: UserStatus.Active, flags: false },
      // Deleted and anonymised accounts (must never be counted)
      { id: '90', name: 'Deleted User', role: UserRole.Collaborator, email: 'deleted-90@deleted.local', isDeleted: true },
      { id: '91', name: 'Anonymised User', role: UserRole.Mentor, anonymized: true },
    ];

    const service = new AdminService(
      { findAll: () => fixtureUsers } as any,
      { findAll: () => [] } as any,
      { findAll: () => [] } as any,
      { count: () => 5 } as any,
      { findByStatus: () => [] } as any,
      { findAll: () => [{ id: 'pa-1', status: 'active' }] } as any,
      { getConfig: () => ({}) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      {
        getDuplicateGroups: () => ({
          groups: [{ key: 'email:dup', users: [{ id: '8' }, { id: '2' }] }],
          totalGroups: 1,
          totalFlaggedUsers: 2,
        }),
      } as any,
      {
        getPendingModerationActions: () => [{ id: 'act-1', status: 'pending' }],
      } as any,
    );

    const counts = service.getUserCounts();
    const stats = service.getStats();

    expect(counts).toEqual({
      total: 9,
      active: 8,
      suspended: 1,
      flagged: 4, // id '5' (flags), '6' (Flagged), plus '2' & '8' (in duplicate group)
      warned: 1, // id '5'
      possibleDuplicates: 1,
      pendingApprovals: 1,
    });
    expect(counts.active + counts.suspended).toBe(counts.total);

    expect(stats.totalUsers).toBe(9);
    expect(stats.activeUsers).toBe(8);
    expect(stats.suspendedUsers).toBe(1);
    expect(stats.flaggedUsers).toBe(4);
    expect(stats.warnedUsers).toBe(1);
    expect(stats.flaggedWarned).toBe(4);
    expect(stats.activeAdmins).toBe(1);
    expect(stats.counts).toEqual(counts);
  });
});
