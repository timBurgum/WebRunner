import { describe, it, expect } from 'vitest';
import { redactSecrets, redactInlineSecrets } from '../../src/core/artifacts/redact.js';
import { generateRunId, RunPaths } from '../../src/core/artifacts/paths.js';
import path from 'node:path';

describe('redactSecrets', () => {
  it('redacts password fields', () => {
    const result = redactSecrets({ username: 'alice', password: 'hunter2' }) as Record<string, unknown>;
    expect(result['username']).toBe('alice');
    expect(result['password']).toBe('[REDACTED:7]');
  });

  it('redacts nested secrets', () => {
    const result = redactSecrets({ auth: { token: 'abc123' } }) as Record<string, unknown>;
    const auth = result['auth'] as Record<string, unknown>;
    expect(auth['token']).toBe('[REDACTED:6]');
  });

  it('redacts in arrays', () => {
    const result = redactSecrets([{ apiKey: 'key123' }]) as Array<Record<string, unknown>>;
    expect(result[0]?.['apiKey']).toBe('[REDACTED:6]');
  });

  it('leaves non-secret fields alone', () => {
    const result = redactSecrets({ email: 'user@example.com', name: 'Alice' }) as Record<string, unknown>;
    expect(result['email']).toBe('user@example.com');
  });

  it('handles allowlist', () => {
    const result = redactSecrets({ token: 'mytoken' }, ['token']) as Record<string, unknown>;
    expect(result['token']).toBe('mytoken');
  });
});

describe('redactInlineSecrets', () => {
  it('redacts inline password values', () => {
    const text = 'fill field {"password": "mypassword"}';
    const result = redactInlineSecrets(text);
    expect(result).not.toContain('mypassword');
    expect(result).toContain('[REDACTED]');
  });
});

describe('RunPaths', () => {
  it('generates correct directory structure', () => {
    const paths = new RunPaths('./out', '20241201-120000-abc12');
    expect(paths.runDir).toContain('run-20241201');
    expect(paths.stateDir).toContain('state');
    expect(paths.plansDir).toContain('plans');
    expect(paths.initialState).toContain('initial.json');
    expect(paths.verdict).toContain('verdict.json');
  });

  it('generates unique run IDs', () => {
    const id1 = generateRunId();
    const id2 = generateRunId();
    expect(id1).not.toBe(id2);
  });

  it('allDirs returns 7 dirs', () => {
    const paths = new RunPaths('./out', 'test-run');
    expect(paths.allDirs()).toHaveLength(7);
  });
});
