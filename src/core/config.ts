export interface WebRunnerConfig {
  /** Global timeout for an entire run in ms. Default: 180000 */
  globalTimeoutMs: number;
  /** Per-step timeout in ms. Default: 30000 */
  stepTimeoutMs: number;
  /** Navigation timeout in ms. Default: 60000 */
  navigationTimeoutMs: number;
  /** Run browser in headless mode. Default: true */
  headless: boolean;
  /** Output directory for artifacts. Default: './out' */
  outDir: string;
  /** LLM model to use via OpenRouter. Default: 'google/gemini-2.0-flash-001' */
  model: string;
  /** Allow saving screenshots. Default: true */
  allowScreenshots: boolean;
  /** Allow saving playwright traces. Default: false */
  allowTracing: boolean;
  /** Field name patterns to redact in logs. */
  redactPatterns: RegExp[];
  /** Max patch rounds before escalating. Default: 2 */
  maxPatchRounds: number;
  /** OpenRouter API key. Falls back to OPENROUTER_API_KEY env var. */
  openRouterApiKey?: string;
  /** Optional download directory (defaults to <outDir>/run-x/downloads) */
  downloadDir?: string;
}

export const defaultConfig: WebRunnerConfig = {
  globalTimeoutMs: 180_000,
  stepTimeoutMs: 30_000,
  navigationTimeoutMs: 60_000,
  headless: true,
  outDir: './out',
  model: 'google/gemini-2.0-flash-001',
  allowScreenshots: true,
  allowTracing: false,
  redactPatterns: [
    /password/i,
    /passwd/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /otp/i,
    /auth/i,
    /credential/i,
  ],
  maxPatchRounds: 2,
};

export function mergeConfig(overrides: Partial<WebRunnerConfig>): WebRunnerConfig {
  return { ...defaultConfig, ...overrides };
}
