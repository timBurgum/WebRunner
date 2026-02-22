export type WebRunnerErrorCode =
  | 'CAPTCHA_DETECTED'
  | 'TWO_FA_DETECTED'
  | 'LOGIN_FAILED'
  | 'ELEMENT_MISSING'
  | 'NAVIGATION_FAILED'
  | 'ASSERTION_FAILED'
  | 'TIMEOUT'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'LLM_ERROR'
  | 'DOWNLOAD_FAILED'
  | 'UNKNOWN';

export class WebRunnerError extends Error {
  constructor(
    public readonly code: WebRunnerErrorCode,
    message: string,
    public readonly recoverable: boolean = false,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'WebRunnerError';
  }
}

export class CaptchaDetected extends WebRunnerError {
  constructor(message = 'CAPTCHA detected, human intervention required') {
    super('CAPTCHA_DETECTED', message, false);
    this.name = 'CaptchaDetected';
  }
}

export class TwoFADetected extends WebRunnerError {
  constructor(message = '2FA prompt detected, human intervention required') {
    super('TWO_FA_DETECTED', message, false);
    this.name = 'TwoFADetected';
  }
}

export class LoginFailed extends WebRunnerError {
  constructor(message = 'Login failed or credentials rejected') {
    super('LOGIN_FAILED', message, false);
    this.name = 'LoginFailed';
  }
}

export class ElementMissing extends WebRunnerError {
  constructor(ref: string, details?: unknown) {
    super('ELEMENT_MISSING', `Element ref ${ref} not found in DOM`, true, details);
    this.name = 'ElementMissing';
  }
}

export class NavigationFailed extends WebRunnerError {
  constructor(url: string, details?: unknown) {
    super('NAVIGATION_FAILED', `Navigation to ${url} failed`, true, details);
    this.name = 'NavigationFailed';
  }
}

export class AssertionFailed extends WebRunnerError {
  constructor(kind: string, expected: string, details?: unknown) {
    super('ASSERTION_FAILED', `Assertion ${kind} failed: expected ${expected}`, true, details);
    this.name = 'AssertionFailed';
  }
}

export class TimeoutError extends WebRunnerError {
  constructor(operation: string, timeoutMs: number) {
    super('TIMEOUT', `Operation "${operation}" timed out after ${timeoutMs}ms`, true);
    this.name = 'TimeoutError';
  }
}

export class SchemaValidationError extends WebRunnerError {
  constructor(schema: string, errors: unknown) {
    super('SCHEMA_VALIDATION_FAILED', `Schema validation failed for ${schema}`, false, errors);
    this.name = 'SchemaValidationError';
  }
}

export class LLMError extends WebRunnerError {
  constructor(message: string, details?: unknown) {
    super('LLM_ERROR', `LLM call failed: ${message}`, true, details);
    this.name = 'LLMError';
  }
}

export function isEscalatable(err: unknown): boolean {
  if (err instanceof WebRunnerError) {
    return ['CAPTCHA_DETECTED', 'TWO_FA_DETECTED', 'LOGIN_FAILED'].includes(err.code);
  }
  return false;
}
