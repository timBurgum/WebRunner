import type { BrowserController } from '../browser/controller.js';
import type { Plan, Step } from '../planning/schemas.js';
import type { CompactState } from '../state/model.js';
import type { Logger } from '../logger.js';
import type { WebRunnerConfig } from '../config.js';
import { collectState } from '../state/collect.js';
import { runAssertions } from './assertions.js';
import { handleCookieBanner, dismissModal, detectCaptcha, detect2FA, elementToSelectorSet, fuzzyRefResolve } from './recovery.js';
import { CaptchaDetected, TwoFADetected, ElementMissing, NavigationFailed, WebRunnerError } from '../errors.js';
import { safeJsonParse } from '../planning/validate.js';
import { writeJsonArtifact } from '../artifacts/write.js';

export interface StepResult {
  id: string;
  op: string;
  status: 'success' | 'skipped' | 'failed';
  selectorUsed?: string;
  durationMs: number;
  error?: string;
  details?: unknown;
}

export interface RunLog {
  planGoal: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  steps: StepResult[];
  assertionResult?: { passed: boolean; failed: unknown[] };
  finalUrl: string;
}

export async function executePlan(
  plan: Plan,
  browser: BrowserController,
  config: WebRunnerConfig,
  currentState: CompactState,
  downloadDir: string,
  logger: Logger,
  runlogPath: string,
): Promise<RunLog> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const stepResults: StepResult[] = [];

  // Pre-run: dismiss cookie banners and modals
  await handleCookieBanner(browser.page).catch(() => {});
  await dismissModal(browser.page).catch(() => {});

  for (const step of plan.steps) {
    const stepStart = Date.now();
    logger.info({ stepId: step.id, op: step.op }, 'Executing step');

    try {
      // Check for CAPTCHA/2FA before each step
      if (await detectCaptcha(browser.page)) throw new CaptchaDetected();
      if (await detect2FA(browser.page)) throw new TwoFADetected();

      const selectorUsed = await executeStep(step, browser, currentState, config, downloadDir, logger);
      stepResults.push({
        id: step.id,
        op: step.op,
        status: 'success',
        selectorUsed,
        durationMs: Date.now() - stepStart,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const isEscalatable = err instanceof CaptchaDetected || err instanceof TwoFADetected;

      stepResults.push({
        id: step.id,
        op: step.op,
        status: 'failed',
        durationMs: Date.now() - stepStart,
        error,
      });

      logger.error({ stepId: step.id, error }, 'Step failed');

      if (isEscalatable || (err instanceof WebRunnerError && !err.recoverable)) {
        break; // Fail-fast on unrecoverable errors
      }

      // Attempt local recovery for element missing
      if (err instanceof ElementMissing) {
        logger.warn({ stepId: step.id }, 'Attempting cookie/modal recovery before giving up');
        await handleCookieBanner(browser.page).catch(() => {});
        await dismissModal(browser.page).catch(() => {});
      }

      break;
    }

    // Snapshot current state for next step's fuzzy resolution
    try {
      currentState = await collectState(browser.page, currentState.meta.runId);
    } catch { /* non-fatal */ }
  }

  // Run plan assertions
  let assertionResult: RunLog['assertionResult'] | undefined;
  if (plan.assertions && plan.assertions.length > 0) {
    const result = await runAssertions(plan.assertions, browser.page, downloadDir);
    assertionResult = result;
    logger.info({ passed: result.passed, failCount: result.failed.length }, 'Assertions complete');
  }

  const completedAt = new Date().toISOString();
  const runLog: RunLog = {
    planGoal: plan.goal,
    startedAt,
    completedAt,
    durationMs: Date.now() - startMs,
    steps: stepResults,
    assertionResult,
    finalUrl: browser.currentUrl(),
  };

  await writeJsonArtifact(runlogPath, runLog, { redact: true });
  return runLog;
}

async function executeStep(
  step: Step,
  browser: BrowserController,
  currentState: CompactState,
  config: WebRunnerConfig,
  downloadDir: string,
  logger: Logger,
): Promise<string | undefined> {
  switch (step.op) {
    case 'navigate':
      if (!step.url) throw new NavigationFailed('(missing url)', 'step.url is required for navigate op');
      await browser.navigate(step.url);
      return undefined;

    case 'click': {
      const el = resolveRef(step.ref, currentState, logger);
      return browser.click(el.selectors);
    }

    case 'type': {
      const el = resolveRef(step.ref, currentState, logger);
      await browser.type(el.selectors, step.text ?? '');
      return undefined;
    }

    case 'select': {
      const el = resolveRef(step.ref, currentState, logger);
      return browser.select(el.selectors, step.value ?? '');
    }

    case 'waitFor':
      await browser.waitFor(
        (step.kind as 'networkIdle' | 'load' | 'domcontentloaded') ?? 'networkIdle',
        step.timeoutMs,
      );
      return undefined;

    case 'screenshot':
      await browser.screenshot();
      return undefined;

    case 'scroll':
      await browser.scroll(step.direction ?? 'down', step.amount);
      return undefined;

    case 'extract': {
      const text = await browser.page.evaluate(() => document.body.innerText);
      logger.info({ out: step.out }, 'Extracted page text');
      return undefined;
    }

    default:
      logger.warn({ op: step.op }, 'Unknown step op, skipping');
      return undefined;
  }
}

function resolveRef(
  ref: string | undefined,
  state: CompactState,
  logger: Logger,
) {
  if (!ref) throw new ElementMissing('(undefined ref)');
  const el = state.interactive.find(e => e.ref === ref);
  if (!el) {
    // Try fuzzy resolve
    const fuzzy = fuzzyRefResolve(ref, state);
    if (fuzzy) {
      logger.warn({ missingRef: ref, resolvedRef: fuzzy.ref }, 'Ref resolved via fuzzy match');
      return fuzzy;
    }
    throw new ElementMissing(ref);
  }
  return el;
}
