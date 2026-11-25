import {
  Controller,
  Get,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FeedbackService } from './feedback.service';
import { ActionFeedbackEntity } from './feedback.entity';
import { REASON_CATEGORIES } from './reason-config';

@ApiTags('Action Feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get('reasons')
  @ApiOperation({ summary: 'Get reasons configuration grouped by actionType (logged-in)' })
  @ApiResponse({ status: 200, description: 'Reason configurations returned successfully.' })
  getReasons(
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    if (!effectiveUserId && !authUser) {
      throw new UnauthorizedException('Authentication required.');
    }
    const actions = this.feedbackService.getReasonsConfig();
    return {
      categories: REASON_CATEGORIES,
      actions,
      ...actions,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get feedback history for a specific entity (Actor, Target, Owner, or Admin)' })
  @ApiQuery({ name: 'entityType', required: true, description: 'Type of entity, e.g. TASK, APPLICATION, INVITE, PROJECT' })
  @ApiQuery({ name: 'entityId', required: true, description: 'ID of the entity' })
  @ApiResponse({ status: 200, description: 'Feedback history returned successfully.', type: [ActionFeedbackEntity] })
  @ApiResponse({ status: 400, description: 'ENTITY_REQUIRED: entityType and entityId must be provided.' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN: Caller is not a party to this entity or an admin.' })
  @ApiResponse({ status: 404, description: 'Entity not found.' })
  async getEntityFeedback(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @CurrentUser() authUser: any,
    @Headers('x-user-id') headerUserId?: string,
    @Headers('x-user-role') headerRole?: string,
  ): Promise<ActionFeedbackEntity[]> {
    if (!entityType || !entityId) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'ENTITY_REQUIRED',
        message: 'Both entityType and entityId query parameters are required.',
      });
    }

    const isLegacy = process.env.AUTH_MODE === 'legacy';
    const effectiveUserId = isLegacy ? headerUserId : (authUser?.uid || authUser?.id);
    const effectiveRole = isLegacy ? headerRole : (authUser?.role || authUser?.roleName);
    if (!effectiveUserId && !authUser) {
      throw new UnauthorizedException('Authentication required.');
    }

    const caller = authUser || { uid: effectiveUserId, id: effectiveUserId, role: effectiveRole };
    return this.feedbackService.getEntityHistory(entityType, entityId, caller);
  }
}
