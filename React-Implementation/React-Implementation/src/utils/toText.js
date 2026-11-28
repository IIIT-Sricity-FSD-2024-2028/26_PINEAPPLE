const OBJECT_TEXT_KEYS = [
  'displayName',
  'name',
  'fullName',
  'username',
  'title',
  'label',
  'reason',
  'message',
  'event',
  'status',
  'text',
  'action',
  'email',
];

/**
 * Converts mixed API values (string, number, boolean, array, or object) into a
 * plain renderable string and never returns an object or "[object Object]".
 */
export function toText(value, fallback = '—', seen = new Set()) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => toText(item, '', seen))
      .filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : fallback;
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return fallback;
    seen.add(value);
    for (const key of OBJECT_TEXT_KEYS) {
      if (value[key] !== undefined && value[key] !== null) {
        const candidate = toText(value[key], '', seen);
        if (candidate) return candidate;
      }
    }
  }
  return fallback;
}

export default toText;
