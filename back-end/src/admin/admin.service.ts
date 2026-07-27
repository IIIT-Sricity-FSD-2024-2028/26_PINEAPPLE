import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { UsersService } from '../users/users.service';



import { ModerateUserDto } from './dto/moderate-user.dto';
import { WarnUserDto } from './dto/warn-user.dto';
import { AdminStatsEntity } from './entities/admin-stats.entity';
import { AuditLogEntry } from './entities/audit-log-entry.entity';
import { UserStatus } from '../users/dto/create-user.dto';

@Injectable()
export class AdminService {
  private readonly auditLog: AuditLogEntry[] = [];

  constructor(
    private readonly usersService: UsersService,
    private readonly projectsService: ProjectsService,
    private readonly tasksService: TasksService,
  ) {}

  getUsers() {
    return this.usersService.findAll();
  }

  updateUserStatus(id: string, payload: ModerateUserDto, performedBy = 'admin') {
    const allowedStatuses = [UserStatus.Active, UserStatus.Suspended, UserStatus.Flagged, UserStatus.Banned];
    if (!allowedStatuses.includes(payload.status as any)) {
      throw new BadRequestException(`Invalid status: ${payload.status}`);
    }

    const updatedUser = this.usersService.update(id, { status: payload.status });
    this.logAudit({
      action: 'update-status',
      entityType: 'user',
      entityId: id,
      performedBy,
      details: { status: payload.status },
    });

    return updatedUser;
  }

  flagUser(id: string, performedBy = 'admin') {
    const updatedUser = this.usersService.update(id, { status: UserStatus.Flagged });
    this.logAudit({
      action: 'flag-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      details: { status: UserStatus.Flagged },
    });
    return updatedUser;
  }

  suspendUser(id: string, performedBy = 'admin') {
    const updatedUser = this.usersService.update(id, { status: UserStatus.Suspended });
    this.logAudit({
      action: 'suspend-user',
      entityType: 'user',
      entityId: id,
      performedBy,
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

    const updatedUser = this.usersService.update(id, { data: updatedData } as any);
    this.logAudit({
      action: 'warn-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      details: { reason: payload.reason },
    });
    return updatedUser;
  }

  getStats(): AdminStatsEntity {
    const users = this.usersService.findAll();
    const projects = this.projectsService.findAll();
    const tasks = this.tasksService.findAll();

    const stats: AdminStatsEntity = {
      totalUsers: users.length,
      activeUsers: users.filter((user: any) => user.status === UserStatus.Active).length,
      suspendedUsers: users.filter((user: any) => user.status === UserStatus.Suspended).length,
      flaggedUsers: users.filter((user: any) => user.status === UserStatus.Flagged).length,
      bannedUsers: users.filter((user: any) => user.status === UserStatus.Banned).length,
      totalProjects: projects.length,
      openProjects: projects.filter((project: any) => project.status === 'open').length,
      inProgressProjects: projects.filter((project: any) => project.status === 'in-progress').length,
      completedProjects: projects.filter((project: any) => project.status === 'completed').length,
      cancelledProjects: projects.filter((project: any) => project.status === 'cancelled').length,
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((task: any) => task.status === 'pending').length,
      inProgressTasks: tasks.filter((task: any) => task.status === 'in-progress').length,
      submittedTasks: tasks.filter((task: any) => task.status === 'submitted').length,
      approvedTasks: tasks.filter((task: any) => task.status === 'approved').length,
    };

    return stats;
  }

  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  private logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
    this.auditLog.unshift({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    });
  }
}
