import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common';
import { BaseService } from '../common/abstracts/base.service';
import { PromotionPlanEntity, HackathonPromotionEntity, PromotionStatus } from './entities/promotion.entity';
import { CreatePromotionPlanDto, PurchasePromotionDto } from './dto/promotion.dto';
import { HackathonsService } from '../hackathons/hackathons.service';

@Injectable()
export class PromotionsService extends BaseService<PromotionPlanEntity> {
  private promotions: HackathonPromotionEntity[] = [];

  constructor(
    @Inject(forwardRef(() => HackathonsService))
    private readonly hackathonsService: HackathonsService,
  ) {
    super();
    this.initializePlans();
  }

  private initializePlans() {
    const plans: PromotionPlanEntity[] = [
      {
        id: 'plan-basic',
        name: 'Basic Promotion',
        price: 2999,
        duration: 7,
        features: ['Standard visibility', 'Search results listing', 'Email to ~500 students'],
        visibilityBoost: 'Standard',
        estimatedReach: 500,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'plan-featured',
        name: 'Featured Hackathon',
        price: 7999,
        duration: 14,
        features: [
          'Featured on homepage banner',
          'Priority in search results',
          'Email to ~2000 students',
          'Social media promotion',
        ],
        visibilityBoost: 'High',
        estimatedReach: 2000,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'plan-premium',
        name: 'Premium Promotion',
        price: 14999,
        duration: 30,
        features: [
          'Homepage featured banner (30 days)',
          'Priority in all filter results',
          'Email to ~5000+ students',
          'Social media campaign + webinar',
          '1-on-1 organizer support',
          'Custom branding options',
        ],
        visibilityBoost: 'Maximum',
        estimatedReach: 5000,
        createdAt: new Date().toISOString(),
      },
    ];

    // Push directly to preserve the custom IDs (plan-basic, plan-featured, plan-premium)
    // so they match the frontend's hardcoded references.
    this.items.push(...plans);
  }

  // Get all available promotion plans
  getAllPlans(): PromotionPlanEntity[] {
    return this.findAll();
  }

  // Create a new promotion plan (admin only)
  createPlan(dto: CreatePromotionPlanDto): PromotionPlanEntity {
    const plan = this.create({
      name: dto.name,
      price: dto.price,
      duration: dto.duration,
      features: dto.features,
      visibilityBoost: dto.visibilityBoost,
      estimatedReach: dto.estimatedReach || 1000,
      createdAt: new Date().toISOString(),
    });
    return plan;
  }

  // Purchase a promotion for a hackathon
  purchasePromotion(dto: PurchasePromotionDto): HackathonPromotionEntity {
    const plan = this.items.find(p => p.id === dto.planId);
    if (!plan) {
      throw new BadRequestException(`Promotion plan ${dto.planId} not found`);
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + plan.duration * 24 * 60 * 60 * 1000);

    const promotion: HackathonPromotionEntity = {
      id: `promo-${Date.now()}`,
      hackathonId: dto.hackathonId,
      planId: dto.planId,
      purchasedBy: dto.purchasedBy,
      purchasedAt: new Date().toISOString(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: PromotionStatus.Active,
      amountPaid: plan.price,
      viewsDuringPromotion: 0,
      registrationsDuringPromotion: 0,
    };

    this.promotions.push(promotion);

    // Update the hackathon's display flags so it surfaces in the Browse tab
    try {
      this.hackathonsService.markAsPromoted(dto.hackathonId, plan.name, plan.visibilityBoost);
    } catch {
      // Hackathon may be a demo seed without a real UUID — silently skip
    }

    return promotion;
  }

  // Get active promotion for a hackathon
  getActivePromotion(hackathonId: string): HackathonPromotionEntity | null {
    const promotion = this.promotions.find(
      p => p.hackathonId === hackathonId && p.status === PromotionStatus.Active
    );
    if (promotion && new Date(promotion.endDate) < new Date()) {
      promotion.status = PromotionStatus.Expired;
      return null;
    }
    return promotion || null;
  }

  // Get all active promotions
  getActivePromotions(): HackathonPromotionEntity[] {
    const now = new Date();
    return this.promotions.filter(
      p => p.status === PromotionStatus.Active && new Date(p.endDate) > now
    );
  }

  // Get promotion analytics
  getPromotionAnalytics(promotionId: string): HackathonPromotionEntity | null {
    return this.promotions.find(p => p.id === promotionId) || null;
  }

  // Update promotion metrics (called by analytics service)
  updatePromotionMetrics(promotionId: string, views: number, registrations: number) {
    const promotion = this.promotions.find(p => p.id === promotionId);
    if (promotion) {
      promotion.viewsDuringPromotion = (promotion.viewsDuringPromotion || 0) + views;
      promotion.registrationsDuringPromotion = (promotion.registrationsDuringPromotion || 0) + registrations;
    }
  }

  // Get organizer revenue summary
  getOrganizerRevenueSummary(organizerId: string): {
    totalSpent: number;
    activePromotions: number;
    totalReach: number;
    estimatedROI: number;
    plans: { planName: string; hackathonId: string; status: string; endDate: string }[];
  } {
    const orgPromotions = this.promotions.filter(p => p.purchasedBy === organizerId);
    const activePromos = orgPromotions.filter(p => p.status === PromotionStatus.Active);

    const totalSpent = orgPromotions.reduce((sum, p) => sum + p.amountPaid, 0);
    const totalReach = activePromos.reduce((sum, p) => {
      const plan = this.items.find(pl => pl.id === p.planId);
      return sum + (plan?.estimatedReach || 0);
    }, 0);

    const estimatedROI = activePromos.reduce((sum, p) => sum + (p.viewsDuringPromotion || 0), 0) * 10;

    const plans = orgPromotions.map(p => {
      const plan = this.items.find(pl => pl.id === p.planId);
      return {
        planName: plan?.name || p.planId,
        hackathonId: p.hackathonId,
        status: p.status,
        endDate: p.endDate,
      };
    });

    return {
      totalSpent,
      activePromotions: activePromos.length,
      totalReach,
      estimatedROI,
      plans,
    };
  }
}
