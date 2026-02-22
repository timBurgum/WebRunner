import path from 'node:path';
import fs from 'node:fs/promises';
import type { Plan } from '../planning/schemas.js';
import { deriveCacheKey, ensureCacheDir } from './keys.js';

export interface MacroMeta {
  key: string;
  name: string;
  hostname: string;
  pathPattern: string;
  formSignature?: string;
  savedAt: string;
  parameters: string[]; // e.g. ["email", "password"]
  plan: Plan;
}

export class MacroStore {
  private cacheDir: string | null = null;
  private baseDir: string;

  constructor(baseDir = '.webrunner') {
    this.baseDir = baseDir;
  }

  private async getMacroDir(): Promise<string> {
    if (!this.cacheDir) {
      this.cacheDir = await ensureCacheDir(this.baseDir);
    }
    return path.join(this.cacheDir, 'macros');
  }

  async save(meta: Omit<MacroMeta, 'savedAt'>): Promise<string> {
    const dir = await this.getMacroDir();
    const key = meta.key || deriveCacheKey({
      hostname: meta.hostname,
      pathPattern: meta.pathPattern,
      formSignature: meta.formSignature,
      macroName: meta.name,
    });
    const filePath = path.join(dir, `${key}.json`);
    const record: MacroMeta = { ...meta, key, savedAt: new Date().toISOString() };
    await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf8');
    return key;
  }

  async get(key: string): Promise<MacroMeta | null> {
    const dir = await this.getMacroDir();
    const filePath = path.join(dir, `${key}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content) as MacroMeta;
    } catch {
      return null;
    }
  }

  async list(): Promise<MacroMeta[]> {
    const dir = await this.getMacroDir();
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    const macros: MacroMeta[] = [];
    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const content = await fs.readFile(path.join(dir, file), 'utf8');
        macros.push(JSON.parse(content) as MacroMeta);
      } catch { /* skip corrupt entries */ }
    }
    return macros;
  }

  async delete(key: string): Promise<boolean> {
    const dir = await this.getMacroDir();
    try {
      await fs.unlink(path.join(dir, `${key}.json`));
      return true;
    } catch {
      return false;
    }
  }

  /** Fill plan parameters with provided values. e.g. {email} → actual@email.com */
  applyParams(plan: Plan, params: Record<string, string>): Plan {
    const planStr = JSON.stringify(plan);
    const filled = planStr.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
    return JSON.parse(filled) as Plan;
  }
}
