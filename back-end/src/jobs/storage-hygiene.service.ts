import { Injectable, Logger, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ClockService } from '../common/services/clock.service';
import { UsersRepository } from '../users/users.repository';
import { DataExportService } from '../users/data-export.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { CommunicationRepository } from '../communication/communication.repository';
import { ReportsService } from '../moderation/reports.service';
import { SupportService } from '../support/support.service';
import { MentorApplicationsService } from '../mentor-applications/mentor-applications.service';
import { MentorMarketplaceService } from '../mentor-marketplace/mentor-marketplace.service';
import { EscrowService } from '../escrow/escrow.service';
import { EscrowState } from '../escrow/entities/escrow-account.entity';
import { FileCleanupService } from '../common/services/file-cleanup.service';
import { SECURE_CVS_DIR, UPLOADS_DIR } from '../core/middleware/file-upload.middleware';

export const ORPHAN_UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const PROJECT_TOMBSTONE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface StorageHygieneCounts {
  dryRun: boolean;
  orphanUploadsRemoved: number;
  expiredExportsRemoved: number;
  orphanExportsRemoved: number;
  deletedAccountCvsRemoved: number;
  projectTombstonesRemoved: number;
  keptReferencedUploads: number;
  keptRecentUploads: number;
  keptProjectsNeededByEscrow: number;
}

export interface StorageHygieneResult {
  dryRun: boolean;
  checkedAt: string;
  itemsProcessed: number;
  counts: StorageHygieneCounts;
  errors: string[];
}

export interface StorageHygieneOptions {
  dryRun?: boolean;
  uploadsDir?: string;
  secureCvsDir?: string;
  exportDir?: string;
}

const IN_FLIGHT_SESSION_STATUSES = new Set<string>([
  'payment_pending',
  'escrow_funded',
  'active',
  'payout_pending',
  'disputed',
  'needs_review',
]);

@Injectable()
export class StorageHygieneService {
  private readonly logger = new Logger(StorageHygieneService.name);
  private hasExecutedOnce = false;
  private lastResult: StorageHygieneResult | null = null;
  private readonly fallbackFileCleanup = new FileCleanupService();

  constructor(
    private readonly moduleRef: ModuleRef,
    @Optional() private readonly clockService?: ClockService,
    @Optional() private readonly fileCleanupService?: FileCleanupService,
  ) {}

  private getCleanupService(): FileCleanupService {
    return this.fileCleanupService || this.fallbackFileCleanup;
  }

  private getService<T>(token: any): T | undefined {
    try {
      return this.moduleRef.get<T>(token, { strict: false });
    } catch {
      return undefined;
    }
  }

  private nowMs(): number {
    return this.clockService ? this.clockService.now().getTime() : Date.now();
  }

  private nowIso(): string {
    return this.clockService ? this.clockService.nowIso() : new Date().toISOString();
  }

  private resolveDryRun(explicit?: boolean): boolean {
    if (explicit !== undefined) {
      return Boolean(explicit);
    }
    const envVal = process.env.STORAGE_HYGIENE_DRY_RUN;
    if (envVal === 'true' || envVal === '1') {
      return true;
    }
    if (envVal === 'false' || envVal === '0') {
      return false;
    }
    // Safe rollout: default to dry-run on first run in non-test environments when unset
    if (process.env.NODE_ENV !== 'test' && !this.hasExecutedOnce) {
      return true;
    }
    return false;
  }

  getLastResult(): StorageHygieneResult | null {
    return this.lastResult;
  }

  resetRunState(): void {
    this.hasExecutedOnce = false;
    this.lastResult = null;
  }

  private collectReferencesFromValue(
    value: unknown,
    uploadRefs: Set<string>,
    cvRefs: Set<string>,
    visited: Set<unknown> = new Set(),
  ): void {
    this.getCleanupService().extractUploadRefsFromValue(value, uploadRefs, cvRefs, visited);
  }

