/**
 * Starter blocked words & spam patterns for Phase 16 Content Filter.
 *
 * Words are matched on word-bounded tokens after case folding, character-swap
 * normalization, and single-letter space-obfuscation collapse so everyday words
 * like "class", "assistant", "analysis", "scrum", "assignment", "hello", "pass",
 * "python", "react", or "skill" are never false-positived.
 */
export const BLOCKED_TOKEN_STEMS: readonly string[] = [
  'fuck',
  'bullshit',
  'shit',
  'shithead',
  'shitt',
  'bitch',
  'asshole',
  'bastard',
  'motherfuck',
  'dickhead',
  'whore',
  'slut',
  'cunt',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'kike',
  'spic',
  'chink',
  'porn',
];

export const BLOCKED_EXACT_TOKENS: readonly string[] = [
  'porn',
  'xxx',
  'viagra',
  'cialis',
  'scamcoin',
  'cryptoscams',
];

export const BLOCKED_SPAM_PHRASES: readonly RegExp[] = [
  /\bbuy\s+followers\b/i,
  /\bfree\s+crypto\b/i,
  /\bfree\s+bitcoin\b/i,
  /\bcasino\s+bonus\b/i,
  /\bearn\s+\$?\d+\s+(?:daily|per\s+day)\b/i,
  /\b(?:whatsapp|telegram)\s+me\s+for\s+(?:money|loans?|hacking)\b/i,
  /\bclick\s+here\s+to\s+claim\s+prize\b/i,
];

export const CHAR_SWAP_VARIANTS: ReadonlyArray<Record<string, string>> = [
  {
    '0': 'o',
    '1': 'i',
    '!': 'i',
    '|': 'i',
    '3': 'e',
    '4': 'a',
    '@': 'a',
    '5': 's',
    '$': 's',
    '7': 't',
    '+': 't',
    '8': 'b',
  },
  {
    '0': 'o',
    '1': 'l',
    '!': 'i',
    '|': 'l',
    '3': 'e',
    '4': 'a',
    '@': 'a',
    '5': 's',
    '$': 's',
    '7': 't',
    '+': 't',
    '8': 'b',
  },
];
