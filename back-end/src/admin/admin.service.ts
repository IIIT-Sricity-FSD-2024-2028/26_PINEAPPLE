import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../users/entities/user.entity';
import { ProjectEntity } from '../projects/entities/project.entity';
import { TaskEntity } from '../tasks/entities/task.entity';
import { ModerateUserDto } from './dto/moderate-user.dto';
import { WarnUserDto } from './dto/warn-user.dto';
import { AdminStatsEntity } from './entities/admin-stats.entity';
import { AuditLogEntry } from './entities/audit-log-entry.entity';

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
    const allowedStatuses = ['active', 'suspended', 'flagged', 'banned'] as const;
    if (!allowedStatuses.includes(payload.status)) {
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
    const updatedUser = this.usersService.update(id, { status: 'flagged' });
    this.logAudit({
      action: 'flag-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      details: { status: 'flagged' },
    });
    return updatedUser;
  }

  suspendUser(id: string, performedBy = 'admin') {
    const updatedUser = this.usersService.update(id, { status: 'suspended' });
    this.logAudit({
      action: 'suspend-user',
      entityType: 'user',
      entityId: id,
      performedBy,
      details: { status: 'suspended' },
    });
    return updatedUser;
  }

  warnUser(id: string, payload: WarnUserDto, performedBy = 'admin') {
    const user = this.usersService.findOne(id);
    const warningRecord = {
      reason: payload.reason,
      issuedBy: performedBy,
      issuedAt: new Date().toISOString(),
    };
    const warnings = Array.isArray(user.data?.warnings) ? user.data.warnings : [];
    const updatedData = {
      ...user.data,
      warnings: [...warnings, warningRecord],
    };

    const updatedUser = this.usersService.update(id, { data: updatedData });
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
      activeUsers: users.filter((user: UserEntity) => user.status === 'active').length,
      suspendedUsers: users.filter((user: UserEntity) => user.status === 'suspended').length,
      flaggedUsers: users.filter((user: UserEntity) => user.status === 'flagged').length,
      bannedUsers: users.filter((user: UserEntity) => user.status === 'banned').length,
      totalProjects: projects.length,
      openProjects: projects.filter((project: ProjectEntity) => project.status === 'open').length,
      inProgressProjects: projects.filter((project: ProjectEntity) => project.status === 'in-progress').length,
      completedProjects: projects.filter((project: ProjectEntity) => project.status === 'completed').length,
      cancelledProjects: projects.filter((project: ProjectEntity) => project.status === 'cancelled').length,
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((task: TaskEntity) => task.status === 'pending').length,
      inProgressTasks: tasks.filter((task: TaskEntity) => task.status === 'in-progress').length,
      submittedTasks: tasks.filter((task: TaskEntity) => task.status === 'submitted').length,
      approvedTasks: tasks.filter((task: TaskEntity) => task.status === 'approved').length,
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
