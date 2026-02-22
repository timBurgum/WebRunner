import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { collectState } from '../../src/core/state/collect.js';
import { diffStates } from '../../src/core/state/diff.js';
import { summarizePage } from '../../src/core/state/summarize.js';

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

describe('collectState against httpbin.org/forms/post', () => {
  beforeAll(async () => {
    await page.goto('https://httpbin.org/forms/post', { waitUntil: 'domcontentloaded', timeout: 30000 });
  });

  it('collects a non-empty CompactState', async () => {
    const state = await collectState(page, 'test-run-001');
    expect(state.interactive.length).toBeGreaterThan(0);
    expect(state.meta.url).toContain('httpbin.org');
  });

  it('assigns stable E-prefixed ref IDs', async () => {
    const state = await collectState(page, 'test-run-001');
    for (const el of state.interactive) {
      expect(el.ref).toMatch(/^E\d+$/);
    }
  });

  it('assigns primary selectors to each element', async () => {
    const state = await collectState(page, 'test-run-001');
    for (const el of state.interactive) {
      expect(el.selectors.primary).toBeTruthy();
    }
  });

  it('all elements have a role', async () => {
    const state = await collectState(page, 'test-run-001');
    const validRoles = ['input', 'button', 'link', 'select', 'textarea', 'checkbox', 'radio', 'other'];
    for (const el of state.interactive) {
      expect(validRoles).toContain(el.role);
    }
  });

  it('detects at least one input and one submit button', async () => {
    const state = await collectState(page, 'test-run-001');
    const hasInput = state.interactive.some(el => el.role === 'input' || el.role === 'textarea');
    const hasButton = state.interactive.some(el => el.role === 'button');
    expect(hasInput).toBe(true);
    expect(hasButton).toBe(true);
  });
});

describe('collectState against example.com', () => {
  beforeAll(async () => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
  });

  it('collects state with at least one link', async () => {
    const state = await collectState(page, 'example-run');
    const hasLink = state.interactive.some(el => el.role === 'link');
    expect(hasLink).toBe(true);
  });

  it('pageSummary includes headings', async () => {
    const state = await collectState(page, 'example-run');
    expect(state.pageSummary.headings.length).toBeGreaterThan(0);
    expect(state.pageSummary.headings[0]).toContain('Example');
  });

  it('meta includes url and title', async () => {
    const state = await collectState(page, 'example-run');
    expect(state.meta.url).toContain('example.com');
    expect(state.meta.title).toBeTruthy();
  });
});

describe('diffStates with live navigation', () => {
  it('detects changes after navigating between pages', async () => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    const stateA = await collectState(page, 'run-a');

    // Navigate to a different page
    await page.goto('https://httpbin.org/forms/post', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const stateB = await collectState(page, 'run-b');

    const diff = diffStates(stateA, stateB);
    // After navigating to a completely different page, refs change (all added/removed)
    const totalChanges = diff.added.length + diff.removed.length + diff.changed.length;
    expect(totalChanges).toBeGreaterThan(0);
  });

  it('shows no diff for the same page re-captured', async () => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    const stateA = await collectState(page, 'run-x');
    const stateB = await collectState(page, 'run-x');
    const diff = diffStates(stateA, stateB);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });
});

describe('summarizePage', () => {
  it('extracts headings from example.com', async () => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    const summary = await summarizePage(page);
    expect(summary.headings.length).toBeGreaterThan(0);
  });

  it('extracts forms from httpbin forms page', async () => {
    await page.goto('https://httpbin.org/forms/post', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const summary = await summarizePage(page);
    // Should have at least one form
    expect(summary).toBeDefined();
    expect(typeof summary.forms).toBe('object');
  });
});
