import type { Page } from 'playwright';
import type { Assertion } from '../planning/schemas.js';
import { AssertionFailed } from '../errors.js';
import path from 'node:path';
import fs from 'node:fs/promises';

export interface AssertionResult {
  passed: boolean;
  failed: Array<{ kind: string; expected?: string; actual?: string; error?: string }>;
}

async function checkAssertion(page: Page, assertion: Assertion, downloadDir: string): Promise<void> {
  const { kind, value, ref, filePattern } = assertion;

  switch (kind) {
    case 'urlContains':
      if (!page.url().includes(value ?? '')) {
        throw new AssertionFailed('urlContains', value ?? '', { actual: page.url() });
      }
      break;

    case 'urlEquals':
      if (page.url() !== value) {
        throw new AssertionFailed('urlEquals', value ?? '', { actual: page.url() });
      }
      break;

    case 'titleContains': {
      const title = await page.title();
      if (!title.includes(value ?? '')) {
        throw new AssertionFailed('titleContains', value ?? '', { actual: title });
      }
      break;
    }

    case 'textPresent': {
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (!bodyText.includes(value ?? '')) {
        throw new AssertionFailed('textPresent', value ?? '', { snippet: bodyText.slice(0, 200) });
      }
      break;
    }

    case 'elementVisible': {
      if (!ref) throw new AssertionFailed('elementVisible', 'ref required');
      // Try to find by aria, placeholder, text match (ref is descriptive here)
      const visible = await page.isVisible(`text="${ref}"`)
        .catch(async () => page.isVisible(ref ?? '').catch(() => false));
      if (!visible) {
        throw new AssertionFailed('elementVisible', `"${ref}" to be visible`);
      }
      break;
    }

    case 'downloadExists': {
      const pattern = filePattern ?? value ?? '';
      const files = await fs.readdir(downloadDir).catch(() => [] as string[]);
      const found = files.some(f => f.includes(pattern) || new RegExp(pattern).test(f));
      if (!found) {
        throw new AssertionFailed('downloadExists', `file matching "${pattern}"`, { files });
      }
      break;
    }

    default:
      throw new AssertionFailed(kind, 'known assertion kind');
  }
}

export async function runAssertions(
  assertions: Assertion[],
  page: Page,
  downloadDir: string,
): Promise<AssertionResult> {
  const failed: AssertionResult['failed'] = [];

  for (const assertion of assertions) {
    try {
      await checkAssertion(page, assertion, downloadDir);
    } catch (err) {
      if (err instanceof AssertionFailed) {
        failed.push({
          kind: assertion.kind,
          expected: assertion.value,
          error: err.message,
        });
      } else {
        failed.push({ kind: assertion.kind, error: String(err) });
      }
    }
  }

  return { passed: failed.length === 0, failed };
}

export async function extractPageText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText.slice(0, 5000));
}
