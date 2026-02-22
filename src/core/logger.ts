import pino from 'pino';

export type Logger = pino.Logger;

export function createLogger(runId: string, level: pino.LevelWithSilent = 'info'): Logger {
  return pino({
    level,
    base: { runId },
    redact: {
      paths: ['*.password', '*.passwd', '*.token', '*.secret', '*.apiKey', '*.api_key', '*.otp'],
      censor: '[REDACTED]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export const rootLogger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  redact: {
    paths: ['*.password', '*.passwd', '*.token', '*.secret', '*.apiKey'],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
