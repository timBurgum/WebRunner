import type { Page } from 'playwright';
import type { PageSummary } from './model.js';

export async function summarizePage(page: Page): Promise<PageSummary> {
  return page.evaluate(() => {
    // Headings (h1-h3)
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .map(h => h.textContent?.trim() ?? '')
      .filter(Boolean)
      .slice(0, 10);

    // Forms — try to detect purpose from legend, fieldset, nearby h tag
    const forms = Array.from(document.querySelectorAll('form'))
      .map(form => {
        const legend = form.querySelector('legend')?.textContent?.trim();
        const label = form.getAttribute('aria-label') ?? form.getAttribute('id') ?? '';
        const heading = form.querySelector('h1,h2,h3,h4')?.textContent?.trim();
        return (legend || heading || label || 'form').slice(0, 60);
      })
      .filter(Boolean)
      .slice(0, 5);

    // Notices: alerts, banners, errors, status messages
    const noticeSelectors = [
      '[role="alert"]',
      '[role="status"]',
      '[role="banner"]',
      '.error', '.alert', '.notice', '.banner',
      '.notification', '.message',
      '[class*="error"]', '[class*="alert"]', '[class*="warning"]',
    ];
    const seen = new Set<string>();
    const notices: string[] = [];
    for (const sel of noticeSelectors) {
      for (const el of Array.from(document.querySelectorAll(sel))) {
        const text = el.textContent?.trim().slice(0, 120) ?? '';
        if (text && !seen.has(text)) {
          seen.add(text);
          notices.push(text);
          if (notices.length >= 5) break;
        }
      }
      if (notices.length >= 5) break;
    }

    return { headings, forms, notices };
  });
}
