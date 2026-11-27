import * as fs from 'fs';
import * as path from 'path';

export type SupportedUploadKind = 'png' | 'jpeg' | 'webp' | 'pdf';

export const ALLOWED_EXTENSIONS_BY_KIND: Record<SupportedUploadKind, string[]> = {
  png: ['.png'],
  jpeg: ['.jpg', '.jpeg'],
  webp: ['.webp'],
  pdf: ['.pdf'],
};

export const ALLOWED_MIMES_BY_KIND: Record<SupportedUploadKind, string[]> = {
  png: ['image/png'],
  jpeg: ['image/jpeg', 'image/jpg'],
  webp: ['image/webp'],
  pdf: ['application/pdf'],
};

export const EXTENSION_TO_KIND: Record<string, SupportedUploadKind> = {
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.webp': 'webp',
  '.pdf': 'pdf',
};

export const SAFE_CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

export const SAFE_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

/**
 * Inspect first magic bytes of an uploaded buffer to identify real format.
 * Only supports png, jpeg, webp, and pdf. Returns null for empty, SVG, text, executables, etc.
 */
export function detectMagicFileType(buffer: Buffer): SupportedUploadKind | null {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpeg';
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  // PDF: %PDF-
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'pdf';
  }

  return null;
}

export interface MagicByteValidationResult {
  valid: boolean;
  reason?: string;
  detectedKind?: SupportedUploadKind | null;
  expectedKind?: SupportedUploadKind;
}

export function validateMagicBytesBuffer(
  buffer: Buffer,
  options: {
    originalName?: string;
    mimetype?: string;
    allowedKinds?: SupportedUploadKind[];
  } = {},
): MagicByteValidationResult {
  const allowedKinds: SupportedUploadKind[] = options.allowedKinds || [
    'png',
    'jpeg',
    'webp',
    'pdf',
  ];

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      valid: false,
      reason: 'Uploaded file is empty.',
      detectedKind: null,
    };
  }

  const ext = path.extname(String(options.originalName || '')).toLowerCase();
  const mime = String(options.mimetype || '').trim().toLowerCase();

  if (ext === '.svg' || ext === '.svgz' || mime === 'image/svg+xml') {
    return {
      valid: false,
      reason: 'SVG uploads are not allowed. Upload a PNG, JPG, JPEG, WEBP, or PDF file.',
      detectedKind: null,
    };
  }

  const expectedFromExt = EXTENSION_TO_KIND[ext];
  if (!expectedFromExt || !allowedKinds.includes(expectedFromExt)) {
    return {
      valid: false,
      reason: `Unsupported file extension "${ext || '(none)'}". Allowed: ${allowedKinds.join(', ')}.`,
      detectedKind: null,
    };
  }

  if (mime) {
    const validMimesForKind = ALLOWED_MIMES_BY_KIND[expectedFromExt];
    if (!validMimesForKind.includes(mime)) {
      return {
        valid: false,
        reason: `Declared MIME type "${mime}" does not match extension "${ext}".`,
        expectedKind: expectedFromExt,
        detectedKind: null,
      };
    }
  }

  const detectedKind = detectMagicFileType(buffer);
  if (!detectedKind || !allowedKinds.includes(detectedKind)) {
    const isPdfOnly = allowedKinds.length === 1 && allowedKinds[0] === 'pdf';
    return {
      valid: false,
      reason: isPdfOnly
        ? 'Invalid PDF file content. File must have a valid %PDF- signature.'
        : `File content does not match any supported format (${allowedKinds.join(', ')}).`,
      expectedKind: expectedFromExt,
      detectedKind,
    };
  }

  if (detectedKind !== expectedFromExt) {
    return {
      valid: false,
      reason: `File signature (${detectedKind}) does not match file extension (${ext}).`,
      expectedKind: expectedFromExt,
      detectedKind,
    };
  }

  return {
    valid: true,
    detectedKind,
    expectedKind: expectedFromExt,
  };
}

export function validateStoredFileMagicBytes(
  filePath: string,
  options: {
    originalName?: string;
    mimetype?: string;
    allowedKinds?: SupportedUploadKind[];
  } = {},
): MagicByteValidationResult {
  let headerBuf: Buffer;
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      const stat = fs.fstatSync(fd);
      if (stat.size === 0) {
        return {
          valid: false,
          reason: 'Uploaded file is empty.',
          detectedKind: null,
        };
      }
      const readLen = Math.min(stat.size, 32);
      headerBuf = Buffer.alloc(readLen);
      fs.readSync(fd, headerBuf, 0, readLen, 0);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return {
      valid: false,
      reason: 'Could not read uploaded file for verification.',
      detectedKind: null,
    };
  }

  return validateMagicBytesBuffer(headerBuf, {
    originalName: options.originalName || path.basename(filePath),
    mimetype: options.mimetype,
    allowedKinds: options.allowedKinds,
  });
}

export function removeStoredFileSafe(filePath?: string): void {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Non-fatal cleanup error
  }
}

export interface ServeFileMetadata {
  allowed: boolean;
  contentType: string;
  asAttachment: boolean;
  safeFilename: string;
}

/**
 * Computes safe response headers for serving uploaded files.
 * Existing stored SVGs are rejected (allowed: false -> 404).
 */
export function getUploadServeMetadata(filename: string): ServeFileMetadata {
  const safeFilename = path.basename(String(filename || ''));
  const ext = path.extname(safeFilename).toLowerCase();

  if (!safeFilename || ext === '.svg' || ext === '.svgz') {
    return {
      allowed: false,
      contentType: 'application/octet-stream',
      asAttachment: true,
      safeFilename,
    };
  }

  if (SAFE_IMAGE_EXTENSIONS.has(ext)) {
    return {
      allowed: true,
      contentType: SAFE_CONTENT_TYPE_BY_EXT[ext],
      asAttachment: false,
      safeFilename,
    };
  }

  if (ext === '.pdf') {
    return {
      allowed: true,
      contentType: 'application/pdf',
      asAttachment: true,
      safeFilename,
    };
  }

  return {
    allowed: true,
    contentType: 'application/octet-stream',
    asAttachment: true,
    safeFilename,
  };
}
