import type { CompactState } from '../state/model.js';
import type { StateDiff } from '../state/model.js';
import type { Plan, Verdict } from './schemas.js';
import { formatDiffForPrompt } from '../state/diff.js';
import type { LLMMessage } from './llm.js';

const PLAN_SYSTEM = `You are WebRunner Planner — a precise web automation planning agent.
Your job is to produce a JSON execution plan (Plan) from a task description and the current compact page state.

RULES:
- Output ONLY valid JSON matching the Plan schema. No prose, no markdown, no explanation.
- Always use element ref IDs (e.g. "E12") for click/type/select actions, not raw CSS selectors.
- Batch all form fields into a sequence of type actions before a single submit click.
- Include assertions after critical steps.
- Set onFailure.escalateIf: ["captchaDetected", "2faDetected", "loginFailed"] on all login steps.
- Prefer stable refs; do not invent refs not present in the state.`;

const VERIFY_SYSTEM = `You are WebRunner Verifier — a precise web automation outcome judge.
Your job is to evaluate whether a task was completed successfully.

RULES:
- Output ONLY valid JSON matching the Verdict schema. No prose, no markdown.
- "success" = task fully achieved, strong evidence present.
- "patch" = task partially done, 1-2 more steps needed — provide patchPlan steps description.
- "escalate" = CAPTCHA, 2FA, login wall, or unrecoverable error encountered.
- Be conservative: only return "success" if you have clear evidence (URL, text, downloaded file).`;

function formatState(state: CompactState): string {
  const { meta, pageSummary, interactive } = state;
  const elements = interactive.slice(0, 60).map(el =>
    `  ${el.ref} [${el.role}${el.inputType ? `/${el.inputType}` : ''}] `
    + `"${el.label}"${el.disabled ? ' (disabled)' : ''}${!el.visible ? ' (hidden)' : ''}`,
  ).join('\n');

  return [
    `URL: ${meta.url}`,
    `Title: ${meta.title}`,
    `Headings: ${pageSummary.headings.slice(0, 5).join(' | ')}`,
    pageSummary.forms.length ? `Forms: ${pageSummary.forms.join(' | ')}` : '',
    pageSummary.notices.length ? `Notices: ${pageSummary.notices.slice(0, 3).join(' | ')}` : '',
    '',
    'Interactive elements:',
    elements,
  ].filter(l => l !== null).join('\n');
}

export function buildPlanPrompt(
  task: string,
  state: CompactState,
  constraints: { headless?: boolean; downloadDir?: string; startUrl?: string },
  previousDiff?: StateDiff,
): LLMMessage[] {
  const diffText = previousDiff ? `\nState changes since last action:\n${formatDiffForPrompt(previousDiff)}` : '';

  const user = `TASK: ${task}

CURRENT PAGE STATE:
${formatState(state)}
${diffText}

CONSTRAINTS:
- headless: ${constraints.headless ?? true}
- download directory: ${constraints.downloadDir ?? './downloads'}
${constraints.startUrl ? `- start URL: ${constraints.startUrl}` : ''}

Output the Plan JSON now.`;

  return [
    { role: 'system', content: PLAN_SYSTEM },
    { role: 'user', content: user },
  ];
}

export function buildVerifyPrompt(
  task: string,
  finalState: CompactState,
  runlogSummary: string,
  extractedFiles: string[],
): LLMMessage[] {
  const user = `TASK: ${task}

FINAL PAGE STATE:
${formatState(finalState)}

EXECUTION LOG SUMMARY:
${runlogSummary}

EXTRACTED FILES: ${extractedFiles.length ? extractedFiles.join(', ') : 'none'}

Output the Verdict JSON now.`;

  return [
    { role: 'system', content: VERIFY_SYSTEM },
    { role: 'user', content: user },
  ];
}

export function buildPatchPrompt(
  task: string,
  state: CompactState,
  previousVerdict: Verdict,
  patchRound: number,
): LLMMessage[] {
  const user = `TASK: ${task}

Previous verdict: ${previousVerdict.status}
Reason: ${previousVerdict.reason ?? 'Unknown'}

CURRENT PAGE STATE:
${formatState(state)}

This is patch round ${patchRound}. Output a minimal patch Plan JSON to complete the task.`;

  return [
    { role: 'system', content: PLAN_SYSTEM },
    { role: 'user', content: user },
  ];
}

export function buildRunlogSummary(steps: Array<{ id: string; op: string; status: string; error?: string }>): string {
  return steps.map(s =>
    `${s.id} [${s.op}]: ${s.status}${s.error ? ` — ${s.error}` : ''}`,
  ).join('\n');
}

export function buildExtractionPrompt(
  schema: Record<string, unknown>,
  state: CompactState,
): LLMMessage[] {
  const user = `Extract data from this page matching the schema below.

SCHEMA: ${JSON.stringify(schema, null, 2)}

PAGE STATE:
${formatState(state)}

Output ONLY the extracted JSON object matching the schema. No prose.`;

  return [
    { role: 'system', content: 'You are a precise web data extractor. Output JSON only.' },
    { role: 'user', content: user },
  ];
}
