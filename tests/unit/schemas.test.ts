import { describe, it, expect } from 'vitest';
import { safeJsonParse, parsePlan, parseVerdict } from '../../src/core/planning/validate.js';

describe('safeJsonParse', () => {
  it('parses plain JSON', () => {
    const result = safeJsonParse('{"goal": "test", "steps": []}');
    expect((result as { goal: string }).goal).toBe('test');
  });

  it('extracts JSON from markdown code fence', () => {
    const result = safeJsonParse('```json\n{"goal": "test", "steps": []}\n```');
    expect((result as { goal: string }).goal).toBe('test');
  });

  it('extracts JSON from text with surrounding prose', () => {
    const result = safeJsonParse('Here is the plan:\n{"goal": "buy", "steps": []}\nDone.');
    expect((result as { goal: string }).goal).toBe('buy');
  });

  it('fixes trailing commas', () => {
    const result = safeJsonParse('{"goal": "test", "steps": [{"id": "S1", "op": "navigate",}],}');
    expect((result as { goal: string }).goal).toBe('test');
  });
});

describe('parsePlan', () => {
  it('validates a valid plan', () => {
    const plan = parsePlan(JSON.stringify({
      goal: 'Download invoice',
      steps: [{ id: 'S1', op: 'navigate', url: 'https://example.com' }],
    }));
    expect(plan.goal).toBe('Download invoice');
  });

  it('throws SchemaValidationError for invalid plan', () => {
    expect(() => parsePlan('{}')).toThrow();
  });
});

describe('parseVerdict', () => {
  it('validates a success verdict', () => {
    const verdict = parseVerdict(JSON.stringify({
      status: 'success',
      summary: 'Task completed',
    }));
    expect(verdict.status).toBe('success');
  });

  it('validates an escalate verdict', () => {
    const verdict = parseVerdict(JSON.stringify({
      status: 'escalate',
      summary: 'CAPTCHA detected',
      reason: 'captchaDetected',
    }));
    expect(verdict.status).toBe('escalate');
  });

  it('throws for invalid status', () => {
    expect(() => parseVerdict(JSON.stringify({ status: 'unknown', summary: 'x' }))).toThrow();
  });
});
