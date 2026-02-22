import { chromium, type Browser, type Page, type BrowserContext, type Download } from 'playwright';
import type { WebRunnerConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { NavigationFailed, TimeoutError } from '../errors.js';
import { trySelectors } from './selectors.js';
import type { SelectorSet } from './selectors.js';
import { waitForNavigation, waitForNetworkIdle } from './waits.js';
import path from 'node:path';
import fs from 'node:fs/promises';

export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private _page: Page | null = null;
  private tracingActive = false;
  private downloads: Map<string, Download> = new Map();

  constructor(
    private readonly config: WebRunnerConfig,
    private readonly downloadDir: string,
    private readonly logger: Logger,
  ) {}

  get page(): Page {
    if (!this._page) throw new Error('Browser not launched. Call launch() first.');
    return this._page;
  }

  async launch(): Promise<void> {
    this.logger.info({ headless: this.config.headless }, 'Launching browser');
    this.browser = await chromium.launch({ headless: this.config.headless });

    await fs.mkdir(this.downloadDir, { recursive: true });

    this.context = await this.browser.newContext({
      acceptDownloads: true,
    });

    this._page = await this.context.newPage();
    this._page.setDefaultTimeout(this.config.stepTimeoutMs);
    this._page.setDefaultNavigationTimeout(this.config.navigationTimeoutMs);

    this._page.on('download', (download) => {
      this.downloads.set(download.suggestedFilename(), download);
    });

    this.logger.info('Browser launched');
  }

  async navigate(url: string): Promise<void> {
    this.logger.info({ url }, 'Navigating');
    try {
      const response = await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.navigationTimeoutMs,
      });
      if (response && !response.ok() && response.status() >= 400) {
        throw new NavigationFailed(url, { status: response.status() });
      }
      await waitForNetworkIdle(this.page, { timeoutMs: 5000 }).catch(() => {
        // Non-fatal; some pages never reach networkidle
      });
    } catch (err) {
      if (err instanceof NavigationFailed) throw err;
      throw new NavigationFailed(url, err);
    }
  }

  async click(selectorSet: SelectorSet): Promise<string> {
    const { selector, handle } = await trySelectors(this.page, selectorSet);
    this.logger.debug({ selector }, 'Clicking element');
    await handle.click({ timeout: this.config.stepTimeoutMs });
    await waitForNavigation(this.page, { timeoutMs: 3000 }).catch(() => {});
    return selector;
  }

  async type(selectorSet: SelectorSet, text: string): Promise<string> {
    const { selector, handle } = await trySelectors(this.page, selectorSet);
    this.logger.debug({ selector, textLength: text.length }, 'Typing into element');
    await handle.click({ clickCount: 3 }); // select all first
    await handle.fill(text, { timeout: this.config.stepTimeoutMs });
    return selector;
  }

  async select(selectorSet: SelectorSet, value: string): Promise<string> {
    const { selector } = await trySelectors(this.page, selectorSet);
    this.logger.debug({ selector, value }, 'Selecting option');
    await this.page.selectOption(selector, value, { timeout: this.config.stepTimeoutMs });
    return selector;
  }

  async scroll(direction: 'up' | 'down' | 'top' | 'bottom', amount?: number): Promise<void> {
    const page = this.page;
    if (direction === 'top') {
      await page.evaluate('window.scrollTo(0, 0)');
    } else if (direction === 'bottom') {
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    } else {
      const delta = (direction === 'down' ? 1 : -1) * (amount ?? 300);
      await page.evaluate(`window.scrollBy(0, ${delta})`);
    }
  }

  async screenshot(savePath?: string): Promise<Buffer> {
    const buffer = await this.page.screenshot({ fullPage: false, type: 'png' });
    if (savePath && this.config.allowScreenshots) {
      await fs.mkdir(path.dirname(savePath), { recursive: true });
      await fs.writeFile(savePath, buffer);
      this.logger.info({ path: savePath }, 'Screenshot saved');
    }
    return buffer;
  }

  async waitFor(kind: 'networkIdle' | 'load' | 'domcontentloaded', timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? this.config.stepTimeoutMs;
    if (kind === 'networkIdle') {
      await waitForNetworkIdle(this.page, { timeoutMs: timeout });
    } else {
      await this.page.waitForLoadState(kind, { timeout });
    }
  }

  async startTrace(): Promise<void> {
    if (!this.context || this.tracingActive) return;
    await this.context.tracing.start({ screenshots: true, snapshots: true });
    this.tracingActive = true;
    this.logger.info('Tracing started');
  }

  async stopTrace(savePath: string): Promise<void> {
    if (!this.context || !this.tracingActive) return;
    await fs.mkdir(path.dirname(savePath), { recursive: true });
    await this.context.tracing.stop({ path: savePath });
    this.tracingActive = false;
    this.logger.info({ path: savePath }, 'Trace saved');
  }

  async waitForDownload(filename: string, timeoutMs: number): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const dl = this.downloads.get(filename);
      if (dl) {
        const savedPath = await dl.path();
        if (savedPath) return savedPath;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    throw new TimeoutError(`waitForDownload(${filename})`, timeoutMs);
  }

  currentUrl(): string {
    return this._page?.url() ?? '';
  }

  async close(): Promise<void> {
    this.logger.info('Closing browser');
    if (this.context && this.tracingActive) {
      await this.context.tracing.stop().catch(() => {});
    }
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.browser = null;
    this.context = null;
    this._page = null;
  }
}
