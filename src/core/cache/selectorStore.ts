import path from 'node:path';
import fs from 'node:fs/promises';
import { deriveSelectorKey, ensureCacheDir } from './keys.js';
import type { SelectorSet } from '../browser/selectors.js';

export interface SelectorRecord {
  key: string;
  hostname: string;
  ref: string;
  selectors: SelectorSet;
  successCount: number;
  failCount: number;
  lastUsed: string;
}

export class SelectorStore {
  private cacheDir: string | null = null;
  private baseDir: string;

  constructor(baseDir = '.webrunner') {
    this.baseDir = baseDir;
  }

  private async getSelectorDir(): Promise<string> {
    if (!this.cacheDir) {
      this.cacheDir = await ensureCacheDir(this.baseDir);
    }
    return path.join(this.cacheDir, 'selectors');
  }

  async get(hostname: string, ref: string): Promise<SelectorSet | null> {
    const key = deriveSelectorKey(hostname, ref);
    const dir = await this.getSelectorDir();
    try {
      const content = await fs.readFile(path.join(dir, `${key}.json`), 'utf8');
      const record = JSON.parse(content) as SelectorRecord;
      return record.selectors;
    } catch {
      return null;
    }
  }

  async recordSuccess(hostname: string, ref: string, selectors: SelectorSet): Promise<void> {
    const key = deriveSelectorKey(hostname, ref);
    const dir = await this.getSelectorDir();
    const filePath = path.join(dir, `${key}.json`);

    let record: SelectorRecord;
    try {
      record = JSON.parse(await fs.readFile(filePath, 'utf8')) as SelectorRecord;
    } catch {
      record = { key, hostname, ref, selectors, successCount: 0, failCount: 0, lastUsed: '' };
    }

    record.selectors = selectors;
    record.successCount++;
    record.lastUsed = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf8');
  }

  async recordFailure(hostname: string, ref: string): Promise<void> {
    const key = deriveSelectorKey(hostname, ref);
    const dir = await this.getSelectorDir();
    const filePath = path.join(dir, `${key}.json`);
    try {
      const record = JSON.parse(await fs.readFile(filePath, 'utf8')) as SelectorRecord;
      record.failCount++;
      await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf8');
    } catch { /* doesn't exist yet, nothing to update */ }
  }
}
