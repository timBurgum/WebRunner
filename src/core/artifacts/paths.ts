import path from 'node:path';
import { format } from 'node:util';

export function generateRunId(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const datePart = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('');
  const timePart = [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
  const rand = Math.random().toString(36).slice(2, 7);
  return format('%s-%s-%s', datePart, timePart, rand);
}

export class RunPaths {
  readonly runDir: string;

  constructor(
    readonly outDir: string,
    readonly runId: string,
  ) {
    this.runDir = path.join(outDir, `run-${runId}`);
  }

  // Directories
  get stateDir(): string { return path.join(this.runDir, 'state'); }
  get plansDir(): string { return path.join(this.runDir, 'plans'); }
  get logsDir(): string  { return path.join(this.runDir, 'logs'); }
  get resultDir(): string { return path.join(this.runDir, 'result'); }
  get mediaDir(): string { return path.join(this.runDir, 'media'); }
  get traceDir(): string { return path.join(this.runDir, 'trace'); }
  get downloadDir(): string { return path.join(this.runDir, 'downloads'); }

  // State files
  get initialState(): string  { return path.join(this.stateDir, 'initial.json'); }
  get finalState(): string    { return path.join(this.stateDir, 'final.json'); }
  get diffState(): string     { return path.join(this.stateDir, 'diff.json'); }

  // Plan files
  get planFile(): string  { return path.join(this.plansDir, 'plan.json'); }
  patchPlan(round: number): string { return path.join(this.plansDir, `patch-${round}.json`); }

  // Log files
  get runlog(): string  { return path.join(this.logsDir, 'runlog.json'); }

  // Result files
  get verdict(): string       { return path.join(this.resultDir, 'verdict.json'); }
  get extractedData(): string { return path.join(this.resultDir, 'data.json'); }

  // Media files
  get screenshotInitial(): string { return path.join(this.mediaDir, 'screenshot-initial.png'); }
  get screenshotFinal(): string   { return path.join(this.mediaDir, 'screenshot-final.png'); }
  get playwrightTrace(): string   { return path.join(this.traceDir, 'playwright-trace.zip'); }

  allDirs(): string[] {
    return [
      this.stateDir, this.plansDir, this.logsDir,
      this.resultDir, this.mediaDir, this.traceDir, this.downloadDir,
    ];
  }
}
