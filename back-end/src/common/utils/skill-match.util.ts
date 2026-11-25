/**
 * Normalizes a skill list (array or comma-separated string) into deduplicated display labels
 * while preserving the first-seen casing.
 */
export function normalizeSkills(raw: any): string[] {
  const arr: string[] = Array.isArray(raw)
    ? raw.map((s) => String(s || '').trim()).filter(Boolean)
    : typeof raw === 'string'
      ? raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const skill of arr) {
    const lower = skill.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      out.push(skill);
    }
  }
  return out;
}

export interface SkillMatchResult {
  percent: number | null;
  shared: string[];
  missing: string[];
}

/**
 * Computes skill overlap between a user's skills and a project's required skills.
 * Returns percent = null when the project lists no skills.
 */
export function computeSkillMatch(userRawSkills: any, projectRawSkills: any): SkillMatchResult {
  const projectSkills = normalizeSkills(projectRawSkills);
  if (projectSkills.length === 0) {
    return { percent: null, shared: [], missing: [] };
  }

  const userSkills = normalizeSkills(userRawSkills);
  const userSet = new Set(userSkills.map((s) => s.toLowerCase()));

  const shared: string[] = [];
  const missing: string[] = [];
  for (const skill of projectSkills) {
    if (userSet.has(skill.toLowerCase())) {
      shared.push(skill);
    } else {
      missing.push(skill);
    }
  }

  const percent = Math.round((shared.length / projectSkills.length) * 100);
  return { percent, shared, missing };
}
