import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import {
  BLOCKED_EXACT_TOKENS,
  BLOCKED_SPAM_PHRASES,
  BLOCKED_TOKEN_STEMS,
  CHAR_SWAP_VARIANTS,
} from '../config/content-filter.config';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ContentFilterService {
  private readonly stemRegex: RegExp;
  private readonly exactSet: Set<string>;

  constructor(
    @Optional()
    @Inject(AuditService)
    private readonly auditService?: AuditService,
  ) {
    const stemGroup = BLOCKED_TOKEN_STEMS.map((s) => `${s}[a-z]*`).join('|');
    this.stemRegex = new RegExp(`^(?:${stemGroup})$`, 'i');
    this.exactSet = new Set(BLOCKED_EXACT_TOKENS.map((w) => w.toLowerCase()));
  }

  /**
   * Produces normalized text variants accounting for:
   *  - Case insensitivity
   *  - Leet / symbol swaps (e.g. 0->o, 1->i/l, 3->e, 4/@->a, 5/$->s, 7->t)
   *  - Obfuscated single-letter runs (e.g. "f u c k", "s.h.i.t", "f_u_c_k")
   *  - Intra-word separator stripping (e.g. "f*u*c*k", "sh.it")
   */
  private buildNormalizedVariants(raw: string): string[] {
    const lower = raw.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    // Collapse spaced-out single characters: "f u c k" -> "fuck", without merging real multi-letter words
    const singleCharCollapsed = lower.replace(
      /(?:^|(?<=[^a-z0-9@$!|]))([a-z0-9@$!|])(?:[\s._\-*]+([a-z0-9@$!|])){2,}(?=$|[^a-z0-9@$!|])/gi,
      (match) => match.replace(/[\s._\-*]+/g, ''),
    );
    // Also strip inline non-alphanumeric separators inside tokens such as "f*u*c*k" or "sh.1.t"
    const separatorStripped = singleCharCollapsed.replace(
      /(?<=[a-z0-9@$!|])[.*_-]+(?=[a-z0-9@$!|])/gi,
      '',
    );

    const bases = Array.from(new Set([lower, singleCharCollapsed, separatorStripped]));
    const variants: string[] = [];

    for (const base of bases) {
      const cleanedSpaces = base.replace(/\s+/g, ' ').trim();
      variants.push(cleanedSpaces);
      for (const map of CHAR_SWAP_VARIANTS) {
        let mapped = '';
        for (const ch of cleanedSpaces) {
          mapped += map[ch] ?? ch;
        }
        variants.push(mapped);
        // Compress 3+ repeated characters (e.g. fuuuuck -> fuck) without touching double letters (class, pass)
        variants.push(mapped.replace(/([a-z])\1{2,}/g, '$1'));
      }

      // If a word uses digit '1' multiple times for both 'i' and 'l' (e.g. "bu11sh1t"),
      // try mixed i/l substitution per word token containing '1' (capped cleanly).
      if (cleanedSpaces.includes('1')) {
        const wordsWithOne = cleanedSpaces
          .split(/\s+/)
          .filter((w) => w.includes('1'))
          .slice(0, 6);
        for (const rawWord of wordsWithOne) {
          let symMapped = '';
          for (const ch of rawWord) {
            if (ch === '1') {
              symMapped += '1';
            } else {
              symMapped += CHAR_SWAP_VARIANTS[0][ch] ?? ch;
            }
          }
          const onePositions: number[] = [];
          for (let i = 0; i < symMapped.length && onePositions.length < 4; i++) {
            if (symMapped[i] === '1') onePositions.push(i);
          }
          const combos = 1 << onePositions.length;
          for (let mask = 0; mask < combos; mask++) {
            const chars = symMapped.split('');
            for (let b = 0; b < onePositions.length; b++) {
              chars[onePositions[b]] = (mask & (1 << b)) ? 'i' : 'l';
            }
            variants.push(chars.join(''));
          }
        }
      }
    }

    return Array.from(new Set(variants));
  }

  containsBlockedContent(value: unknown): boolean {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) {
      return value.some((item) => this.containsBlockedContent(item));
    }
    const text = typeof value === 'string' ? value : String(value);
    if (!text.trim()) return false;

    const variants = this.buildNormalizedVariants(text);
    for (const variant of variants) {
      for (const pattern of BLOCKED_SPAM_PHRASES) {
        if (pattern.test(variant)) {
          return true;
        }
      }
      const tokens = variant.split(/[^a-z]+/).filter(Boolean);
      for (const token of tokens) {
        if (this.stemRegex.test(token) || this.exactSet.has(token)) {
          return true;
        }
      }
    }
    return false;
  }

  findBlockedField(payload: Record<string, any> | null | undefined, fields: string[]): string | null {
    if (!payload || typeof payload !== 'object') return null;
    for (const field of fields) {
      if (payload[field] !== undefined && this.containsBlockedContent(payload[field])) {
        return field;
      }
    }
    return null;
  }

  /**
   * Validates user-facing text fields without echoing any blocked word in
   * error responses or storing offensive text in the audit log.
   */
  assertClean(
    payload: Record<string, any> | null | undefined,
    fields: string[],
    options: { actorId?: string; entityType?: string; entityId?: string } = {},
  ): void {
    const blockedField = this.findBlockedField(payload, fields);
    if (!blockedField) return;

    try {
      this.auditService?.log({
        action: 'CONTENT_BLOCKED',
        actor: options.actorId || 'anonymous',
        target: options.entityId || blockedField,
        entityType: options.entityType || 'content',
        entityId: options.entityId || 'pending',
        event: `Blocked disallowed content in field "${blockedField}"`,
        details: { field: blockedField },
      });
    } catch {
      // Never block error handling if audit logging fails
    }

    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      code: 'CONTENT_NOT_ALLOWED',
      field: blockedField,
      message: `The field "${blockedField}" contains content that is not allowed on TeamForge. Please revise and try again.`,
    });
  }
}
