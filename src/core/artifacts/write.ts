import fs from 'node:fs/promises';
import path from 'node:path';
import { redactSecrets } from './redact.js';

export interface WriteJsonOptions {
  redact?: boolean;
  allowlist?: string[];
  schemaVersion?: string;
}

/** Atomically write a JSON artifact (tmp → rename) */
export async function writeJsonArtifact(
  filePath: string,
  data: unknown,
  options: WriteJsonOptions = {},
): Promise<void> {
  const { redact = true, allowlist = [] } = options;

  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const payload = redact ? redactSecrets(data, allowlist) : data;
  const json = JSON.stringify(payload, null, 2);

  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, json, 'utf8');
  await fs.rename(tmpPath, filePath);
}

/** Write a screenshot buffer to disk, create dirs as needed */
export async function writeScreenshot(filePath: string, buffer: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
}

/** Ensure all artifact directories exist for a run */
export async function ensureRunDirs(dirs: string[]): Promise<void> {
  await Promise.all(dirs.map(d => fs.mkdir(d, { recursive: true })));
}

/** Read a JSON artifact back from disk */
export async function readJsonArtifact<T = unknown>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content) as T;
}

/** Check if an artifact file exists */
export async function artifactExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Append a line to a text log file */
export async function appendLog(filePath: string, line: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, line + '\n', 'utf8');
}
