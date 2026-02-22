# WebRunner — Codebase Overview

## Project Summary
**WebRunner** is a Plan→Execute→Verify web browsing substrate for AI agents. It minimizes LLM round-trips and token burn by batching browser actions deterministically, using compact state representations (interactive elements only), and falling back to step-mode only when needed (CAPTCHAs, 2FA, unexpected modals).

## Tech Stack
- **Runtime**: Node.js + TypeScript
- **Browser automation**: Playwright
- **CLI**: Yargs
- **Schema validation**: AJV
- **Logging**: Pino
- **LLM**: OpenRouter (via openai SDK)
- **Testing**: Vitest + Playwright Test
- **MCP**: `@modelcontextprotocol/sdk` (optional)

## Architecture
```
Observe (compact state) → Plan (LLM) → Execute (deterministic) → Verify (LLM)
                                                                    ↓
                                                        patch → re-execute → re-verify
                                                        escalate → step-mode / human
```

## Repository Structure
```
WebRunner/
├── src/
│   ├── cli/webrunner.ts          # CLI entry point
│   ├── core/
│   │   ├── index.ts              # Main runTask loop
│   │   ├── config.ts             # Configuration defaults
│   │   ├── errors.ts             # Typed error classes
│   │   ├── logger.ts             # Structured logging
│   │   ├── artifacts/            # File I/O, redaction, paths
│   │   ├── browser/              # Playwright wrapper, selectors, waits
│   │   ├── state/                # Compact state collector, diff engine
│   │   ├── planning/             # LLM adapter, prompts, schemas, validation
│   │   ├── execute/              # Deterministic executor, assertions, recovery
│   │   └── cache/                # Macro & selector caching
│   └── mcp/                      # Optional MCP server
├── tests/unit/                   # Unit tests
├── tests/e2e/                    # End-to-end tests
├── examples/tasks/               # Example task JSONs
└── scripts/bench.ts              # Benchmark runner
```

## Key Concepts
- **CompactState**: Only interactive elements + page summary; no full DOM
- **Ref IDs**: Stable element references (E1, E2...) used in plans
- **Artifacts**: All heavyweight data stays on disk; LLM sees paths only
- **Macros**: Cached reusable plans with parameterized values
- **Selector self-heal**: Fallback selector sets with cache rotation

## Current Status
- **Phase**: COMPLETE — all 11 phases implemented
- **Version**: 0.1.0
- **TypeScript**: 0 errors (`npx tsc --noEmit` clean)
- **Tests**: 25/25 unit tests passing
- **Next steps**: Set `OPENROUTER_API_KEY`, run `npx playwright install chromium`, then `npx tsx src/cli/webrunner.ts doctor`
