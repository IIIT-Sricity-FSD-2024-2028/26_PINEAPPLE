import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ACTION_CONFIGS, ActionConfig, REASON_CATEGORIES } from './reason-config';
import { ActionFeedbackEntity } from './feedback.entity';
import { ActionFeedbackRepository } from './feedback.repository';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/services/clock.service';
import { ContentFilterService } from '../common/services/content-filter.service';

export interface EntityResolution {
  exists: boolean;
  projectId?: string;
  parties: string[];
  actorId?: string;
  targetId?: string;
}

export type EntityResolverFn = (entityId: string) => Promise<EntityResolution> | EntityResolution;

@Injectable()
export class FeedbackService {
  private readonly resolvers = new Map<string, EntityResolverFn>();

  constructor(
    private readonly repo: ActionFeedbackRepository,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly clockService?: ClockService,
    @Optional() private readonly contentFilterService?: ContentFilterService,
  ) {}

  registerEntityResolver(entityType: string, resolver: EntityResolverFn): void {
    this.resolvers.set(entityType.toUpperCase().trim(), resolver);
  }

  getReasonsConfig(): Record<string, ActionConfig> {
    return ACTION_CONFIGS;
  }

  getActionConfig(actionType: string): ActionConfig {
    const key = String(actionType || '').toUpperCase().trim();
    const config = ACTION_CONFIGS[key];
    if (!config) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'INVALID_ACTION_TYPE',
        message: `Invalid action type: "${actionType}".`,
      });
    }
    return config;
  }

  validate(
    actionType: string,
    payload: { reasons?: string[]; explanation?: string },
    _actor?: any,
    _entity?: any,
  ): { valid: boolean; reasons: string[]; explanation?: string } {
    const config = this.getActionConfig(actionType);

    const reasons = Array.isArray(payload?.reasons) ? payload.reasons : [];
    if (reasons.length < (config.minReasons || 1)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'REASON_REQUIRED',
        message: `At least ${config.minReasons || 1} reason is required for ${config.title}.`,
      });
    }

    const validReasonIds = new Set(config.reasons.map((r) => r.id));
    for (const rId of reasons) {
      if (!validReasonIds.has(rId)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INVALID_REASON',
          message: `Invalid reason ID: "${rId}" for action ${actionType}.`,
        });
      }
    }

    const trimmedExplanation = typeof payload?.explanation === 'string' ? payload.explanation.trim() : '';
    const hasOther = reasons.includes('OTHER');
    const isExplanationRequired = config.explanationRequired || hasOther;

    if (isExplanationRequired) {
      const minLength = config.explanationMin > 0 ? config.explanationMin : 1;
      if (!trimmedExplanation || trimmedExplanation.length < minLength) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'EXPLANATION_REQUIRED',
          message:
            config.explanationMin > 0
              ? `An explanation between ${config.explanationMin} and ${config.explanationMax} characters is required.`
              : 'An explanation is required when "Other" is selected.',
        });
      }
    }

    if (trimmedExplanation) {
      if (trimmedExplanation.length > config.explanationMax) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'EXPLANATION_TOO_LONG',
          message: `Explanation cannot exceed ${config.explanationMax} characters.`,
        });
      }

      if (this.contentFilterService) {
        this.contentFilterService.assertClean({ explanation: trimmedExplanation }, ['explanation']);
      }
    }

    return {
      valid: true,
      reasons,
      explanation: trimmedExplanation || undefined,
    };
  }

  async resolveEntity(entityType: string, entityId: string): Promise<EntityResolution> {
    const key = String(entityType || '').toUpperCase().trim();
    const resolver = this.resolvers.get(key);
    if (!resolver) {
      return { exists: true, parties: [] };
    }
    const res = await resolver(entityId);
    if (!res || !res.exists) {
      throw new NotFoundException(`Entity ${entityType} #${entityId} not found.`);
    }
    return res;
  }

  record(params: {
    actionType: string;
    entityType: string;
    entityId: string;
    projectId?: string;
    actorUserId: string;
    targetUserId?: string;
    reasons: string[];
    explanation?: string;
  }): ActionFeedbackEntity {
    const config = this.getActionConfig(params.actionType);
    const reasonLabelMap = new Map(config.reasons.map((r) => [r.id, r.label]));
    const reasonLabels = params.reasons.map((id) => reasonLabelMap.get(id) || id);

    const nowIso = this.clockService?.nowIso?.() || new Date().toISOString();
    const entity: ActionFeedbackEntity = {
      id: `fb-${randomUUID()}`,
      actionType: config.actionType,
      entityType: params.entityType.toUpperCase().trim(),
      entityId: String(params.entityId),
      projectId: params.projectId ? String(params.projectId) : undefined,
      actorUserId: String(params.actorUserId),
      targetUserId: params.targetUserId ? String(params.targetUserId) : undefined,
      reasons: params.reasons,
      reasonLabels,
      explanation: params.explanation ? String(params.explanation).trim() : undefined,
      createdAt: nowIso,
    };

    const saved = this.repo.create(entity);

    try {
      this.auditService?.log?.({
        action: 'ACTION_FEEDBACK_RECORDED',
        actor: params.actorUserId,
        target: params.entityId,
        entityType: params.entityType,
        entityId: params.entityId,
        event: `Action feedback recorded for ${params.actionType} on ${params.entityType} #${params.entityId}`,
        details: {
          actionType: params.actionType,
          reasons: params.reasons,
          entityType: params.entityType,
          entityId: params.entityId,
          projectId: params.projectId,
          targetUserId: params.targetUserId,
        },
      });
    } catch {}

    return saved;
  }

  async getEntityHistory(
    entityType: string,
    entityId: string,
    callerUser?: any,
  ): Promise<ActionFeedbackEntity[]> {
    const res = await this.resolveEntity(entityType, entityId);

    const callerId = String(callerUser?.uid || callerUser?.id || callerUser || '').trim();
    const callerRole = String(callerUser?.role || callerUser?.roleName || '').toLowerCase().trim();
    const isAdmin = ['admin', 'superuser', 'administrator', 'super user'].includes(callerRole) || callerUser?.isSuperUser;

    if (!isAdmin && callerId) {
      const parties = (res.parties || []).map((p) => String(p).trim());
      const isParty = parties.includes(callerId);
      if (!isParty) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'FORBIDDEN',
          message: 'You do not have permission to view feedback for this entity.',
        });
      }
    }

    return this.repo.findByEntity(entityType, entityId);
  }

  findByEntity(entityType: string, entityId: string): ActionFeedbackEntity[] {
    return this.repo.findByEntity(entityType, entityId);
  }

  findByProject(projectId: string): ActionFeedbackEntity[] {
    return this.repo.findByProject(projectId);
  }

  reset(): void {
    this.repo.reset();
  }
}
