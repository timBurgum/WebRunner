import type { Page, ElementHandle } from 'playwright';
import { ElementMissing } from '../errors.js';

export interface SelectorSet {
  primary: string;
  fallback: string[];
}

export interface ResolvedSelector {
  selector: string;
  handle: ElementHandle;
}

/**
 * Given a DOM element's attributes, generate a priority-ordered selector set.
 * Called from within page.evaluate() context — so this runs in Node, not browser.
 */
export function buildSelectorSet(attrs: {
  dataTestId?: string;
  id?: string;
  name?: string;
  ariaLabel?: string;
  role?: string;
  label?: string;
  tagName?: string;
  index?: number;
}): SelectorSet {
  const fallback: string[] = [];

  if (attrs.dataTestId) {
    return {
      primary: `[data-testid="${attrs.dataTestId}"]`,
      fallback: buildFallbacks(attrs),
    };
  }

  if (attrs.name && attrs.tagName) {
    return {
      primary: `${attrs.tagName.toLowerCase()}[name="${attrs.name}"]`,
      fallback: buildFallbacks({ ...attrs, name: undefined }),
    };
  }

  if (attrs.ariaLabel) {
    return {
      primary: `[aria-label="${attrs.ariaLabel}"]`,
      fallback: buildFallbacks({ ...attrs, ariaLabel: undefined }),
    };
  }

  if (attrs.id) {
    return {
      primary: `#${attrs.id.replace(/[\s"'<>]/g, '_')}`,
      fallback: [...fallback, ...buildFallbacks({ ...attrs, id: undefined })],
    };
  }

  const fb = buildFallbacks(attrs);
  return {
    primary: fb[0] ?? `${attrs.tagName ?? '*'}:nth-of-type(${(attrs.index ?? 0) + 1})`,
    fallback: fb.slice(1),
  };
}

function buildFallbacks(attrs: {
  id?: string;
  name?: string;
  ariaLabel?: string;
  role?: string;
  label?: string;
  tagName?: string;
  placeholder?: string;
  index?: number;
}): string[] {
  const result: string[] = [];
  if (attrs.ariaLabel) result.push(`[aria-label="${attrs.ariaLabel}"]`);
  if (attrs.id) result.push(`#${attrs.id}`);
  if (attrs.name && attrs.tagName) result.push(`${attrs.tagName.toLowerCase()}[name="${attrs.name}"]`);
  if (attrs.role && attrs.label) result.push(`role=${attrs.role}[name="${attrs.label}"]`);
  if (attrs.placeholder) result.push(`[placeholder="${attrs.placeholder}"]`);
  if (attrs.tagName && attrs.index !== undefined) {
    result.push(`${attrs.tagName.toLowerCase()}:nth-of-type(${attrs.index + 1})`);
  }
  return result;
}

/**
 * Attempt selectors in order: primary first, then fallbacks.
 * Returns the first visible, attached element found.
 */
export async function trySelectors(page: Page, selectorSet: SelectorSet): Promise<ResolvedSelector> {
  const attempts = [selectorSet.primary, ...selectorSet.fallback];

  for (const selector of attempts) {
    try {
      const handle = await page.$(selector);
      if (handle) {
        const visible = await handle.isVisible();
        if (visible) {
          return { selector, handle: handle as ElementHandle };
        }
        // Try hidden elements too as second pass
        return { selector, handle: handle as ElementHandle };
      }
    } catch {
      // selector syntax error or detached — try next
    }
  }

  throw new ElementMissing(`(via selectors: ${attempts.join(', ')})`, { attempts });
}

/** Check if any selector in the set matches a visible element */
export async function selectorExists(page: Page, selectorSet: SelectorSet): Promise<boolean> {
  try {
    await trySelectors(page, selectorSet);
    return true;
  } catch {
    return false;
  }
}
