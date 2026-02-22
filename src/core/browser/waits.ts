import type { Page } from 'playwright';
import { TimeoutError } from '../errors.js';

export interface WaitOptions {
  timeoutMs?: number;
}

/**
 * Wait for a navigation to complete (fires if URL changes or load event fires).
 * Non-fatal: resolves immediately if no navigation occurs.
 */
export async function waitForNavigation(page: Page, opts: WaitOptions = {}): Promise<void> {
  const timeout = opts.timeoutMs ?? 5000;
  try {
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout });
  } catch {
    // No navigation occurred — that's okay
  }
}

/**
 * Wait for network to be idle (no requests for 500ms).
 */
export async function waitForNetworkIdle(page: Page, opts: WaitOptions = {}): Promise<void> {
  const timeout = opts.timeoutMs ?? 10_000;
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    throw new TimeoutError('waitForNetworkIdle', timeout);
  }
}

/**
 * Wait for a CSS selector to appear in DOM.
 */
export async function waitForSelector(
  page: Page,
  selector: string,
  opts: WaitOptions & { visible?: boolean } = {},
): Promise<void> {
  const timeout = opts.timeoutMs ?? 10_000;
  try {
    await page.waitForSelector(selector, {
      state: opts.visible ? 'visible' : 'attached',
      timeout,
    });
  } catch {
    throw new TimeoutError(`waitForSelector(${selector})`, timeout);
  }
}

/**
 * Wait for a specific URL pattern.
 */
export async function waitForUrl(
  page: Page,
  urlPattern: string | RegExp,
  opts: WaitOptions = {},
): Promise<void> {
  const timeout = opts.timeoutMs ?? 30_000;
  try {
    await page.waitForURL(urlPattern, { timeout });
  } catch {
    throw new TimeoutError(`waitForUrl(${urlPattern})`, timeout);
  }
}

/**
 * Simple sleep utility.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