  private safeRemoveFile(filePath: string, dryRun: boolean, errors: string[]): boolean {
    return this.getCleanupService().safeRemoveFile(filePath, dryRun, errors).removed;
  }

  runHygiene(options?: StorageHygieneOptions): StorageHygieneResult {
    const dryRun = this.resolveDryRun(options?.dryRun);
    this.hasExecutedOnce = true;

    const nowMs = this.nowMs();
    const checkedAt = this.nowIso();
    const errors: string[] = [];

    const uploadsDir = options?.uploadsDir || UPLOADS_DIR;
    const secureCvsDir = options?.secureCvsDir || SECURE_CVS_DIR;
    const exportDir =
      options?.exportDir || process.env.EXPORT_DIR || path.join(os.tmpdir(), 'teamforge-exports');

    const usersRepo = this.getService<UsersRepository>(UsersRepository);
    const projectsRepo = this.getService<ProjectsRepository>(ProjectsRepository);
    const tasksRepo = this.getService<TasksRepository>(TasksRepository);
    const commRepo = this.getService<CommunicationRepository>(CommunicationRepository);
    const reportsService = this.getService<ReportsService>(ReportsService);
    const supportService = this.getService<SupportService>(SupportService);
    const mentorAppsService = this.getService<MentorApplicationsService>(MentorApplicationsService);
    const mentorMarketplaceService = this.getService<MentorMarketplaceService>(MentorMarketplaceService);
    const escrowService = this.getService<EscrowService>(EscrowService);
    const dataExportService = this.getService<DataExportService>(DataExportService);

    const allUsers = usersRepo ? usersRepo.findAll(true) : [];
    const deletedUserIds = new Set<string>(
      allUsers.filter((u) => Boolean(u.isDeleted || u.deletedAt)).map((u) => String(u.id)),
    );

    const counts: StorageHygieneCounts = {
      dryRun,
      orphanUploadsRemoved: 0,
      expiredExportsRemoved: 0,
      orphanExportsRemoved: 0,
      deletedAccountCvsRemoved: 0,
      projectTombstonesRemoved: 0,
      keptReferencedUploads: 0,
      keptRecentUploads: 0,
      keptProjectsNeededByEscrow: 0,
    };

    // ────────────────────────────────────────────────────────────────────────
    // 1. Gather all referenced upload filenames and active/deleted CV files
    // ────────────────────────────────────────────────────────────────────────
    const referencedUploads = new Set<string>();
    const activeCvRefs = new Set<string>();
    const deletedAccountCvRefs = new Set<string>();

    this.collectReferencesFromValue(allUsers, referencedUploads, new Set());
    this.collectReferencesFromValue(projectsRepo ? projectsRepo.findAll(true) : [], referencedUploads, new Set());
    this.collectReferencesFromValue(tasksRepo ? tasksRepo.findAll() : [], referencedUploads, new Set());
    this.collectReferencesFromValue(commRepo?.getAllMessages?.() || [], referencedUploads, new Set());
    this.collectReferencesFromValue(reportsService?.getAllRaw?.() || [], referencedUploads, new Set());
    this.collectReferencesFromValue(supportService?.findAll?.() || [], referencedUploads, new Set());
    this.collectReferencesFromValue(mentorMarketplaceService?.getAllMarketplaceRecords?.() || {}, referencedUploads, new Set());

    const mentorApps = mentorAppsService ? mentorAppsService.findAll() : [];
    for (const app of mentorApps) {
      const uid = String(app.userId || '');
      const isDeletedAccount = uid ? deletedUserIds.has(uid) : false;
      const appUploadRefs = new Set<string>();
      const appCvRefs = new Set<string>();
      this.collectReferencesFromValue(app, appUploadRefs, appCvRefs);
      if (app.cvFileName) {
        appCvRefs.add(path.basename(String(app.cvFileName)));
      }

      if (isDeletedAccount) {
        for (const cvName of appCvRefs) {
          deletedAccountCvRefs.add(cvName);
        }
        if (!dryRun && (app.cvFileName || app.cvUrl)) {
          app.cvFileName = undefined;
          app.cvUrl = undefined;
        }
      } else {
        for (const upName of appUploadRefs) {
          referencedUploads.add(upName);
        }
        for (const cvName of appCvRefs) {
          activeCvRefs.add(cvName);
        }
      }
    }

    // Never purge a CV file if it is also actively linked to a non-deleted account
    for (const cvName of activeCvRefs) {
      deletedAccountCvRefs.delete(cvName);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 2. Clean orphan uploaded files older than 24 hours in UPLOADS_DIR
    // ────────────────────────────────────────────────────────────────────────
    if (uploadsDir && fs.existsSync(uploadsDir)) {
      let entries: string[] = [];
      try {
        entries = fs.readdirSync(uploadsDir);
      } catch (err: any) {
        errors.push(`Failed to read uploadsDir ${uploadsDir}: ${err?.message || err}`);
      }

      for (const name of entries) {
        const filePath = path.join(uploadsDir, name);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(filePath);
        } catch {
          continue;
        }
        if (!stat.isFile()) continue;

        if (referencedUploads.has(name)) {
          counts.keptReferencedUploads += 1;
          continue;
        }

        const ageMs = nowMs - stat.mtimeMs;
        if (ageMs <= ORPHAN_UPLOAD_MAX_AGE_MS) {
          counts.keptRecentUploads += 1;
          continue;
        }

        if (this.safeRemoveFile(filePath, dryRun, errors)) {
          counts.orphanUploadsRemoved += 1;
          if (dryRun) {
            this.logger.log(`[DRY-RUN] Would remove orphan upload (>24h): ${filePath}`);
          }
        }
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3. Clean expired exports and orphaned export files on disk
    // ────────────────────────────────────────────────────────────────────────
    if (dataExportService && typeof dataExportService.cleanExpiredExports === 'function') {
      const cleanRes = dataExportService.cleanExpiredExports({ dryRun });
      counts.expiredExportsRemoved += cleanRes.cleanedCount || 0;
    }

    const trackedExportPaths = new Set<string>();
    const trackedExportNames = new Set<string>();
    const exportRecords =
      dataExportService && typeof dataExportService.getAllRecords === 'function'
        ? dataExportService.getAllRecords()
        : [];
    for (const rec of exportRecords) {
      if (rec.filePath) {
        // Both active exports and expired exports (handled above by cleanExpiredExports)
        // are known to DataExportService, preventing double-counting during dry-run.
        trackedExportPaths.add(path.resolve(rec.filePath));
        trackedExportNames.add(path.basename(rec.filePath));
      }
    }

    if (exportDir && fs.existsSync(exportDir)) {
      let entries: string[] = [];
      try {
        entries = fs.readdirSync(exportDir);
      } catch (err: any) {
        errors.push(`Failed to read exportDir ${exportDir}: ${err?.message || err}`);
      }

      for (const name of entries) {
        const filePath = path.resolve(exportDir, name);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(filePath);
        } catch {
          continue;
        }
        if (!stat.isFile()) continue;

        if (trackedExportPaths.has(filePath) || trackedExportNames.has(name)) {
          continue;
        }

        if (this.safeRemoveFile(filePath, dryRun, errors)) {
          counts.orphanExportsRemoved += 1;
          if (dryRun) {
            this.logger.log(`[DRY-RUN] Would remove orphaned export file: ${filePath}`);
          }
        }
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. Clean CV files belonging to deleted accounts (and >24h orphan CVs)
    // ────────────────────────────────────────────────────────────────────────
    if (secureCvsDir && fs.existsSync(secureCvsDir)) {
      let entries: string[] = [];
      try {
        entries = fs.readdirSync(secureCvsDir);
      } catch (err: any) {
        errors.push(`Failed to read secureCvsDir ${secureCvsDir}: ${err?.message || err}`);
      }

      for (const name of entries) {
        const filePath = path.join(secureCvsDir, name);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(filePath);
        } catch {
          continue;
        }
        if (!stat.isFile()) continue;

        if (activeCvRefs.has(name)) {
          continue;
        }

        const isDeletedAccountCv = deletedAccountCvRefs.has(name);
        const ageMs = nowMs - stat.mtimeMs;
        if (isDeletedAccountCv || ageMs > ORPHAN_UPLOAD_MAX_AGE_MS) {
          if (this.safeRemoveFile(filePath, dryRun, errors)) {
            counts.deletedAccountCvsRemoved += 1;
            if (dryRun) {
              this.logger.log(`[DRY-RUN] Would remove CV file (${isDeletedAccountCv ? 'deleted account' : 'orphan >24h'}): ${filePath}`);
            }
          }
        }
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 5. Purge soft-deleted project tombstones (>30 days old) unneeded by
    //    any escrow or dispute record (audit entries stay untouched)
    // ────────────────────────────────────────────────────────────────────────
    if (projectsRepo) {
      const allSessions = mentorMarketplaceService?.findAllSessions
        ? mentorMarketplaceService.findAllSessions()
        : [];
      const allDisputes = mentorMarketplaceService?.listDisputes
        ? mentorMarketplaceService.listDisputes('all')
        : [];
      const allEscrows = escrowService ? escrowService.findAll() : [];

      const protectedProjectIds = new Set<string>();
      const sessionById = new Map<string, any>();

      for (const s of allSessions) {
        sessionById.set(String(s.id), s);
        const pid = s.projectId ? String(s.projectId) : '';
        if (!pid) continue;
        if (IN_FLIGHT_SESSION_STATUSES.has(String(s.status || '').toLowerCase())) {
          protectedProjectIds.add(pid);
        }
      }

      for (const d of allDisputes) {
        if (String(d.status || '').toLowerCase() === 'open') {
          const sess = sessionById.get(String(d.sessionId));
          if (sess?.projectId) {
            protectedProjectIds.add(String(sess.projectId));
          }
        }
      }

      for (const e of allEscrows) {
        const eStatus = String(e.status || '');
        const isTerminal =
          eStatus === EscrowState.Distributed ||
          eStatus === EscrowState.Refunded ||
          eStatus.toLowerCase() === 'distributed' ||
          eStatus.toLowerCase() === 'refunded';
        if (!isTerminal && e.mentorSessionId) {
          const sess = sessionById.get(String(e.mentorSessionId));
          if (sess?.projectId) {
            protectedProjectIds.add(String(sess.projectId));
          }
        }
      }

      const deletedProjects = projectsRepo
        .findAll(true)
        .filter((p) => Boolean(p.deletedAt));

      for (const proj of deletedProjects) {
        const deletedAtMs = new Date(String(proj.deletedAt)).getTime();
        if (Number.isNaN(deletedAtMs)) continue;
        if (nowMs - deletedAtMs <= PROJECT_TOMBSTONE_MAX_AGE_MS) {
          continue;
        }

        if (protectedProjectIds.has(String(proj.id))) {
          counts.keptProjectsNeededByEscrow += 1;
          continue;
        }

        if (!dryRun) {
          projectsRepo.hardDelete(proj.id);
        } else {
          this.logger.log(`[DRY-RUN] Would purge >30d deleted project tombstone: ${proj.id}`);
        }
        counts.projectTombstonesRemoved += 1;
      }
    }

    const itemsProcessed =
      counts.orphanUploadsRemoved +
      counts.expiredExportsRemoved +
      counts.orphanExportsRemoved +
      counts.deletedAccountCvsRemoved +
      counts.projectTombstonesRemoved;

    const result: StorageHygieneResult = {
      dryRun,
      checkedAt,
      itemsProcessed,
      counts,
      errors,
    };

    this.lastResult = result;
    this.logger.log(
      `StorageHygieneService(${dryRun ? 'dry-run' : 'live'}): processed=${itemsProcessed}, counts=${JSON.stringify(counts)}`,
    );
    return result;
  }
}
