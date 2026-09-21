import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  avatarUploadOptions,
  taskProofUploadOptions,
  resourceUploadOptions,
} from '../core/middleware/file-upload.middleware';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  @Post('avatar')
  @ApiOperation({
    summary: 'Upload user avatar image (max 2MB, images only)',
    operationId: 'UploadsController_uploadAvatar',
  })
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
  @ApiResponse({ status: 201, description: 'Avatar uploaded successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid file or file too large.' })
  @UseInterceptors(FileInterceptor('file', avatarUploadOptions))
  uploadAvatar(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required.');
    }
    return {
      message: 'Avatar uploaded successfully.',
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
    };
  }

  @Post('task-proof')
  @ApiOperation({
    summary: 'Upload task proof document/archive/image (max 5MB)',
    operationId: 'UploadsController_uploadTaskProof',
  })
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
  @ApiResponse({ status: 201, description: 'Task proof uploaded successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid file or file too large.' })
  @UseInterceptors(FileInterceptor('file', taskProofUploadOptions))
  uploadTaskProof(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required.');
    }
    return {
      message: 'Task proof uploaded successfully.',
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
    };
  }

  @Post('resource')
  @ApiOperation({
    summary: 'Upload resource file (max 10MB)',
    operationId: 'UploadsController_uploadResource',
  })
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
  @ApiResponse({ status: 201, description: 'Resource uploaded successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid file or file too large.' })
  @UseInterceptors(FileInterceptor('file', resourceUploadOptions))
  uploadResource(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required.');
    }
    return {
      message: 'Resource uploaded successfully.',
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
    };
  }
}
