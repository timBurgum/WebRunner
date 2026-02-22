import AjvModule from 'ajv';
import { PlanSchema, VerdictSchema } from './schemas.js';
import type { Plan, Verdict } from './schemas.js';
import { SchemaValidationError } from '../errors.js';

// AJV ESM compat
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv = (AjvModule as any).default ?? AjvModule;
const ajv = new Ajv({ allErrors: true, useDefaults: true });
const validatePlan = ajv.compile(PlanSchema);
const validateVerdict = ajv.compile(VerdictSchema);

/**
 * Safely parse JSON from LLM output — handles markdown fences and trailing commas.
 */
export function safeJsonParse(text: string): unknown {
  // Strip markdown code fences
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    cleaned = fenceMatch[1].trim();
  }

  // Find the first { or [ and last } or ]
  const firstBrace = cleaned.search(/[\[{]/);
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try removing trailing commas (common LLM mistake)
    const fixedTrailingCommas = cleaned
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([{[,])\s*,/g, '$1');
    return JSON.parse(fixedTrailingCommas);
  }
}

export function parsePlan(text: string): Plan {
  const raw = safeJsonParse(text);
  const valid = validatePlan(raw);
  if (!valid) {
    throw new SchemaValidationError('Plan', validatePlan.errors);
  }
  return raw as Plan;
}

export function parseVerdict(text: string): Verdict {
  const raw = safeJsonParse(text);
  const valid = validateVerdict(raw);
  if (!valid) {
    throw new SchemaValidationError('Verdict', validateVerdict.errors);
  }
  return raw as Verdict;
}

/**
 * Auto-repair a Plan that's close but missing some optional fields.
 */
export function repairPlan(raw: unknown): Plan {
  const obj = raw as Record<string, unknown>;
  if (!obj['schemaVersion']) obj['schemaVersion'] = '1.0';
  if (!obj['assumptions']) obj['assumptions'] = [];
  if (!obj['assertions']) obj['assertions'] = [];
  return obj as unknown as Plan;
}

/**
 * Auto-repair a Verdict.
 */
export function repairVerdict(raw: unknown): Verdict {
  const obj = raw as Record<string, unknown>;
  if (!obj['schemaVersion']) obj['schemaVersion'] = '1.0';
  if (!obj['evidence']) obj['evidence'] = {};
  if (obj['status'] === 'success' && !obj['next']) obj['next'] = 'stop';
  if (obj['status'] === 'patch' && !obj['next']) obj['next'] = 'runPatch';
  if (obj['status'] === 'escalate' && !obj['next']) obj['next'] = 'enterStepMode';
  return obj as unknown as Verdict;
}
