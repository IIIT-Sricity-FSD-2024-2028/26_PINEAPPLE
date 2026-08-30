import multer = require('multer');
import * as path from 'path';
import * as fs from 'fs';
import { Request } from 'express';
import { BadRequestException } from '@nestjs/common';

/**
 * FileUploadMiddleware — Multer-based File Upload Configuration
 *
 * Provides pre-configured multer instances for different upload scenarios:
 *  - Avatar uploads (images only, 2 MB limit)
 *  - Task proof uploads (images, PDFs, ZIPs — 5 MB limit)
 *  - Resource uploads (documents, images, archives — 10 MB limit)
 *
 * Features:
 *  - MIME type whitelist validation
 *  - File size limits per upload type
 *  - Filename sanitization (strips special characters, adds timestamp prefix)
 *  - Automatic uploads/ directory creation
 */

// ──────────────────────────────────────────────────────────────
// Storage Configuration
// ──────────────────────────────────────────────────────────────

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Sanitizes a filename by removing special characters and adding a timestamp.
 */
function sanitizeFilename(originalName: string): string {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  // Remove all characters except letters, numbers, hyphens, and underscores
  const sanitized = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();
  return `${timestamp}-${sanitized}${ext}`;
}

/**
 * Multer disk storage with sanitized filenames.
 */
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: Function) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: Function) => {
    cb(null, sanitizeFilename(file.originalname));
  },
});

// ──────────────────────────────────────────────────────────────
// MIME Type Whitelists
// ──────────────────────────────────────────────────────────────

const IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];

const ARCHIVE_MIMES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/gzip',
  'application/x-tar',
  'application/x-7z-compressed',
];

// ──────────────────────────────────────────────────────────────
// File Filter Factories
// ──────────────────────────────────────────────────────────────

function createFileFilter(allowedMimes: string[]) {
  return (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed types: ${allowedMimes.join(', ')}`,
      ) as any);
    }
  };
}

// ──────────────────────────────────────────────────────────────
// Pre-configured Multer Instances
// MulterOptions — used by NestJS FileInterceptor
// ──────────────────────────────────────────────────────────────

/**
 * Avatar upload options — images only, max 2 MB.
 * Use with @UseInterceptors(FileInterceptor('file', avatarUploadOptions))
 */
export const avatarUploadOptions = {
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: createFileFilter(IMAGE_MIMES),
};

/**
 * Task proof upload options — images, PDFs, ZIPs — max 5 MB.
 * Use with @UseInterceptors(FileInterceptor('file', taskProofUploadOptions))
 */
export const taskProofUploadOptions = {
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: createFileFilter([...IMAGE_MIMES, ...DOCUMENT_MIMES, ...ARCHIVE_MIMES]),
};

/**
 * Resource upload options — documents, images, archives — max 10 MB.
 * Use with @UseInterceptors(FileInterceptor('file', resourceUploadOptions))
 */
export const resourceUploadOptions = {
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: createFileFilter([...IMAGE_MIMES, ...DOCUMENT_MIMES, ...ARCHIVE_MIMES]),
};

// ──────────────────────────────────────────────────────────────
// Pre-configured Multer Instances (for non-NestJS use)
// ──────────────────────────────────────────────────────────────

/**
 * Avatar upload — images only, max 2 MB.
 */
export const avatarUpload = multer(avatarUploadOptions);
export const avatarUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: createFileFilter(IMAGE_MIMES),
});

/**
 * Task proof upload — images, PDFs, ZIPs — max 5 MB.
 */
export const taskProofUpload = multer(taskProofUploadOptions);
export const taskProofUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: createFileFilter([...IMAGE_MIMES, ...DOCUMENT_MIMES, ...ARCHIVE_MIMES]),
});

/**
 * Resource upload — documents, images, archives — max 10 MB.
 */
export const resourceUpload = multer(resourceUploadOptions);
export const resourceUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: createFileFilter([...IMAGE_MIMES, ...DOCUMENT_MIMES, ...ARCHIVE_MIMES]),
});
