import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Res,
  Req,
  Headers,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Response, Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import {
  avatarUploadOptions,
  taskProofUploadOptions,
  resourceUploadOptions,
  cvUploadOptions,
  getSecureCvsDir,
  getUploadsDir,
} from '../core/middleware/file-upload.middleware';
import { RolesGuard, normalizeRole } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuditService } from '../audit/audit.service';
import { MentorApplicationsService } from '../mentor-applications/mentor-applications.service';
import { UsersService } from '../users/users.service';
import {
  validateStoredFileMagicBytes,
  removeStoredFileSafe,
  getUploadServeMetadata,
  SupportedUploadKind,
} from './file-validation.util';
import { UploadAuditInterceptor } from './upload-audit.interceptor';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(
    @Inject(forwardRef(() => MentorApplicationsService))
    private readonly mentorApplicationsService: MentorApplicationsService,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Optional() @Inject(AuditService) private readonly auditService?: AuditService,
    @Optional() @Inject(UsersService) private readonly usersService?: UsersService,
  ) {}

  private resolveUsersService(): UsersService | undefined {
    if (this.usersService) return this.usersService;
    try {
      return this.moduleRef?.get(UsersService, { strict: false });
    } catch {
      return undefined;
    }
  }

  private hasMentorAppsPermission(authUser: any, headerRole?: string): boolean {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const role = isLegacy ? headerRole : authUser?.role;
    const normRole = normalizeRole(role);
    if (normRole === 'superuser') return true;
    if (normRole !== 'admin') return false;
    const perms = Array.isArray(authUser?.permissions) ? authUser.permissions : [];
    return perms.includes('*') || perms.includes('mentor_apps');
  }

  private verifyUploadedFile(
    file: Express.Multer.File,
    req: Request,
    allowedKinds: SupportedUploadKind[],
  ): void {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const validation = validateStoredFileMagicBytes(file.path, {
      originalName: file.originalname,
      mimetype: file.mimetype,
      allowedKinds,
    });

    if (!validation.valid) {
      removeStoredFileSafe(file.path);
      const isLegacy = process.env.AUTH_MODE === 'legacy';
      const actorId = String(
        (req as any)?.user?.uid ||
          (req as any)?.user?.id ||
          (isLegacy ? req?.headers?.['x-user-id'] : undefined) ||
          'user',
      );
      (req as any).__uploadAuditHandled = true;
      try {
        this.auditService?.log({
          action: 'UPLOAD_REJECTED',
          actor: actorId,
          target: file.originalname || file.filename,
          entityType: 'upload',
          performedBy: actorId,
          event: `Upload rejected for "${file.originalname}": ${validation.reason}`,
          details: {
            filename: file.originalname,
            mimetype: file.mimetype,
            reason: validation.reason,
            path: req?.path,
          },
        });
      } catch {
        // Non-critical audit write
      }
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'UNSUPPORTED_FILE_TYPE',
        message: validation.reason || 'Unsupported file type. Allowed: png, jpg, jpeg, webp, pdf.',
      });
    }
  }

  @Post('cv')
  @ApiOperation({ summary: 'Upload mentor CV (PDF only, max 5MB, %PDF- signature verified)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(UploadAuditInterceptor, FileInterceptor('file', cvUploadOptions))
  uploadCv(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    this.verifyUploadedFile(file, req, ['pdf']);

    return {
      message: 'CV uploaded successfully',
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      url: `/uploads/cv/${file.filename}`,
    };
  }

  @Get('cv/:filename')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superuser', 'collaborator', 'mentor', 'project-owner', 'user')
  @ApiOperation({ summary: 'Authorised download for applicant CV (applicant or admin with mentor_apps)' })
  downloadCv(
    @Param('filename') filename: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-role') xRole: string,
    @Headers('x-user-id') xUid: string,
    @Res() res: Response,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const callerId = isLegacy ? xUid : (authUser?.uid || authUser?.id);
    const isPrivileged = this.hasMentorAppsPermission(authUser, xRole);

    const cleanFilename = path.basename(filename);
    const secureCvsDir = getSecureCvsDir();
    const filePath = path.join(secureCvsDir, cleanFilename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('CV file not found');
    }

    if (!isPrivileged) {
      const apps = this.mentorApplicationsService.findAll();
      const ownApp = apps.find(
        (a) => a.cvFileName === cleanFilename && String(a.userId) === String(callerId),
      );
      if (!ownApp) {
        throw new ForbiddenException('You are not authorized to download this CV.');
      }
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
    return res.sendFile(cleanFilename, { root: secureCvsDir });
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Upload user avatar image (max 2MB, PNG/JPG/JPEG/WEBP)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(UploadAuditInterceptor, FileInterceptor('file', avatarUploadOptions))
  uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @CurrentUser() authUser?: any,
  ) {
    this.verifyUploadedFile(file, req, ['png', 'jpeg', 'webp']);
    const avatarUrl = `/uploads/${file.filename}`;
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const callerId =
      authUser?.uid ||
      authUser?.id ||
      (req as any)?.user?.uid ||
      (req as any)?.user?.id ||
      (isLegacy ? req?.headers?.['x-user-id'] : undefined);

    const usersSvc = this.resolveUsersService();
    let updatedUser: any = null;
    if (callerId && usersSvc) {
      try {
        updatedUser = usersSvc.updateAvatar(String(callerId), avatarUrl);
      } catch (err) {
        if (!(err instanceof NotFoundException)) {
          throw err;
        }
      }
    }

    return {
      message: 'Avatar uploaded successfully',
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: avatarUrl,
      avatarUrl,
      ...(updatedUser ? { user: updatedUser } : {}),
    };
  }

  @Post('task-proof')
  @ApiOperation({ summary: 'Upload task proof file (max 5MB, PNG/JPG/JPEG/WEBP/PDF)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(UploadAuditInterceptor, FileInterceptor('file', taskProofUploadOptions))
  uploadTaskProof(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    this.verifyUploadedFile(file, req, ['png', 'jpeg', 'webp', 'pdf']);
    return {
      message: 'Task proof uploaded successfully',
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
    };
  }

  @Post('resource')
  @ApiOperation({ summary: 'Upload project resource file (max 10MB, PNG/JPG/JPEG/WEBP/PDF)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(UploadAuditInterceptor, FileInterceptor('file', resourceUploadOptions))
  uploadResource(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    this.verifyUploadedFile(file, req, ['png', 'jpeg', 'webp', 'pdf']);
    return {
      message: 'Resource uploaded successfully',
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Upload file (generic, max 10MB, PNG/JPG/JPEG/WEBP/PDF)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(UploadAuditInterceptor, FileInterceptor('file', resourceUploadOptions))
  uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    this.verifyUploadedFile(file, req, ['png', 'jpeg', 'webp', 'pdf']);
    return {
      message: 'File uploaded successfully',
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
    };
  }

  @Public()
  @Get(':filename')
  @ApiOperation({ summary: 'Serve uploaded file with safe headers (nosniff, attachment for PDFs, no SVG)' })
  serveUploadedFile(@Param('filename') filename: string, @Res() res: Response) {
    const raw = String(filename || '');
    const cleanFilename = path.basename(raw);
    if (
      !cleanFilename ||
      raw !== cleanFilename ||
      cleanFilename.includes('..') ||
      !/^[a-zA-Z0-9._-]+$/.test(cleanFilename)
    ) {
      throw new NotFoundException('File not found');
    }

    const meta = getUploadServeMetadata(cleanFilename);
    if (!meta.allowed) {
      throw new NotFoundException('File not found');
    }

    const uploadsDir = path.resolve(getUploadsDir());
    const filePath = path.resolve(uploadsDir, cleanFilename);
    if (!filePath.startsWith(`${uploadsDir}${path.sep}`) || !fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', meta.contentType);
    if (!meta.asAttachment) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
    }
    return res.sendFile(cleanFilename, { root: uploadsDir });
  }
}
