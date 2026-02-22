import path from 'node:path';
import fs from 'node:fs/promises';

/** Derive a cache key from hostname + path pattern + optional signature */
export function deriveCacheKey(params: {
  hostname: string;
  pathPattern: string;
  formSignature?: string;
  macroName?: string;
}): string {
  const parts = [
    params.hostname.replace(/[^a-z0-9]/gi, '_'),
    params.pathPattern.replace(/[^a-z0-9]/gi, '_').slice(0, 40),
    params.formSignature?.slice(0, 20) ?? '',
    params.macroName?.replace(/[^a-z0-9]/gi, '_') ?? '',
  ];
  return parts.filter(Boolean).join('--').toLowerCase();
}

/** Derive a form signature from a list of input names */
export function deriveFormSignature(inputNames: string[]): string {
  return inputNames.slice().sort().join(',');
}

/** Derive a selector cache key for a specific site + ref */
export function deriveSelectorKey(hostname: string, ref: string): string {
  return `${hostname.replace(/[^a-z0-9]/gi, '_')}--${ref}`;
}

/** Safe directory path for cache storage */
export function getCacheDir(baseDir = '.webrunner'): string {
  return path.resolve(baseDir);
}

export async function ensureCacheDir(baseDir?: string): Promise<string> {
  const dir = getCacheDir(baseDir);
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(path.join(dir, 'macros'), { recursive: true });
  await fs.mkdir(path.join(dir, 'selectors'), { recursive: true });
  return dir;
}
