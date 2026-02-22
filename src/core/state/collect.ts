import type { Page } from 'playwright';
import type { CompactState, InteractiveElement, ElementRole, StateMeta } from './model.js';
import { summarizePage } from './summarize.js';

interface RawElement {
  tagName: string;
  type?: string;
  role?: string;
  ariaLabel?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  visible?: boolean;
  labelText?: string;
  innerText?: string;
  href?: string;
  dataTestId?: string;
  index: number;
}

function mapRole(tag: string, type?: string): ElementRole {
  const t = tag.toLowerCase();
  if (t === 'button' || type === 'button' || type === 'submit' || type === 'reset') return 'button';
  if (t === 'a') return 'link';
  if (t === 'select') return 'select';
  if (t === 'textarea') return 'textarea';
  if (type === 'checkbox') return 'checkbox';
  if (type === 'radio') return 'radio';
  if (t === 'input') return 'input';
  return 'other';
}

function deriveLabel(el: RawElement): string {
  return (
    el.labelText ||
    el.ariaLabel ||
    el.placeholder ||
    el.innerText?.trim().slice(0, 60) ||
    el.name ||
    el.id ||
    `${el.tagName}[${el.index}]`
  );
}

function buildSelectors(el: RawElement) {
  const fallback: string[] = [];
  if (el.ariaLabel) fallback.push(`[aria-label="${el.ariaLabel}"]`);
  if (el.id) fallback.push(`#${el.id}`);
  if (el.name) fallback.push(`${el.tagName.toLowerCase()}[name="${el.name}"]`);
  if (el.placeholder) fallback.push(`[placeholder="${el.placeholder}"]`);
  fallback.push(`${el.tagName.toLowerCase()}:nth-of-type(${el.index + 1})`);

  let primary: string;
  if (el.dataTestId) {
    primary = `[data-testid="${el.dataTestId}"]`;
  } else if (el.name) {
    primary = `${el.tagName.toLowerCase()}[name="${el.name}"]`;
  } else if (el.ariaLabel) {
    primary = `[aria-label="${el.ariaLabel}"]`;
  } else if (el.id) {
    primary = `#${el.id}`;
  } else {
    primary = fallback.shift() ?? `${el.tagName.toLowerCase()}:nth-of-type(${el.index + 1})`;
  }

  return { primary, fallback: fallback.filter(f => f !== primary) };
}

export async function collectState(page: Page, runId: string): Promise<CompactState> {
  const url = page.url();
  const title = await page.title();

  const rawElements: RawElement[] = await page.evaluate(() => {
    const SELECTORS = 'input:not([type="hidden"]), button, a[href], select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"]';
    const elements = Array.from(document.querySelectorAll(SELECTORS));

    return elements.map((el, index) => {
      const htmlEl = el as HTMLElement;
      const input = el as HTMLInputElement;
      const anchor = el as HTMLAnchorElement;

      // Find associated label
      let labelText = '';
      if (input.labels && input.labels.length > 0) {
        labelText = input.labels[0]?.textContent?.trim() ?? '';
      } else {
        const ariaDescId = el.getAttribute('aria-labelledby');
        if (ariaDescId) {
          const labelEl = document.getElementById(ariaDescId);
          labelText = labelEl?.textContent?.trim() ?? '';
        }
      }

      const rect = htmlEl.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(htmlEl).display !== 'none';

      return {
        tagName: el.tagName,
        type: input.type || undefined,
        role: el.getAttribute('role') || undefined,
        ariaLabel: el.getAttribute('aria-label') || undefined,
        id: el.id || undefined,
        name: input.name || undefined,
        placeholder: input.placeholder || undefined,
        value: input.value || undefined,
        checked: input.checked,
        disabled: input.disabled || el.getAttribute('aria-disabled') === 'true',
        visible,
        labelText: labelText || undefined,
        innerText: htmlEl.innerText?.slice(0, 80) || undefined,
        href: anchor.href || undefined,
        dataTestId: el.getAttribute('data-testid') || undefined,
        index,
      };
    });
  });

  const interactive: InteractiveElement[] = rawElements.map((el, i) => ({
    ref: `E${i + 1}`,
    role: mapRole(el.tagName, el.type),
    label: deriveLabel(el),
    name: el.name,
    inputType: el.type,
    valuePresent: Boolean(el.value),
    disabled: el.disabled ?? false,
    visible: el.visible ?? true,
    selectors: buildSelectors(el),
    text: el.innerText?.trim(),
    href: el.href,
  }));

  const pageSummary = await summarizePage(page);

  const meta: StateMeta = {
    runId,
    timestamp: new Date().toISOString(),
    url,
    title,
  };

  return { meta, pageSummary, interactive };
}
