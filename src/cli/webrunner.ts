#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { runTask } from '../core/index.js';
import { MacroStore } from '../core/cache/macroStore.js';
import { collectState } from '../core/state/collect.js';
import { BrowserController } from '../core/browser/controller.js';
import { mergeConfig } from '../core/config.js';
import { rootLogger } from '../core/logger.js';
import { readJsonArtifact } from '../core/artifacts/write.js';
import type { CompactState } from '../core/state/model.js';
import { chromium } from 'playwright';
import path from 'node:path';

const macroStore = new MacroStore();

yargs(hideBin(process.argv))
  .scriptName('webrunner')
  .usage('$0 <command> [options]')

  // ── run ──────────────────────────────────────────────────────────────────
  .command(
    'run',
    'Run a web task using Plan→Execute→Verify',
    (y) => y
      .option('task', { type: 'string', demandOption: true, alias: 't', describe: 'Task description' })
      .option('start-url', { type: 'string', alias: 'u', describe: 'Starting URL' })
      .option('headful', { type: 'boolean', default: false, describe: 'Show browser window' })
      .option('out', { type: 'string', alias: 'o', default: './out', describe: 'Output directory' })
      .option('model', { type: 'string', alias: 'm', describe: 'LLM model (OpenRouter)' })
      .option('screenshots', { type: 'boolean', default: true, describe: 'Save screenshots' })
      .option('trace', { type: 'boolean', default: false, describe: 'Save Playwright trace' }),
    async (argv) => {
      try {
        console.log(`\n🚀 WebRunner — ${argv.task}\n`);
        const result = await runTask(argv.task, {
          startUrl: argv['start-url'],
          headless: !argv.headful,
          outDir: argv.out,
          model: argv.model,
          allowScreenshots: argv.screenshots,
          allowTracing: argv.trace,
        });

        const statusIcon = result.verdict.status === 'success' ? '✅'
          : result.verdict.status === 'patch' ? '⚠️'
          : '❌';

        console.log(`\n${statusIcon} Status: ${result.verdict.status.toUpperCase()}`);
        console.log(`📝 Summary: ${result.verdict.summary}`);
        console.log(`📁 Artifacts: ${result.runDir}`);
        console.log(`🔢 LLM calls: ${result.llmStats.totalCalls} | Tokens: ${result.llmStats.totalTokensUsed}`);
        console.log(`⏱️  Duration: ${(result.durationMs / 1000).toFixed(1)}s\n`);

        process.exit(result.verdict.status === 'escalate' ? 2 : 0);
      } catch (err) {
        console.error('❌ Fatal error:', err instanceof Error ? err.message : err);
        process.exit(1);
      }
    },
  )

  // ── replay ───────────────────────────────────────────────────────────────
  .command(
    'replay',
    'Replay a stored macro',
    (y) => y
      .option('macro', { type: 'string', demandOption: true, describe: 'Macro key or name' })
      .option('params', { type: 'string', describe: 'JSON params file path' })
      .option('headful', { type: 'boolean', default: false })
      .option('out', { type: 'string', default: './out' }),
    async (argv) => {
      const macro = await macroStore.get(argv.macro);
      if (!macro) {
        console.error(`❌ Macro "${argv.macro}" not found`);
        process.exit(1);
      }

      let params: Record<string, string> = {};
      if (argv.params) {
        params = await readJsonArtifact<Record<string, string>>(argv.params);
      }

      const filledPlan = macroStore.applyParams(macro.plan, params);
      console.log(`\n🔄 Replaying macro: ${macro.name}`);
      console.log(`   Goal: ${macro.plan.goal}`);
      console.log(`   Steps: ${filledPlan.steps.length}\n`);

      // Run the filled plan directly
      const result = await runTask(macro.plan.goal, {
        headless: !argv.headful,
        outDir: argv.out,
      });
      console.log(`✅ Done: ${result.verdict.status}\n`);
    },
  )

  // ── list-macros ───────────────────────────────────────────────────────────
  .command(
    'list-macros',
    'List all stored macros',
    () => {},
    async () => {
      const macros = await macroStore.list();
      if (macros.length === 0) {
        console.log('No macros stored yet.');
        return;
      }
      console.log('\nStored macros:');
      for (const m of macros) {
        console.log(`  ${m.key.padEnd(40)} — ${m.name} (${m.hostname})`);
      }
      console.log();
    },
  )

  // ── extract ───────────────────────────────────────────────────────────────
  .command(
    'extract',
    'Extract structured data from a saved state.json',
    (y) => y
      .option('from', { type: 'string', demandOption: true, describe: 'Path to state.json' })
      .option('schema', { type: 'string', describe: 'Path to extraction schema JSON' }),
    async (argv) => {
      const state = await readJsonArtifact<CompactState>(argv.from);
      console.log('\nPage Summary:');
      console.log('  URL:', state.meta.url);
      console.log('  Title:', state.meta.title);
      console.log('  Headings:', state.pageSummary.headings.slice(0, 5).join(' | '));
      console.log('  Interactive elements:', state.interactive.length);
      console.log('\nFirst 10 elements:');
      for (const el of state.interactive.slice(0, 10)) {
        console.log(`  ${el.ref} [${el.role}] "${el.label}"`);
      }
      console.log();
    },
  )

  // ── doctor ────────────────────────────────────────────────────────────────
  .command(
    'doctor',
    'Check environment and Playwright installation',
    () => {},
    async () => {
      console.log('\n🩺 WebRunner Doctor\n');

      // Check Playwright
      try {
        const browser = await chromium.launch({ headless: true });
        await browser.close();
        console.log('  ✅ Playwright/Chromium installed and working');
      } catch (err) {
        console.log(`  ❌ Playwright/Chromium issue: ${err instanceof Error ? err.message : err}`);
        console.log('     Run: npx playwright install chromium');
      }

      // Check API key
      if (process.env['OPENROUTER_API_KEY']) {
        console.log('  ✅ OPENROUTER_API_KEY set');
      } else {
        console.log('  ⚠️  OPENROUTER_API_KEY not set — LLM calls will fail');
      }

      // Check Node version
      const major = parseInt(process.version.slice(1));
      if (major >= 18) {
        console.log(`  ✅ Node.js ${process.version}`);
      } else {
        console.log(`  ❌ Node.js ${process.version} — v18+ required`);
      }

      console.log();
    },
  )

  .demandCommand(1, 'Please specify a command')
  .help()
  .alias('h', 'help')
  .version('0.1.0')
  .parse();
