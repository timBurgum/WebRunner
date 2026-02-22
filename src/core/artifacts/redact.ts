import type { WebRunnerConfig } from '../config.js';

type AnyRecord = Record<string, unknown>;

const SECRET_KEY_PATTERNS: RegExp[] = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /otp/i,
  /auth(?:orization)?/i,
  /credential/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
];

function isSecretKey(key: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(key));
}

export function redactSecrets(
  value: unknown,
  allowlist: string[] = [],
  patterns: RegExp[] = SECRET_KEY_PATTERNS,
): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(item => redactSecrets(item, allowlist, patterns));
  }

  if (typeof value === 'object') {
    const obj = value as AnyRecord;
    const result: AnyRecord = {};
    for (const [key, val] of Object.entries(obj)) {
      if (allowlist.includes(key)) {
        result[key] = val;
      } else if (isSecretKey(key, patterns) && typeof val === 'string') {
        result[key] = `[REDACTED:${val.length}]`;
      } else {
        result[key] = redactSecrets(val, allowlist, patterns);
      }
    }
    return result;
  }

  return value;
}

export function buildRedactPatterns(config: Pick<WebRunnerConfig, 'redactPatterns'>): RegExp[] {
  return [...SECRET_KEY_PATTERNS, ...config.redactPatterns];
}

/** Scrub a typed plan/step of any inline credential values */
export function redactInlineSecrets(text: string): string {
  // Redact common inline patterns like "password": "abc123"
  return text
    .replace(/(["']?(?:password|passwd|secret|token|otp|api[_-]?key)["']?\s*:\s*)["'][^"']+["']/gi,
      '$1"[REDACTED]"')
    .replace(/(["']?(?:password|passwd|secret|token|otp|api[_-]?key)["']?\s*=\s*)[^\s&]+/gi,
      '$1[REDACTED]');
}
