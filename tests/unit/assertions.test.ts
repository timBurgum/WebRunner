import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { runAssertions } from '../../src/core/execute/assertions.js';
import { handleCookieBanner, detect2FA, detectCaptcha, fuzzyRefResolve } from '../../src/core/execute/recovery.js';
import type { CompactState } from '../../src/core/state/model.js';

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  page = await context.newPage();
});

afterAll(async () => {
  await browser.close();
});

describe('assertions against live example.com', () => {
  beforeAll(async () => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
  });

  it('urlContains passes for correct substring', async () => {
    const result = await runAssertions(
      [{ kind: 'urlContains', value: 'example.com' }],
      page,
      './downloads',
    );
    expect(result.passed).toBe(true);
    expect(result.failed).toHaveLength(0);
  });

  it('urlContains fails for wrong substring', async () => {
    const result = await runAssertions(
      [{ kind: 'urlContains', value: 'this-does-not-exist-xyz' }],
      page,
      './downloads',
    );
    expect(result.passed).toBe(false);
    expect(result.failed).toHaveLength(1);
  });

  it('urlEquals passes with exact URL', async () => {
    const result = await runAssertions(
      [{ kind: 'urlEquals', value: 'https://example.com/' }],
      page,
      './downloads',
    );
    expect(result.passed).toBe(true);
  });

  it('titleContains finds "Example Domain"', async () => {
    const result = await runAssertions(
      [{ kind: 'titleContains', value: 'Example Domain' }],
      page,
      './downloads',
    );
    expect(result.passed).toBe(true);
  });

  it('textPresent finds "Learn more" link', async () => {
    const result = await runAssertions(
      [{ kind: 'textPresent', value: 'Learn more' }],
      page,
      './downloads',
    );
    expect(result.passed).toBe(true);
  });

  it('textPresent fails for absent text', async () => {
    const result = await runAssertions(
      [{ kind: 'textPresent', value: 'abcXYZnonexistent9947' }],
      page,
      './downloads',
    );
    expect(result.passed).toBe(false);
  });

  it('passes multiple assertions together', async () => {
    const result = await runAssertions([
      { kind: 'urlContains', value: 'example.com' },
      { kind: 'titleContains', value: 'Example' },
      { kind: 'textPresent', value: 'This domain' },
    ], page, './downloads');
    expect(result.passed).toBe(true);
    expect(result.failed).toHaveLength(0);
  });
});

describe('detectCaptcha / detect2FA on clean pages', () => {
  it('returns false on example.com (no CAPTCHA)', async () => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    const hasCaptcha = await detectCaptcha(page);
    expect(hasCaptcha).toBe(false);
  });

  it('returns false on example.com (no 2FA)', async () => {
    const has2FA = await detect2FA(page);
    expect(has2FA).toBe(false);
  });
});

describe('fuzzyRefResolve', () => {
  const state: CompactState = {
    meta: { runId: 'test', timestamp: '', url: 'https://example.com', title: 'Test' },
    pageSummary: { headings: [], forms: [], notices: [] },
    interactive: [
      { ref: 'E1', role: 'button', label: 'Submit Form', valuePresent: false, disabled: false, visible: true, selectors: { primary: '#submit', fallback: [] } },
      { ref: 'E2', role: 'input', label: 'Email Address', valuePresent: false, disabled: false, visible: true, selectors: { primary: '#email', fallback: [] } },
    ],
  };

  it('resolves by label substring', () => {
    const match = fuzzyRefResolve('E99', state, { label: 'Email', role: 'input' });
    expect(match).toBeDefined();
    expect(match?.ref).toBe('E2');
  });

  it('resolves by role only when no label hint', () => {
    const match = fuzzyRefResolve('E99', state, { role: 'button' });
    expect(match?.ref).toBe('E1');
  });

  it('returns undefined when no match', () => {
    const match = fuzzyRefResolve('E99', state, { label: 'nonexistent-xyz' });
    expect(match).toBeUndefined();
  });
});
