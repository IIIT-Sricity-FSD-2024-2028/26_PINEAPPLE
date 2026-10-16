import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { MentorApplicationsService } from '../mentor-applications/mentor-applications.service';
import { PortalAdminsService } from '../portal-admins/portal-admins.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { UpdatePlatformConfigDto } from '../platform-config/dto/update-platform-config.dto';
import { ModerateUserDto } from './dto/moderate-user.dto';
import { WarnUserDto } from './dto/warn-user.dto';
import { AdminStatsEntity } from './entities/admin-stats.entity';
import { AuditLogEntry } from './entities/audit-log-entry.entity';
import { UserStatus } from '../users/dto/create-user.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly projectsService: ProjectsService,
    private readonly tasksService: TasksService,
    private readonly auditService: AuditService,
    private readonly mentorApplicationsService: MentorApplicationsService,
    private readonly portalAdminsService: PortalAdminsService,
    private readonly platformConfigService: PlatformConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  getConfig() {
    return this.platformConfigService.getConfig();
  }

  updateConfig(dto: UpdatePlatformConfigDto) {
    const updated = this.platformConfigService.updateConfig(dto);
    try {
      this.auditService.log({
        action: 'config-saved',
        actor: 'Super User',
        target: 'Platform Configuration',
        entityType: 'platform_config',
        entityId: 'global',
        event: 'Super User committed platform configuration updates',
        details: dto,
      });
    } catch { /* non-critical */ }
    return updated;
  }

  getUsers() {
    const users = this.usersService.findAll();
    return users.map((u: any) => {
      const xp = u.profile?.xp ?? u.xp ?? 0;
      const rep = u.profile?.rep ?? u.rep ?? 0;
      const university = u.profile?.uni || u.university || 'Unknown University';
      const userProjects = (u.data?.projects?.length ?? 0) || this.projectsService.findByOwnerId(u.id).length;
      return {
        ...u,
        xp,
        rep,
        university,
        projects: userProjects,
      };
    });
  }

  getUserDetails(id: string) {
    const user = this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Never return password, secrets, or internal auth hashes
    const { password, salt, ...safeUser } = user as any;

    const xp = safeUser.profile?.xp ?? safeUser.xp ?? 0;
    const rep = safeUser.profile?.rep ?? safeUser.rep ?? 0;
    const university = safeUser.profile?.uni || (safeUser.profile as any)?.university || safeUser.university || 'Not specified';
    const skills = safeUser.profile?.skills || safeUser.skills || [];

    // Projects: all projects owned by user or where user is member/collaborator
    const allProjects = this.projectsService.findAll();
    const userProjects = allProjects.filter((p: any) => {
      const isOwner = String(p.ownerId) === String(id);
      const isCollab = Array.isArray(p.collaborators) && p.collaborators.some((c: any) => String(c.id || c.userId) === String(id));
      const isMember = Array.isArray(p.members) && p.members.some((m: any) => String(m.id || m.userId) === String(id));
      return isOwner || isCollab || isMember;
    }).map((p: any) => ({
      id: p.id,
      title: p.title || p.name || 'Untitled Project',
      difficulty: p.difficulty || 'Medium',
      status: p.status || 'Active',
      isCompleted: Boolean(p.isCompleted),
      progress: p.progress ?? 0,
      role: String(p.ownerId) === String(id) ? 'Owner' : 'Collaborator',
      createdAt: p.createdAt,
    }));

    // Tasks / Contributions
    const allTasks = this.tasksService.findAll();
    const userTasks = allTasks.filter((t: any) => String(t.assigneeId) === String(id)).map((t: any) => ({
      id: t.id,
      projectId: t.projectId,
      projectName: t.projectName || allProjects.find((p: any) => String(p.id) === String(t.projectId))?.title || 'Project',
      title: t.title,
      status: t.status,
      priority: t.priority || 'medium',
      xpAwarded: Boolean(t.xpAwarded),
      awardedXp: t.awardedXp ?? (t.xpReward || 50),
      createdAt: t.createdAt,
    }));

    // Mentor Status
    let mentorStatus = 'None';
    const normRole = String(safeUser.role || '').toLowerCase();
    if (normRole === 'mentor') {
      mentorStatus = 'Approved Mentor';
    } else {
      const apps = this.mentorApplicationsService.findAll();
      const userApp = apps.find((a: any) => String(a.userId) === String(id) || (safeUser.email && a.email === safeUser.email));
      if (userApp) {
        mentorStatus = userApp.status === 'approved' ? 'Approved Mentor' : userApp.status === 'rejected' ? 'Application Rejected' : 'Application Pending';
      }
    }

    // Recent Activity from Audit Log
    const allAudit = this.auditService.findAll();
    const userAudit = allAudit.filter((entry: any) => {
      return (
        String(entry.entityId) === String(id) ||
        entry.actor === safeUser.name ||
        entry.performedBy === safeUser.email ||
        entry.performedBy === safeUser.name ||
        (entry.target && typeof entry.target === 'string' && entry.target.includes(safeUser.name))
      );
    }).slice(0, 10);

    return {
      id: safeUser.id,
      name: safeUser.name,
      email: safeUser.email,
      username: safeUser.username || safeUser.name,
      role: safeUser.role || 'Collaborator',
      university,
      status: safeUser.status || 'Active',
      flags: Boolean(safeUser.flags || safeUser.flagged),
      flagged: Boolean(safeUser.flags || safeUser.flagged),
      warnings: typeof safeUser.warnings === 'number'
        ? safeUser.warnings
        : Array.isArray(safeUser.data?.warnings)
        ? safeUser.data.warnings.length
        : 0,
      joinedDate: safeUser.createdAt || safeUser.profile?.joined || safeUser.joinedDate || 'Jan 15, 2024',
      xp,
      rep,
      skills,
      mentorStatus,
      projectsCount: userProjects.length,
      completedTasksCount: userTasks.filter((t: any) => {
        const s = String(t.status).toLowerCase();
        return s === 'completed' || s === 'approved';
      }).length,
      projects: userProjects,
      contributions: userTasks,
      recentActivity: userAudit,
      mentorRecommendations: safeUser.data?.mentorRecommendations || [],
    };
  }

  login(credentials: any) {
    const { email, password } = credentials || {};
    const normEmail = String(email || '').trim().toLowerCase();

    // 1. Superuser hardcoded root credential
    if (normEmail === 'superuser@teamforge.io' && password === 'Super@123') {
      this.auditService.log({
        action: 'login',
        entityType: 'superuser',
        entityId: 'superuser',
        performedBy: 'superuser@teamforge.io',
        actor: 'Super User',
        target: 'Super User Portal',
        event: 'Super User (superuser@teamforge.io) logged into Portal',
      });
      return {
        token: 'mock-su-token-456',
        role: 'superuser',
        permissions: ['*'],
        name: 'Super User',
        email: 'superuser@teamforge.io',
      };
    }

    // 2. Default Admin hardcoded credential
    if (normEmail === 'admin@teamforge.io' && password === 'admin123') {
      this.auditService.log({
        action: 'login',
        entityType: 'admin',
        entityId: 'admin',
        performedBy: 'admin@teamforge.io',
        actor: 'Admin',
        target: 'Admin Portal',
        event: 'Admin (admin@teamforge.io) logged into Admin Portal',
      });
      return {
        token: 'mock-admin-token-123',
        role: 'admin',
        permissions: ['*'],
        name: 'Default Admin',
        email: 'admin@teamforge.io',
      };
    }

    // 3. Dynamic Portal Admins created by Super User
    const portalAdmin = this.portalAdminsService.findByEmail(normEmail);
    if (portalAdmin) {
      if (portalAdmin.password !== password) {
        throw new BadRequestException('Invalid credentials');
      }

      if ((portalAdmin.status || 'active').toLowerCase() === 'suspended' || (portalAdmin.status || 'active').toLowerCase() === 'disabled') {
        throw new ForbiddenException('This admin account is suspended or disabled. Contact super user.');
      }

      portalAdmin.lastLogin = new Date().toISOString();

      try {
        this.auditService.log({
          action: 'admin-login',
          entityType: 'portal_admin',
          entityId: portalAdmin.id,
          performedBy: portalAdmin.email,
          actor: portalAdmin.name || 'Admin',
          target: 'Portal',
          event: `Portal Admin "${portalAdmin.name}" (${portalAdmin.email}) logged into Portal`,
          details: { permissions: portalAdmin.permissions },
        });
      } catch { /* non-critical */ }

      return {
        token: `portal-token-${portalAdmin.id}`,
        role: portalAdmin.portalRole || 'admin',
        permissions: Array.isArray(portalAdmin.permissions) ? portalAdmin.permissions : ['dashboard'],
        name: portalAdmin.name,
        email: portalAdmin.email,
      };
    }

    throw new BadRequestException('Invalid credentials');
  }

  updateUserStatus(id: string, payload: ModerateUserDto, performedBy = 'admin') {
    if (payload.status === UserStatus.Suspended) {
      return this.suspendUser(id, performedBy);
    }
    const allowedStatuses = [UserStatus.Active, UserStatus.Suspended, UserStatus.Flagged, UserStatus.Banned];
    if (!allowedStatuses.includes(payload.status as any)) {
      throw new BadRequestException(`Invalid status: ${payload.status}`);
    }

    const isActivating = payload.status === UserStatus.Active;
    const updatedUser = this.usersService.update(id, {
      status: payload.status,
      ...(isActivating ? { flags: false, flagged: false } : {}),
    });
    const targetName = updatedUser ? updatedUser.name : `User #${id}`;

    this.auditService.log({
      action: payload.status === UserStatus.Active ? 'reactivate-user' : 'update-status',
      entityType: 'user',
      entityId: id,
      performedBy,
      actor: performedBy,
      target: targetName,
      event: `Admin updated status for ${targetName} to ${payload.status}`,
      details: { status: payload.status },
    });

    return updatedUser;
  }

  flagUser(id: string, performedBy = 'admin') {
    const updatedUser = this.usersService.update(id, { status: UserStatus.Flagged, flags: true });
    const targetName = updatedUser ? updatedUser.name : `User #${id}`;

    this.auditService.log({
      action: 'flag-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      actor: performedBy,
      target: targetName,
      event: `Admin flagged account for ${targetName}`,
      details: { status: UserStatus.Flagged, flagged: true },
    });
    return updatedUser;
  }

  suspendUser(id: string, performedBy = 'admin') {
    const updatedUser = this.usersService.update(id, { status: UserStatus.Suspended });
    const targetName = updatedUser ? updatedUser.name : `User #${id}`;

    try {
      this.notificationsService.create({
        userId: String(id),
        type: 'ACCOUNT_SUSPENDED',
        title: 'Account Suspended',
        message: '⚠️ Your account has been suspended by an administrator. Contact support for assistance.',
        readStatus: false,
      });
    } catch { /* non-critical */ }

    this.auditService.log({
      action: 'suspend-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      actor: performedBy,
      target: targetName,
      event: `Admin suspended account for ${targetName}`,
      details: { status: UserStatus.Suspended },
    });
    return updatedUser;
  }

  warnUser(id: string, payload: WarnUserDto, performedBy = 'admin') {
    const user = this.usersService.findById(id);
    const warningRecord = {
      reason: payload.reason,
      issuedBy: performedBy,
      issuedAt: new Date().toISOString(),
    };
    const userData = (user as any).data || {};
    const warnings = Array.isArray(userData.warnings) ? userData.warnings : [];
    const updatedData = {
      ...userData,
      warnings: [...warnings, warningRecord],
    };

    const updatedUser = this.usersService.update(id, { 
      data: updatedData,
      status: UserStatus.Warned,
      flags: true 
    } as any);

    const targetName = user ? user.name : `User #${id}`;

    try {
      this.notificationsService.create({
        userId: String(id),
        type: 'ACCOUNT_WARNED',
        title: 'Official Account Warning',
        message: `⚠️ You have received an official account warning. Reason: ${payload.reason}`,
        readStatus: false,
      });
    } catch { /* non-critical */ }

    this.auditService.log({
      action: 'warn-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      actor: performedBy,
      target: targetName,
      event: `Admin issued warning to ${targetName}: ${payload.reason}`,
      details: { reason: payload.reason },
    });
    return updatedUser;
  }

  getStats(): AdminStatsEntity {
    const users = this.usersService.findAll();
    const projects = this.projectsService.findAll();
    const tasks = this.tasksService.findAll();

    const activeUsers = users.filter((user: any) => (user.status || 'Active').toLowerCase() === 'active').length;
    const suspendedUsers = users.filter((user: any) => (user.status || '').toLowerCase() === 'suspended').length;
    const flaggedUsers = users.filter((user: any) => (user.status || '').toLowerCase() === 'flagged').length;
    const warnedUsers = users.filter((user: any) => (user.status || '').toLowerCase() === 'warned' || (user.flags && (user.status || '').toLowerCase() !== 'suspended' && (user.status || '').toLowerCase() !== 'flagged')).length;
    const bannedUsers = users.filter((user: any) => (user.status || '').toLowerCase() === 'banned').length;
    const flaggedWarned = flaggedUsers + warnedUsers;

    let pendingMentorApps = 0;
    try {
      pendingMentorApps = this.mentorApplicationsService.findByStatus('pending' as any).length;
    } catch {
      pendingMentorApps = 0;
    }

    const auditEvents = this.auditService.count();
    const activeAdmins = this.portalAdminsService
      .findAll()
      .filter((a) => (a.status || 'active').toLowerCase() === 'active').length;

    const stats: AdminStatsEntity = {
      totalUsers: users.length,
      activeUsers,
      activeAdmins,
      suspendedUsers,
      flaggedUsers,
      bannedUsers,
      warnedUsers,
      flaggedWarned,
      pendingMentorApps,
      auditEvents,
      totalProjects: projects.length,
      openProjects: projects.filter((project: any) => (project.status || '').toLowerCase() === 'open').length,
      inProgressProjects: projects.filter((project: any) => (project.status || '').toLowerCase() === 'in-progress' || (project.status || '').toLowerCase() === 'inprogress').length,
      completedProjects: projects.filter((project: any) => (project.status || '').toLowerCase() === 'completed' || project.isCompleted === true).length,
      cancelledProjects: projects.filter((project: any) => (project.status || '').toLowerCase() === 'cancelled').length,
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((task: any) => (task.status || '').toLowerCase() === 'pending' || (task.status || '').toLowerCase() === 'open').length,
      inProgressTasks: tasks.filter((task: any) => (task.status || '').toLowerCase() === 'in-progress' || (task.status || '').toLowerCase() === 'inprogress').length,
      submittedTasks: tasks.filter((task: any) => (task.status || '').toLowerCase() === 'submitted').length,
      approvedTasks: tasks.filter((task: any) => (task.status || '').toLowerCase() === 'approved' || (task.status || '').toLowerCase() === 'completed').length,
    };

    return stats;
  }

  getAuditLog(): AuditLogEntry[] {
    return this.auditService.findAll();
  }

  logClientAudit(entry: any) {
    return this.auditService.log(entry);
  }
}
