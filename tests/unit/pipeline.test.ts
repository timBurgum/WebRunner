/**
 * Full pipeline integration test — mocks LLM, runs real browser
 *
 * Tests the Observe→Plan→Execute→Verify loop end-to-end against example.com
 * using a pre-baked plan (no real LLM call needed).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { BrowserController } from '../../src/core/browser/controller.js';
import { collectState } from '../../src/core/state/collect.js';
import { executePlan } from '../../src/core/execute/executor.js';
import { RunPaths, generateRunId } from '../../src/core/artifacts/paths.js';
import { ensureRunDirs, writeJsonArtifact, readJsonArtifact } from '../../src/core/artifacts/write.js';
import { mergeConfig } from '../../src/core/config.js';
import { createLogger } from '../../src/core/logger.js';
import { diffStates } from '../../src/core/state/diff.js';
import type { Plan } from '../../src/core/planning/schemas.js';
import type { RunLog } from '../../src/core/execute/executor.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

const OUT_DIR = path.join(os.tmpdir(), 'webrunner-pipeline-test');
const config = mergeConfig({ headless: true, outDir: OUT_DIR, allowScreenshots: true });
const logger = createLogger('pipeline-test');

describe('Full pipeline: observe → plan (mocked) → execute → verify artifacts', () => {
  let runId: string;
  let paths: RunPaths;
  let controller: BrowserController;

  beforeAll(async () => {
    runId = generateRunId();
    paths = new RunPaths(OUT_DIR, runId);
    await ensureRunDirs(paths.allDirs());
    controller = new BrowserController(config, paths.downloadDir, logger);
    await controller.launch();
  });

  it('Step 1: navigate and collect initial state', async () => {
    await controller.navigate('https://example.com');
    const state = await collectState(controller.page, runId);
    await writeJsonArtifact(paths.initialState, state);

    const saved = await readJsonArtifact(paths.initialState);
    expect(saved).toBeDefined();
    const s = saved as { meta: { url: string }; interactive: unknown[] };
    expect(s.meta.url).toContain('example.com');
    expect(s.interactive.length).toBeGreaterThan(0);
  });

  it('Step 2: screenshot is saved', async () => {
    const buffer = await controller.screenshot(paths.screenshotInitial);
    const stat = await fs.stat(paths.screenshotInitial);
    expect(stat.size).toBeGreaterThan(100);
  });

  it('Step 3: execute a mocked plan (navigate + waitFor)', async () => {
    const initialState = await collectState(controller.page, runId);

    // A minimal plan that exercises navigate and waitFor without needing LLM
    const plan: Plan = {
      goal: 'Navigate to example.com and verify page loaded',
      steps: [
        { id: 'S1', op: 'navigate', url: 'https://example.com' },
        { id: 'S2', op: 'waitFor', kind: 'networkIdle', timeoutMs: 10000 },
        { id: 'S3', op: 'screenshot' },
      ],
      assertions: [
        { kind: 'urlContains', value: 'example.com' },
        { kind: 'titleContains', value: 'Example' },
        { kind: 'textPresent', value: 'This domain' },
      ],
    };

    await writeJsonArtifact(paths.planFile, plan);

    const runlog = await executePlan(
      plan,
      controller,
      config,
      initialState,
      paths.downloadDir,
      logger,
      paths.runlog,
    );

    expect(runlog.steps).toHaveLength(3);
    expect(runlog.steps.every(s => s.status === 'success')).toBe(true);
    expect(runlog.assertionResult?.passed).toBe(true);
  });

  it('Step 4: verify run artifacts exist on disk', async () => {
    const [planExists, runlogExists] = await Promise.all([
      fs.access(paths.planFile).then(() => true).catch(() => false),
      fs.access(paths.runlog).then(() => true).catch(() => false),
    ]);
    expect(planExists).toBe(true);
    expect(runlogExists).toBe(true);
  });

  it('Step 5: runlog has correct structure', async () => {
    const runlog = await readJsonArtifact<RunLog>(paths.runlog);
    expect(runlog.planGoal).toBe('Navigate to example.com and verify page loaded');
    expect(runlog.steps).toHaveLength(3);
    expect(runlog.steps[0]?.id).toBe('S1');
    expect(runlog.steps[0]?.status).toBe('success');
    expect(runlog.assertionResult?.passed).toBe(true);
    expect(runlog.assertionResult?.failed).toHaveLength(0);
  });

  it('Step 6: collect final state and compute diff', async () => {
    const initialState = await readJsonArtifact(paths.initialState) as Awaited<ReturnType<typeof collectState>>;
    const finalState = await collectState(controller.page, runId);
    await writeJsonArtifact(paths.finalState, finalState);

    const diff = diffStates(initialState, finalState);
    await writeJsonArtifact(paths.diffState, diff);

    // Same page — diff should be empty or minimal
    expect(diff).toBeDefined();
    const diffFile = await readJsonArtifact(paths.diffState);
    expect(diffFile).toBeDefined();
  });

  it('Step 7: cleanup — close browser', async () => {
    await controller.close();
    await fs.rm(OUT_DIR, { recursive: true, force: true });
  });
});

describe('Plan executor: fail-fast on bad step', () => {
  it('reports step as failed when element ref does not exist', async () => {
    const runId2 = generateRunId();
    const paths2 = new RunPaths(OUT_DIR + '2', runId2);
    await ensureRunDirs(paths2.allDirs());

    const ctrl2 = new BrowserController(config, paths2.downloadDir, logger);
    await ctrl2.launch();
    await ctrl2.navigate('https://example.com');

    const initialState = await collectState(ctrl2.page, runId2);

    const badPlan: Plan = {
      goal: 'Click a nonexistent button',
      steps: [
        { id: 'S1', op: 'navigate', url: 'https://example.com' },
        { id: 'S2', op: 'click', ref: 'ENONEXISTENT' }, // This ref doesn't exist
      ],
    };

    const runlog = await executePlan(
      badPlan, ctrl2, config, initialState, paths2.downloadDir, logger, paths2.runlog,
    );

    const failed = runlog.steps.find(s => s.id === 'S2');
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toBeTruthy();

    await ctrl2.close();
    await fs.rm(OUT_DIR + '2', { recursive: true, force: true });
  });
});
