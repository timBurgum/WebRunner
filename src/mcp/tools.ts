import { runTask } from '../core/index.js';
import { BrowserController } from '../core/browser/controller.js';
import { collectState } from '../core/state/collect.js';
import { MacroStore } from '../core/cache/macroStore.js';
import { defaultConfig } from '../core/config.js';
import { createLogger } from '../core/logger.js';
import { RunPaths, generateRunId } from '../core/artifacts/paths.js';
import { ensureRunDirs, writeJsonArtifact, readJsonArtifact } from '../core/artifacts/write.js';
import type { CompactState } from '../core/state/model.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const macroStore = new MacroStore();

export const tools: Tool[] = [
  {
    name: 'observe_compact',
    description: 'Navigate to a URL and return a compact interactive-element state. Returns file path to state.json.',
    inputSchema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string', description: 'URL to observe' },
        outDir: { type: 'string', description: 'Output directory' },
      },
    },
  },
  {
    name: 'plan',
    description: 'Generate a Plan JSON for a task given a compact state file path.',
    inputSchema: {
      type: 'object',
      required: ['task', 'statePath'],
      properties: {
        task: { type: 'string' },
        statePath: { type: 'string', description: 'Path to state.json' },
        model: { type: 'string' },
      },
    },
  },
  {
    name: 'execute',
    description: 'Execute a plan JSON file. Returns runlog path and final state path.',
    inputSchema: {
      type: 'object',
      required: ['planPath'],
      properties: {
        planPath: { type: 'string' },
        headless: { type: 'boolean', default: true },
        outDir: { type: 'string' },
      },
    },
  },
  {
    name: 'verify',
    description: 'Verify task completion given task, final state path, and runlog path.',
    inputSchema: {
      type: 'object',
      required: ['task', 'finalStatePath', 'runlogPath'],
      properties: {
        task: { type: 'string' },
        finalStatePath: { type: 'string' },
        runlogPath: { type: 'string' },
        model: { type: 'string' },
      },
    },
  },
  {
    name: 'run_task',
    description: 'Run a complete web task (Plan→Execute→Verify) and return verdict + artifact paths. This is the primary tool.',
    inputSchema: {
      type: 'object',
      required: ['task'],
      properties: {
        task: { type: 'string', description: 'Natural language task description' },
        startUrl: { type: 'string' },
        headless: { type: 'boolean', default: true },
        outDir: { type: 'string', default: './out' },
        model: { type: 'string' },
      },
    },
  },
  {
    name: 'replay',
    description: 'Replay a stored macro with provided parameters.',
    inputSchema: {
      type: 'object',
      required: ['macroKey'],
      properties: {
        macroKey: { type: 'string' },
        params: { type: 'object', additionalProperties: { type: 'string' } },
        outDir: { type: 'string' },
      },
    },
  },
];

export async function handleTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'run_task': {
      const result = await runTask(args['task'] as string, {
        startUrl: args['startUrl'] as string | undefined,
        headless: (args['headless'] as boolean | undefined) ?? true,
        outDir: (args['outDir'] as string | undefined) ?? './out',
        model: args['model'] as string | undefined,
      });
      return {
        status: result.verdict.status,
        summary: result.verdict.summary,
        runDir: result.runDir,
        verdictPath: `${result.runDir}/result/verdict.json`,
        llmCalls: result.llmStats.totalCalls,
        tokens: result.llmStats.totalTokensUsed,
        durationMs: result.durationMs,
      };
    }

    case 'observe_compact': {
      const runId = generateRunId();
      const outDir = (args['outDir'] as string | undefined) ?? './out';
      const paths = new RunPaths(outDir, runId);
      await ensureRunDirs(paths.allDirs());
      const logger = createLogger(runId);
      const browser = new BrowserController(defaultConfig, paths.downloadDir, logger);
      try {
        await browser.launch();
        await browser.navigate(args['url'] as string);
        const state = await collectState(browser.page, runId);
        await writeJsonArtifact(paths.initialState, state);
        return { statePath: paths.initialState, elementCount: state.interactive.length, url: state.meta.url };
      } finally {
        await browser.close();
      }
    }

    case 'replay': {
      const macro = await macroStore.get(args['macroKey'] as string);
      if (!macro) throw new Error(`Macro "${args['macroKey']}" not found`);
      const params = (args['params'] as Record<string, string> | undefined) ?? {};
      const filledPlan = macroStore.applyParams(macro.plan, params);
      const result = await runTask(filledPlan.goal, {
        outDir: (args['outDir'] as string | undefined) ?? './out',
      });
      return { status: result.verdict.status, runDir: result.runDir };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
