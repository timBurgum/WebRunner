# WebRunner — Do / Doing / Done Tracker

## ✅ Done
- [2026-02-22] Read and analysed `WebRunner_Implementation_Plan_v1.1.docx`
- [2026-02-22] Created Gemini 3.1 Pro execution plan (`implementation_plan.md`)
- [2026-02-22] **Phase 0**: Scaffolded project — `package.json`, `tsconfig.json`, `config.ts`, `errors.ts`, `logger.ts`
- [2026-02-22] **Phase 1**: Artifacts module — `paths.ts`, `redact.ts`, `write.ts`
- [2026-02-22] **Phase 2**: Browser controller — `controller.ts`, `selectors.ts`, `waits.ts`
- [2026-02-22] **Phase 3**: Compact state & diff — `model.ts`, `collect.ts`, `summarize.ts`, `diff.ts`
- [2026-02-22] **Phase 4**: Planning & LLM — `schemas.ts`, `validate.ts`, `llm.ts`, `prompts.ts`
- [2026-02-22] **Phase 5**: Execution engine — `executor.ts`, `assertions.ts`, `recovery.ts`
- [2026-02-22] **Phase 6**: Core loop — `src/core/index.ts` (runTask with observe→plan→execute→verify→patch)
- [2026-02-22] **Phase 7**: CLI — `src/cli/webrunner.ts` (run, replay, list-macros, extract, doctor)
- [2026-02-22] **Phase 8**: Cache — `keys.ts`, `macroStore.ts`, `selectorStore.ts`
- [2026-02-22] **Phase 9**: MCP server — `src/mcp/server.ts`, `src/mcp/tools.ts`
- [2026-02-22] **Phase 10**: Unit tests — 25/25 passing (artifacts, diff, schemas)
- [2026-02-22] **Phase 11**: README, .gitignore, .env.example
- [2026-02-22] TypeScript compilation: **0 errors**

## 🔄 Doing
- Nothing active

## 📋 To Do
- Set `OPENROUTER_API_KEY` in `.env` before running live tasks
- Run `npx playwright install chromium` once after cloning
- Add e2e tests (`tests/e2e/`) for form-fill, login, download flows
- Add `scripts/bench.ts` benchmark runner
- Add `.github/workflows/ci.yml` and `release.yml`
- Consider publishing to npm as `@webrunner/core` post-v0.2
