import type { Page } from 'playwright';
import type { CompactState, InteractiveElement } from '../state/model.js';
import type { SelectorSet } from '../browser/selectors.js';

const COOKIE_ACCEPT_TEXTS = [
  'accept', 'accept all', 'allow all', 'agree', 'allow cookies',
  'i agree', 'ok', 'got it', 'consent', 'enable all',
];

const COOKIE_BANNER_SELECTORS = [
  '[id*="cookie"]', '[class*="cookie"]', '[id*="gdpr"]', '[class*="gdpr"]',
  '[id*="consent"]', '[class*="consent"]', '[aria-label*="cookie"]',
];

/**
 * Detect and dismiss a cookie banner by clicking an accept-style button.
 * Returns true if a banner was handled.
 */
export async function handleCookieBanner(page: Page): Promise<boolean> {
  for (const sel of COOKIE_BANNER_SELECTORS) {
    try {
      const banner = await page.$(sel);
      if (!banner) continue;

      // Find a button inside it matching accept-like text
      const buttons = await banner.$$('button, a, [role="button"]');
      for (const btn of buttons) {
        const text = (await btn.textContent())?.toLowerCase().trim() ?? '';
        if (COOKIE_ACCEPT_TEXTS.some(t => text.includes(t))) {
          await btn.click().catch(() => {});
          await page.waitForTimeout(500);
          return true;
        }
      }
    } catch {
      // Ignore; try next selector
    }
  }

  // Fallback: look for any visible "accept" button anywhere
  for (const acceptText of COOKIE_ACCEPT_TEXTS.slice(0, 4)) {
    try {
      const btn = await page.$(`button:has-text("${acceptText}")`);
      if (btn && await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(300);
        return true;
      }
    } catch {
      // Continue
    }
  }

  return false;
}

const MODAL_CLOSE_SELECTORS = [
  '[aria-label="Close"]', '[aria-label="close"]',
  '[aria-label="Dismiss"]', '[aria-label="dismiss"]',
  'button.close', 'button[data-dismiss]',
  '.modal-close', '.dialog-close',
  '[role="dialog"] button:first-of-type',
];

/**
 * Attempt to dismiss any visible modal dialog.
 * Returns true if a modal was dismissed.
 */
export async function dismissModal(page: Page): Promise<boolean> {
  // Try ESC first
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  for (const sel of MODAL_CLOSE_SELECTORS) {
    try {
      const btn = await page.$(sel);
      if (btn && await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(300);
        return true;
      }
    } catch {
      // Continue
    }
  }

  return false;
}

/**
 * Attempt to resolve a missing ref by fuzzy matching on label + role in current state.
 * Returns the best matching element or undefined.
 */
export function fuzzyRefResolve(
  missingRef: string,
  currentState: CompactState,
  hint?: { label?: string; role?: string },
): InteractiveElement | undefined {
  if (!hint) return undefined;

  const candidates = currentState.interactive.filter(el => {
    if (hint.role && el.role !== hint.role) return false;
    if (hint.label) {
      const normalLabel = el.label.toLowerCase();
      const normalHint = hint.label.toLowerCase();
      return normalLabel.includes(normalHint) || normalHint.includes(normalLabel);
    }
    return true;
  });

  return candidates[0];
}

/**
 * Detect if the page looks like a CAPTCHA challenge.
 */
export async function detectCaptcha(page: Page): Promise<boolean> {
  const text = await page.evaluate(() => document.body.innerText.toLowerCase()).catch(() => '');
  const hasCaptchaText = /captcha|recaptcha|i'm not a robot|bot detection/i.test(text);
  const hasCaptchaIframe = await page.$('iframe[src*="recaptcha"], iframe[src*="hcaptcha"]').then(Boolean).catch(() => false);
  return hasCaptchaText || hasCaptchaIframe;
}

/**
 * Detect if the page looks like a 2FA prompt.
 */
export async function detect2FA(page: Page): Promise<boolean> {
  const text = await page.evaluate(() => document.body.innerText.toLowerCase()).catch(() => '');
  return /two.factor|2fa|verification code|authenticator|otp|one.time/i.test(text);
}

/**
 * Build a selector set from an element found in state.
 */
export function elementToSelectorSet(el: InteractiveElement): SelectorSet {
  return el.selectors;
}
