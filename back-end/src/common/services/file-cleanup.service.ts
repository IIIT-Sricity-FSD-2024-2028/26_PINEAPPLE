import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { getSecureCvsDir, getUploadsDir } from '../../core/middleware/file-upload.middleware';

export const UPLOAD_REF_RE = /(?:^|[/"'`(\s=])uploads\/(?!cv\/)([^?#\s"'`<>\\]+)/gi;
export const CV_REF_RE = /(?:^|[/"'`(\s=])uploads\/cv\/([^?#\s"'`<>\\]+)/gi;

export interface DeleteUserFilesOptions {
  userId: string;
  user?: any;
  mentorApplications?: any[];
  exportRecords?: any[];
  uploadsDir?: string;
  secureCvsDir?: string;
  protectedUploadNames?: Set<string>;
  protectedCvNames?: Set<string>;
  dryRun?: boolean;
}

export interface DeleteUserFilesResult {
  deletedCount: number;
  deletedFiles: string[];
  errors: string[];
}

/**
 * Shared file cleanup service (Phase 24).
 * Centralizes safe file unlinking, upload/CV reference extraction, and
 * personal artifact cleanup (CVs, avatars/uploads, requested data exports)
 * so StorageHygieneService, DataExportService, and AccountDeletionService
 * never duplicate file-removal logic.
 */
@Injectable()
export class FileCleanupService {
  private readonly logger = new Logger(FileCleanupService.name);

  extractUploadRefsFromValue(
    value: unknown,
    uploadRefs: Set<string>,
    cvRefs: Set<string>,
    visited: Set<unknown> = new Set(),
  ): void {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') {
      UPLOAD_REF_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = UPLOAD_REF_RE.exec(value)) !== null) {
        const rawName = match[1];
        try {
          uploadRefs.add(path.basename(decodeURIComponent(rawName)));
        } catch {
          uploadRefs.add(path.basename(rawName));
        }
      }
      CV_REF_RE.lastIndex = 0;
      while ((match = CV_REF_RE.exec(value)) !== null) {
        const rawName = match[1];
        try {
          cvRefs.add(path.basename(decodeURIComponent(rawName)));
        } catch {
          cvRefs.add(path.basename(rawName));
        }
      }
      return;
    }
    if (typeof value !== 'object') return;
    if (visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        this.extractUploadRefsFromValue(item, uploadRefs, cvRefs, visited);
      }
      return;
    }

    for (const val of Object.values(value as Record<string, unknown>)) {
      this.extractUploadRefsFromValue(val, uploadRefs, cvRefs, visited);
    }
  }

  safeRemoveFile(
    filePath: string,
    dryRun = false,
    errors: string[] = [],
  ): { removed: boolean; skippedMissing?: boolean } {
    const cleanPath = typeof filePath === 'string' ? filePath.trim() : '';
    if (!cleanPath) return { removed: false, skippedMissing: true };

    if (dryRun) {
      return { removed: fs.existsSync(cleanPath) };
    }

    try {
      if (fs.existsSync(cleanPath)) {
        fs.unlinkSync(cleanPath);
        return { removed: true };
      }
      return { removed: false, skippedMissing: true };
    } catch (err: any) {
      const msg = `Failed to delete file ${cleanPath}: ${err?.message || err}`;
      errors.push(msg);
      this.logger.warn(msg);
      return { removed: false };
    }
  }

  removeNamedFileInDir(
    dir: string,
    filename: string,
    dryRun = false,
    errors: string[] = [],
  ): { removed: boolean; resolvedPath?: string } {
    const cleanName = path.basename(String(filename || '').trim());
    if (!cleanName || cleanName === '.' || cleanName === '..') {
      return { removed: false };
    }
    const baseDir = path.resolve(dir);
    const resolvedPath = path.resolve(baseDir, cleanName);
    if (!resolvedPath.startsWith(`${baseDir}${path.sep}`) && resolvedPath !== baseDir) {
      return { removed: false };
    }
    const res = this.safeRemoveFile(resolvedPath, dryRun, errors);
    return { removed: res.removed, resolvedPath };
  }

  deleteUserPersonalFiles(options: DeleteUserFilesOptions): DeleteUserFilesResult {
    const uid = String(options.userId || '').trim();
    const dryRun = Boolean(options.dryRun);
    const uploadsDir = options.uploadsDir || getUploadsDir();
    const secureCvsDir = options.secureCvsDir || getSecureCvsDir();
    const protectedUploads = options.protectedUploadNames || new Set<string>();
    const protectedCvs = options.protectedCvNames || new Set<string>();

    const deletedFiles: string[] = [];
    const errors: string[] = [];
    const seenPaths = new Set<string>();

    const candidateUploads = new Set<string>();
    const candidateCvs = new Set<string>();

    const userObj = options.user;
    if (userObj && typeof userObj === 'object') {
      this.extractUploadRefsFromValue(userObj, candidateUploads, candidateCvs);
      const directCvNames = [
        (userObj as any).cvFileName,
        (userObj as any).cvUrl,
        (userObj as any).profile?.cvFileName,
        (userObj as any).profile?.cvUrl,
      ];
      for (const raw of directCvNames) {
        if (typeof raw === 'string' && raw.trim()) {
          candidateCvs.add(path.basename(raw.trim()));
        }
      }
      const directAvatars = [
        (userObj as any).avatarUrl,
        (userObj as any).avatar,
        (userObj as any).profile?.avatarUrl,
        (userObj as any).profile?.avatar,
        (userObj as any).profile?.photoUrl,
      ];
      for (const raw of directAvatars) {
        if (typeof raw === 'string' && raw.trim() && !/^https?:\/\//i.test(raw)) {
          if (raw.includes('uploads/')) {
            this.extractUploadRefsFromValue(raw, candidateUploads, candidateCvs);
          } else {
            candidateUploads.add(path.basename(raw.trim()));
          }
        }
      }
    }

    const apps = Array.isArray(options.mentorApplications) ? options.mentorApplications : [];
    for (const app of apps) {
      if (!app || String(app.userId) !== uid) continue;
      this.extractUploadRefsFromValue(app, candidateUploads, candidateCvs);
      if (app.cvFileName) {
        candidateCvs.add(path.basename(String(app.cvFileName)));
      }
      if (!dryRun) {
        app.cvFileName = undefined;
        app.cvUrl = undefined;
      }
    }

    for (const cvName of candidateCvs) {
      if (!cvName || protectedCvs.has(cvName)) continue;
      const res = this.removeNamedFileInDir(secureCvsDir, cvName, dryRun, errors);
      if (res.removed && res.resolvedPath && !seenPaths.has(res.resolvedPath)) {
        seenPaths.add(res.resolvedPath);
        deletedFiles.push(res.resolvedPath);
      }
    }

    for (const upName of candidateUploads) {
      if (!upName || protectedUploads.has(upName)) continue;
      const res = this.removeNamedFileInDir(uploadsDir, upName, dryRun, errors);
      if (res.removed && res.resolvedPath && !seenPaths.has(res.resolvedPath)) {
        seenPaths.add(res.resolvedPath);
        deletedFiles.push(res.resolvedPath);
      }
    }

    const exports = Array.isArray(options.exportRecords) ? options.exportRecords : [];
    for (const rec of exports) {
      if (!rec || String(rec.userId) !== uid || !rec.filePath) continue;
      const absPath = path.resolve(String(rec.filePath));
      if (seenPaths.has(absPath)) continue;
      const res = this.safeRemoveFile(absPath, dryRun, errors);
      if (res.removed) {
        seenPaths.add(absPath);
        deletedFiles.push(absPath);
      }
    }

    return {
      deletedCount: deletedFiles.length,
      deletedFiles,
      errors,
    };
  }
}
