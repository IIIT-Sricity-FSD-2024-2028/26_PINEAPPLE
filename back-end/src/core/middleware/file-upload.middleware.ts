import * as multerNs from 'multer';
import type multerType from 'multer';
const multerRuntime: any =
  typeof (multerNs as any) === 'function'
    ? multerNs
    : typeof (multerNs as any)?.default === 'function'
      ? (multerNs as any).default
      : multerNs;
import * as path from 'path';
import * as fs from 'fs';
import { Request } from 'express';
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

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

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

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
const storage = multerRuntime.diskStorage({
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
  'image/jpg',
  'image/png',
  'image/webp',
];

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

const GENERAL_MIMES = [...IMAGE_MIMES, 'application/pdf'];
const GENERAL_EXTS = [...IMAGE_EXTS, '.pdf'];

// ──────────────────────────────────────────────────────────────
// File Filter Factories
// ──────────────────────────────────────────────────────────────

function createFileFilter(allowedMimes: string[], allowedExts: string[]) {
  return (_req: Request, file: Express.Multer.File, cb: multerType.FileFilterCallback) => {
    const ext = path.extname(String(file.originalname || '')).toLowerCase();
    const mime = String(file.mimetype || '').trim().toLowerCase();
    const isSvg = ext === '.svg' || ext === '.svgz' || mime === 'image/svg+xml';

    if (!isSvg && allowedMimes.includes(mime) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'UNSUPPORTED_FILE_TYPE',
          message: `Unsupported file type (${file.mimetype || ext}). Allowed types: png, jpg, jpeg, webp, pdf.`,
        }) as any,
      );
    }
  };
}

// ──────────────────────────────────────────────────────────────
// Pre-configured Multer Instances
// ──────────────────────────────────────────────────────────────

/**
 * Avatar upload — PNG, JPG, JPEG, WEBP only, max 2 MB.
 */
export const avatarUploadOptions = {
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: createFileFilter(IMAGE_MIMES, IMAGE_EXTS),
};
export const avatarUpload = multerRuntime(avatarUploadOptions);

/**
 * Task proof upload — PNG, JPG, JPEG, WEBP, PDF — max 5 MB.
 */
export const taskProofUploadOptions = {
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: createFileFilter(GENERAL_MIMES, GENERAL_EXTS),
};
export const taskProofUpload = multerRuntime(taskProofUploadOptions);

/**
 * Resource upload — PNG, JPG, JPEG, WEBP, PDF — max 10 MB.
 */
export const resourceUploadOptions = {
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: createFileFilter(GENERAL_MIMES, GENERAL_EXTS),
};
export const resourceUpload = multerRuntime(resourceUploadOptions);

// ──────────────────────────────────────────────────────────────
// Secure CV Upload Configuration (Stored outside public web root)
// ──────────────────────────────────────────────────────────────

export const SECURE_CVS_DIR = path.join(process.cwd(), 'secure-cvs');
if (!fs.existsSync(SECURE_CVS_DIR)) {
  fs.mkdirSync(SECURE_CVS_DIR, { recursive: true });
}

const cvStorage = multerRuntime.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: Function) => {
    cb(null, SECURE_CVS_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: Function) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanId = randomUUID();
    cb(null, `cv-${cleanId}${ext}`);
  },
});

function createPdfFilter() {
  return (_req: Request, file: Express.Multer.File, cb: multerType.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype === 'application/pdf' && ext === '.pdf') {
      cb(null, true);
    } else {
      cb(
        new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'UNSUPPORTED_FILE_TYPE',
          message: 'Invalid file type: Only PDF documents (.pdf) are allowed for CV upload.',
        }) as any,
      );
    }
  };
}

/**
 * CV upload — strictly PDF only, max 5 MB, stored securely outside web root
 */
export const cvUploadOptions = {
  storage: cvStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: createPdfFilter(),
};
export const cvUpload = multerRuntime(cvUploadOptions);
