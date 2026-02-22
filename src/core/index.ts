import { BrowserController } from './browser/controller.js';
import { collectState } from './state/collect.js';
import { diffStates } from './state/diff.js';
import { LLMClient } from './planning/llm.js';
import { buildPlanPrompt, buildVerifyPrompt, buildPatchPrompt, buildRunlogSummary } from './planning/prompts.js';
import { parsePlan, parseVerdict, repairPlan, repairVerdict, safeJsonParse } from './planning/validate.js';
import { executePlan } from './execute/executor.js';
import { writeJsonArtifact, ensureRunDirs } from './artifacts/write.js';
import { RunPaths, generateRunId } from './artifacts/paths.js';
import { createLogger } from './logger.js';
import { mergeConfig } from './config.js';
import type { WebRunnerConfig } from './config.js';
import type { Plan, Verdict } from './planning/schemas.js';
import type { CompactState } from './state/model.js';
import type { RunLog } from './execute/executor.js';
import { SchemaValidationError } from './errors.js';

export interface TaskResult {
  runId: string;
  runDir: string;
  verdict: Verdict;
  llmStats: { totalCalls: number; totalTokensUsed: number };
  durationMs: number;
}

export async function runTask(
  task: string,
  configOverrides: Partial<WebRunnerConfig> & { startUrl?: string } = {},
): Promise<TaskResult> {
  const config = mergeConfig(configOverrides);
  const runId = generateRunId();
  const paths = new RunPaths(config.outDir, runId);
  const logger = createLogger(runId);
  const llm = new LLMClient(config, logger);
  const downloadDir = config.downloadDir ?? paths.downloadDir;

  logger.info({ task, runId }, 'Starting WebRunner task');
  const startMs = Date.now();

  // Ensure directories
  await ensureRunDirs(paths.allDirs());

  const browser = new BrowserController(config, downloadDir, logger);

  try {
    await browser.launch();

    if (configOverrides.startUrl) {
      await browser.navigate(configOverrides.startUrl);
    }

    if (config.allowTracing) {
      await browser.startTrace();
    }

    // ── STEP 1: OBSERVE ────────────────────────────────────────────────────
    logger.info('Observing initial state');
    const initialState = await collectState(browser.page, runId);
    if (config.allowScreenshots) {
      await browser.screenshot(paths.screenshotInitial);
    }
    await writeJsonArtifact(paths.initialState, initialState);

    // ── STEP 2: PLAN ───────────────────────────────────────────────────────
    logger.info('Requesting plan from LLM');
    const planMessages = buildPlanPrompt(task, initialState, {
      headless: config.headless,
      downloadDir,
      startUrl: configOverrides.startUrl,
    });

    const planResponse = await llm.call(planMessages, { maxTokens: 2048 });
    let plan: Plan;
    try {
      plan = parsePlan(planResponse.content);
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        plan = repairPlan(safeJsonParse(planResponse.content));
      } else throw err;
    }
    await writeJsonArtifact(paths.planFile, plan);
    logger.info({ goal: plan.goal, stepCount: plan.steps.length }, 'Plan received');

    // ── STEP 3: EXECUTE ────────────────────────────────────────────────────
    let runlog: RunLog = await executePlan(
      plan, browser, config, initialState, downloadDir, logger, paths.runlog,
    );

    // ── STEP 4: OBSERVE FINAL ──────────────────────────────────────────────
    const finalState = await collectState(browser.page, runId);
    const diff = diffStates(initialState, finalState);
    if (config.allowScreenshots) {
      await browser.screenshot(paths.screenshotFinal);
    }
    await writeJsonArtifact(paths.finalState, finalState);
    await writeJsonArtifact(paths.diffState, diff);

    // ── STEP 5: VERIFY ─────────────────────────────────────────────────────
    logger.info('Requesting verdict from LLM');
    const runlogSummary = buildRunlogSummary(runlog.steps);
    const verifyMessages = buildVerifyPrompt(task, finalState, runlogSummary, []);

    const verifyResponse = await llm.call(verifyMessages, { maxTokens: 1024 });
    let verdict: Verdict;
    try {
      verdict = parseVerdict(verifyResponse.content);
    } catch {
      verdict = repairVerdict(safeJsonParse(verifyResponse.content));
    }
    await writeJsonArtifact(paths.verdict, verdict);
    logger.info({ status: verdict.status }, 'Verdict received');

    // ── STEP 6: PATCH LOOP ─────────────────────────────────────────────────
    let patchRound = 0;
    while (verdict.status === 'patch' && patchRound < config.maxPatchRounds) {
      patchRound++;
      logger.info({ patchRound }, 'Running patch plan');

      const patchMessages = buildPatchPrompt(task, finalState, verdict, patchRound);
      const patchResponse = await llm.call(patchMessages, { maxTokens: 2048 });
      let patchPlan: Plan;
      try {
        patchPlan = parsePlan(patchResponse.content);
      } catch {
        patchPlan = repairPlan(safeJsonParse(patchResponse.content));
      }
      await writeJsonArtifact(paths.patchPlan(patchRound), patchPlan);

      runlog = await executePlan(
        patchPlan, browser, config, finalState, downloadDir, logger,
        paths.patchPlan(patchRound).replace('.json', '-log.json'),
      );

      const newFinalState = await collectState(browser.page, runId);
      const patchRunlogSummary = buildRunlogSummary(runlog.steps);
      const patchVerifyMessages = buildVerifyPrompt(task, newFinalState, patchRunlogSummary, []);
      const patchVerifyResponse = await llm.call(patchVerifyMessages, { maxTokens: 1024 });

      try {
        verdict = parseVerdict(patchVerifyResponse.content);
      } catch {
        verdict = repairVerdict(safeJsonParse(patchVerifyResponse.content));
      }
      await writeJsonArtifact(paths.verdict, verdict);
      logger.info({ status: verdict.status, patchRound }, 'Patch verdict received');
    }

    // ── STEP 7: ESCALATE ───────────────────────────────────────────────────
    if (verdict.status === 'escalate') {
      logger.warn({ reason: verdict.reason }, 'Escalating task to human');
    }

    if (config.allowTracing) {
      await browser.stopTrace(paths.playwrightTrace);
    }

    const result: TaskResult = {
      runId,
      runDir: paths.runDir,
      verdict,
      llmStats: llm.getStats(),
      durationMs: Date.now() - startMs,
    };

    logger.info({
      status: verdict.status,
      durationMs: result.durationMs,
      llmCalls: result.llmStats.totalCalls,
      totalTokens: result.llmStats.totalTokensUsed,
    }, 'Task complete');

    return result;
  } finally {
    await browser.close();
  }
}

// Re-export key types and modules for library use
export type { WebRunnerConfig } from './config.js';
export type { CompactState } from './state/model.js';
export type { Plan, Verdict } from './planning/schemas.js';
export { collectState } from './state/collect.js';
export { diffStates } from './state/diff.js';
export { mergeConfig, defaultConfig } from './config.js';
