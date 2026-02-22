import OpenAI from 'openai';
import type { Logger } from '../logger.js';
import type { WebRunnerConfig } from '../config.js';
import { LLMError } from '../errors.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  retries?: number;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  usage: LLMUsage;
  model: string;
}

export class LLMClient {
  private readonly client: OpenAI;
  private readonly model: string;
  private totalTokensUsed = 0;
  private totalCalls = 0;

  constructor(
    private readonly config: WebRunnerConfig,
    private readonly logger: Logger,
  ) {
    const apiKey = config.openRouterApiKey ?? process.env['OPENROUTER_API_KEY'] ?? '';
    if (!apiKey) {
      logger.warn('OPENROUTER_API_KEY not set — LLM calls will fail');
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/webrunner-core',
        'X-Title': 'WebRunner',
      },
    });
    this.model = config.model;
  }

  async call(messages: LLMMessage[], opts: LLMOptions = {}): Promise<LLMResponse> {
    const {
      maxTokens = 4096,
      temperature = 0,
      retries = 3,
    } = opts;

    let lastErr: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.logger.info({ model: this.model, attempt, messageCount: messages.length }, 'Calling LLM');

        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          max_tokens: maxTokens,
          temperature,
        });

        const content = response.choices[0]?.message?.content ?? '';
        const usage: LLMUsage = {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        };

        this.totalTokensUsed += usage.totalTokens;
        this.totalCalls += 1;

        this.logger.info({
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalCallsThisRun: this.totalCalls,
          totalTokensThisRun: this.totalTokensUsed,
        }, 'LLM call complete');

        return { content, usage, model: this.model };
      } catch (err) {
        lastErr = err;
        this.logger.warn({ attempt, err }, 'LLM call failed, retrying...');
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    throw new LLMError(`Failed after ${retries} attempts`, lastErr);
  }

  getStats() {
    return { totalCalls: this.totalCalls, totalTokensUsed: this.totalTokensUsed };
  }
}
