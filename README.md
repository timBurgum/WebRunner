# WebRunner

> Plan→Execute→Verify web browsing substrate for agents.
> Minimizes LLM round-trips. Filesystem-first. MCP-ready.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## How it works

```
Observe (compact state) → Plan (LLM, 1 call) → Execute (deterministic, no LLM)
                                                         ↓
                                       Verify (LLM, 1 call) → success ✅
                                                             → patch → re-execute → re-verify
                                                             → escalate → human intervention
```

**Typical task: 2–3 LLM calls.** No LLM in the execution loop.

---

## Quickstart

```bash
# 1. Install dependencies
npm install
npx playwright install chromium

# 2. Set your OpenRouter API key
echo "OPENROUTER_API_KEY=your_key_here" > .env

# 3. Run a task
npx tsx src/cli/webrunner.ts run \
  --task "Go to example.com and extract the page title" \
  --out ./out

# 4. Check results
cat out/run-*/result/verdict.json
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `webrunner run --task "..."` | Run a task end-to-end |
| `webrunner replay --macro <key>` | Replay a cached macro |
| `webrunner list-macros` | List all stored macros |
| `webrunner extract --from state.json` | Inspect a state file |
| `webrunner doctor` | Check environment health |

### `run` options

```
--task, -t       Task description (required)
--start-url, -u  Starting URL
--headful        Show browser window (for CAPTCHA/2FA)
--out, -o        Output directory (default: ./out)
--model, -m      LLM model via OpenRouter
--screenshots    Save screenshots (default: true)
--trace          Save Playwright trace
```

---

## Artifact layout

```
out/run-YYYYMMDD-HHMMSS-<id>/
  state/
    initial.json        ← compact state before execution
    final.json          ← compact state after execution
    diff.json           ← what changed
  plans/
    plan.json           ← generated plan
    patch-1.json        ← patch plan (if needed)
  logs/
    runlog.json         ← per-step execution log
  result/
    verdict.json        ← success | patch | escalate
    data.json           ← extracted structured data (if any)
  media/
    screenshot-initial.png
    screenshot-final.png
  downloads/            ← quarantined downloads
```

---

## MCP Server

WebRunner exposes 6 tools via Model Context Protocol:

| Tool | Description |
|------|-------------|
| `run_task` | Full Plan→Execute→Verify (primary tool) |
| `observe_compact` | Navigate and capture compact state |
| `plan` | Generate a plan from a state file |
| `execute` | Execute a plan file |
| `verify` | Verify task completion |
| `replay` | Replay a stored macro |

All tools return **file paths + compact summaries** — never full DOM blobs.

To use as MCP server, add to your MCP config:
```json
{
  "mcpServers": {
    "webrunner": {
      "command": "node",
      "args": ["path/to/webrunner/dist/mcp/server.js"]
    }
  }
}
```

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | Required — your OpenRouter API key |
| `LOG_LEVEL` | Logging level: debug/info/warn/error (default: info) |

---

## Architecture

```
src/
  cli/webrunner.ts          ← CLI entry point (yargs)
  core/
    index.ts                ← runTask() — main loop
    config.ts               ← WebRunnerConfig + defaults
    errors.ts               ← Typed error classes
    logger.ts               ← Pino structured logging
    artifacts/              ← paths, atomic writes, redaction
    browser/                ← Playwright controller, selectors, waits
    state/                  ← compact state collector, diff engine
    planning/               ← LLM adapter, prompts, schemas, validation
    execute/                ← deterministic executor, assertions, recovery
    cache/                  ← macro store, selector store
  mcp/                      ← MCP server + tool definitions
tests/
  unit/                     ← vitest unit tests
  e2e/                      ← end-to-end tests
examples/tasks/             ← example task JSONs
```

---

## Development

```bash
npm run typecheck    # TypeScript type checking
npm test             # All unit tests
npm run build        # Compile to dist/
npm run lint         # ESLint
```

---

## Security

- Secrets are **never logged** (passwords, tokens, OTPs are redacted)
- Full page HTML is **never written to disk** unless debug mode
- Downloads are **quarantined** per run, not auto-opened
- Screenshots may contain PII — review before sharing

See [SECURITY.md](SECURITY.md) for the responsible disclosure policy.

---

## License

MIT © WebRunner Contributors
