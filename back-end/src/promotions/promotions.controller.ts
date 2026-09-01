import { Body, Controller, Get, Param, Post, UseGuards, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../core/decorators/roles.decorator';
import { RolesGuard } from '../core/guards/roles.guard';
import { PromotionsService } from './promotions.service';
import { CreatePromotionPlanDto, PurchasePromotionDto } from './dto/promotion.dto';

@ApiTags('Promotions & Revenue')
@Controller('promotions')
@UseGuards(RolesGuard)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('plans')
  @Roles('user')
  @ApiOperation({ summary: 'Get all available promotion plans' })
  getAllPlans() {
    return this.promotionsService.getAllPlans();
  }

  @Post('plans')
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new promotion plan (admin only)' })
  @ApiBody({ type: CreatePromotionPlanDto })
  createPlan(@Body() dto: CreatePromotionPlanDto) {
    return this.promotionsService.createPlan(dto);
  }

  @Post('purchase')
  @Roles('user')
  @ApiOperation({ summary: 'Purchase promotion for a hackathon' })
  @ApiBody({ type: PurchasePromotionDto })
  purchasePromotion(@Body() dto: PurchasePromotionDto) {
    return this.promotionsService.purchasePromotion(dto);
  }

  @Get('active')
  @Roles('user')
  @ApiOperation({ summary: 'Get all active promotions (hackathons with active promotion)' })
  getActivePromotions() {
    return this.promotionsService.getActivePromotions();
  }

  @Get('hackathon/:hackathonId')
  @Roles('user')
  @ApiOperation({ summary: 'Get active promotion for a specific hackathon' })
  getActivePromotion(@Param('hackathonId') hackathonId: string) {
    return this.promotionsService.getActivePromotion(hackathonId);
  }

  @Get('analytics/:promotionId')
  @Roles('user')
  @ApiOperation({ summary: 'Get analytics for a specific promotion' })
  getPromotionAnalytics(@Param('promotionId') promotionId: string) {
    return this.promotionsService.getPromotionAnalytics(promotionId);
  }

  @Get('organizer/:organizerId/summary')
  @Roles('user')
  @ApiOperation({ summary: "Get organizer's revenue and promotion summary" })
  getOrganizerRevenueSummary(@Param('organizerId') organizerId: string) {
    return this.promotionsService.getOrganizerRevenueSummary(organizerId);
  }
}
