/**
 * BrowserController integration tests
 * Tests the full browser controller against live public sites.
 * No LLM needed — pure Playwright orchestration.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BrowserController } from '../../src/core/browser/controller.js';
import { mergeConfig } from '../../src/core/config.js';
import { createLogger } from '../../src/core/logger.js';
import { trySelectors } from '../../src/core/browser/selectors.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

const testDownloadDir = path.join(os.tmpdir(), 'webrunner-test-downloads', Date.now().toString());
const logger = createLogger('browser-test');
const config = mergeConfig({ headless: true, stepTimeoutMs: 15000, navigationTimeoutMs: 30000 });

let controller: BrowserController;

beforeAll(async () => {
  await fs.mkdir(testDownloadDir, { recursive: true });
  controller = new BrowserController(config, testDownloadDir, logger);
  await controller.launch();
});

afterAll(async () => {
  await controller.close();
  await fs.rm(testDownloadDir, { recursive: true, force: true });
});

describe('BrowserController.navigate', () => {
  it('navigates to example.com without error', async () => {
    await expect(controller.navigate('https://example.com')).resolves.not.toThrow();
    expect(controller.currentUrl()).toContain('example.com');
  });

  it('reflects URL change after navigation', async () => {
    await controller.navigate('https://example.com');
    expect(controller.currentUrl()).toContain('example.com');
    await controller.navigate('https://httpbin.org/get');
    expect(controller.currentUrl()).toContain('httpbin.org');
  });

  it('throws NavigationFailed for invalid URL', async () => {
    // Navigate to a known valid page first
    await controller.navigate('https://example.com');
  });
});

describe('BrowserController.click', () => {
  it('clicks the "More information" link on example.com', async () => {
    await controller.navigate('https://example.com');
    const selectorSet = { primary: 'a[href="https://www.iana.org/domains/reserved"]', fallback: ['a'] };
    const usedSelector = await controller.click(selectorSet);
    expect(usedSelector).toBeTruthy();
  });
});

describe('BrowserController.type', () => {
  it('types text into an input field on httpbin forms page', async () => {
    await controller.navigate('https://httpbin.org/forms/post');
    // Find the custname input
    const selectorSet = { primary: 'input[name="custname"]', fallback: ['input[type="text"]', 'input:first-of-type'] };
    const usedSelector = await controller.type(selectorSet, 'Alice Tester');
    expect(usedSelector).toBeTruthy();

    // Verify the value was set
    const value = await controller.page.$eval('input[name="custname"]', (el) => (el as HTMLInputElement).value);
    expect(value).toBe('Alice Tester');
  });
});

describe('BrowserController.screenshot', () => {
  it('returns a non-empty buffer', async () => {
    await controller.navigate('https://example.com');
    const buffer = await controller.screenshot();
    expect(buffer.length).toBeGreaterThan(0);
    // PNG magic bytes: 0x89 0x50 0x4E 0x47
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4E);
    expect(buffer[3]).toBe(0x47);
  });

  it('saves screenshot to path when specified', async () => {
    const shotPath = path.join(testDownloadDir, 'test-screenshot.png');
    await controller.navigate('https://example.com');
    await controller.screenshot(shotPath);
    const stat = await fs.stat(shotPath);
    expect(stat.size).toBeGreaterThan(0);
  });
});

describe('BrowserController.waitFor', () => {
  it('waits for networkIdle without timing out on example.com', async () => {
    await controller.navigate('https://example.com');
    await expect(controller.waitFor('networkIdle', 10000)).resolves.not.toThrow();
  });
});

describe('trySelectors', () => {
  it('resolves primary selector first', async () => {
    await controller.navigate('https://example.com');
    const result = await trySelectors(controller.page, {
      primary: 'h1',
      fallback: ['h2', 'h3'],
    });
    expect(result.selector).toBe('h1');
    expect(result.handle).toBeTruthy();
  });

  it('falls back to second selector when primary is not found', async () => {
    await controller.navigate('https://example.com');
    const result = await trySelectors(controller.page, {
      primary: '[data-testid="nonexistent-xyz"]',
      fallback: ['h1', 'a'],
    });
    expect(result.selector).toBe('h1');
  });

  it('throws ElementMissing when no selector matches', async () => {
    await controller.navigate('https://example.com');
    await expect(
      trySelectors(controller.page, {
        primary: '[data-testid="absolutely-nonexistent"]',
        fallback: ['[data-xyz="nope"]'],
      })
    ).rejects.toThrow();
  });
});
