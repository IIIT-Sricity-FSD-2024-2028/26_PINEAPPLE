import { Injectable, Logger, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileCleanupService } from '../common/services/file-cleanup.service';
import { SECURE_CVS_DIR, UPLOADS_DIR } from '../core/middleware/file-upload.middleware';
import { UsersRepository } from '../users/users.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { CommunicationRepository } from '../communication/communication.repository';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { MentorApplicationsService } from '../mentor-applications/mentor-applications.service';
import { ReportsService } from '../moderation/reports.service';
import { SupportService } from '../support/support.service';

export interface StartupCleanupOptions {
  uploadsDir?: string;
  secureCvsDir?: string;
  exportDir?: string;
}

export interface StartupCleanupSummary {
  enabled: boolean;
  removedCount: number;
  keptSeedCount: number;
}

export function isCleanUploadsOnStartEnabled(): boolean {
  const raw = process.env.CLEAN_UPLOADS_ON_START;
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    const norm = String(raw).trim().toLowerCase();
    return norm !== 'false' && norm !== '0' && norm !== 'no';
  }
  return true;
}

@Injectable()
export class StartupCleanupService {
  private readonly logger = new Logger(StartupCleanupService.name);
  private readonly fallbackFileCleanup = new FileCleanupService();

  constructor(
    private readonly moduleRef: ModuleRef,
    @Optional() private readonly fileCleanupService?: FileCleanupService,
  ) {}

  private getService<T>(token: any): T | undefined {
    try {
      return this.moduleRef.get<T>(token, { strict: false });
    } catch {
      return undefined;
    }
  }

  public collectSeedReferencedFilenames(): { seedUploads: Set<string>; seedCvs: Set<string> } {
    const cleanup = this.fileCleanupService || this.fallbackFileCleanup;
    const seedUploads = new Set<string>();
    const seedCvs = new Set<string>();

    const usersRepo = this.getService<UsersRepository>(UsersRepository);
    const projectsRepo = this.getService<ProjectsRepository>(ProjectsRepository);
    const tasksRepo = this.getService<TasksRepository>(TasksRepository);
    const commRepo = this.getService<CommunicationRepository>(CommunicationRepository);
    const mentorMarketplace = this.getService<MentorMarketplaceService>(MentorMarketplaceService);
    const mentorApps = this.getService<MentorApplicationsService>(MentorApplicationsService);
    const reportsService = this.getService<ReportsService>(ReportsService);
    const supportService = this.getService<SupportService>(SupportService);

    cleanup.extractUploadRefsFromValue(usersRepo?.findAll(true) || [], seedUploads, seedCvs);
    cleanup.extractUploadRefsFromValue(projectsRepo?.findAll(true) || [], seedUploads, seedCvs);
    cleanup.extractUploadRefsFromValue(tasksRepo?.findAll() || [], seedUploads, seedCvs);
    cleanup.extractUploadRefsFromValue(commRepo?.getAllMessages?.() || [], seedUploads, seedCvs);
    cleanup.extractUploadRefsFromValue(
      mentorMarketplace?.getAllMarketplaceRecords?.() || {},
      seedUploads,
      seedCvs,
    );
    cleanup.extractUploadRefsFromValue(mentorApps?.findAll?.() || [], seedUploads, seedCvs);
    cleanup.extractUploadRefsFromValue(reportsService?.getAllRaw?.() || [], seedUploads, seedCvs);
    cleanup.extractUploadRefsFromValue(supportService?.findAll?.() || [], seedUploads, seedCvs);

    return { seedUploads, seedCvs };
  }

  public cleanNonSeedFilesOnDisk(options?: StartupCleanupOptions): {
    removedCount: number;
    keptSeedCount: number;
  } {
    const cleanup = this.fileCleanupService || this.fallbackFileCleanup;
    const uploadsDir = options?.uploadsDir || process.env.UPLOADS_DIR || UPLOADS_DIR;
    const secureCvsDir = options?.secureCvsDir || process.env.SECURE_CVS_DIR || SECURE_CVS_DIR;
    const exportDir =
      options?.exportDir || process.env.EXPORT_DIR || path.join(os.tmpdir(), 'teamforge-exports');

    const { seedUploads, seedCvs } = this.collectSeedReferencedFilenames();

    let removedCount = 0;
    let keptSeedCount = 0;

    const cleanDir = (dirPath: string, keepSet: Set<string>) => {
      if (!dirPath || !fs.existsSync(dirPath)) return;
      let entries: string[] = [];
      try {
        entries = fs.readdirSync(dirPath);
      } catch {
        return;
      }
      for (const entry of entries) {
        const abs = path.join(dirPath, entry);
        let isFile = false;
        try {
          isFile = fs.statSync(abs).isFile();
        } catch {
          continue;
        }
        if (!isFile) continue;

        if (keepSet.has(entry)) {
          keptSeedCount += 1;
          continue;
        }
        try {
          const res = cleanup.safeRemoveFile(abs, false);
          if (res.removed) removedCount += 1;
        } catch (err: any) {
          this.logger.warn(`[StartupCleanupService] Failed removing file ${abs}: ${err?.message || err}`);
        }
      }
    };

    cleanDir(uploadsDir, seedUploads);
    cleanDir(secureCvsDir, seedCvs);
    cleanDir(exportDir, new Set<string>());

    return { removedCount, keptSeedCount };
  }

  public cleanOrphanFilesOnStartup(options?: StartupCleanupOptions): StartupCleanupSummary {
    if (!isCleanUploadsOnStartEnabled()) {
      this.logger.log('[StartupCleanupService] Startup upload cleanup disabled (CLEAN_UPLOADS_ON_START=false).');
      return { enabled: false, removedCount: 0, keptSeedCount: 0 };
    }
    const { removedCount, keptSeedCount } = this.cleanNonSeedFilesOnDisk(options);
    this.logger.log(
      `[StartupCleanupService] Removed ${removedCount} orphan file(s) from uploads, CVs, and exports on startup (kept ${keptSeedCount} seed file(s)).`,
    );
    return { enabled: true, removedCount, keptSeedCount };
  }
}
